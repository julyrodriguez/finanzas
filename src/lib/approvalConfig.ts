export interface ApprovalConfig {
  // Límites de corte
  limiteNivel1: number; // default: 5_000_000 (Tomás + Área)
  limiteNivel2: number; // default: 18_000_000 (Pablo Mondelo + Darío)
  limiteNivel3: number; // default: 150_000_000 (Matías/Hernán + Darío)
  
  // Nivel 1 (Hasta 5M)
  firmantes1Nivel1: string[]; // ["Tomas"]
  firmantes2Nivel1: string[]; // ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"]
  
  // Nivel 2 (5M a 18M)
  firmantes1Nivel2: string[]; // ["Pablo Mondelo"]
  firmantes2Nivel2: string[]; // ["Dario"]

  // Nivel 3 (18M a 150M)
  firmantes1Nivel3: string[]; // ["Matias", "Hernan"]
  firmantes2Nivel3: string[]; // ["Dario"]

  // Nivel 4 (> 150M)
  firmantes1Nivel4: string[]; // ["Dario", "Hernan"]
  firmantes2Nivel4: string[]; // ["Martin"]

  // Backward compatibility
  firmanteBaseNivel1?: string;
  firmantesAreaNivel1?: string[];
  firmante1Nivel2?: string;
  firmante2Nivel2?: string;
  firmante2Nivel3?: string;
  firmante2Nivel4?: string;
  limiteTomas?: number;
  limiteMondelo?: number;
  limiteDario?: number;
  limitesIndividuales?: Record<string, number>;
}

export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  limiteNivel1: 5000000,
  limiteNivel2: 18000000,
  limiteNivel3: 150000000,
  
  firmantes1Nivel1: ["Tomas"],
  firmantes2Nivel1: ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"],
  
  firmantes1Nivel2: ["Pablo Mondelo"],
  firmantes2Nivel2: ["Dario"],

  firmantes1Nivel3: ["Matias", "Hernan"],
  firmantes2Nivel3: ["Dario"],

  firmantes1Nivel4: ["Dario", "Hernan"],
  firmantes2Nivel4: ["Martin"],

  firmanteBaseNivel1: "Tomas",
  firmantesAreaNivel1: ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"],
  firmante1Nivel2: "Pablo Mondelo",
  firmante2Nivel2: "Dario",
  firmante2Nivel3: "Dario",
  firmante2Nivel4: "Martin",
  limiteTomas: 5000000,
  limiteMondelo: 18000000,
  limiteDario: 18000000,
  limitesIndividuales: {},
};

const STORAGE_KEY = "finanzas_approval_config_v4";
export const APPROVAL_CONFIG_API_URL = "https://apivacas.jariel.com.ar/api/ordenes/approval-config";

export function getStoredApprovalConfig(): ApprovalConfig {
  if (typeof window === "undefined") return DEFAULT_APPROVAL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Intentar cargar en segundo plano desde el servidor
      fetchApprovalConfigFromServer().catch(() => null);
      return DEFAULT_APPROVAL_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APPROVAL_CONFIG,
      ...parsed,
      limiteNivel1: Number(parsed.limiteNivel1) || DEFAULT_APPROVAL_CONFIG.limiteNivel1,
      limiteNivel2: Number(parsed.limiteNivel2) || DEFAULT_APPROVAL_CONFIG.limiteNivel2,
      limiteNivel3: Number(parsed.limiteNivel3) || DEFAULT_APPROVAL_CONFIG.limiteNivel3,
      firmantes1Nivel1: Array.isArray(parsed.firmantes1Nivel1)
        ? parsed.firmantes1Nivel1 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel1,
      firmantes2Nivel1: Array.isArray(parsed.firmantes2Nivel1)
        ? parsed.firmantes2Nivel1 : (Array.isArray(parsed.firmantesAreaNivel1) ? parsed.firmantesAreaNivel1 : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel1),
      firmantes1Nivel2: Array.isArray(parsed.firmantes1Nivel2)
        ? parsed.firmantes1Nivel2 : (parsed.firmante1Nivel2 ? [parsed.firmante1Nivel2] : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel2),
      firmantes2Nivel2: Array.isArray(parsed.firmantes2Nivel2)
        ? parsed.firmantes2Nivel2 : (parsed.firmante2Nivel2 ? [parsed.firmante2Nivel2] : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel2),
      firmantes1Nivel3: Array.isArray(parsed.firmantes1Nivel3)
        ? parsed.firmantes1Nivel3 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel3,
      firmantes2Nivel3: Array.isArray(parsed.firmantes2Nivel3)
        ? parsed.firmantes2Nivel3 : (parsed.firmante2Nivel3 ? [parsed.firmante2Nivel3] : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel3),
      firmantes1Nivel4: Array.isArray(parsed.firmantes1Nivel4)
        ? parsed.firmantes1Nivel4 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel4,
      firmantes2Nivel4: Array.isArray(parsed.firmantes2Nivel4)
        ? parsed.firmantes2Nivel4 : (parsed.firmante2Nivel4 ? [parsed.firmante2Nivel4] : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel4),
    };
  } catch {
    return DEFAULT_APPROVAL_CONFIG;
  }
}

/**
 * Consulta la configuración de aprobaciones directamente desde el servidor local MongoDB.
 */
export async function fetchApprovalConfigFromServer(): Promise<ApprovalConfig> {
  try {
    const res = await fetch(`${APPROVAL_CONFIG_API_URL}?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.success && data.config) {
      const cfg: ApprovalConfig = {
        ...DEFAULT_APPROVAL_CONFIG,
        ...data.config,
        limiteNivel1: Number(data.config.limiteNivel1) || DEFAULT_APPROVAL_CONFIG.limiteNivel1,
        limiteNivel2: Number(data.config.limiteNivel2) || DEFAULT_APPROVAL_CONFIG.limiteNivel2,
        limiteNivel3: Number(data.config.limiteNivel3) || DEFAULT_APPROVAL_CONFIG.limiteNivel3,
        firmantes1Nivel1: Array.isArray(data.config.firmantes1Nivel1)
          ? data.config.firmantes1Nivel1 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel1,
        firmantes2Nivel1: Array.isArray(data.config.firmantes2Nivel1)
          ? data.config.firmantes2Nivel1 : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel1,
        firmantes1Nivel2: Array.isArray(data.config.firmantes1Nivel2)
          ? data.config.firmantes1Nivel2 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel2,
        firmantes2Nivel2: Array.isArray(data.config.firmantes2Nivel2)
          ? data.config.firmantes2Nivel2 : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel2,
        firmantes1Nivel3: Array.isArray(data.config.firmantes1Nivel3)
          ? data.config.firmantes1Nivel3 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel3,
        firmantes2Nivel3: Array.isArray(data.config.firmantes2Nivel3)
          ? data.config.firmantes2Nivel3 : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel3,
        firmantes1Nivel4: Array.isArray(data.config.firmantes1Nivel4)
          ? data.config.firmantes1Nivel4 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel4,
        firmantes2Nivel4: Array.isArray(data.config.firmantes2Nivel4)
          ? data.config.firmantes2Nivel4 : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel4,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
        window.dispatchEvent(new Event("approval_config_updated"));
      }
      return cfg;
    }
  } catch (err) {
    console.warn("⚠️ [ApprovalConfig] Aviso al consultar configuración en el servidor:", err);
  }
  return getStoredApprovalConfig();
}

/**
 * Guarda la configuración de aprobaciones en el servidor MongoDB y en caché local.
 */
export async function saveApprovalConfigToServer(config: ApprovalConfig, updatedBy?: string): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new Event("approval_config_updated"));
    } catch (err) {
      console.error("Error guardando en caché local:", err);
    }
  }

  try {
    const res = await fetch(APPROVAL_CONFIG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...config,
        updatedBy: updatedBy || "Usuario"
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && data.config) {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.config));
          window.dispatchEvent(new Event("approval_config_updated"));
        }
      }
      console.log("✅ [ApprovalConfig] Guardado exitosamente en el servidor MongoDB");
      return true;
    }
    return false;
  } catch (err) {
    console.error("❌ [ApprovalConfig] Error al guardar en el servidor MongoDB:", err);
    return false;
  }
}

export function saveStoredApprovalConfig(config: ApprovalConfig): void {
  // Guarda en caché local inmediatamente y sincroniza con el servidor en segundo plano
  saveApprovalConfigToServer(config).catch((err) => {
    console.warn("Aviso en sincronización en segundo plano con el servidor:", err);
  });
}

export function cleanName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function isNameInList(name: string, list: string[]): boolean {
  if (!name || !list || list.length === 0) return false;
  const target = cleanName(name);
  return list.some(item => {
    const it = cleanName(item);
    return target === it || target.includes(it) || it.includes(target);
  });
}

export function parseMontoToNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  str = str.replace(/[^0-9.,-]/g, "");
  if (!str) return 0;

  if (str.includes(",") && str.includes(".")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    const parts = str.split(",");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, "");
    } else {
      str = str.replace(",", ".");
    }
  } else if (str.includes(".")) {
    const parts = str.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, "");
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}
