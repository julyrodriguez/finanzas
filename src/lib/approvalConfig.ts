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

export function getStoredApprovalConfig(): ApprovalConfig {
  if (typeof window === "undefined") return DEFAULT_APPROVAL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPROVAL_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_APPROVAL_CONFIG,
      ...parsed,
      limiteNivel1: Number(parsed.limiteNivel1) || DEFAULT_APPROVAL_CONFIG.limiteNivel1,
      limiteNivel2: Number(parsed.limiteNivel2) || DEFAULT_APPROVAL_CONFIG.limiteNivel2,
      limiteNivel3: Number(parsed.limiteNivel3) || DEFAULT_APPROVAL_CONFIG.limiteNivel3,
      firmantes1Nivel1: Array.isArray(parsed.firmantes1Nivel1) && parsed.firmantes1Nivel1.length > 0
        ? parsed.firmantes1Nivel1 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel1,
      firmantes2Nivel1: Array.isArray(parsed.firmantes2Nivel1) && parsed.firmantes2Nivel1.length > 0
        ? parsed.firmantes2Nivel1 : (Array.isArray(parsed.firmantesAreaNivel1) ? parsed.firmantesAreaNivel1 : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel1),
      firmantes1Nivel2: Array.isArray(parsed.firmantes1Nivel2) && parsed.firmantes1Nivel2.length > 0
        ? parsed.firmantes1Nivel2 : (parsed.firmante1Nivel2 ? [parsed.firmante1Nivel2] : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel2),
      firmantes2Nivel2: Array.isArray(parsed.firmantes2Nivel2) && parsed.firmantes2Nivel2.length > 0
        ? parsed.firmantes2Nivel2 : (parsed.firmante2Nivel2 ? [parsed.firmante2Nivel2] : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel2),
      firmantes1Nivel3: Array.isArray(parsed.firmantes1Nivel3) && parsed.firmantes1Nivel3.length > 0
        ? parsed.firmantes1Nivel3 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel3,
      firmantes2Nivel3: Array.isArray(parsed.firmantes2Nivel3) && parsed.firmantes2Nivel3.length > 0
        ? parsed.firmantes2Nivel3 : (parsed.firmante2Nivel3 ? [parsed.firmante2Nivel3] : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel3),
      firmantes1Nivel4: Array.isArray(parsed.firmantes1Nivel4) && parsed.firmantes1Nivel4.length > 0
        ? parsed.firmantes1Nivel4 : DEFAULT_APPROVAL_CONFIG.firmantes1Nivel4,
      firmantes2Nivel4: Array.isArray(parsed.firmantes2Nivel4) && parsed.firmantes2Nivel4.length > 0
        ? parsed.firmantes2Nivel4 : (parsed.firmante2Nivel4 ? [parsed.firmante2Nivel4] : DEFAULT_APPROVAL_CONFIG.firmantes2Nivel4),
    };
  } catch {
    return DEFAULT_APPROVAL_CONFIG;
  }
}

export function saveStoredApprovalConfig(config: ApprovalConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event("approval_config_updated"));
  } catch (err) {
    console.error("Error saving approval config:", err);
  }
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
