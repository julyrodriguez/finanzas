/**
 * serverSync.ts
 * Integración con el backend local (MongoDB) en https://apivacas.jariel.com.ar/api/ordenes
 * 
 * Permite doble escritura (dual-write) asíncrona no bloqueante:
 * Si el servidor está apagado o hay un problema de red, nunca interrumpe
 * la operación del usuario en el navegador ni en Firebase.
 */

import { OrdenCompra } from "@/types/ordenes";

const API_BASE_URL = "https://apivacas.jariel.com.ar/api/ordenes";

export interface MongoQueryParams {
  empresa?: "Hoyts" | "CMK";
  creadoPor?: string;
  anio?: number | string;
  year?: number | string;
  search?: string;
  numsOC?: string[] | string;
  estado?: string;
  limit?: number;
  page?: number;
  sort?: string;
}

/**
 * Guarda o actualiza una orden de compra en MongoDB de manera asíncrona.
 */
export async function syncOrderToMongo(orderData: Partial<OrdenCompra> & { id?: string; firebaseId?: string; fechaOC?: string | Date }): Promise<void> {
  try {
    const firebaseId = orderData.id || orderData.firebaseId;
    if (!firebaseId) return;

    let fechaOC: string | undefined = undefined;
    if (orderData.fechaOC) {
      fechaOC = typeof orderData.fechaOC === "string" ? orderData.fechaOC : orderData.fechaOC.toISOString();
    } else if (orderData.createdAt) {
      const ca = orderData.createdAt as any;
      if (typeof ca === "object" && typeof ca?.toDate === "function") {
        fechaOC = ca.toDate().toISOString();
      } else if (typeof ca === "object" && typeof ca?.seconds === "number") {
        fechaOC = new Date(ca.seconds * 1000).toISOString();
      } else if (ca instanceof Date) {
        fechaOC = ca.toISOString();
      }
    }

    if (!fechaOC) {
      fechaOC = new Date().toISOString();
    }

    const payload = {
      ...orderData,
      firebaseId,
      fechaOC,
    };

    // Petición no bloqueante en segundo plano
    fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn("⚠️ [Mongo Sync] Aviso en segundo plano:", err.message || err);
    });
  } catch (err) {
    console.warn("⚠️ [Mongo Sync] Error iniciando sincronización:", err);
  }
}

/**
 * Elimina una orden de compra en MongoDB cuando se borra en Firebase.
 */
export async function deleteOrderFromMongo(orderId?: string): Promise<void> {
  try {
    if (!orderId) return;

    fetch(`${API_BASE_URL}/${orderId}`, {
      method: "DELETE",
    }).catch((err) => {
      console.warn("⚠️ [Mongo Delete] Aviso en segundo plano:", err.message || err);
    });
  } catch (err) {
    console.warn("⚠️ [Mongo Delete] Error iniciando eliminación:", err);
  }
}

/**
 * Sincronización masiva (bulk) de múltiples órdenes hacia MongoDB.
 */
export async function bulkSyncOrdersToMongo(orders: (Partial<OrdenCompra> & { id?: string; firebaseId?: string })[]): Promise<any> {
  try {
    if (!orders || orders.length === 0) return null;

    const formatted = orders.map((o) => ({
      ...o,
      firebaseId: o.id || o.firebaseId,
    }));

    const res = await fetch(`${API_BASE_URL}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenes: formatted }),
    });
    if (!res.ok) {
      console.warn("⚠️ [Mongo Bulk Sync] Error status:", res.status);
    }
    return await res.json().catch(() => null);
  } catch (err: any) {
    console.warn("⚠️ [Mongo Bulk Sync] Error:", err?.message || err);
    return null;
  }
}

/**
 * Endpoint preparado para consultar órdenes directamente desde MongoDB en el servidor.
 * (Disponible para su uso cuando se decida consultar desde MongoDB en vez de Firebase).
 */
export async function fetchOrdersFromMongo(params: MongoQueryParams = {}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.empresa) searchParams.set("empresa", params.empresa);
    if (params.creadoPor && params.creadoPor !== "todos") searchParams.set("creadoPor", params.creadoPor);
    if (params.anio || params.year) searchParams.set("anio", String(params.anio || params.year));
    if (params.search) searchParams.set("search", params.search);
    if (params.numsOC) {
      const val = Array.isArray(params.numsOC) ? params.numsOC.join(",") : params.numsOC;
      searchParams.set("numsOC", val);
    }
    if (params.estado) searchParams.set("estado", params.estado);
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.sort) searchParams.set("sort", params.sort);

    const queryString = searchParams.toString();
    const url = queryString ? `${API_BASE_URL}?${queryString}` : API_BASE_URL;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ Error al consultar órdenes desde MongoDB:", err);
    throw err;
  }
}

/**
 * Convierte un documento de orden devuelto por MongoDB en una instancia de OrdenCompra.
 */
export function parseMongoDocToOrdenCompra(docItem: any): OrdenCompra {
  if (!docItem) {
    return {
      empresa: "Hoyts",
      numSolicitud: "",
      numOC: "",
      razonSocial: "",
      monto: 0,
      motivo: "",
      formaPago: "30DFF",
      liberada: false,
      mandada: false,
    };
  }

  let createdAtObj: any = null;
  const rawDate = docItem.fechaOC || docItem.createdAtFirebase || docItem.createdAt;
  if (rawDate) {
    const d = new Date(rawDate);
    const secs = Math.floor(d.getTime() / 1000);
    createdAtObj = {
      seconds: isNaN(secs) ? 0 : secs,
      nanoseconds: 0,
      toDate: () => d,
    };
  }

  const raw = docItem.raw || {};

  return {
    id: String(docItem.firebaseId || docItem._id || raw.id || ""),
    empresa: (docItem.empresa || raw.empresa || "Hoyts") as "Hoyts" | "CMK",
    numSolicitud: String(docItem.numSolicitud ?? raw.numSolicitud ?? ""),
    numOC: String(docItem.numOC ?? raw.numOC ?? ""),
    razonSocial: String(docItem.razonSocial || raw.razonSocial || ""),
    monto: docItem.monto ?? raw.monto ?? 0,
    motivo: String(docItem.motivo || raw.motivo || ""),
    formaPago: String(docItem.formaPago || raw.formaPago || "30DFF"),
    liberada: Boolean(docItem.liberada ?? raw.liberada),
    mandada: Boolean(docItem.mandada ?? raw.mandada),
    entregada: Boolean(docItem.entregada ?? raw.entregada),
    cancelada: Boolean(docItem.cancelada ?? raw.cancelada),
    creadoPor: String(docItem.creadoPor || raw.creadoPor || "Usuario"),
    notas: Array.isArray(docItem.notas)
      ? docItem.notas
      : Array.isArray(raw.notas)
      ? raw.notas
      : [],
    createdAt:
      createdAtObj ||
      (raw.createdAt
        ? {
            seconds: raw.createdAt.seconds || 0,
            nanoseconds: raw.createdAt.nanoseconds || 0,
            toDate: () => new Date((raw.createdAt.seconds || 0) * 1000),
          }
        : null),
    relatedOC: String(docItem.relatedOC || raw.relatedOC || ""),
    enviado: Boolean(docItem.enviado ?? raw.enviado),
    enviadoA1: String(docItem.enviadoA1 || raw.enviadoA1 || ""),
    enviadoA2: String(docItem.enviadoA2 || raw.enviadoA2 || ""),
    fechaEnvio1: String(docItem.fechaEnvio1 || raw.fechaEnvio1 || ""),
    fechaEnvio2: String(docItem.fechaEnvio2 || raw.fechaEnvio2 || ""),
    firmado1: Boolean(docItem.firmado1 ?? raw.firmado1),
    firmado2: Boolean(docItem.firmado2 ?? raw.firmado2),
    firmante1: String(docItem.firmante1 || raw.firmante1 || ""),
    firmante2: String(docItem.firmante2 || raw.firmante2 || ""),
    fechaFirma1: String(docItem.fechaFirma1 || raw.fechaFirma1 || ""),
    fechaFirma2: String(docItem.fechaFirma2 || raw.fechaFirma2 || ""),
    linkSharepoint: String(docItem.linkSharepoint || raw.linkSharepoint || ""),
  };
}

export interface CapexBudget {
  _id?: string;
  anio: number;
  hoytsBudget: number;
  cmkBudget: number;
  observaciones?: string;
  updatedAt?: string;
}

export interface CapexGastoDirecto {
  _id: string;
  anio: number;
  fecha: string;
  empresa: "Hoyts" | "CMK";
  empresaDestino?: "Hoyts" | "CMK" | "";
  tipo?: "GASTO" | "REASIGNACION" | "EXTRA_CAPEX";
  monto: number;
  concepto: string;
  proveedor?: string;
  comprobante?: string;
  observaciones?: string;
  creadoPor?: string;
  createdAt?: string;
}

/**
 * Consulta los presupuestos CAPEX anuales por compañía.
 */
export async function fetchCapexBudgets(anio?: number | string): Promise<CapexBudget[]> {
  try {
    const q = anio && anio !== "Todos" ? `?anio=${anio}` : "";
    const res = await fetch(`${API_BASE_URL}/capex-budget${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.success && Array.isArray(data.budgets) ? data.budgets : [];
  } catch (err) {
    console.warn("Error consultando presupuestos CAPEX:", err);
    return [];
  }
}

/**
 * Guarda o actualiza el presupuesto anual de una compañía en MongoDB.
 */
export async function saveCapexBudget(payload: {
  anio: number;
  hoytsBudget?: number;
  cmkBudget?: number;
  observaciones?: string;
}): Promise<CapexBudget> {
  const res = await fetch(`${API_BASE_URL}/capex-budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.budget;
}

/**
 * Consulta los gastos CAPEX directos sin orden de compra.
 */
export async function fetchCapexGastosDirectos(params: { anio?: number | string; empresa?: string } = {}): Promise<CapexGastoDirecto[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params.anio && params.anio !== "Todos") searchParams.set("anio", String(params.anio));
    if (params.empresa && params.empresa !== "Todas") searchParams.set("empresa", params.empresa);
    const q = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/capex-gastos-directos${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.success && Array.isArray(data.gastos) ? data.gastos : [];
  } catch (err) {
    console.warn("Error consultando gastos CAPEX directos:", err);
    return [];
  }
}

/**
 * Registra un nuevo gasto CAPEX sin orden de compra o movimiento corporativo.
 */
export async function createCapexGastoDirecto(payload: {
  anio: number;
  fecha?: string | Date;
  empresa: "Hoyts" | "CMK";
  empresaDestino?: "Hoyts" | "CMK" | "";
  tipo?: "GASTO" | "REASIGNACION" | "EXTRA_CAPEX";
  monto: number;
  concepto: string;
  proveedor?: string;
  comprobante?: string;
  observaciones?: string;
  creadoPor?: string;
}): Promise<CapexGastoDirecto> {
  const res = await fetch(`${API_BASE_URL}/capex-gastos-directos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.gasto;
}

/**
 * Elimina un gasto CAPEX sin orden de compra por su ID.
 */
export async function deleteCapexGastoDirecto(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/capex-gastos-directos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return true;
}

/**
 * Consulta el resumen estadístico exacto de estados de órdenes desde el servidor MongoDB.
 */
export async function fetchOrdersStatsFromMongo(): Promise<{
  total: number;
  pendiente: number;
  mandada: number;
  liberada: number;
  entregada: number;
  cancelada: number;
} | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/stats/summary`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.success && json.summary) {
      return {
        total: Number(json.summary.totalOrdenes) || 0,
        pendiente: Number(json.summary.pendientes) || 0,
        mandada: Number(json.summary.mandadas) || 0,
        liberada: Number(json.summary.liberadas) || 0,
        entregada: Number(json.summary.entregadas) || 0,
        cancelada: Number(json.summary.canceladas) || 0,
      };
    }
  } catch (err) {
    console.warn("⚠️ [Mongo Stats] Error consultando stats:", err);
  }
  return null;
}
