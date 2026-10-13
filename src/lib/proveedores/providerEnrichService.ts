import { Proveedor } from "@/types/proveedor";
import { saveProveedorToMongo } from "@/lib/serverSync";

export interface EnrichResult {
  success: boolean;
  proveedor: Proveedor;
  savedInDb: boolean;
  newEmailsFound: number;
  error?: string;
}

export interface EnrichProgressEvent {
  completed: number;
  total: number;
  currentProv: Proveedor;
  enrichedProv?: Proveedor;
  status: "searching" | "synthesizing" | "completed" | "error";
  message: string;
  error?: string;
}

const API_ENDPOINT = process.env.NEXT_PUBLIC_PROVEEDORES_API_BASE || "https://apivacas.jariel.com.ar/api/proveedores";

/**
 * Enriquece un proveedor individual mediante IA y rastreo web
 */
export async function enrichSingleProveedor(
  proveedor: Proveedor,
  options: { autoSave?: boolean; geminiApiKey?: string } = {}
): Promise<EnrichResult> {
  const { autoSave = false, geminiApiKey } = options;

  try {
    const payload = {
      proveedor,
      autoSave,
      geminiApiKey: geminiApiKey || undefined,
    };

    // 1. Intento primario al backend central apivacas
    let res = await fetch(`${API_ENDPOINT}/enrich-single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    // 2. Fallback a ruta local de Next.js
    if (!res || !res.ok) {
      res = await fetch("/api/proveedores/enrich-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);
    }

    if (!res || !res.ok) {
      const errData = res ? await res.json().catch(() => ({})) : {};
      throw new Error(errData.error || `Error ${res?.status || 500} al conectar con el servicio de IA`);
    }

    const data = await res.json();
    return {
      success: true,
      proveedor: data.proveedor,
      savedInDb: Boolean(data.savedInDb),
      newEmailsFound: Number(data.newEmailsFound) || 0,
    };
  } catch (error: any) {
    console.error(`Error enriqueciendo "${proveedor.nombre}":`, error);
    return {
      success: false,
      proveedor,
      savedInDb: false,
      newEmailsFound: 0,
      error: error.message || "Error desconocido en el enriquecimiento",
    };
  }
}

/**
 * Enriquece un lote de proveedores uno a uno notificando el progreso en vivo
 */
export async function enrichMultipleProveedores(
  proveedores: Proveedor[],
  options: { autoSave?: boolean; geminiApiKey?: string } = {},
  onProgress?: (event: EnrichProgressEvent) => void
): Promise<{
  enrichedList: Proveedor[];
  savedCount: number;
  errorsCount: number;
}> {
  const enrichedList: Proveedor[] = [];
  let savedCount = 0;
  let errorsCount = 0;
  const total = proveedores.length;

  for (let i = 0; i < total; i++) {
    const current = proveedores[i];

    if (onProgress) {
      onProgress({
        completed: i,
        total,
        currentProv: current,
        status: "searching",
        message: `Buscando en la web y canales de contacto para "${current.nombre}"...`,
      });
    }

    const result = await enrichSingleProveedor(current, options);

    if (result.success && result.proveedor) {
      enrichedList.push(result.proveedor);
      if (result.savedInDb) savedCount++;

      if (onProgress) {
        onProgress({
          completed: i + 1,
          total,
          currentProv: current,
          enrichedProv: result.proveedor,
          status: "completed",
          message: `Ficha de "${current.nombre}" completada (+${result.newEmailsFound} correos).`,
        });
      }
    } else {
      errorsCount++;
      enrichedList.push(current);

      if (onProgress) {
        onProgress({
          completed: i + 1,
          total,
          currentProv: current,
          status: "error",
          message: `No se pudo enriquecer "${current.nombre}": ${result.error}`,
          error: result.error,
        });
      }
    }
  }

  return {
    enrichedList,
    savedCount,
    errorsCount,
  };
}

/**
 * Guarda en MongoDB y en caché local un conjunto de proveedores enriquecidos
 */
export async function bulkSaveEnrichedProveedores(
  proveedores: Proveedor[]
): Promise<{ savedCount: number; errorsCount: number }> {
  let savedCount = 0;
  let errorsCount = 0;

  for (const prov of proveedores) {
    try {
      const savedDoc = await saveProveedorToMongo({
        ...prov,
        guardado: true,
      });
      if (savedDoc) {
        savedCount++;
      } else {
        errorsCount++;
      }
    } catch (e) {
      console.warn(`Error al guardar proveedor ${prov.nombre}:`, e);
      errorsCount++;
    }
  }

  // Actualizar caché unificada local
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("finanzas_proveedores_unified_cache");
      let list: Proveedor[] = cached ? JSON.parse(cached) : [];
      if (!Array.isArray(list)) list = [];

      proveedores.forEach((p) => {
        const idx = list.findIndex(
          (item) =>
            item.id === p.id ||
            item._id === p._id ||
            item.nombre.toLowerCase().trim() === p.nombre.toLowerCase().trim()
        );
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...p, guardado: true };
        } else {
          list.unshift({ ...p, guardado: true });
        }
      });

      localStorage.setItem("finanzas_proveedores_unified_cache", JSON.stringify(list));
    } catch {}
  }

  return { savedCount, errorsCount };
}
