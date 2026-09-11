"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { exportToExcel } from "@/lib/exportToExcel";
import { 
  fetchOrdersFromMongo,
  fetchCapexBudgets,
  saveCapexBudget,
  fetchCapexGastosDirectos,
  createCapexGastoDirecto,
  deleteCapexGastoDirecto,
  CapexBudget,
  CapexGastoDirecto
} from "@/lib/serverSync";
import { extractProvidersFromOrders } from "@/lib/providersRegistry";
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Building2, 
  Calendar, 
  DollarSign, 
  Layers, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  Eye, 
  X, 
  Users, 
  Award, 
  Sparkles, 
  Clock, 
  Coins, 
  ShoppingBag,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Building,
  HardHat,
  FolderKanban,
  Tag,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
  Briefcase,
  Plus,
  Trash2,
  Settings2,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Receipt,
  ArrowRightLeft,
  ArrowRight
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

export interface SerializableOrder {
  id: string;
  empresa: "Hoyts" | "CMK";
  numSolicitud: string;
  numOC: string;
  razonSocial: string;
  monto: number;
  motivo: string;
  formaPago: string;
  liberada: boolean;
  mandada: boolean;
  entregada: boolean;
  cancelada: boolean;
  timestamp: number;
  year: number | null;
  month: number | null; // 0-11
  dateStr: string;
  creadoPor?: string;
}

export interface GroupedProvider {
  id: string; // normalized key
  name: string; // canonical name
  aliases: string[];
  totalMonto: number;
  totalOrders: number;
  averageTicket: number;
  hoytsMonto: number;
  hoytsOrders: number;
  cmkMonto: number;
  cmkOrders: number;
  orders: SerializableOrder[];
  percentageOfTotalMonto: number;
  percentageOfTotalOrders: number;
}

const CACHE_KEY = "finanzas_estadisticas_cache_v1";
const LOCAL_BUDGETS_KEY = "finanzas_capex_budgets_v1";
const LOCAL_GASTOS_KEY = "finanzas_capex_gastos_v1";

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

// ==========================================
// STRING NORMALIZATION & FUZZY MATCHING
// ==========================================

/**
 * Known manual provider synonym mappings for trade names that differ significantly
 */
const MANUAL_PROVIDER_SYNONYMS: Record<string, string> = {
  "ping": "ping solutions",
  "ping solution": "ping solutions",
  "ping solutions": "ping solutions",
  "ping solutions argentina": "ping solutions",
};

/**
 * Generic corporate, industry, and activity descriptor words commonly appended or omitted in trade names.
 */
const GENERIC_DESCRIPTORS = new Set([
  "solution", "solutions", "soluciones",
  "servicio", "servicios", "service", "services",
  "sistema", "sistemas", "system", "systems",
  "tecnologia", "tecnologias", "tech", "technology", "technologies",
  "digital", "digitales",
  "grupo", "group",
  "logistica", "logistics",
  "distribuidora", "distribucion",
  "consultora", "consultoria", "consulting",
  "comunicaciones", "comunicacion", "communications",
  "producciones", "produccion", "productions", "production",
  "medios", "media",
  "seguridad", "security",
  "comercial", "comercializadora",
  "internacional", "international",
  "red", "redes",
  "publicidad", "marketing",
  "mantenimiento", "limpieza",
  "argentina", "arg", "sur", "latam",
]);

/**
 * Strips legal suffixes, accents, punctuation, stop words, and excessive spaces.
 */
function cleanProviderName(raw: string): string {
  if (!raw) return "";
  let s = raw.toLowerCase();

  // Normalize accents (e.g. á -> a, ñ -> n)
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Replace & with y
  s = s.replace(/&/g, " y ");

  // Remove dots in acronyms like S.R.L. or S.A.
  s = s.replace(/\./g, "");

  // Remove other punctuation
  s = s.replace(/[,/\-_()"\x27\[\]{}:;!#*+]/g, " ");

  // Remove legal business forms
  s = s.replace(
    /\b(srl|sa|sas|sacifi|saci|sh|ute|sca|se|cisa|ltda|limitada|inc|corp|llc)\b/g,
    " "
  );

  // Remove noise / filler words
  s = s.replace(/\b(argentina|arg|de|del|la|el|los|las)\b/g, " ");

  s = s.replace(/\s+/g, " ").trim();

  // If over-cleaned, fallback to basic trimmed lowercase without punctuation
  if (s.length < 2) {
    s = raw.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Check manual synonym mappings
  if (MANUAL_PROVIDER_SYNONYMS[s]) {
    s = MANUAL_PROVIDER_SYNONYMS[s];
  }

  return s;
}

/**
 * Standard Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Evaluates whether two normalized provider names represent the same entity.
 */
function areSimilarProviders(norm1: string, norm2: string): boolean {
  if (norm1 === norm2) return true;
  if (!norm1 || !norm2) return false;

  // Short words (< 4 chars) require exact match to avoid false merges
  if (norm1.length < 4 || norm2.length < 4) return false;

  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length >= norm2.length ? norm1 : norm2;

  // Token-based Jaccard similarity
  const tokens1 = norm1.split(" ").filter(Boolean);
  const tokens2 = norm2.split(" ").filter(Boolean);

  if (tokens1.length > 1 && tokens2.length > 1) {
    const set2 = new Set(tokens2);
    const intersection = tokens1.filter((t) => set2.has(t));
    const union = new Set([...tokens1, ...tokens2]);
    if (intersection.length / union.size >= 0.6) return true;
  }

  // Generic descriptor containment check (e.g. "ping" and "ping solutions")
  const shorterTokens = tokens1.length <= tokens2.length ? tokens1 : tokens2;
  const longerTokens = tokens1.length > tokens2.length ? tokens1 : tokens2;
  if (shorterTokens.length >= 1 && shorterTokens.join("").length >= 4) {
    const matchedLongerIndices = new Set<number>();
    let allMatched = true;
    for (const st of shorterTokens) {
      let foundIdx = -1;
      for (let i = 0; i < longerTokens.length; i++) {
        if (!matchedLongerIndices.has(i) && (longerTokens[i] === st || (st.length > 4 && longerTokens[i].startsWith(st)))) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        matchedLongerIndices.add(foundIdx);
      } else {
        allMatched = false;
        break;
      }
    }

    if (allMatched) {
      const remaining = longerTokens.filter((_, idx) => !matchedLongerIndices.has(idx));
      if (remaining.length > 0 && remaining.every((t) => GENERIC_DESCRIPTORS.has(t))) {
        return true;
      }
    }
  }

  // Levenshtein distance check with length-adjusted tolerances
  const maxLen = longer.length;
  const dist = levenshteinDistance(norm1, norm2);
  if (maxLen <= 6 && dist <= 1) return true;
  if (maxLen > 6 && maxLen <= 10 && dist <= 2) return true;
  if (maxLen > 10 && dist <= 3) return true;

  // Prefix match (e.g., "distribuidora norte" and "distribuidora norte sa")
  if (shorter.length >= 4 && longer.startsWith(shorter)) {
    const rem = longer.slice(shorter.length).trim();
    const remTokens = rem.split(" ").filter(Boolean);
    if (remTokens.length > 0 && remTokens.every((t) => GENERIC_DESCRIPTORS.has(t))) {
      return true;
    }
    if (shorter.length >= 6 && rem.length <= 4) {
      return true;
    }
  }

  return false;
}

/**
 * Format currency with Argentine locale
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Helper to parse raw monto value
 */
function parseMonto(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Detects if an order belongs to CAPEX or PCT investments.
 * Checks for "CAPEX" or "PCT" (case-insensitive) in the order's description / motivo.
 */
export function isCapexOrder(order?: { motivo?: string; isCapex?: boolean } | null): boolean {
  if (!order) return false;
  if (order.isCapex) return true;
  if (!order.motivo) return false;
  const m = order.motivo.toLowerCase();
  return /\b(capex|pct)\b/i.test(m) || m.includes("capex") || /\bpct[-0-9 ]/i.test(m);
}

/**
 * Returns whether an order is tagged primarily as PCT or CAPEX.
 */
export function getCapexTag(motivo?: string): "PCT" | "CAPEX" {
  if (!motivo) return "CAPEX";
  const m = motivo.toLowerCase();
  if (/\b(pct)\b/i.test(m) || /\bpct[-0-9 ]/i.test(m)) return "PCT";
  return "CAPEX";
}

export default function EstadisticasPage() {
  const [orders, setOrders] = useState<SerializableOrder[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedEmpresa, setSelectedEmpresa] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"monto" | "count" | "promedio" | "nombre">("monto");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [activeProviderModal, setActiveProviderModal] = useState<GroupedProvider | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab switching & CAPEX dashboard states
  const [activeTab, setActiveTab] = useState<"general" | "capex">("general");
  const [capexSearchQuery, setCapexSearchQuery] = useState<string>("");
  const [capexTypeFilter, setCapexTypeFilter] = useState<"Todos" | "CAPEX" | "PCT">("Todos");
  const [capexSortBy, setCapexSortBy] = useState<"monto" | "fecha" | "numOC" | "proveedor">("monto");
  const [capexSortOrder, setCapexSortOrder] = useState<"desc" | "asc">("desc");
  const [capexPage, setCapexPage] = useState<number>(1);
  const [capexMonthlySort, setCapexMonthlySort] = useState<"ranking" | "cronologico">("ranking");

  // CAPEX Budget & Gastos Directos State
  const [capexBudgets, setCapexBudgets] = useState<Record<number, CapexBudget>>({});
  const [capexGastosDirectos, setCapexGastosDirectos] = useState<CapexGastoDirecto[]>([]);
  const [loadingCapexMeta, setLoadingCapexMeta] = useState<boolean>(false);

  // Modals state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [isGastoModalOpen, setIsGastoModalOpen] = useState<boolean>(false);
  const [isReasignacionModalOpen, setIsReasignacionModalOpen] = useState<boolean>(false);
  const [isExtraCapexModalOpen, setIsExtraCapexModalOpen] = useState<boolean>(false);

  const [savingBudget, setSavingBudget] = useState<boolean>(false);
  const [savingGasto, setSavingGasto] = useState<boolean>(false);
  const [savingReasignacion, setSavingReasignacion] = useState<boolean>(false);
  const [savingExtraCapex, setSavingExtraCapex] = useState<boolean>(false);

  // Budget modal form
  const [budgetHoytsInput, setBudgetHoytsInput] = useState<string>("");
  const [budgetCmkInput, setBudgetCmkInput] = useState<string>("");
  const [budgetObsInput, setBudgetObsInput] = useState<string>("");

  // Gasto directo modal form
  const [gastoEmpresaInput, setGastoEmpresaInput] = useState<"Hoyts" | "CMK">("Hoyts");
  const [gastoMontoInput, setGastoMontoInput] = useState<string>("");
  const [gastoConceptoInput, setGastoConceptoInput] = useState<string>("");
  const [gastoProveedorInput, setGastoProveedorInput] = useState<string>("");
  const [gastoFechaInput, setGastoFechaInput] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [gastoComprobanteInput, setGastoComprobanteInput] = useState<string>("");
  const [gastoObsInput, setGastoObsInput] = useState<string>("");

  // Reasignacion modal form
  const [reasigOrigenInput, setReasigOrigenInput] = useState<"Hoyts" | "CMK">("Hoyts");
  const [reasigDestinoInput, setReasigDestinoInput] = useState<"Hoyts" | "CMK">("CMK");
  const [reasigMontoInput, setReasigMontoInput] = useState<string>("");
  const [reasigConceptoInput, setReasigConceptoInput] = useState<string>("");
  const [reasigFechaInput, setReasigFechaInput] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [reasigComprobanteInput, setReasigComprobanteInput] = useState<string>("");
  const [reasigObsInput, setReasigObsInput] = useState<string>("");

  // Extra CAPEX modal form
  const [extraEmpresaInput, setExtraEmpresaInput] = useState<"Hoyts" | "CMK">("Hoyts");
  const [extraMontoInput, setExtraMontoInput] = useState<string>("");
  const [extraConceptoInput, setExtraConceptoInput] = useState<string>("");
  const [extraFechaInput, setExtraFechaInput] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [extraComprobanteInput, setExtraComprobanteInput] = useState<string>("");
  const [extraObsInput, setExtraObsInput] = useState<string>("");

  // Movimientos corporativos list visibility toggle
  const [showGastosList, setShowGastosList] = useState<boolean>(true);

  // Responsive year pills auto-scroll container
  const yearContainerRef = useRef<HTMLDivElement | null>(null);
  const activeYearRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (yearContainerRef.current && activeYearRef.current) {
      const container = yearContainerRef.current;
      const element = activeYearRef.current;
      const elementLeft = element.offsetLeft;
      const elementWidth = element.offsetWidth;
      const containerWidth = container.clientWidth;
      const containerScrollLeft = container.scrollLeft;

      if (
        elementLeft < containerScrollLeft ||
        elementLeft + elementWidth > containerScrollLeft + containerWidth
      ) {
        container.scrollTo({
          left: Math.max(0, elementLeft - containerWidth / 2 + elementWidth / 2),
          behavior: "smooth",
        });
      }
    }
  }, [selectedYear]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Cargar metadatos CAPEX (Presupuestos y Gastos sin OC) desde el servidor MongoDB
  const loadCapexMetadata = async () => {
    try {
      setLoadingCapexMeta(true);
      const [budgetsRes, gastosRes] = await Promise.all([
        fetchCapexBudgets(),
        fetchCapexGastosDirectos(),
      ]);

      const bMap: Record<number, CapexBudget> = {};
      budgetsRes.forEach((b) => {
        bMap[b.anio] = b;
      });
      setCapexBudgets(bMap);
      setCapexGastosDirectos(gastosRes);

      try {
        localStorage.setItem(LOCAL_BUDGETS_KEY, JSON.stringify(bMap));
        localStorage.setItem(LOCAL_GASTOS_KEY, JSON.stringify(gastosRes));
      } catch (err) {
        console.warn("Error guardando en localStorage:", err);
      }
    } catch (err) {
      console.warn("Error sincronizando metadata CAPEX desde MongoDB:", err);
    } finally {
      setLoadingCapexMeta(false);
    }
  };

  // ==========================================
  // LOCAL STORAGE INITIAL LOAD (0 FIRESTORE READS)
  // ==========================================
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.orders)) {
          setOrders(parsed.orders);
          setLastSync(parsed.lastSync || null);
        }
      }
      const cachedB = localStorage.getItem(LOCAL_BUDGETS_KEY);
      if (cachedB) {
        setCapexBudgets(JSON.parse(cachedB));
      }
      const cachedG = localStorage.getItem(LOCAL_GASTOS_KEY);
      if (cachedG) {
        setCapexGastosDirectos(JSON.parse(cachedG));
      }
    } catch (e) {
      console.error("Error cargando caché de estadísticas:", e);
    }

    // Cargar metadatos de CAPEX en segundo plano
    loadCapexMetadata();
  }, []);

  // Handlers para Presupuesto Anual CAPEX
  const handleOpenBudgetModal = () => {
    const yearNum = selectedYear !== "Todos" ? Number(selectedYear) : new Date().getFullYear();
    const existing = capexBudgets[yearNum];
    setBudgetHoytsInput(existing?.hoytsBudget ? existing.hoytsBudget.toString() : "");
    setBudgetCmkInput(existing?.cmkBudget ? existing.cmkBudget.toString() : "");
    setBudgetObsInput(existing?.observaciones || "");
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBudget(true);
    const targetYear = selectedYear !== "Todos" ? Number(selectedYear) : new Date().getFullYear();
    try {
      const hoytsVal = parseFloat(budgetHoytsInput.replace(/[^0-9.-]+/g, "")) || 0;
      const cmkVal = parseFloat(budgetCmkInput.replace(/[^0-9.-]+/g, "")) || 0;

      const updated = await saveCapexBudget({
        anio: targetYear,
        hoytsBudget: Math.max(0, hoytsVal),
        cmkBudget: Math.max(0, cmkVal),
        observaciones: budgetObsInput.trim(),
      });

      if (updated) {
        const nextBudgets = {
          ...capexBudgets,
          [targetYear]: updated,
        };
        setCapexBudgets(nextBudgets);
        try {
          localStorage.setItem(LOCAL_BUDGETS_KEY, JSON.stringify(nextBudgets));
        } catch (e) {}
      }

      setIsBudgetModalOpen(false);
      showToast(`🎯 Presupuesto CAPEX ${targetYear} configurado correctamente.`);
    } catch (err: any) {
      console.error("Error guardando presupuesto:", err);
      showToast(`❌ Error al guardar presupuesto: ${err.message || "Error de conexión"}`);
    } finally {
      setSavingBudget(false);
    }
  };

  // Handlers para Gastos sin Orden de Compra
  const handleOpenGastoModal = () => {
    const targetYear = selectedYear !== "Todos" ? selectedYear : new Date().getFullYear().toString();
    const defaultDate = `${targetYear}-01-15`;
    setGastoFechaInput(defaultDate);
    setGastoEmpresaInput("Hoyts");
    setGastoMontoInput("");
    setGastoConceptoInput("");
    setGastoProveedorInput("");
    setGastoComprobanteInput("");
    setGastoObsInput("");
    setIsGastoModalOpen(true);
  };

  const handleSaveGastoDirecto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGasto(true);
    try {
      const montoVal = parseFloat(gastoMontoInput.replace(/[^0-9.-]+/g, "")) || 0;
      if (montoVal <= 0) {
        showToast("⚠️ El monto del gasto debe ser mayor a 0.");
        setSavingGasto(false);
        return;
      }
      if (!gastoConceptoInput.trim()) {
        showToast("⚠️ Debes ingresar un concepto o descripción del gasto.");
        setSavingGasto(false);
        return;
      }

      const dateObj = new Date(gastoFechaInput);
      const fallbackYear = selectedYear !== "Todos" ? Number(selectedYear) : new Date().getFullYear();
      const targetYear = !isNaN(dateObj.getFullYear()) ? dateObj.getFullYear() : fallbackYear;

      const nuevoGasto = await createCapexGastoDirecto({
        anio: targetYear,
        fecha: gastoFechaInput,
        empresa: gastoEmpresaInput,
        monto: montoVal,
        concepto: gastoConceptoInput.trim(),
        proveedor: gastoProveedorInput.trim(),
        comprobante: gastoComprobanteInput.trim(),
        observaciones: gastoObsInput.trim(),
      });

      if (nuevoGasto) {
        const nextGastos = [nuevoGasto, ...capexGastosDirectos];
        setCapexGastosDirectos(nextGastos);
        try {
          localStorage.setItem(LOCAL_GASTOS_KEY, JSON.stringify(nextGastos));
        } catch (e) {}
      }

      setIsGastoModalOpen(false);
      showToast(`✅ Gasto sin OC registrado para ${gastoEmpresaInput} (${targetYear}).`);
    } catch (err: any) {
      console.error("Error guardando gasto directo:", err);
      showToast(`❌ Error al registrar gasto: ${err.message || "Error de conexión"}`);
    } finally {
      setSavingGasto(false);
    }
  };

  // Handlers para Reasignación entre Compañías
  const handleOpenReasignacionModal = () => {
    const targetYear = selectedYear !== "Todos" ? selectedYear : new Date().getFullYear().toString();
    const defaultDate = `${targetYear}-01-15`;
    setReasigFechaInput(defaultDate);
    setReasigOrigenInput("Hoyts");
    setReasigDestinoInput("CMK");
    setReasigMontoInput("");
    setReasigConceptoInput("Reasignación de fondos CAPEX");
    setReasigComprobanteInput("");
    setReasigObsInput("");
    setIsReasignacionModalOpen(true);
  };

  const handleSaveReasignacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReasignacion(true);
    try {
      const montoVal = parseFloat(reasigMontoInput.replace(/[^0-9.-]+/g, "")) || 0;
      if (montoVal <= 0) {
        showToast("⚠️ El monto a reasignar debe ser mayor a 0.");
        setSavingReasignacion(false);
        return;
      }
      if (reasigOrigenInput === reasigDestinoInput) {
        showToast("⚠️ La empresa origen y destino no pueden ser iguales.");
        setSavingReasignacion(false);
        return;
      }

      const dateObj = new Date(reasigFechaInput);
      const fallbackYear = selectedYear !== "Todos" ? Number(selectedYear) : new Date().getFullYear();
      const targetYear = !isNaN(dateObj.getFullYear()) ? dateObj.getFullYear() : fallbackYear;

      const nuevoMovimiento = await createCapexGastoDirecto({
        anio: targetYear,
        fecha: reasigFechaInput,
        empresa: reasigOrigenInput,
        empresaDestino: reasigDestinoInput,
        tipo: "REASIGNACION",
        monto: montoVal,
        concepto: reasigConceptoInput.trim() || `Reasignación de ${reasigOrigenInput} a ${reasigDestinoInput}`,
        comprobante: reasigComprobanteInput.trim(),
        observaciones: reasigObsInput.trim(),
      });

      if (nuevoMovimiento) {
        const nextGastos = [nuevoMovimiento, ...capexGastosDirectos];
        setCapexGastosDirectos(nextGastos);
        try {
          localStorage.setItem(LOCAL_GASTOS_KEY, JSON.stringify(nextGastos));
        } catch (e) {}
      }

      setIsReasignacionModalOpen(false);
      showToast(`✅ Reasignación de ${reasigOrigenInput} ➔ ${reasigDestinoInput} (${targetYear}) guardada.`);
    } catch (err: any) {
      console.error("Error guardando reasignación:", err);
      showToast(`❌ Error al reasignar fondos: ${err.message || "Error de conexión"}`);
    } finally {
      setSavingReasignacion(false);
    }
  };

  // Handlers para Agregar Extra CAPEX
  const handleOpenExtraCapexModal = () => {
    const targetYear = selectedYear !== "Todos" ? selectedYear : new Date().getFullYear().toString();
    const defaultDate = `${targetYear}-01-15`;
    setExtraFechaInput(defaultDate);
    setExtraEmpresaInput("Hoyts");
    setExtraMontoInput("");
    setExtraConceptoInput("Ampliación presupuestaria CAPEX");
    setExtraComprobanteInput("");
    setExtraObsInput("");
    setIsExtraCapexModalOpen(true);
  };

  const handleSaveExtraCapex = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExtraCapex(true);
    try {
      const montoVal = parseFloat(extraMontoInput.replace(/[^0-9.-]+/g, "")) || 0;
      if (montoVal <= 0) {
        showToast("⚠️ El monto de Extra CAPEX debe ser mayor a 0.");
        setSavingExtraCapex(false);
        return;
      }

      const dateObj = new Date(extraFechaInput);
      const fallbackYear = selectedYear !== "Todos" ? Number(selectedYear) : new Date().getFullYear();
      const targetYear = !isNaN(dateObj.getFullYear()) ? dateObj.getFullYear() : fallbackYear;

      const nuevoMovimiento = await createCapexGastoDirecto({
        anio: targetYear,
        fecha: extraFechaInput,
        empresa: extraEmpresaInput,
        tipo: "EXTRA_CAPEX",
        monto: montoVal,
        concepto: extraConceptoInput.trim() || `Extra CAPEX para ${extraEmpresaInput}`,
        comprobante: extraComprobanteInput.trim(),
        observaciones: extraObsInput.trim(),
      });

      if (nuevoMovimiento) {
        const nextGastos = [nuevoMovimiento, ...capexGastosDirectos];
        setCapexGastosDirectos(nextGastos);
        try {
          localStorage.setItem(LOCAL_GASTOS_KEY, JSON.stringify(nextGastos));
        } catch (e) {}
      }

      setIsExtraCapexModalOpen(false);
      showToast(`✅ Extra CAPEX para ${extraEmpresaInput} (${targetYear}) registrado.`);
    } catch (err: any) {
      console.error("Error guardando extra CAPEX:", err);
      showToast(`❌ Error al agregar Extra CAPEX: ${err.message || "Error de conexión"}`);
    } finally {
      setSavingExtraCapex(false);
    }
  };

  const handleDeleteGastoDirecto = async (id: string, concepto: string) => {
    if (!confirm(`¿Eliminar el movimiento corporativo "${concepto}"?`)) return;
    try {
      await deleteCapexGastoDirecto(id);
      const nextGastos = capexGastosDirectos.filter((g) => g._id !== id);
      setCapexGastosDirectos(nextGastos);
      try {
        localStorage.setItem(LOCAL_GASTOS_KEY, JSON.stringify(nextGastos));
      } catch (e) {}
      showToast("🗑️ Movimiento corporativo eliminado correctamente.");
    } catch (err: any) {
      console.error("Error eliminando movimiento:", err);
      showToast(`❌ Error al eliminar movimiento: ${err.message || "Error de conexión"}`);
    }
  };

  // ==========================================
  // FETCH FROM LOCAL SERVER (MONGODB)
  // ==========================================
  const handleActualizarDatos = async () => {
    setLoading(true);
    try {
      // Consulta directamente a nuestro servidor local (MongoDB)
      const [res] = await Promise.all([
        fetchOrdersFromMongo({ limit: 0 }),
        loadCapexMetadata()
      ]);
      if (!res || !res.success || !Array.isArray(res.ordenes)) {
        throw new Error("Respuesta inválida del servidor");
      }

      const loadedOrders: SerializableOrder[] = res.ordenes.map((docItem: any) => {
        const rawMonto = parseMonto(docItem.monto);
        const rawRazon = (docItem.razonSocial || "Sin Proveedor").toString().trim();

        let timestamp = 0;
        let year: number | null = docItem.anio ? Number(docItem.anio) : null;
        let month: number | null = docItem.mes !== undefined && docItem.mes !== null ? Number(docItem.mes) : null;
        let dateStr = "-";

        const rawDate = docItem.fechaOC || docItem.createdAtFirebase || docItem.createdAt;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            timestamp = d.getTime();
            if (!year) year = d.getFullYear();
            if (month === null) month = d.getMonth();
            dateStr = d.toLocaleDateString("es-AR");
          }
        }

        return {
          id: docItem.firebaseId || docItem._id,
          empresa: docItem.empresa === "Hoyts" ? "Hoyts" : "CMK",
          numSolicitud: docItem.numSolicitud ? String(docItem.numSolicitud) : "",
          numOC: docItem.numOC ? String(docItem.numOC) : "",
          razonSocial: rawRazon,
          monto: rawMonto,
          motivo: docItem.motivo ? String(docItem.motivo) : "",
          formaPago: docItem.formaPago ? String(docItem.formaPago) : "30DFF",
          liberada: Boolean(docItem.liberada),
          mandada: Boolean(docItem.mandada),
          entregada: Boolean(docItem.entregada),
          cancelada: Boolean(docItem.cancelada),
          timestamp,
          year,
          month,
          dateStr,
          creadoPor: docItem.creadoPor ? String(docItem.creadoPor) : "",
        };
      });

      const nowIso = new Date().toISOString();
      const payload = {
        version: 1,
        lastSync: nowIso,
        orders: loadedOrders,
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        const providers = extractProvidersFromOrders(loadedOrders);
        localStorage.setItem("finanzas_proveedores_registry_v1", JSON.stringify(providers));
      } catch (storageErr) {
        console.warn("No se pudo guardar en localStorage (cuota excedida):", storageErr);
      }

      setOrders(loadedOrders);
      setLastSync(nowIso);
      showToast(`✅ ¡Datos sincronizados desde el servidor! Se analizaron ${loadedOrders.length} órdenes.`);
    } catch (err) {
      console.error("Error al actualizar órdenes desde el servidor:", err);
      showToast("❌ Hubo un error al actualizar los datos desde el servidor local.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // DYNAMIC AVAILABLE YEARS
  // ==========================================
  const availableYears = useMemo(() => {
    const setYears = new Set<number>();
    orders.forEach((o) => {
      if (o.year) setYears.add(o.year);
    });
    const arr = Array.from(setYears).sort((a, b) => b - a);
    return arr.map(String);
  }, [orders]);

  // ==========================================
  // SCOPED ORDERS (YEAR & EMPRESA FILTER)
  // ==========================================
  const ordersInScope = useMemo(() => {
    return orders.filter((o) => {
      if (selectedYear !== "Todos" && o.year !== Number(selectedYear)) {
        return false;
      }
      if (selectedEmpresa !== "Todas" && o.empresa !== selectedEmpresa) {
        return false;
      }
      return true;
    });
  }, [orders, selectedYear, selectedEmpresa]);

  // ==========================================
  // FILTERED ORDERS (EXCLUDES CANCELLED ORDERS)
  // Non-cancelled orders used for all financial metrics, sums & rankings
  // ==========================================
  const filteredOrders = useMemo(() => {
    return ordersInScope.filter((o) => !o.cancelada);
  }, [ordersInScope]);

  // ==========================================
  // INTELLIGENT PROVIDER GROUPING / FUZZY CLUSTERING
  // ==========================================
  const { groupedProviders, totalFacturadoGeneral, totalOrdenesValidas, rawAliasesCount } = useMemo(() => {
    // 1. Calculate frequency of each raw provider name
    const rawCounts: Record<string, { count: number; monto: number }> = {};
    filteredOrders.forEach((o) => {
      const r = o.razonSocial || "Sin Proveedor";
      if (!rawCounts[r]) rawCounts[r] = { count: 0, monto: 0 };
      rawCounts[r].count += 1;
      rawCounts[r].monto += o.monto;
    });

    const uniqueRaws = Object.keys(rawCounts).sort((a, b) => rawCounts[b].count - rawCounts[a].count);

    // 2. Form clusters
    interface Cluster {
      id: string;
      canonical: string;
      norm: string;
      rawNames: string[];
      totalCount: number;
    }

    const clusters: Cluster[] = [];

    for (const raw of uniqueRaws) {
      const norm = cleanProviderName(raw);
      let matchedCluster: Cluster | null = null;

      for (const c of clusters) {
        if (c.norm === norm || areSimilarProviders(c.norm, norm)) {
          matchedCluster = c;
          break;
        }
      }

      if (matchedCluster) {
        matchedCluster.rawNames.push(raw);
        matchedCluster.totalCount += rawCounts[raw].count;
        // If this raw name was used more times, upgrade it to canonical
        if (rawCounts[raw].count > rawCounts[matchedCluster.canonical].count) {
          matchedCluster.canonical = raw;
        }
      } else {
        clusters.push({
          id: norm || raw.toLowerCase(),
          canonical: raw,
          norm: norm,
          rawNames: [raw],
          totalCount: rawCounts[raw].count,
        });
      }
    }

    // 3. Map each raw name to its cluster
    const rawToClusterMap = new Map<string, Cluster>();
    clusters.forEach((c) => {
      c.rawNames.forEach((rn) => {
        rawToClusterMap.set(rn, c);
      });
    });

    // 4. Aggregate metrics per cluster
    const providerMap = new Map<string, GroupedProvider>();
    let totalFacturado = 0;
    let totalOrdenes = 0;
    let aliasCount = 0;

    clusters.forEach((c) => {
      aliasCount += c.rawNames.length > 1 ? c.rawNames.length - 1 : 0;
      providerMap.set(c.id, {
        id: c.id,
        name: c.canonical,
        aliases: c.rawNames,
        totalMonto: 0,
        totalOrders: 0,
        averageTicket: 0,
        hoytsMonto: 0,
        hoytsOrders: 0,
        cmkMonto: 0,
        cmkOrders: 0,
        orders: [],
        percentageOfTotalMonto: 0,
        percentageOfTotalOrders: 0,
      });
    });

    filteredOrders.forEach((o) => {
      const r = o.razonSocial || "Sin Proveedor";
      const c = rawToClusterMap.get(r);
      if (!c) return;

      const p = providerMap.get(c.id);
      if (!p) return;

      p.orders.push(o);
      p.totalOrders += 1;
      p.totalMonto += o.monto;

      if (o.empresa === "Hoyts") {
        p.hoytsMonto += o.monto;
        p.hoytsOrders += 1;
      } else {
        p.cmkMonto += o.monto;
        p.cmkOrders += 1;
      }

      totalFacturado += o.monto;
      totalOrdenes += 1;
    });

    const result: GroupedProvider[] = [];
    providerMap.forEach((p) => {
      if (p.totalOrders > 0) {
        p.averageTicket = p.totalMonto / p.totalOrders;
        p.percentageOfTotalMonto = totalFacturado > 0 ? (p.totalMonto / totalFacturado) * 100 : 0;
        p.percentageOfTotalOrders = totalOrdenes > 0 ? (p.totalOrders / totalOrdenes) * 100 : 0;
        result.push(p);
      }
    });

    return {
      groupedProviders: result,
      totalFacturadoGeneral: totalFacturado,
      totalOrdenesValidas: totalOrdenes,
      rawAliasesCount: aliasCount,
    };
  }, [filteredOrders]);

  // ==========================================
  // TOP RANKINGS
  // ==========================================
  const topFacturacion = useMemo(() => {
    return [...groupedProviders].sort((a, b) => b.totalMonto - a.totalMonto).slice(0, 10);
  }, [groupedProviders]);

  const topOrdenes = useMemo(() => {
    return [...groupedProviders].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 10);
  }, [groupedProviders]);

  // ==========================================
  // COMPANY BREAKDOWN (HOYTS VS CMK)
  // ==========================================
  const companyBreakdown = useMemo(() => {
    let hoytsMonto = 0;
    let hoytsOrders = 0;
    let cmkMonto = 0;
    let cmkOrders = 0;

    filteredOrders.forEach((o) => {
      if (o.empresa === "Hoyts") {
        hoytsMonto += o.monto;
        hoytsOrders += 1;
      } else {
        cmkMonto += o.monto;
        cmkOrders += 1;
      }
    });

    const totalMonto = hoytsMonto + cmkMonto;
    const totalOrders = hoytsOrders + cmkOrders;

    return {
      hoytsMonto,
      hoytsOrders,
      hoytsPercent: totalMonto > 0 ? (hoytsMonto / totalMonto) * 100 : 0,
      cmkMonto,
      cmkOrders,
      cmkPercent: totalMonto > 0 ? (cmkMonto / totalMonto) * 100 : 0,
      totalMonto,
      totalOrders,
    };
  }, [filteredOrders]);

  // ==========================================
  // MONTHLY BREAKDOWN
  // ==========================================
  const monthlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      name: MONTH_NAMES[i],
      monto: 0,
      orders: 0,
    }));

    filteredOrders.forEach((o) => {
      if (o.month !== null && o.month >= 0 && o.month < 12) {
        months[o.month].monto += o.monto;
        months[o.month].orders += 1;
      }
    });

    const maxMonto = Math.max(...months.map((m) => m.monto), 1);
    const maxOrders = Math.max(...months.map((m) => m.orders), 1);

    return { months, maxMonto, maxOrders };
  }, [filteredOrders]);

  // ==========================================
  // PAYMENT METHODS & STATUS BREAKDOWN
  // ==========================================
  const paymentMethods = useMemo(() => {
    const counts: Record<string, { count: number; monto: number }> = {};
    filteredOrders.forEach((o) => {
      const fp = o.formaPago || "30DFF";
      if (!counts[fp]) counts[fp] = { count: 0, monto: 0 };
      counts[fp].count += 1;
      counts[fp].monto += o.monto;
    });

    return Object.entries(counts)
      .map(([method, data]) => ({
        method,
        count: data.count,
        monto: data.monto,
        percent: totalFacturadoGeneral > 0 ? (data.monto / totalFacturadoGeneral) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 6);
  }, [filteredOrders, totalFacturadoGeneral]);

  const orderStatuses = useMemo(() => {
    let entregadas = 0;
    let liberadas = 0;
    let mandadas = 0;
    let pendientes = 0;
    let canceladas = 0;

    ordersInScope.forEach((o) => {
      if (o.cancelada) canceladas++;
      else if (o.entregada) entregadas++;
      else if (o.liberada) liberadas++;
      else if (o.mandada) mandadas++;
      else pendientes++;
    });

    return { entregadas, liberadas, mandadas, pendientes, canceladas };
  }, [ordersInScope]);

  // ==========================================
  // TABLE FILTERING & SORTING
  // ==========================================
  const displayedProviders = useMemo(() => {
    let list = groupedProviders.filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      const inCanonical = p.name.toLowerCase().includes(q);
      const inAliases = p.aliases.some((a) => a.toLowerCase().includes(q));
      return inCanonical || inAliases;
    });

    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortBy === "monto") {
        valA = a.totalMonto;
        valB = b.totalMonto;
      } else if (sortBy === "count") {
        valA = a.totalOrders;
        valB = b.totalOrders;
      } else if (sortBy === "promedio") {
        valA = a.averageTicket;
        valB = b.averageTicket;
      } else if (sortBy === "nombre") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return list;
  }, [groupedProviders, searchQuery, sortBy, sortOrder]);

  // ==========================================
  // CAPEX & PCT COMPUTED METRICS
  // ==========================================
  const allCapexOrders = useMemo(() => {
    return orders.filter((o) => !o.cancelada && isCapexOrder(o));
  }, [orders]);

  const filteredCapexOrders = useMemo(() => {
    return filteredOrders.filter((o) => isCapexOrder(o));
  }, [filteredOrders]);

  const capexStats = useMemo(() => {
    let totalMonto = 0;
    let hoytsMonto = 0;
    let hoytsOrders = 0;
    let cmkMonto = 0;
    let cmkOrders = 0;
    let sinEmpresaMonto = 0;
    let sinEmpresaOrders = 0;
    let pctCount = 0;
    let pctMonto = 0;
    let capexTagCount = 0;
    let capexTagMonto = 0;

    const months = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      name: MONTH_NAMES[i],
      monto: 0,
      orders: 0,
    }));

    const yearsMap: Record<number, { year: number; monto: number; orders: number }> = {};

    filteredCapexOrders.forEach((o) => {
      totalMonto += o.monto;

      if (o.empresa === "Hoyts") {
        hoytsMonto += o.monto;
        hoytsOrders++;
      } else if (o.empresa === "CMK") {
        cmkMonto += o.monto;
        cmkOrders++;
      } else {
        sinEmpresaMonto += o.monto;
        sinEmpresaOrders++;
      }

      const tag = getCapexTag(o.motivo);
      if (tag === "PCT") {
        pctCount++;
        pctMonto += o.monto;
      } else {
        capexTagCount++;
        capexTagMonto += o.monto;
      }

      if (o.month !== null && o.month >= 0 && o.month < 12) {
        months[o.month].monto += o.monto;
        months[o.month].orders += 1;
      }

      if (o.year) {
        if (!yearsMap[o.year]) {
          yearsMap[o.year] = { year: o.year, monto: 0, orders: 0 };
        }
        yearsMap[o.year].monto += o.monto;
        yearsMap[o.year].orders += 1;
      }
    });

    const totalOrders = filteredCapexOrders.length;
    const avgTicket = totalOrders > 0 ? totalMonto / totalOrders : 0;
    const percentOfGeneralMonto = totalFacturadoGeneral > 0 ? (totalMonto / totalFacturadoGeneral) * 100 : 0;
    const percentOfGeneralOrders = totalOrdenesValidas > 0 ? (totalOrders / totalOrdenesValidas) * 100 : 0;

    const maxMonthOrders = Math.max(...months.map((m) => m.orders), 1);
    const maxMonthMonto = Math.max(...months.map((m) => m.monto), 1);

    const sortedYears = Object.values(yearsMap).sort((a, b) => b.year - a.year);
    const maxYearOrders = Math.max(...sortedYears.map((y) => y.orders), 1);
    const maxYearMonto = Math.max(...sortedYears.map((y) => y.monto), 1);

    const providerCapexMap: Record<string, { name: string; monto: number; count: number }> = {};
    filteredCapexOrders.forEach((o) => {
      const raw = o.razonSocial || "Sin Proveedor";
      const cleaned = cleanProviderName(raw);
      const key = cleaned || raw;
      if (!providerCapexMap[key]) {
        providerCapexMap[key] = { name: raw, monto: 0, count: 0 };
      }
      providerCapexMap[key].monto += o.monto;
      providerCapexMap[key].count += 1;
    });

    const topCapexProviders = Object.values(providerCapexMap)
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 8)
      .map((p) => ({
        ...p,
        percent: totalMonto > 0 ? (p.monto / totalMonto) * 100 : 0,
      }));

    return {
      totalMonto,
      totalOrders,
      avgTicket,
      percentOfGeneralMonto,
      percentOfGeneralOrders,
      hoytsMonto,
      hoytsOrders,
      cmkMonto,
      cmkOrders,
      sinEmpresaMonto,
      sinEmpresaOrders,
      pctCount,
      pctMonto,
      capexTagCount,
      capexTagMonto,
      months,
      maxMonthOrders,
      maxMonthMonto,
      sortedYears,
      maxYearOrders,
      maxYearMonto,
      topCapexProviders,
    };
  }, [filteredCapexOrders, totalFacturadoGeneral, totalOrdenesValidas]);

  // Año activo para presupuestos y gastos CAPEX
  const currentCapexYear = useMemo(() => {
    return selectedYear !== "Todos" ? Number(selectedYear) : new Date().getFullYear();
  }, [selectedYear]);

  // Movimientos corporativos sin OC filtrados según el año y empresa seleccionados
  const activeCapexGastosDirectos = useMemo(() => {
    return capexGastosDirectos.filter((g) => {
      if (selectedYear !== "Todos" && g.anio !== Number(selectedYear)) {
        return false;
      }
      if (selectedEmpresa !== "Todas") {
        if (g.tipo === "REASIGNACION") {
          if (g.empresa !== selectedEmpresa && g.empresaDestino !== selectedEmpresa) {
            return false;
          }
        } else if (g.empresa !== selectedEmpresa) {
          return false;
        }
      }
      return true;
    });
  }, [capexGastosDirectos, selectedYear, selectedEmpresa]);

  // Métricas de Presupuesto Anual vs Gastos Reales (OCs + Movimientos corporativos sin OC)
  const capexBudgetStats = useMemo(() => {
    const budgetForYear = capexBudgets[currentCapexYear] || {
      anio: currentCapexYear,
      hoytsBudget: 0,
      cmkBudget: 0,
      observaciones: "",
    };

    const baseHoytsBudget = budgetForYear.hoytsBudget || 0;
    const baseCmkBudget = budgetForYear.cmkBudget || 0;

    // Movimientos del año en curso
    const yearMovements = capexGastosDirectos.filter((g) => g.anio === currentCapexYear);

    let hoytsGastosDirectosMonto = 0;
    let cmkGastosDirectosMonto = 0;

    let extraHoytsMonto = 0;
    let extraCmkMonto = 0;

    let reasignacionHoytsMonto = 0; // positivo si recibe fondos, negativo si cede fondos
    let reasignacionCmkMonto = 0; // positivo si recibe fondos, negativo si cede fondos

    yearMovements.forEach((m) => {
      const monto = m.monto || 0;
      if (m.tipo === "EXTRA_CAPEX") {
        if (m.empresa === "Hoyts") extraHoytsMonto += monto;
        else if (m.empresa === "CMK") extraCmkMonto += monto;
      } else if (m.tipo === "REASIGNACION") {
        // m.empresa es la que cede (origen), m.empresaDestino es la que recibe (destino)
        if (m.empresa === "Hoyts") {
          reasignacionHoytsMonto -= monto;
          reasignacionCmkMonto += monto;
        } else if (m.empresa === "CMK") {
          reasignacionCmkMonto -= monto;
          reasignacionHoytsMonto += monto;
        }
      } else {
        // Gasto directo regular sin OC
        if (m.empresa === "Hoyts") hoytsGastosDirectosMonto += monto;
        else if (m.empresa === "CMK") cmkGastosDirectosMonto += monto;
      }
    });

    const totalGastosDirectosMonto = hoytsGastosDirectosMonto + cmkGastosDirectosMonto;

    // Presupuestos Efectivos disponibles para gastar en el año:
    // Base + Extra CAPEX asignado + Ajuste por Reasignación
    const hoytsBudget = Math.max(0, baseHoytsBudget + extraHoytsMonto + reasignacionHoytsMonto);
    const cmkBudget = Math.max(0, baseCmkBudget + extraCmkMonto + reasignacionCmkMonto);
    const totalBudget = hoytsBudget + cmkBudget;

    // OCs CAPEX
    const hoytsOcMonto = capexStats.hoytsMonto;
    const cmkOcMonto = capexStats.cmkMonto;
    const totalOcMonto = capexStats.totalMonto;

    // Total consumido / gastado por compañía y ambas
    const hoytsTotalGastado = hoytsOcMonto + hoytsGastosDirectosMonto;
    const cmkTotalGastado = cmkOcMonto + cmkGastosDirectosMonto;
    const totalGastadoAmbas = hoytsTotalGastado + cmkTotalGastado;

    // Saldos disponibles / restantes
    const hoytsRestante = hoytsBudget - hoytsTotalGastado;
    const cmkRestante = cmkBudget - cmkTotalGastado;
    const totalRestante = totalBudget - totalGastadoAmbas;

    // Porcentajes de ejecución
    const hoytsPercent = hoytsBudget > 0 ? (hoytsTotalGastado / hoytsBudget) * 100 : 0;
    const cmkPercent = cmkBudget > 0 ? (cmkTotalGastado / cmkBudget) * 100 : 0;
    const totalPercent = totalBudget > 0 ? (totalGastadoAmbas / totalBudget) * 100 : 0;

    return {
      year: currentCapexYear,
      budgetForYear,
      baseHoytsBudget,
      baseCmkBudget,
      extraHoytsMonto,
      extraCmkMonto,
      reasignacionHoytsMonto,
      reasignacionCmkMonto,
      hoytsBudget,
      cmkBudget,
      totalBudget,
      hoytsOcMonto,
      cmkOcMonto,
      totalOcMonto,
      hoytsGastosDirectosMonto,
      cmkGastosDirectosMonto,
      totalGastosDirectosMonto,
      hoytsTotalGastado,
      cmkTotalGastado,
      totalGastadoAmbas,
      hoytsRestante,
      cmkRestante,
      totalRestante,
      hoytsPercent,
      cmkPercent,
      totalPercent,
      totalMovimientosCount: activeCapexGastosDirectos.length,
    };
  }, [currentCapexYear, capexBudgets, capexGastosDirectos, activeCapexGastosDirectos, capexStats]);

  const displayedCapexOrders = useMemo(() => {
    let list = filteredCapexOrders.filter((o) => {
      const tag = getCapexTag(o.motivo);
      if (capexTypeFilter !== "Todos" && tag !== capexTypeFilter) {
        return false;
      }
      if (!capexSearchQuery.trim()) return true;
      const q = capexSearchQuery.toLowerCase().trim();
      return (
        (o.numOC && o.numOC.toLowerCase().includes(q)) ||
        (o.razonSocial && o.razonSocial.toLowerCase().includes(q)) ||
        (o.motivo && o.motivo.toLowerCase().includes(q)) ||
        (o.creadoPor && o.creadoPor.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      if (capexSortBy === "monto") {
        return capexSortOrder === "asc" ? a.monto - b.monto : b.monto - a.monto;
      }
      if (capexSortBy === "fecha") {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return capexSortOrder === "asc" ? timeA - timeB : timeB - timeA;
      }
      if (capexSortBy === "numOC") {
        const numA = parseInt(a.numOC, 10) || 0;
        const numB = parseInt(b.numOC, 10) || 0;
        return capexSortOrder === "asc" ? numA - numB : numB - numA;
      }
      if (capexSortBy === "proveedor") {
        const pA = (a.razonSocial || "").toLowerCase();
        const pB = (b.razonSocial || "").toLowerCase();
        return capexSortOrder === "asc" ? pA.localeCompare(pB) : pB.localeCompare(pA);
      }
      return 0;
    });

    return list;
  }, [filteredCapexOrders, capexTypeFilter, capexSearchQuery, capexSortBy, capexSortOrder]);

  const CAPEX_PAGE_SIZE = 50;
  const totalCapexPages = Math.max(1, Math.ceil(displayedCapexOrders.length / CAPEX_PAGE_SIZE));
  const paginatedCapexOrders = useMemo(() => {
    const start = (capexPage - 1) * CAPEX_PAGE_SIZE;
    return displayedCapexOrders.slice(start, start + CAPEX_PAGE_SIZE);
  }, [displayedCapexOrders, capexPage]);

  // Reset page when search or filters change
  useEffect(() => {
    setCapexPage(1);
  }, [capexSearchQuery, capexTypeFilter, capexSortBy, capexSortOrder, selectedYear, selectedEmpresa]);

  const handleExportarCapexExcel = () => {
    if (displayedCapexOrders.length === 0) {
      showToast("⚠️ No hay órdenes CAPEX para exportar con los filtros actuales");
      return;
    }

    const dataToExport = displayedCapexOrders.map((o, idx) => ({
      "N°": idx + 1,
      "N° OC": o.numOC,
      "Tipo": getCapexTag(o.motivo),
      "Proveedor": o.razonSocial,
      "Monto ($)": o.monto,
      "Fecha": o.dateStr,
      "Año": o.year || "-",
      "Empresa": o.empresa || "Sin Asignar",
      "Motivo / Proyecto": o.motivo,
      "Usuario": o.creadoPor || "-",
      "Forma de Pago": o.formaPago || "-",
      "Estado": o.entregada ? "Entregada" : o.liberada ? "Liberada" : o.mandada ? "Mandada" : "Pendiente",
    }));

    const filename = `Reporte_CAPEX_PCT_${selectedYear !== "Todos" ? selectedYear : "Historico"}_${new Date().toISOString().split("T")[0]}`;
    exportToExcel(dataToExport, filename, "Órdenes CAPEX");
    showToast("📊 Listado CAPEX exportado a Excel con éxito");
  };

  // ==========================================
  // EXPORT TO EXCEL
  // ==========================================
  const handleExportarExcel = () => {
    if (displayedProviders.length === 0) {
      showToast("⚠️ No hay proveedores para exportar con los filtros actuales");
      return;
    }

    const dataToExport = displayedProviders.map((p, idx) => ({
      "Ranking": idx + 1,
      "Proveedor": p.name,
      "Variantes / Alias Detectados": p.aliases.join(", "),
      "Facturación Total ($)": p.totalMonto,
      "% Participación Facturación": `${p.percentageOfTotalMonto.toFixed(2)}%`,
      "Cantidad de OCs": p.totalOrders,
      "% Participación OCs": `${p.percentageOfTotalOrders.toFixed(2)}%`,
      "Ticket Promedio ($)": Math.round(p.averageTicket),
      "Facturación Hoyts ($)": p.hoytsMonto,
      "OCs Hoyts": p.hoytsOrders,
      "Facturación Cinemark ($)": p.cmkMonto,
      "OCs Cinemark": p.cmkOrders,
    }));

    const filename = `Estadisticas_Proveedores_${selectedYear !== "Todos" ? selectedYear : "Historico"}_${new Date().toISOString().split("T")[0]}`;
    exportToExcel(dataToExport, filename, "Ranking Proveedores");
    showToast("📊 Archivo Excel exportado con éxito");
  };

  const handleExportarProveedorOCs = (provider: GroupedProvider) => {
    const dataToExport = provider.orders.map((o) => {
      let estado = "Pendiente";
      if (o.cancelada) estado = "Cancelada";
      else if (o.entregada) estado = "Entregada";
      else if (o.liberada) estado = "Liberada";
      else if (o.mandada) estado = "Mandada";

      return {
        "N° OC": o.numOC,
        "N° Solicitud": o.numSolicitud || "-",
        "Fecha": o.dateStr,
        "Empresa": o.empresa,
        "Proveedor (Original)": o.razonSocial,
        "Monto ($)": o.monto,
        "Forma de Pago": o.formaPago,
        "Estado": estado,
        "Motivo / Detalle": o.motivo,
      };
    });

    const filename = `OCs_${provider.name.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}`;
    exportToExcel(dataToExport, filename, "Detalle OCs");
    showToast(`📊 OCs de ${provider.name} exportadas con éxito`);
  };

  // Format relative last sync string
  const formattedLastSync = useMemo(() => {
    if (!lastSync) return null;
    try {
      const date = new Date(lastSync);
      return date.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return lastSync;
    }
  }, [lastSync]);

  return (
    <AppLayout
      title="Estadísticas"
      subtitle="Análisis anual de proveedores, facturación y órdenes de compra"
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 text-slate-200">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/95 border border-white/20 text-white shadow-2xl shadow-indigo-500/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  Estadísticas & Análisis de Proveedores
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-normal">
                    Anual / Histórico
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Ranking de proveedores con mayor facturación, volumen de órdenes y unificación inteligente de variantes.
                </p>
              </div>
            </div>
          </div>

          {/* ACTIONS & CACHE PANEL */}
          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            {/* Última sincronización badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-xs text-slate-300">
              <span className={`w-2 h-2 rounded-full ${formattedLastSync ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Última sincronización:{" "}
                <strong className="text-white font-medium font-mono">
                  {formattedLastSync || "Sin sincronizar"}
                </strong>
              </span>
            </div>

            {/* Botones de acción colocados directamente abajo */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleActualizarDatos}
                disabled={loading}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 shadow-lg cursor-pointer ${
                  loading
                    ? "bg-indigo-600/50 text-indigo-200 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 active:scale-95"
                }`}
                title="Descarga todas las órdenes desde Firebase y actualiza la caché local"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-white" : ""}`} />
                <span>{loading ? "Sincronizando..." : "Actualizar datos"}</span>
              </button>

              <button
                onClick={activeTab === "general" ? handleExportarExcel : handleExportarCapexExcel}
                disabled={activeTab === "general" ? displayedProviders.length === 0 : displayedCapexOrders.length === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title={activeTab === "general" ? "Exportar análisis de proveedores a archivo Excel" : "Exportar listado de órdenes CAPEX & PCT a archivo Excel"}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{activeTab === "general" ? "Exportar Excel" : "Exportar CAPEX"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* WELCOME / EMPTY CACHE STATE */}
        {orders.length === 0 && !loading && (
          <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-dashed border-indigo-500/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              No hay datos sincronizados en este dispositivo
            </h3>
            <p className="text-sm text-slate-400 max-w-lg mx-auto mb-6">
              Para proteger tu cuota de lecturas en Firestore, esta pestaña no realiza consultas automáticas al entrar.
              Haz clic en el botón a continuación para descargar el historial y guardarlo en la caché local.
            </p>
            <button
              onClick={handleActualizarDatos}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Cargar y Sincronizar Órdenes Ahora</span>
            </button>
          </div>
        )}

        {/* MAIN DASHBOARD (WHEN ORDERS ARE LOADED) */}
        {orders.length > 0 && (
          <>
            {/* TOP NAVIGATION TABS: Proveedores vs CAPEX */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("general")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "general"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-white/10"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-indigo-300" />
                  <span>Proveedores & Facturación</span>
                </button>

                <button
                  onClick={() => setActiveTab("capex")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "capex"
                      ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30 ring-1 ring-white/20"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-white/10"
                  }`}
                >
                  <HardHat className="w-4 h-4 text-amber-400" />
                  <span>Dashboard CAPEX & PCT</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      activeTab === "capex"
                        ? "bg-black/40 text-white"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {filteredCapexOrders.length} OCs
                  </span>
                </button>
              </div>

              {/* Quick info indicator */}
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                {activeTab === "general" ? (
                  <span>Analizando compras generales, operativas y ranking de proveedores unificados.</span>
                ) : (
                  <span className="text-amber-400/90 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    Filtrado por órdenes con descripción <strong>CAPEX</strong> o código <strong>PCT</strong>.
                  </span>
                )}
              </div>
            </div>

            {/* FILTERS BAR */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto min-w-0 max-w-full">
                {/* Year filter: responsive con scroll táctil suave y selector rápido para listas largas de años */}
                <div className="w-full sm:w-auto max-w-full flex items-center bg-slate-800/80 p-1 rounded-xl border border-white/10 min-w-0">
                  <div className="flex items-center gap-1.5 px-2 text-xs text-slate-400 shrink-0 select-none">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Año:</span>
                  </div>

                  {/* Acceso rápido desplegable para cuando hay muchos años */}
                  <div className="relative shrink-0 flex items-center pr-1 border-r border-white/10">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      aria-label="Seleccionar año de la lista completa"
                      title="Seleccionar año"
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    >
                      <option value="Todos" className="bg-slate-900 text-white">Todos los años</option>
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr} className="bg-slate-900 text-white">
                          Año {yr}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="Ver todos los años en lista desplegable"
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Pills con scroll horizontal táctil que no desbordan en móvil */}
                  <div
                    ref={yearContainerRef}
                    className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5 px-1 scrollbar-thin scroll-smooth touch-pan-x flex-1 min-w-0"
                  >
                    <button
                      ref={selectedYear === "Todos" ? activeYearRef : undefined}
                      onClick={() => setSelectedYear("Todos")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                        selectedYear === "Todos"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Todos
                    </button>
                    {availableYears.map((yr) => (
                      <button
                        key={yr}
                        ref={selectedYear === yr ? activeYearRef : undefined}
                        onClick={() => setSelectedYear(yr)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                          selectedYear === yr
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Company filter */}
                <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-white/10 shrink-0">
                  <div className="flex items-center gap-1.5 px-2 text-xs text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Empresa:</span>
                  </div>
                  {(["Todas", "Hoyts", "CMK"] as const).map((emp) => (
                    <button
                      key={emp}
                      onClick={() => setSelectedEmpresa(emp)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedEmpresa === emp
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {emp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input (adapted to active tab) */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                {activeTab === "general" ? (
                  <>
                    <input
                      type="text"
                      placeholder="Buscar proveedor o alias..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Buscar en CAPEX (OC, proveedor, obra)..."
                      value={capexSearchQuery}
                      onChange={(e) => setCapexSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                    {capexSearchQuery && (
                      <button
                        onClick={() => setCapexSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {activeTab === "general" ? (
              <>
                {/* CAPEX DISCOVERY BANNER */}
                {filteredCapexOrders.length > 0 && (
                  <div
                    onClick={() => setActiveTab("capex")}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border border-amber-500/20 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-500/40 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
                        <HardHat className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white">Inversiones de Capital detectadas:</span>{" "}
                        <span className="text-slate-300">
                          Hay <strong className="text-amber-300">{filteredCapexOrders.length} órdenes de CAPEX & PCT</strong> por{" "}
                          <strong className="text-emerald-400 font-mono">{formatCurrency(capexStats.totalMonto)}</strong> en este período.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform shrink-0">
                      <span>Ver Dashboard CAPEX</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                {/* KPI SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Total Facturado */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-emerald-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Facturación Total</span>
                  <Coins className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight truncate">
                  {formatCurrency(totalFacturadoGeneral)}
                </div>
                <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>En período seleccionado</span>
                </div>
              </div>

              {/* Total Órdenes */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-indigo-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all" />
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Total de Órdenes (OCs)</span>
                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight">
                  {totalOrdenesValidas}
                </div>
                <div className="text-[11px] text-indigo-300/80 mt-1">
                  {companyBreakdown.hoytsOrders} Hoyts · {companyBreakdown.cmkOrders} CMK
                </div>
              </div>

              {/* Ticket Promedio */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-cyan-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all" />
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Ticket Promedio</span>
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight truncate">
                  {formatCurrency(totalOrdenesValidas > 0 ? totalFacturadoGeneral / totalOrdenesValidas : 0)}
                </div>
                <div className="text-[11px] text-cyan-300/80 mt-1">
                  Promedio por orden de compra
                </div>
              </div>

              {/* Proveedores Únicos */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-purple-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all" />
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Proveedores Únicos</span>
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight flex items-baseline gap-2">
                  <span>{groupedProviders.length}</span>
                  {rawAliasesCount > 0 && (
                    <span className="text-[10px] text-purple-300 font-normal px-1.5 py-0.5 rounded bg-purple-500/20">
                      +{rawAliasesCount} variantes
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-purple-300/80 mt-1">
                  Unificados con coincidencia fuzzy
                </div>
              </div>

              {/* Top Proveedor Facturación */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-amber-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Top Facturación</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-white tracking-tight truncate" title={topFacturacion[0]?.name || "-"}>
                  {topFacturacion[0]?.name || "-"}
                </div>
                <div className="text-[11px] text-amber-300/90 mt-1 truncate">
                  {topFacturacion[0] ? `${formatCurrency(topFacturacion[0].totalMonto)} (${topFacturacion[0].percentageOfTotalMonto.toFixed(1)}%)` : "-"}
                </div>
              </div>

              {/* Top Proveedor Órdenes */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-rose-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all" />
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Top Cantidad OCs</span>
                  <Layers className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-sm font-bold text-white tracking-tight truncate" title={topOrdenes[0]?.name || "-"}>
                  {topOrdenes[0]?.name || "-"}
                </div>
                <div className="text-[11px] text-rose-300/90 mt-1 truncate">
                  {topOrdenes[0] ? `${topOrdenes[0].totalOrders} OCs (${topOrdenes[0].percentageOfTotalOrders.toFixed(1)}%)` : "-"}
                </div>
              </div>
            </div>

            {/* RANKINGS & CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* TOP 10 FACTURACIÓN */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-white text-sm sm:text-base">
                      Top 10 Proveedores con Mayor Facturación
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    % del total
                  </span>
                </div>

                <div className="space-y-2.5">
                  {topFacturacion.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">Sin datos</div>
                  ) : (
                    topFacturacion.map((p, idx) => {
                      const maxTopMonto = topFacturacion[0].totalMonto || 1;
                      const relativeBar = (p.totalMonto / maxTopMonto) * 100;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setActiveProviderModal(p)}
                          className="group relative p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer overflow-hidden"
                        >
                          {/* Progress bar background */}
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500/15 to-teal-500/5 rounded-xl transition-all"
                            style={{ width: `${relativeBar}%` }}
                          />

                          <div className="relative flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                                idx === 0
                                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                                  : idx === 1
                                  ? "bg-slate-400/20 text-slate-300 border border-slate-400/40"
                                  : idx === 2
                                  ? "bg-amber-700/20 text-amber-500 border border-amber-700/40"
                                  : "bg-slate-800 text-slate-400 border border-white/5"
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="font-medium text-white truncate max-w-[180px] sm:max-w-[260px]" title={p.name}>
                                {p.name}
                              </span>
                              {p.aliases.length > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                  {p.aliases.length} nombres
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-400 text-[11px]">
                                {p.totalOrders} {p.totalOrders === 1 ? "OC" : "OCs"}
                              </span>
                              <span className="font-semibold text-emerald-400 font-mono">
                                {formatCurrency(p.totalMonto)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono w-12 text-right">
                                {p.percentageOfTotalMonto.toFixed(1)}%
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* TOP 10 CANTIDAD DE ÓRDENES */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-white text-sm sm:text-base">
                      Top 10 Proveedores con Más Órdenes Realizadas
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    % de órdenes
                  </span>
                </div>

                <div className="space-y-2.5">
                  {topOrdenes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">Sin datos</div>
                  ) : (
                    topOrdenes.map((p, idx) => {
                      const maxTopOrders = topOrdenes[0].totalOrders || 1;
                      const relativeBar = (p.totalOrders / maxTopOrders) * 100;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setActiveProviderModal(p)}
                          className="group relative p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden"
                        >
                          {/* Progress bar background */}
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500/15 to-purple-500/5 rounded-xl transition-all"
                            style={{ width: `${relativeBar}%` }}
                          />

                          <div className="relative flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                                idx === 0
                                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                                  : idx === 1
                                  ? "bg-slate-400/20 text-slate-300 border border-slate-400/40"
                                  : idx === 2
                                  ? "bg-amber-700/20 text-amber-500 border border-amber-700/40"
                                  : "bg-slate-800 text-slate-400 border border-white/5"
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="font-medium text-white truncate max-w-[180px] sm:max-w-[260px]" title={p.name}>
                                {p.name}
                              </span>
                              {p.aliases.length > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                  {p.aliases.length} nombres
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-indigo-300 font-mono">
                                {p.totalOrders} {p.totalOrders === 1 ? "OC" : "OCs"}
                              </span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                {formatCurrency(p.totalMonto)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono w-12 text-right">
                                {p.percentageOfTotalOrders.toFixed(1)}%
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* SECONDARY ANALYTICS: HOYTS VS CMK, MONTHLY, PAYMENT METHODS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* DISTRIBUCIÓN HOYTS VS CINEMARK */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-white text-sm">
                    Distribución por Empresa (Hoyts vs CMK)
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Split Visual Bar */}
                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded-full bg-slate-800 flex overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all"
                        style={{ width: `${companyBreakdown.hoytsPercent}%` }}
                        title={`Hoyts: ${companyBreakdown.hoytsPercent.toFixed(1)}%`}
                      />
                      <div
                        className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all"
                        style={{ width: `${companyBreakdown.cmkPercent}%` }}
                        title={`Cinemark: ${companyBreakdown.cmkPercent.toFixed(1)}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                      <span className="text-cyan-400">Hoyts: {companyBreakdown.hoytsPercent.toFixed(1)}%</span>
                      <span className="text-rose-400">CMK: {companyBreakdown.cmkPercent.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Cards Breakdown */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                      <div className="text-xs font-semibold text-cyan-400 mb-1 flex items-center justify-between">
                        <span>Hoyts</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20">
                          {companyBreakdown.hoytsOrders} OCs
                        </span>
                      </div>
                      <div className="text-base font-bold text-white font-mono truncate">
                        {formatCurrency(companyBreakdown.hoytsMonto)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {companyBreakdown.totalOrders > 0
                          ? `${((companyBreakdown.hoytsOrders / companyBreakdown.totalOrders) * 100).toFixed(1)}% de órdenes`
                          : "0%"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                      <div className="text-xs font-semibold text-rose-400 mb-1 flex items-center justify-between">
                        <span>Cinemark (CMK)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20">
                          {companyBreakdown.cmkOrders} OCs
                        </span>
                      </div>
                      <div className="text-base font-bold text-white font-mono truncate">
                        {formatCurrency(companyBreakdown.cmkMonto)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {companyBreakdown.totalOrders > 0
                          ? `${((companyBreakdown.cmkOrders / companyBreakdown.totalOrders) * 100).toFixed(1)}% de órdenes`
                          : "0%"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* EVOLUCIÓN MENSUAL */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        Evolución Mensual {selectedYear !== "Todos" ? `(${selectedYear})` : ""}
                      </h3>
                      <p className="text-[10px] text-slate-400">Órdenes de compra creadas por mes</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                    Por OCs Creadas
                  </span>
                </div>

                {/* 12 Months Mini-bars */}
                <div className="h-32 flex items-end justify-between gap-1 pt-4 pb-2 px-1">
                  {monthlyStats.months.map((m) => {
                    const heightPercent = monthlyStats.maxOrders > 0 ? (m.orders / monthlyStats.maxOrders) * 100 : 0;
                    return (
                      <div key={m.index} className="flex-1 flex flex-col items-center gap-1 group relative">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg border border-white/20 whitespace-nowrap z-20 pointer-events-none shadow-xl">
                          <p className="font-bold text-white">{m.name}</p>
                          <p className="text-indigo-300 font-bold">{m.orders.toLocaleString("es-AR")} OCs creadas</p>
                          <p className="text-emerald-400">{formatCurrency(m.monto)}</p>
                        </div>

                        <div className="w-full bg-slate-800 rounded-t h-24 flex items-end overflow-hidden">
                          <div
                            className={`w-full transition-all duration-300 ${
                              m.orders > 0
                                ? "bg-gradient-to-t from-indigo-600 to-purple-400 group-hover:from-indigo-500 group-hover:to-purple-300"
                                : "bg-transparent"
                            }`}
                            style={{ height: `${Math.max(heightPercent, m.orders > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors">
                          {m.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FORMAS DE PAGO & ESTADO DE ÓRDENES */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-white text-sm">
                    Formas de Pago & Estados
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Status Pills */}
                  <div className={`grid ${orderStatuses.canceladas > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-2 text-center pb-2 border-b border-white/5`}>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-[10px] text-emerald-400">Liberadas / Entregadas</div>
                      <div className="font-bold text-white text-sm">
                        {orderStatuses.liberadas + orderStatuses.entregadas}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-[10px] text-blue-400">Mandadas</div>
                      <div className="font-bold text-white text-sm">
                        {orderStatuses.mandadas}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="text-[10px] text-amber-400">Pendientes</div>
                      <div className="font-bold text-white text-sm">
                        {orderStatuses.pendientes}
                      </div>
                    </div>
                    {orderStatuses.canceladas > 0 && (
                      <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20" title="Órdenes canceladas (no sumadas a la facturación ni estadísticas)">
                        <div className="text-[10px] text-rose-400 flex items-center justify-center gap-1">
                          <span>Canceladas</span>
                        </div>
                        <div className="font-bold text-rose-300 text-sm">
                          {orderStatuses.canceladas}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top Payment Methods */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-slate-400 block mb-1">
                      Principales Condiciones de Pago:
                    </span>
                    {paymentMethods.map((pm) => (
                      <div key={pm.method} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium truncate max-w-[120px]">
                          {pm.method}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">{pm.count} OCs</span>
                          <span className="text-slate-200">{formatCurrency(pm.monto)}</span>
                          <span className="text-[10px] text-slate-500 w-9 text-right">
                            {pm.percent.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* DETAILED PROVIDER EXPLORER TABLE */}
            <div className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md overflow-hidden space-y-4">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>Explorador Completo de Proveedores</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {displayedProviders.length} {displayedProviders.length === 1 ? "proveedor" : "proveedores"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Haz clic en cualquier proveedor para ver el desglose detallado de todas sus órdenes de compra.
                  </p>
                </div>

                {/* Sorting Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-white/10 text-xs">
                    <span className="px-2 text-slate-400 flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3" /> Ordenar:
                    </span>
                    <button
                      onClick={() => {
                        if (sortBy === "monto") setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                        else { setSortBy("monto"); setSortOrder("desc"); }
                      }}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        sortBy === "monto" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Facturación {sortBy === "monto" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === "count") setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                        else { setSortBy("count"); setSortOrder("desc"); }
                      }}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        sortBy === "count" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      OCs {sortBy === "count" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === "promedio") setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                        else { setSortBy("promedio"); setSortOrder("desc"); }
                      }}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        sortBy === "promedio" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Promedio {sortBy === "promedio" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === "nombre") setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                        else { setSortBy("nombre"); setSortOrder("asc"); }
                      }}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        sortBy === "nombre" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      A-Z {sortBy === "nombre" ? (sortOrder === "asc" ? "↓" : "↑") : ""}
                    </button>
                  </div>
                </div>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-white/5 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Proveedor (Unificado)</th>
                      <th className="py-3 px-4">Variantes Detectadas</th>
                      <th className="py-3 px-4 text-right">Facturación Total</th>
                      <th className="py-3 px-4 text-center">% Fact.</th>
                      <th className="py-3 px-4 text-center">Cant. OCs</th>
                      <th className="py-3 px-4 text-right">Ticket Promedio</th>
                      <th className="py-3 px-4 text-center">Hoyts / CMK</th>
                      <th className="py-3 px-4 text-center w-24">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {displayedProviders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                          No se encontraron proveedores que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      displayedProviders.map((p, idx) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                          onClick={() => setActiveProviderModal(p)}
                        >
                          <td className="py-3 px-4 text-center text-slate-500 font-mono text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                              {p.name}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.aliases.map((alias) => (
                                <span
                                  key={alias}
                                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                    alias.toLowerCase() === p.name.toLowerCase()
                                      ? "bg-slate-800 text-slate-300 border-white/10"
                                      : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                  }`}
                                >
                                  {alias}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-400 font-mono">
                            {formatCurrency(p.totalMonto)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-300">
                            {p.percentageOfTotalMonto.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                              {p.totalOrders}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-300">
                            {formatCurrency(p.averageTicket)}
                          </td>
                          <td className="py-3 px-4 text-center text-xs">
                            <span className="text-cyan-400 font-medium">{p.hoytsOrders}H</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-rose-400 font-medium">{p.cmkOrders}C</span>
                          </td>
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setActiveProviderModal(p)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                              title="Ver detalle de todas las órdenes de este proveedor"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* CAPEX & PCT DASHBOARD */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* ============================================================================ */}
            {/* PANEL DE PRESUPUESTO ANUAL CAPEX & CONTROL DE EJECUCIÓN                     */}
            {/* ============================================================================ */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-amber-950/20 border border-amber-500/30 backdrop-blur-md space-y-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        Presupuesto Anual CAPEX & Control de Ejecución
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                        Año {currentCapexYear}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Límite presupuestario asignado por compañía para el año {currentCapexYear}. Monitorea el consumo real
                      sumando las <strong>Órdenes de Compra</strong> y los <strong>Gastos directos sin OC</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
                  <button
                    onClick={handleOpenBudgetModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-white/10 shadow-sm transition-all cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Configurar Presupuesto</span>
                  </button>

                  <button
                    onClick={handleOpenGastoModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gasto sin OC</span>
                  </button>

                  <button
                    onClick={handleOpenReasignacionModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 hover:text-white text-xs font-bold border border-purple-500/30 shadow-sm transition-all cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                    <span>Reasignación</span>
                  </button>

                  <button
                    onClick={handleOpenExtraCapexModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 hover:text-white text-xs font-bold border border-emerald-500/30 shadow-sm transition-all cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Extra CAPEX</span>
                  </button>
                </div>
              </div>

              {/* 3 Executive Comparative Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. TOTAL AMBAS COMPAÑÍAS */}
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/10 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      Total Ambas Compañías
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">
                      Consolidado {currentCapexYear}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Presupuesto Anual Combinado</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {capexBudgetStats.totalBudget > 0 ? formatCurrency(capexBudgetStats.totalBudget) : "Sin definir"}
                    </span>
                    {(capexBudgetStats.extraHoytsMonto + capexBudgetStats.extraCmkMonto) > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>Base: {formatCurrency(capexBudgetStats.baseHoytsBudget + capexBudgetStats.baseCmkBudget)}</span>
                        <span className="text-emerald-400 font-semibold">
                          +{formatCurrency(capexBudgetStats.extraHoytsMonto + capexBudgetStats.extraCmkMonto)} Extra CAPEX
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 pt-1 border-t border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Gastado:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {formatCurrency(capexBudgetStats.totalGastadoAmbas)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>OCs: {formatCurrency(capexBudgetStats.totalOcMonto)}</span>
                      <span>·</span>
                      <span>Sin OC: {formatCurrency(capexBudgetStats.totalGastosDirectosMonto)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 font-semibold">
                      <span className="text-slate-400">Saldo Disponible:</span>
                      <span
                        className={`font-mono ${
                          capexBudgetStats.totalRestante >= 0 ? "text-emerald-400" : "text-rose-400 font-bold"
                        }`}
                      >
                        {capexBudgetStats.totalBudget > 0
                          ? formatCurrency(capexBudgetStats.totalRestante)
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {capexBudgetStats.totalBudget > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Ejecución presupuestaria</span>
                        <span className="font-mono font-bold text-purple-300">
                          {capexBudgetStats.totalPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            capexBudgetStats.totalPercent > 100
                              ? "bg-rose-500"
                              : capexBudgetStats.totalPercent > 80
                              ? "bg-amber-500"
                              : "bg-gradient-to-r from-purple-500 to-indigo-500"
                          }`}
                          style={{ width: `${Math.min(capexBudgetStats.totalPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. HOYTS */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-amber-400" />
                      Hoyts
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                      {currentCapexYear}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Presupuesto Vigente</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {capexBudgetStats.hoytsBudget > 0 ? formatCurrency(capexBudgetStats.hoytsBudget) : "Sin definir"}
                    </span>
                    {(capexBudgetStats.extraHoytsMonto > 0 || capexBudgetStats.reasignacionHoytsMonto !== 0) && (
                      <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>Base: {formatCurrency(capexBudgetStats.baseHoytsBudget)}</span>
                        {capexBudgetStats.extraHoytsMonto > 0 && (
                          <span className="text-emerald-400 font-semibold">
                            +{formatCurrency(capexBudgetStats.extraHoytsMonto)} Extra
                          </span>
                        )}
                        {capexBudgetStats.reasignacionHoytsMonto !== 0 && (
                          <span className={capexBudgetStats.reasignacionHoytsMonto > 0 ? "text-purple-300 font-semibold" : "text-amber-400 font-semibold"}>
                            {capexBudgetStats.reasignacionHoytsMonto > 0 ? "+" : ""}{formatCurrency(capexBudgetStats.reasignacionHoytsMonto)} Reasig.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 pt-1 border-t border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Gastado:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {formatCurrency(capexBudgetStats.hoytsTotalGastado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>OCs: {formatCurrency(capexBudgetStats.hoytsOcMonto)}</span>
                      <span>·</span>
                      <span>Sin OC: {formatCurrency(capexBudgetStats.hoytsGastosDirectosMonto)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 font-semibold">
                      <span className="text-slate-400">Saldo Restante:</span>
                      <span
                        className={`font-mono ${
                          capexBudgetStats.hoytsRestante >= 0 ? "text-emerald-400" : "text-rose-400 font-bold"
                        }`}
                      >
                        {capexBudgetStats.hoytsBudget > 0
                          ? formatCurrency(capexBudgetStats.hoytsRestante)
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {capexBudgetStats.hoytsBudget > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Consumido</span>
                        <span className="font-mono font-bold text-amber-300">
                          {capexBudgetStats.hoytsPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            capexBudgetStats.hoytsPercent > 100
                              ? "bg-rose-500"
                              : capexBudgetStats.hoytsPercent > 80
                              ? "bg-amber-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(capexBudgetStats.hoytsPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. CINEMARK (CMK) */}
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-rose-400" />
                      CMK (Cinemark)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold">
                      {currentCapexYear}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Presupuesto Vigente</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {capexBudgetStats.cmkBudget > 0 ? formatCurrency(capexBudgetStats.cmkBudget) : "Sin definir"}
                    </span>
                    {(capexBudgetStats.extraCmkMonto > 0 || capexBudgetStats.reasignacionCmkMonto !== 0) && (
                      <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>Base: {formatCurrency(capexBudgetStats.baseCmkBudget)}</span>
                        {capexBudgetStats.extraCmkMonto > 0 && (
                          <span className="text-emerald-400 font-semibold">
                            +{formatCurrency(capexBudgetStats.extraCmkMonto)} Extra
                          </span>
                        )}
                        {capexBudgetStats.reasignacionCmkMonto !== 0 && (
                          <span className={capexBudgetStats.reasignacionCmkMonto > 0 ? "text-purple-300 font-semibold" : "text-amber-400 font-semibold"}>
                            {capexBudgetStats.reasignacionCmkMonto > 0 ? "+" : ""}{formatCurrency(capexBudgetStats.reasignacionCmkMonto)} Reasig.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 pt-1 border-t border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Gastado:</span>
                      <span className="font-mono font-bold text-rose-300">
                        {formatCurrency(capexBudgetStats.cmkTotalGastado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>OCs: {formatCurrency(capexBudgetStats.cmkOcMonto)}</span>
                      <span>·</span>
                      <span>Sin OC: {formatCurrency(capexBudgetStats.cmkGastosDirectosMonto)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 font-semibold">
                      <span className="text-slate-400">Saldo Restante:</span>
                      <span
                        className={`font-mono ${
                          capexBudgetStats.cmkRestante >= 0 ? "text-emerald-400" : "text-rose-400 font-bold"
                        }`}
                      >
                        {capexBudgetStats.cmkBudget > 0
                          ? formatCurrency(capexBudgetStats.cmkRestante)
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {capexBudgetStats.cmkBudget > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Consumido</span>
                        <span className="font-mono font-bold text-rose-300">
                          {capexBudgetStats.cmkPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            capexBudgetStats.cmkPercent > 100
                              ? "bg-rose-500"
                              : capexBudgetStats.cmkPercent > 80
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(capexBudgetStats.cmkPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* KPI CARDS CAPEX */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Invertido */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-amber-500/20 backdrop-blur-sm relative overflow-hidden group">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Inversión Total CAPEX</span>
                  <Coins className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight truncate font-mono">
                  {formatCurrency(capexStats.totalMonto)}
                </div>
                <div className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1 font-medium">
                  <TrendingUp className="w-3 h-3" />
                  <span>{capexStats.percentOfGeneralMonto.toFixed(1)}% del gasto total analizado</span>
                </div>
              </div>

              {/* Cantidad de OCs */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Total Órdenes CAPEX</span>
                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight font-mono">
                  {capexStats.totalOrders}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {capexStats.percentOfGeneralOrders.toFixed(1)}% de todas las OCs del período
                </div>
              </div>

              {/* Hoyts vs Cinemark */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Desglose por Empresa</span>
                  <Building2 className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="space-y-1 mt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-medium">Hoyts:</span>
                    <span className="font-mono font-bold text-white">{formatCurrency(capexStats.hoytsMonto)}</span>
                    <span className="text-[10px] text-slate-400">({capexStats.hoytsOrders} OCs)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-rose-300 font-medium">CMK:</span>
                    <span className="font-mono font-bold text-white">{formatCurrency(capexStats.cmkMonto)}</span>
                    <span className="text-[10px] text-slate-400">({capexStats.cmkOrders} OCs)</span>
                  </div>
                  {capexStats.sinEmpresaOrders > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Sin asignar:</span>
                      <span className="font-mono">{formatCurrency(capexStats.sinEmpresaMonto)}</span>
                      <span className="text-[10px]">({capexStats.sinEmpresaOrders})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipos de Proyecto (CAPEX vs PCT) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Etiquetas de Proyecto</span>
                  <Tag className="w-4 h-4 text-orange-400" />
                </div>
                <div className="space-y-1.5 mt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      CAPEX
                    </span>
                    <span className="font-mono font-bold text-white">{capexStats.capexTagCount} OCs</span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatCurrency(capexStats.capexTagMonto)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      PCT
                    </span>
                    <span className="font-mono font-bold text-white">{capexStats.pctCount} OCs</span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatCurrency(capexStats.pctMonto)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VISUAL CHARTS: Evolución Temporal & Top Proveedores de CAPEX */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolución de Inversión CAPEX */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {selectedYear === "Todos"
                          ? "Evolución Interanual CAPEX (2015-2026)"
                          : `Evolución Mensual CAPEX (${selectedYear})`}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Arriba: por orden de OC · Abajo: por montos
                      </p>
                    </div>
                  </div>

                  {/* Toggle: Mayor a Menor vs Cronológico */}
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 text-[10px] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setCapexMonthlySort("ranking")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        capexMonthlySort === "ranking"
                          ? "bg-amber-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Mayor a Menor
                    </button>
                    <button
                      type="button"
                      onClick={() => setCapexMonthlySort("cronologico")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        capexMonthlySort === "cronologico"
                          ? "bg-amber-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {selectedYear === "Todos" ? "Por Años" : "Ene - Dic"}
                    </button>
                  </div>
                </div>

                {/* Double Bar Charts: Arriba (OCs) & Abajo (Montos) */}
                {(() => {
                  const isAllYears = selectedYear === "Todos";
                  const itemsBase = isAllYears ? capexStats.sortedYears : capexStats.months;
                  const maxOrders = isAllYears ? capexStats.maxYearOrders : capexStats.maxMonthOrders;
                  const maxMonto = isAllYears ? capexStats.maxYearMonto : capexStats.maxMonthMonto;

                  const itemsForOrders = capexMonthlySort === "ranking"
                    ? [...itemsBase].sort((a: any, b: any) => b.orders - a.orders)
                    : itemsBase;

                  const itemsForMonto = capexMonthlySort === "ranking"
                    ? [...itemsBase].sort((a: any, b: any) => b.monto - a.monto)
                    : itemsBase;

                  return (
                    <div className="space-y-4 pt-1">
                      {/* 1. SECCIÓN ARRIBA: BARRAS POR ÓRDENES DE COMPRA (OC) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-amber-300 flex items-center gap-1.5 text-[11px]">
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {capexMonthlySort === "ranking" ? "Barras ordenadas por Cantidad de OCs" : "Cantidad de Órdenes de Compra (OCs)"}
                            </span>
                          </span>
                          <span className="text-[10px] text-amber-400/90 font-mono font-bold">
                            Total: {capexStats.totalOrders} OCs
                          </span>
                        </div>

                        <div className="h-28 flex items-end justify-between gap-1 pt-3 pb-1 px-0.5">
                          {itemsForOrders.map((item: any) => {
                            const label = isAllYears ? String(item.year).slice(2) : item.name;
                            const fullLabel = isAllYears ? `Año ${item.year}` : item.name;
                            const heightPercent = maxOrders > 0 ? (item.orders / maxOrders) * 100 : 0;
                            return (
                              <div key={`orders-${isAllYears ? item.year : item.index}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg border border-white/20 whitespace-nowrap z-20 pointer-events-none shadow-xl">
                                  <p className="font-bold text-white">{fullLabel}</p>
                                  <p className="text-amber-400 font-bold">{item.orders} OCs CAPEX</p>
                                  <p className="text-emerald-400 font-mono">{formatCurrency(item.monto)}</p>
                                </div>

                                <div className="w-full bg-slate-800/80 rounded-t h-20 flex items-end overflow-hidden">
                                  <div
                                    className={`w-full transition-all duration-300 ${
                                      item.orders > 0
                                        ? "bg-gradient-to-t from-amber-600 to-orange-400 group-hover:from-amber-500 group-hover:to-orange-300"
                                        : "bg-transparent"
                                    }`}
                                    style={{ height: `${Math.max(heightPercent, item.orders > 0 ? 8 : 0)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400 group-hover:text-amber-300 font-mono transition-colors">
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. SECCIÓN ABAJO: BARRAS POR MONTOS ($ ARS) */}
                      <div className="space-y-1.5 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {capexMonthlySort === "ranking" ? "Barras ordenadas por Montos ($ ARS)" : "Inversión por Montos ($ ARS)"}
                            </span>
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            Total: {formatCurrency(capexStats.totalMonto)}
                          </span>
                        </div>

                        <div className="h-28 flex items-end justify-between gap-1 pt-3 pb-1 px-0.5">
                          {itemsForMonto.map((item: any) => {
                            const label = isAllYears ? String(item.year).slice(2) : item.name;
                            const fullLabel = isAllYears ? `Año ${item.year}` : item.name;
                            const heightPercent = maxMonto > 0 ? (item.monto / maxMonto) * 100 : 0;
                            return (
                              <div key={`monto-${isAllYears ? item.year : item.index}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg border border-white/20 whitespace-nowrap z-20 pointer-events-none shadow-xl">
                                  <p className="font-bold text-white">{fullLabel}</p>
                                  <p className="text-emerald-400 font-bold font-mono">{formatCurrency(item.monto)}</p>
                                  <p className="text-slate-400">{item.orders} OCs CAPEX</p>
                                </div>

                                <div className="w-full bg-slate-800/80 rounded-t h-20 flex items-end overflow-hidden">
                                  <div
                                    className={`w-full transition-all duration-300 ${
                                      item.monto > 0
                                        ? "bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300"
                                        : "bg-transparent"
                                    }`}
                                    style={{ height: `${Math.max(heightPercent, item.monto > 0 ? 8 : 0)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400 group-hover:text-emerald-300 font-mono transition-colors">
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Top Proveedores en CAPEX & PCT */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        Principales Proveedores de CAPEX & PCT
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Mayores adjudicatarios en obras, equipamiento y reformas
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    Top 8
                  </span>
                </div>

                <div className="space-y-2.5">
                  {capexStats.topCapexProviders.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No hay proveedores CAPEX en este período.
                    </div>
                  ) : (
                    capexStats.topCapexProviders.map((p, idx) => (
                      <div key={p.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate max-w-[240px]">
                            <span className="font-mono text-slate-500 text-[10px] w-4">{idx + 1}.</span>
                            <span className="font-semibold text-slate-200 truncate" title={p.name}>
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-slate-400 text-[11px]">{p.count} OCs</span>
                            <span className="font-bold text-white">{formatCurrency(p.monto)}</span>
                            <span className="text-[10px] text-amber-400 font-bold w-10 text-right">
                              {p.percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full"
                            style={{ width: `${Math.min(p.percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* MOVIMIENTOS CORPORATIVOS SIN OC (Por Año) */}
            <div className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md overflow-hidden">
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <span>Movimientos corporativos sin OC</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                        Año {currentCapexYear}: {activeCapexGastosDirectos.length} {activeCapexGastosDirectos.length === 1 ? "movimiento" : "movimientos"}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Gastos directos, reasignaciones de fondos entre compañías y ampliaciones Extra CAPEX del año {currentCapexYear}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenGastoModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 transition-all cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gasto Directo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenReasignacionModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-semibold border border-purple-500/30 transition-all cursor-pointer text-xs"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                    <span>Reasignación</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenExtraCapexModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold border border-emerald-500/30 transition-all cursor-pointer text-xs"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Extra CAPEX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGastosList(!showGastosList)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                    title={showGastosList ? "Ocultar lista" : "Mostrar lista"}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        showGastosList ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {showGastosList && (
                <div>
                  {activeCapexGastosDirectos.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-3">
                      <p>No hay movimientos corporativos sin OC registrados para el año {currentCapexYear}.</p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        <button
                          type="button"
                          onClick={handleOpenGastoModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold border border-amber-500/30 text-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Registrar Gasto Directo</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenReasignacionModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-semibold border border-purple-500/30 text-xs transition-colors cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Reasignar Fondos</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenExtraCapexModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold border border-emerald-500/30 text-xs transition-colors cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Agregar Extra CAPEX</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5 sticky top-0 backdrop-blur-sm">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3 text-center">Tipo</th>
                            <th className="py-2.5 px-3 text-center">Compañía / Flujo</th>
                            <th className="py-2.5 px-3">Concepto / Motivo</th>
                            <th className="py-2.5 px-3">Proveedor / Ref</th>
                            <th className="py-2.5 px-3">Comprobante</th>
                            <th className="py-2.5 px-3 text-right">Monto</th>
                            <th className="py-2.5 px-3 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeCapexGastosDirectos.map((g, idx) => {
                            const isReasig = g.tipo === "REASIGNACION";
                            const isExtra = g.tipo === "EXTRA_CAPEX";
                            const destino = g.empresaDestino || (g.empresa === "Hoyts" ? "CMK" : "Hoyts");

                            return (
                              <tr key={g._id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                                <td className="py-2.5 px-3 text-slate-300 font-mono whitespace-nowrap">
                                  {g.fecha ? new Date(g.fecha).toLocaleDateString("es-AR") : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {isReasig ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                      Reasignación
                                    </span>
                                  ) : isExtra ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                      Extra CAPEX
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                      Gasto Directo
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {isReasig ? (
                                    <div className="inline-flex items-center gap-1 font-mono text-xs font-bold">
                                      <span className={g.empresa === "Hoyts" ? "text-amber-300" : "text-rose-300"}>
                                        {g.empresa}
                                      </span>
                                      <ArrowRight className="w-3 h-3 text-purple-400" />
                                      <span className={destino === "Hoyts" ? "text-amber-300" : "text-rose-300"}>
                                        {destino}
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        g.empresa === "Hoyts"
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                      }`}
                                    >
                                      {isExtra ? `+ ${g.empresa}` : g.empresa}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-white max-w-[240px] truncate" title={g.concepto}>
                                  {g.concepto}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300 max-w-[160px] truncate" title={g.proveedor}>
                                  {g.proveedor || "-"}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                                  {g.comprobante || "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                                  {isReasig ? (
                                    <span className="text-purple-300 font-mono">⇄ {formatCurrency(g.monto)}</span>
                                  ) : isExtra ? (
                                    <span className="text-emerald-400 font-mono font-bold">+{formatCurrency(g.monto)}</span>
                                  ) : (
                                    <span className="text-amber-300 font-mono">{formatCurrency(g.monto)}</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGastoDirecto(g._id, g.concepto)}
                                    title="Eliminar movimiento corporativo"
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TABLA EXPLORADORA DE ÓRDENES CAPEX & PCT */}
            <div className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md overflow-hidden space-y-4">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>Listado Detallado de Órdenes CAPEX & PCT</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 font-mono font-bold">
                      {displayedCapexOrders.length} {displayedCapexOrders.length === 1 ? "Orden" : "Órdenes"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Explorador y auditoría de todas las compras asociadas a obras y activos fijos.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Filter Tag Pills */}
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 text-xs">
                    {(["Todos", "CAPEX", "PCT"] as const).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setCapexTypeFilter(tag)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                          capexTypeFilter === tag
                            ? "bg-amber-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* Sort dropdown */}
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 text-xs">
                    <select
                      value={capexSortBy}
                      onChange={(e) => setCapexSortBy(e.target.value as any)}
                      className="bg-transparent text-slate-300 text-xs focus:outline-none px-2 py-0.5 cursor-pointer"
                    >
                      <option value="monto" className="bg-slate-800 text-white">Por Monto</option>
                      <option value="fecha" className="bg-slate-800 text-white">Por Fecha</option>
                      <option value="numOC" className="bg-slate-800 text-white">Por N° OC</option>
                      <option value="proveedor" className="bg-slate-800 text-white">Por Proveedor</option>
                    </select>
                    <button
                      onClick={() => setCapexSortOrder(capexSortOrder === "asc" ? "desc" : "asc")}
                      className="p-1 rounded-lg text-slate-400 hover:text-white"
                      title="Cambiar orden ascendente/descendente"
                    >
                      {capexSortOrder === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-white/5 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-16 text-center">N° OC</th>
                      <th className="py-3 px-4 w-20 text-center">Tipo</th>
                      <th className="py-3 px-4">Proveedor</th>
                      <th className="py-3 px-4">Motivo / Proyecto</th>
                      <th className="py-3 px-4 text-center">Fecha</th>
                      <th className="py-3 px-4 text-center">Empresa</th>
                      <th className="py-3 px-4 text-right">Monto</th>
                      <th className="py-3 px-4 text-center">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {paginatedCapexOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                          No se encontraron órdenes CAPEX & PCT que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      paginatedCapexOrders.map((o) => {
                        const tag = getCapexTag(o.motivo);
                        return (
                          <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-center font-mono font-bold text-white">
                              {o.numOC}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  tag === "PCT"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                }`}
                              >
                                {tag}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-200">
                              {o.razonSocial}
                            </td>
                            <td className="py-3 px-4 text-slate-300 max-w-[320px] truncate" title={o.motivo}>
                              {o.motivo || "-"}
                            </td>
                            <td className="py-3 px-4 text-center text-xs font-mono text-slate-400 whitespace-nowrap">
                              {o.dateStr}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {o.empresa === "Hoyts" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  Hoyts
                                </span>
                              ) : o.empresa === "CMK" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  CMK
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-white/5">
                                  Sin Asignar
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {formatCurrency(o.monto)}
                            </td>
                            <td className="py-3 px-4 text-center text-xs text-slate-400">
                              {o.creadoPor}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalCapexPages > 1 && (
                <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    Mostrando {((capexPage - 1) * CAPEX_PAGE_SIZE) + 1} a {Math.min(capexPage * CAPEX_PAGE_SIZE, displayedCapexOrders.length)} de {displayedCapexOrders.length} órdenes
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCapexPage((p) => Math.max(1, p - 1))}
                      disabled={capexPage === 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="font-mono text-white px-2">
                      {capexPage} / {totalCapexPages}
                    </span>
                    <button
                      onClick={() => setCapexPage((p) => Math.min(totalCapexPages, p + 1))}
                      disabled={capexPage === totalCapexPages}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )}

        {/* PROVIDER DETAIL MODAL */}
        {activeProviderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/10 flex items-start justify-between bg-slate-800/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {activeProviderModal.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                      {activeProviderModal.totalOrders} {activeProviderModal.totalOrders === 1 ? "Orden" : "Órdenes"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-slate-400">Variantes unificadas:</span>
                    {activeProviderModal.aliases.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/10"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportarProveedorOCs(activeProviderModal)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exportar OCs</span>
                  </button>
                  <button
                    onClick={() => setActiveProviderModal(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Summary KPIs inside modal */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/80 border-b border-white/5 text-xs">
                <div className="p-3 rounded-xl bg-slate-800/40 border border-white/5">
                  <span className="text-slate-400 block mb-1">Facturación Total</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {formatCurrency(activeProviderModal.totalMonto)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/40 border border-white/5">
                  <span className="text-slate-400 block mb-1">Ticket Promedio</span>
                  <span className="text-base font-bold text-cyan-400 font-mono">
                    {formatCurrency(activeProviderModal.averageTicket)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/40 border border-white/5">
                  <span className="text-slate-400 block mb-1">Hoyts vs CMK</span>
                  <span className="text-base font-bold text-white font-mono">
                    <span className="text-cyan-400">{activeProviderModal.hoytsOrders}</span> /{" "}
                    <span className="text-rose-400">{activeProviderModal.cmkOrders}</span>
                  </span>
                </div>
              </div>

              {/* Orders List */}
              <div className="p-4 flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-white/5 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">N° OC</th>
                      <th className="py-2.5 px-3">Solicitud</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Empresa</th>
                      <th className="py-2.5 px-3">Razón Social en OC</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3">Forma Pago</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                      <th className="py-2.5 px-3">Motivo / Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeProviderModal.orders.map((o) => {
                      let estadoBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Pendiente
                        </span>
                      );
                      if (o.cancelada) {
                        estadoBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/15 text-red-300 border border-red-500/30">
                            Cancelada
                          </span>
                        );
                      } else if (o.entregada) {
                        estadoBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Entregada
                          </span>
                        );
                      } else if (o.liberada) {
                        estadoBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            Liberada
                          </span>
                        );
                      } else if (o.mandada) {
                        estadoBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            Mandada
                          </span>
                        );
                      }

                      return (
                        <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {o.numOC || "-"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {o.numSolicitud || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                            {o.dateStr}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.empresa === "Hoyts"
                                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            }`}>
                              {o.empresa}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-[140px] truncate" title={o.razonSocial}>
                            {o.razonSocial}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                            {formatCurrency(o.monto)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px] whitespace-nowrap">
                            {o.formaPago}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {estadoBadge}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-[200px] truncate" title={o.motivo}>
                            {o.motivo || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-slate-800/40 flex justify-end">
                <button
                  onClick={() => setActiveProviderModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Configurar Presupuesto CAPEX por Año */}
        {isBudgetModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-slate-900 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Presupuesto Anual CAPEX</h3>
                    <p className="text-xs text-slate-400">Año fiscal {currentCapexYear}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveBudget} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-cyan-300 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Presupuesto Anual Hoyts ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={budgetHoytsInput}
                      onChange={(e) => setBudgetHoytsInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2.5 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Límite de gasto anual asignado a Hoyts para el año {currentCapexYear}.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Presupuesto Anual Cinemark (CMK) ($ ARS)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={budgetCmkInput}
                      onChange={(e) => setBudgetCmkInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2.5 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Límite de gasto anual asignado a Cinemark para el año {currentCapexYear}.
                  </p>
                </div>

                {/* Total Combinado Preview */}
                <div className="p-3 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Total Ambas Compañías:</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {formatCurrency((parseFloat(budgetHoytsInput) || 0) + (parseFloat(budgetCmkInput) || 0))}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Observaciones / Notas (Opcional)
                  </label>
                  <textarea
                    value={budgetObsInput}
                    onChange={(e) => setBudgetObsInput(e.target.value)}
                    rows={2}
                    placeholder="Detalles sobre la aprobación o distribución..."
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                {/* Footer buttons */}
                <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBudgetModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingBudget}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingBudget ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Guardar Presupuesto
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Registrar Gasto Directo sin Orden de Compra */}
        {isGastoModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-slate-900 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Registrar Gasto Sin Orden de Compra</h3>
                    <p className="text-xs text-slate-400">Gasto CAPEX directo imputado al año de la fecha</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGastoModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveGastoDirecto} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Empresa *
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGastoEmpresaInput("Hoyts")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          gastoEmpresaInput === "Hoyts"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                            : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800"
                        }`}
                      >
                        Hoyts
                      </button>
                      <button
                        type="button"
                        onClick={() => setGastoEmpresaInput("CMK")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                          gastoEmpresaInput === "CMK"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/10"
                            : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800"
                        }`}
                      >
                        CMK
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Fecha del Gasto *
                    </label>
                    <input
                      type="date"
                      required
                      value={gastoFechaInput}
                      onChange={(e) => setGastoFechaInput(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Año de imputación: {gastoFechaInput ? new Date(gastoFechaInput).getFullYear() : currentCapexYear}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Monto ($ ARS) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={gastoMontoInput}
                        onChange={(e) => setGastoMontoInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      N° Factura / Comprobante
                    </label>
                    <input
                      type="text"
                      value={gastoComprobanteInput}
                      onChange={(e) => setGastoComprobanteInput(e.target.value)}
                      placeholder="FC-A-0001-00012345"
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Concepto / Detalle del Gasto *
                  </label>
                  <input
                    type="text"
                    required
                    value={gastoConceptoInput}
                    onChange={(e) => setGastoConceptoInput(e.target.value)}
                    placeholder="Ej. Renovación de lámparas proyectores, obra civil..."
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Proveedor (Opcional)
                  </label>
                  <input
                    type="text"
                    value={gastoProveedorInput}
                    onChange={(e) => setGastoProveedorInput(e.target.value)}
                    placeholder="Ej. Christie Digital, Barco, Proveedor Local..."
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Observaciones (Opcional)
                  </label>
                  <textarea
                    value={gastoObsInput}
                    onChange={(e) => setGastoObsInput(e.target.value)}
                    rows={2}
                    placeholder="Detalles complementarios..."
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                </div>

                {/* Footer buttons */}
                <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGastoModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingGasto}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingGasto ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Registrar Gasto
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* Modal: Reasignación entre Compañías */}
      {isReasignacionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-500/10 via-slate-900 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reasignación de Fondos CAPEX</h3>
                  <p className="text-xs text-slate-400">Transfiere presupuesto entre compañías (Año {currentCapexYear})</p>
                </div>
              </div>
              <button
                onClick={() => setIsReasignacionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveReasignacion} className="p-5 space-y-4">
              {/* Transfer Direction Flow */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Sentido de la Transferencia
                </span>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Cede fondos (Origen)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newOrigen = reasigOrigenInput === "Hoyts" ? "CMK" : "Hoyts";
                        setReasigOrigenInput(newOrigen);
                        setReasigDestinoInput(newOrigen === "Hoyts" ? "CMK" : "Hoyts");
                      }}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs border transition-all text-center ${
                        reasigOrigenInput === "Hoyts"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {reasigOrigenInput}
                    </button>
                  </div>

                  <div className="pt-4 text-purple-400">
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Recibe fondos (Destino)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newDestino = reasigDestinoInput === "Hoyts" ? "CMK" : "Hoyts";
                        setReasigDestinoInput(newDestino);
                        setReasigOrigenInput(newDestino === "Hoyts" ? "CMK" : "Hoyts");
                      }}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs border transition-all text-center ${
                        reasigDestinoInput === "Hoyts"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {reasigDestinoInput}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 text-center">
                  Se restarán fondos de <strong>{reasigOrigenInput}</strong> y se incrementará el límite de <strong>{reasigDestinoInput}</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Monto a Transferir ($ ARS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={reasigMontoInput}
                      onChange={(e) => setReasigMontoInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={reasigFechaInput}
                    onChange={(e) => setReasigFechaInput(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Concepto / Motivo de la Reasignación *
                </label>
                <input
                  type="text"
                  required
                  value={reasigConceptoInput}
                  onChange={(e) => setReasigConceptoInput(e.target.value)}
                  placeholder="Ej. Compensación por atraso obra complejos..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  N° Comprobante / Ref. Interna (Opcional)
                </label>
                <input
                  type="text"
                  value={reasigComprobanteInput}
                  onChange={(e) => setReasigComprobanteInput(e.target.value)}
                  placeholder="Ej. MEMO-FIN-2026-004"
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={reasigObsInput}
                  onChange={(e) => setReasigObsInput(e.target.value)}
                  rows={2}
                  placeholder="Notas complementarias..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>

              {/* Footer buttons */}
              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReasignacionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReasignacion}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingReasignacion ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Reasignación
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar Extra CAPEX */}
      {isExtraCapexModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-slate-900 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Agregar Extra CAPEX</h3>
                  <p className="text-xs text-slate-400">Incrementa el presupuesto asignado para el año {currentCapexYear}</p>
                </div>
              </div>
              <button
                onClick={() => setIsExtraCapexModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveExtraCapex} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Compañía Beneficiaria *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExtraEmpresaInput("Hoyts")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        extraEmpresaInput === "Hoyts"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                          : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      Hoyts
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtraEmpresaInput("CMK")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        extraEmpresaInput === "CMK"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/10"
                          : "bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      CMK
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Fecha de Asignación *
                  </label>
                  <input
                    type="date"
                    required
                    value={extraFechaInput}
                    onChange={(e) => setExtraFechaInput(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Monto Adicional Extra ($ ARS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={extraMontoInput}
                    onChange={(e) => setExtraMontoInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Aumenta el total para gastar de <strong>{extraEmpresaInput}</strong> en este año fiscal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Concepto / Aprobación *
                </label>
                <input
                  type="text"
                  required
                  value={extraConceptoInput}
                  onChange={(e) => setExtraConceptoInput(e.target.value)}
                  placeholder="Ej. Aprobación adicional Directorio Q2..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  N° Acta / Resolución / Comprobante (Opcional)
                </label>
                <input
                  type="text"
                  value={extraComprobanteInput}
                  onChange={(e) => setExtraComprobanteInput(e.target.value)}
                  placeholder="Ej. RES-DIR-2026-08"
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Observaciones (Opcional)
                </label>
                <textarea
                  value={extraObsInput}
                  onChange={(e) => setExtraObsInput(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre el origen del fondo o condiciones..."
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              {/* Footer buttons */}
              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExtraCapexModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingExtraCapex}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingExtraCapex ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Agregar Extra CAPEX
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </AppLayout>
  );
}
