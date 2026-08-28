export interface ApprovalConfig {
  limiteNivel1: number; // default: 5_000_000
  limiteNivel2: number; // default: 18_000_000
  firmanteBaseNivel1: string; // default: "Tomas"
  firmantesAreaNivel1: string[]; // default: ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"]
  firmante1Nivel2: string; // default: "Pablo Mondelo"
  firmante2Nivel2: string; // default: "Dario"
}

export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  limiteNivel1: 5000000,
  limiteNivel2: 18000000,
  firmanteBaseNivel1: "Tomas",
  firmantesAreaNivel1: ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"],
  firmante1Nivel2: "Pablo Mondelo",
  firmante2Nivel2: "Dario",
};

const STORAGE_KEY = "finanzas_approval_config_v1";

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
      firmantesAreaNivel1: Array.isArray(parsed.firmantesAreaNivel1) && parsed.firmantesAreaNivel1.length > 0
        ? parsed.firmantesAreaNivel1
        : DEFAULT_APPROVAL_CONFIG.firmantesAreaNivel1,
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
