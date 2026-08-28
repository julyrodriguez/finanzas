export interface ApprovalConfig {
  limiteNivel1: number; // default: 5_000_000
  limiteNivel2: number; // default: 18_000_000
  firmanteBaseNivel1: string; // default: "Tomas"
  limiteTomas: number; // default: 5_000_000
  firmantesAreaNivel1: string[]; // default: ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"]
  limitesIndividuales: Record<string, number>; // nombre -> monto maximo
  firmante1Nivel2: string; // default: "Pablo Mondelo"
  limiteMondelo: number; // default: 18_000_000
  firmante2Nivel2: string; // default: "Dario"
  limiteDario: number; // default: 18_000_000
}

export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  limiteNivel1: 5000000,
  limiteNivel2: 18000000,
  firmanteBaseNivel1: "Tomas",
  limiteTomas: 5000000,
  firmantesAreaNivel1: ["Victoria", "Tristan", "Pablo Gonzalez", "Jorgelina"],
  limitesIndividuales: {
    "Tomas": 5000000,
    "Victoria": 5000000,
    "Tristan": 5000000,
    "Pablo Gonzalez": 5000000,
    "Jorgelina": 5000000,
    "Pablo Mondelo": 18000000,
    "Dario": 18000000,
  },
  firmante1Nivel2: "Pablo Mondelo",
  limiteMondelo: 18000000,
  firmante2Nivel2: "Dario",
  limiteDario: 18000000,
};

const STORAGE_KEY = "finanzas_approval_config_v2";

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
      limiteTomas: Number(parsed.limiteTomas) || Number(parsed.limiteNivel1) || DEFAULT_APPROVAL_CONFIG.limiteTomas,
      limiteMondelo: Number(parsed.limiteMondelo) || Number(parsed.limiteNivel2) || DEFAULT_APPROVAL_CONFIG.limiteMondelo,
      limiteDario: Number(parsed.limiteDario) || Number(parsed.limiteNivel2) || DEFAULT_APPROVAL_CONFIG.limiteDario,
      limitesIndividuales: typeof parsed.limitesIndividuales === "object" && parsed.limitesIndividuales !== null
        ? { ...DEFAULT_APPROVAL_CONFIG.limitesIndividuales, ...parsed.limitesIndividuales }
        : DEFAULT_APPROVAL_CONFIG.limitesIndividuales,
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

export function getSignerIndividualLimit(config: ApprovalConfig, signerName: string): number {
  if (!signerName) return config.limiteNivel1;
  const nameLower = signerName.toLowerCase().trim();

  // Check specific keys in limitesIndividuales with case-insensitive match
  for (const [key, limit] of Object.entries(config.limitesIndividuales || {})) {
    if (key.toLowerCase().trim() === nameLower) {
      return Number(limit) || config.limiteNivel1;
    }
  }

  if (nameLower.includes("tomas")) return config.limiteTomas || config.limiteNivel1;
  if (nameLower.includes("mondelo")) return config.limiteMondelo || config.limiteNivel2;
  if (nameLower.includes("dario") || nameLower.includes("darío")) return config.limiteDario || config.limiteNivel2;

  return config.limiteNivel1;
}
