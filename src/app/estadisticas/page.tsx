"use client";

import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { exportToExcel } from "@/lib/exportToExcel";
import { fetchOrdersFromMongo } from "@/lib/serverSync";
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
  Building,
  HardHat,
  FolderKanban,
  Tag,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
  Briefcase
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
export function isCapexOrder(order?: { motivo?: string } | null): boolean {
  if (!order || !order.motivo) return false;
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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
    } catch (e) {
      console.error("Error cargando caché de estadísticas:", e);
    }
  }, []);

  // ==========================================
  // FETCH FROM LOCAL SERVER (MONGODB)
  // ==========================================
  const handleActualizarDatos = async () => {
    setLoading(true);
    try {
      // Consulta directamente a nuestro servidor local (MongoDB)
      const res = await fetchOrdersFromMongo({ limit: 0 });
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
  // FILTERED ORDERS
  // ==========================================
  const filteredOrders = useMemo(() => {
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

    filteredOrders.forEach((o) => {
      if (o.cancelada) canceladas++;
      else if (o.entregada) entregadas++;
      else if (o.liberada) liberadas++;
      else if (o.mandada) mandadas++;
      else pendientes++;
    });

    return { entregadas, liberadas, mandadas, pendientes, canceladas };
  }, [filteredOrders]);

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
    return orders.filter((o) => isCapexOrder(o));
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
              <div className="flex flex-wrap items-center gap-3">
                {/* Year filter pills */}
                <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-white/10">
                  <div className="flex items-center gap-1.5 px-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Año:</span>
                  </div>
                  <button
                    onClick={() => setSelectedYear("Todos")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
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
                      onClick={() => setSelectedYear(yr)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedYear === yr
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>

                {/* Company filter */}
                <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-white/10">
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
                  <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-white/5">
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
            {/* Banner with brief info */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Control de Inversiones de Capital (CAPEX & Proyectos PCT)
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                      {filteredCapexOrders.length} Órdenes
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Órdenes de compra detectadas automáticamente por contener el término <strong>CAPEX</strong> o el código de obra/proyecto <strong>PCT</strong> en su descripción.
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportarCapexExcel}
                disabled={displayedCapexOrders.length === 0}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all self-start sm:self-auto cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Excel ({displayedCapexOrders.length})</span>
              </button>
            </div>

            {/* KPI CARDS CAPEX */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

              {/* Ticket Promedio */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Ticket Promedio CAPEX</span>
                  <DollarSign className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight truncate font-mono">
                  {formatCurrency(capexStats.avgTicket)}
                </div>
                <div className="text-[11px] text-purple-300/80 mt-1">
                  Por cada orden de inversión
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {selectedYear === "Todos"
                          ? "Evolución Interanual de Inversiones CAPEX (2015-2026)"
                          : `Evolución Mensual CAPEX (${selectedYear})`}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {selectedYear === "Todos"
                          ? "Distribución histórica de OCs y montos por año"
                          : "Cantidad de órdenes CAPEX creadas por mes"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                    {selectedYear === "Todos" ? "Por Años" : "12 Meses"}
                  </span>
                </div>

                {/* Chart Bars */}
                {selectedYear === "Todos" ? (
                  <div className="h-40 flex items-end justify-between gap-1 pt-4 pb-2 px-1">
                    {capexStats.sortedYears.map((y) => {
                      const heightPercent = capexStats.maxYearOrders > 0 ? (y.orders / capexStats.maxYearOrders) * 100 : 0;
                      return (
                        <div key={y.year} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg border border-white/20 whitespace-nowrap z-20 pointer-events-none shadow-xl">
                            <p className="font-bold text-white">Año {y.year}</p>
                            <p className="text-amber-400 font-bold">{y.orders} OCs CAPEX</p>
                            <p className="text-emerald-400 font-mono">{formatCurrency(y.monto)}</p>
                          </div>

                          <div className="w-full bg-slate-800 rounded-t h-28 flex items-end overflow-hidden">
                            <div
                              className={`w-full transition-all duration-300 ${
                                y.orders > 0
                                  ? "bg-gradient-to-t from-amber-600 to-orange-400 group-hover:from-amber-500 group-hover:to-orange-300"
                                  : "bg-transparent"
                              }`}
                              style={{ height: `${Math.max(heightPercent, y.orders > 0 ? 8 : 0)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 group-hover:text-white font-mono transition-colors">
                            {String(y.year).slice(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-40 flex items-end justify-between gap-1 pt-4 pb-2 px-1">
                    {capexStats.months.map((m) => {
                      const heightPercent = capexStats.maxMonthOrders > 0 ? (m.orders / capexStats.maxMonthOrders) * 100 : 0;
                      return (
                        <div key={m.index} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg border border-white/20 whitespace-nowrap z-20 pointer-events-none shadow-xl">
                            <p className="font-bold text-white">{m.name}</p>
                            <p className="text-amber-400 font-bold">{m.orders} OCs CAPEX</p>
                            <p className="text-emerald-400 font-mono">{formatCurrency(m.monto)}</p>
                          </div>

                          <div className="w-full bg-slate-800 rounded-t h-28 flex items-end overflow-hidden">
                            <div
                              className={`w-full transition-all duration-300 ${
                                m.orders > 0
                                  ? "bg-gradient-to-t from-amber-600 to-orange-400 group-hover:from-amber-500 group-hover:to-orange-300"
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
                )}
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
      </div>
    </AppLayout>
  );
}
