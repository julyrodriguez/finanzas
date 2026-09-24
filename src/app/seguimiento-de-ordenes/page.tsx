"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion 
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { syncOrderToMongo, fetchOrdersFromMongo, parseMongoDocToOrdenCompra } from "@/lib/serverSync";
import { 
  Search, 
  X, 
  Copy, 
  CheckCircle2, 
  Clock, 
  Send, 
  ShieldCheck, 
  Eye, 
  Loader2, 
  PackageCheck, 
  FileSpreadsheet, 
  Layers, 
  Database, 
  Check, 
  LayoutGrid, 
  ListFilter,
  Building2,
  Sparkles
} from "lucide-react";
import { getCreadorBadgeStyle, type Nota, type OrdenCompra } from "@/types/ordenes";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { getOrderStatus, STATUS_CONFIG } from "@/components/ordenes/OrderStatusMenu";
import { DolarVentaBadge } from "@/components/ordenes/DolarVentaBadge";
import { exportToExcel } from "@/lib/exportToExcel";

interface ApprovalConfig {
  limiteNivel1: number;
  limiteNivel2: number;
  limiteNivel3: number;
  firmantes1Nivel1: string[];
  firmantes2Nivel1: string[];
  firmantes1Nivel2: string[];
  firmantes2Nivel2: string[];
  firmantes1Nivel3: string[];
  firmantes2Nivel3: string[];
  firmantes1Nivel4: string[];
  firmantes2Nivel4: string[];
}

const DEFAULT_CONFIG: ApprovalConfig = {
  limiteNivel1: 5000000,
  limiteNivel2: 18000000,
  limiteNivel3: 150000000,
  firmantes1Nivel1: ["Tomas"],
  firmantes2Nivel1: ["Victoria", "Tristan", "Jorgelina", "Pablo G.", "Diego"],
  firmantes1Nivel2: ["Pablo Mondelo"],
  firmantes2Nivel2: ["Dario"],
  firmantes1Nivel3: ["Matias", "Hernan"],
  firmantes2Nivel3: ["Dario"],
  firmantes1Nivel4: ["Dario", "Hernan"],
  firmantes2Nivel4: ["Martin"],
};

export default function SeguimientoDeOrdenesPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [dbSearchResults, setDbSearchResults] = useState<OrdenCompra[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [config, setConfig] = useState<ApprovalConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // View Mode: Cards or Compact Table
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Search, Filters and Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [queryLimit, setQueryLimit] = useState(20);
  const [hasLoadedAllFromDb, setHasLoadedAllFromDb] = useState(false);
  const [loadingAllDb, setLoadingAllDb] = useState(false);

  const isSearching = Boolean(searchQuery.trim());

  // Modals
  const [activeNotesOrden, setActiveNotesOrden] = useState<OrdenCompra | null>(null);
  const [newNotaText, setNewNotaText] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  const { user } = useAuth();
  const authorName = user?.email?.split("@")[0] || "Usuario";

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3000);
  };

  const handleLoadAllFromDb = async () => {
    loadOrdersFromServer();
  };

  // Helper to parse currency / amount
  const parseMontoToNumber = (monto: number | string): number => {
    if (typeof monto === "number") return isNaN(monto) ? 0 : monto;
    if (!monto) return 0;
    const clean = monto.replace(/[^0-9,-]/g, "").replace(",", ".");
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  };

  // Load Approval Config
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const unsubConfig = onSnapshot(
      doc(db, "configuracion_ordenes", "aprobaciones"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<ApprovalConfig>;
          setConfig({
            limiteNivel1: d.limiteNivel1 ?? DEFAULT_CONFIG.limiteNivel1,
            limiteNivel2: d.limiteNivel2 ?? DEFAULT_CONFIG.limiteNivel2,
            limiteNivel3: d.limiteNivel3 ?? DEFAULT_CONFIG.limiteNivel3,
            firmantes1Nivel1: d.firmantes1Nivel1 ?? DEFAULT_CONFIG.firmantes1Nivel1,
            firmantes2Nivel1: d.firmantes2Nivel1 ?? DEFAULT_CONFIG.firmantes2Nivel1,
            firmantes1Nivel2: d.firmantes1Nivel2 ?? DEFAULT_CONFIG.firmantes1Nivel2,
            firmantes2Nivel2: d.firmantes2Nivel2 ?? DEFAULT_CONFIG.firmantes2Nivel2,
            firmantes1Nivel3: d.firmantes1Nivel3 ?? DEFAULT_CONFIG.firmantes1Nivel3,
            firmantes2Nivel3: d.firmantes2Nivel3 ?? DEFAULT_CONFIG.firmantes2Nivel3,
            firmantes1Nivel4: d.firmantes1Nivel4 ?? DEFAULT_CONFIG.firmantes1Nivel4,
            firmantes2Nivel4: d.firmantes2Nivel4 ?? DEFAULT_CONFIG.firmantes2Nivel4,
          });
        }
      },
      (err) => console.error("Error loading approval config:", err)
    );

    return () => unsubConfig();
  }, []);

  const parseSeguimientoDoc = (id: string, data: Record<string, any>): OrdenCompra => ({
    id,
    empresa: data.empresa || "Hoyts",
    numSolicitud: data.numSolicitud || "",
    numOC: data.numOC || "",
    razonSocial: data.razonSocial || "",
    monto: data.monto || 0,
    motivo: data.motivo || "",
    formaPago: data.formaPago || "Transferencia",
    liberada: Boolean(data.liberada),
    mandada: Boolean(data.mandada),
    entregada: Boolean(data.entregada),
    cancelada: Boolean(data.cancelada),
    creadoPor: data.creadoPor || "",
    notas: data.notas || [],
    createdAt: data.createdAt || null,
    relatedOC: data.relatedOC || "",
    enviado: Boolean(data.enviado),
    enviadoA1: data.enviadoA1 || "",
    enviadoA2: data.enviadoA2 || "",
    fechaEnvio1: data.fechaEnvio1 || "",
    fechaEnvio2: data.fechaEnvio2 || "",
    firmado1: Boolean(data.firmado1),
    firmado2: Boolean(data.firmado2),
    firmante1: data.firmante1 || "",
    firmante2: data.firmante2 || "",
    fechaFirma1: data.fechaFirma1 || "",
    fechaFirma2: data.fechaFirma2 || "",
    linkSharepoint: data.linkSharepoint || "",
  });

  // Cargar órdenes directamente desde el servidor local (MongoDB)
  const loadOrdersFromServer = async () => {
    setLoading(true);
    try {
      const res = await fetchOrdersFromMongo({ limit: 0 });
      if (res && res.success && Array.isArray(res.ordenes)) {
        const allDocs: OrdenCompra[] = res.ordenes.map(parseMongoDocToOrdenCompra);
        allDocs.sort((a, b) => {
          const timeA = (a.createdAt && "seconds" in a.createdAt) ? a.createdAt.seconds : 0;
          const timeB = (b.createdAt && "seconds" in b.createdAt) ? b.createdAt.seconds : 0;
          return timeB - timeA;
        });
        setOrdenes(allDocs);
        setHasLoadedAllFromDb(true);
        setQueryLimit(allDocs.length);
      }
    } catch (err) {
      console.error("Error al cargar órdenes de seguimiento desde el servidor local:", err);
      showToast("Error al cargar órdenes desde el servidor local");
    } finally {
      setLoading(false);
      setLoadingAllDb(false);
    }
  };

  useEffect(() => {
    loadOrdersFromServer();
  }, []);

  // Búsqueda en memoria instantánea (sin lecturas de Firestore)
  useEffect(() => {
    setIsSearchingDb(false);
    setDbSearchResults([]);
  }, [searchQuery]);

  // Helper to determine signature statuses for an order
  const getOrderSignatureInfo = (orden: OrdenCompra) => {
    const numMonto = parseMontoToNumber(orden.monto);

    if (numMonto <= config.limiteNivel1) {
      const isF1 = Boolean(orden.firmado1 || (orden.firmante1 && orden.firmante1.trim().length > 0) || orden.mandada || orden.liberada);
      const isF2 = Boolean(orden.firmado2 || (orden.firmante2 && orden.firmante2.trim().length > 0) || orden.liberada);
      return {
        tierName: "Nivel 1 (≤ $5M)",
        tierKey: "Nivel 1",
        f1Label: "Tomás",
        f2Label: "Área",
        f1Signer: orden.firmante1?.trim() || (isF1 ? "Tomas" : ""),
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isComplete: isF1 && isF2,
      };
    }

    if (numMonto > config.limiteNivel1 && numMonto <= config.limiteNivel2) {
      const isF1 = Boolean(orden.firmado1 || (orden.firmante1 && orden.firmante1.trim().length > 0));
      const isF2 = Boolean(orden.firmado2 || (orden.firmante2 && orden.firmante2.trim().length > 0));
      return {
        tierName: "Nivel 2 ($5M - $18M)",
        tierKey: "Nivel 2",
        f1Label: "Pablo Mondelo",
        f2Label: "Darío",
        f1Signer: orden.firmante1?.trim() || "",
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isComplete: isF1 && isF2,
      };
    }

    if (numMonto > config.limiteNivel2 && numMonto <= config.limiteNivel3) {
      const isF1 = Boolean(orden.firmado1 || (orden.firmante1 && orden.firmante1.trim().length > 0));
      const isF2 = Boolean(orden.firmado2 || (orden.firmante2 && orden.firmante2.trim().length > 0));
      return {
        tierName: "Nivel 3 ($18M - $150M)",
        tierKey: "Nivel 3",
        f1Label: "Matías / Hernán",
        f2Label: "Darío",
        f1Signer: orden.firmante1?.trim() || "",
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isComplete: isF1 && isF2,
      };
    }

    const isF1 = Boolean(orden.firmado1 || (orden.firmante1 && orden.firmante1.trim().length > 0));
    const isF2 = Boolean(orden.firmado2 || (orden.firmante2 && orden.firmante2.trim().length > 0));
    return {
      tierName: "Nivel 4 (> $150M)",
      tierKey: "Nivel 4",
      f1Label: "Darío / Hernán",
      f2Label: "Martín",
      f1Signer: orden.firmante1?.trim() || "",
      f2Signer: orden.firmante2?.trim() || "",
      isF1Signed: isF1,
      isF2Signed: isF2,
      isComplete: isF1 && isF2,
    };
  };

  const isOrderNotSent = (orden: OrdenCompra) => {
    if (orden.liberada || orden.entregada || orden.cancelada) return false;
    const info = getOrderSignatureInfo(orden);
    if (!info.isF1Signed) return !orden.enviadoA1?.trim();
    if (!info.isF2Signed) return !orden.enviadoA2?.trim();
    return false;
  };

  const isOrderSent = (orden: OrdenCompra) => {
    if (orden.liberada || orden.entregada || orden.cancelada) return false;
    const info = getOrderSignatureInfo(orden);
    if (!info.isF1Signed) return Boolean(orden.enviadoA1?.trim());
    if (!info.isF2Signed) return Boolean(orden.enviadoA2?.trim());
    return false;
  };

  // KPIs
  const stats = useMemo(() => {
    let totalMonto = 0;
    let countMandadas = 0;
    let countLiberadas = 0;
    let countEntregadas = 0;
    let countPendientes = 0;
    let countSinEnviar = 0;
    let countEnviadas = 0;

    for (const ord of ordenes) {
      totalMonto += parseMontoToNumber(ord.monto);
      const st = getOrderStatus(ord);
      if (st === "mandada") countMandadas++;
      else if (st === "liberada") countLiberadas++;
      else if (st === "entregada") countEntregadas++;
      else if (st === "pendiente") countPendientes++;

      if (isOrderNotSent(ord)) countSinEnviar++;
      else if (isOrderSent(ord)) countEnviadas++;
    }

    return {
      totalCount: ordenes.length,
      totalMonto,
      countMandadas,
      countLiberadas,
      countEntregadas,
      countPendientes,
      countSinEnviar,
      countEnviadas,
    };
  }, [ordenes, config]);

  // Combine live real-time orders with any deep search results
  const combinedOrdenes = useMemo(() => {
    if (dbSearchResults.length === 0) return ordenes;
    const map = new Map<string, OrdenCompra>();
    ordenes.forEach((o) => {
      const key = o.id || o.numOC;
      if (key) map.set(key, o);
    });
    dbSearchResults.forEach((o) => {
      const key = o.id || o.numOC;
      if (key && !map.has(key)) {
        map.set(key, o);
      }
    });
    return Array.from(map.values());
  }, [ordenes, dbSearchResults]);

  // Filtered Orders
  const filteredOrdenes = useMemo(() => {
    return combinedOrdenes.filter((ord) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = (
          ord.numOC.toLowerCase().includes(q) ||
          ord.numSolicitud.toLowerCase().includes(q) ||
          ord.razonSocial.toLowerCase().includes(q) ||
          ord.motivo.toLowerCase().includes(q) ||
          (ord.creadoPor && ord.creadoPor.toLowerCase().includes(q)) ||
          (ord.firmante1 && ord.firmante1.toLowerCase().includes(q)) ||
          (ord.firmante2 && ord.firmante2.toLowerCase().includes(q)) ||
          (ord.enviadoA1 && ord.enviadoA1.toLowerCase().includes(q)) ||
          (ord.enviadoA2 && ord.enviadoA2.toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      // 2. Empresa Filter
      if (empresaFilter !== "Todas") {
        const ordEmp = String(ord.empresa || "");
        if (empresaFilter === "CMK") {
          if (ordEmp !== "CMK" && ordEmp !== "Cinemark") return false;
        } else if (empresaFilter === "Hoyts") {
          if (ordEmp !== "Hoyts") return false;
        }
      }

      // 3. Status Filter Toggle
      if (statusFilter !== "todas") {
        const currentSt = getOrderStatus(ord);
        if (statusFilter === "sin_enviar") {
          if (!isOrderNotSent(ord)) return false;
        } else if (statusFilter === "mandada") {
          if (currentSt !== "mandada") return false;
        } else if (statusFilter === "liberada") {
          if (currentSt !== "liberada") return false;
        } else if (statusFilter === "entregada") {
          if (currentSt !== "entregada") return false;
        }
      }

      return true;
    });
  }, [combinedOrdenes, searchQuery, empresaFilter, statusFilter]);

  const visibleOrdenes = useMemo(() => {
    if (isSearching) return filteredOrdenes;
    return filteredOrdenes.slice(0, queryLimit);
  }, [filteredOrdenes, isSearching, queryLimit]);

  const hasMore = !isSearching && (ordenes.length > queryLimit || filteredOrdenes.length > queryLimit);

  useEffect(() => {
    setQueryLimit(20);
  }, [empresaFilter, statusFilter]);

  // Copy helpers
  const getOrderCopyText = (orden: OrdenCompra) => {
    if (orden.liberada || orden.entregada) {
      return `OC 0${orden.numOC} - ${orden.razonSocial}`;
    }

    const formattedMonto = typeof orden.monto === "number"
      ? `$ ${orden.monto.toLocaleString("es-AR")}`
      : orden.monto;

    const notasPart = orden.notas && orden.notas.length > 0
      ? "\nNotas:\n" + orden.notas.map(n => `- ${n.texto}`).join("\n")
      : "";

    const linkPart = orden.linkSharepoint ? `\nLink: ${orden.linkSharepoint}` : "";

    return `\n\n\nOC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: ${formattedMonto}
Detalle: ${orden.motivo}
Forma de Pago: ${orden.formaPago}${notasPart}${linkPart}`;
  };

  const handleCopy = (orden: OrdenCompra) => {
    const copyText = getOrderCopyText(orden);
    navigator.clipboard.writeText(copyText);
    setCopiedId(orden.id || orden.numOC);
    setTimeout(() => setCopiedId(null), 2000);
    showToast(`¡Copiada OC ${orden.numOC}!`);
  };

  const handleCopyAll = () => {
    if (filteredOrdenes.length === 0) return;
    const joinedText = filteredOrdenes
      .map((orden) => getOrderCopyText(orden))
      .join("\n");
    navigator.clipboard.writeText(joinedText);
    showToast(`¡Copiadas ${filteredOrdenes.length} órdenes al portapapeles!`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredOrdenes.length === 0) {
      showToast("No hay órdenes para exportar");
      return;
    }

    const dataToExport = filteredOrdenes.map((o) => {
      const sig = getOrderSignatureInfo(o);
      const st = getOrderStatus(o);
      return {
        "Empresa": o.empresa,
        "N° OC": o.numOC,
        "N° Solicitud": o.numSolicitud || "-",
        "Proveedor": o.razonSocial,
        "Monto": typeof o.monto === "number" ? o.monto : parseMontoToNumber(o.monto),
        "Estado": STATUS_CONFIG[st].label,
        "Detalle": o.motivo,
        "Forma de Pago": o.formaPago,
        "Nivel": sig.tierName,
        "1ra Firma": sig.isF1Signed ? `Firmado (${sig.f1Signer || "Tomás"})` : o.enviadoA1 ? `Enviado a ${o.enviadoA1}` : "Sin enviar",
        "2da Firma": sig.isF2Signed ? `Firmado (${sig.f2Signer})` : o.enviadoA2 ? `Enviado a ${o.enviadoA2}` : "Sin enviar",
        "Creado Por": o.creadoPor || "-",
        "Link": o.linkSharepoint || "-",
      };
    });

    exportToExcel(dataToExport, `Seguimiento_Ordenes_${new Date().toISOString().split("T")[0]}`);
    showToast("Excel generado correctamente");
  };

  // Notes handler for modal
  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNotesOrden || !newNotaText.trim()) return;

    setSavingNota(true);
    const db = getFirebaseDb();
    const newNota: Nota = {
      id: Date.now().toString(),
      texto: newNotaText.trim(),
      autor: authorName,
      fecha: new Date().toISOString(),
    };

    const updatedNotas = [...(activeNotesOrden.notas || []), newNota];
    if (activeNotesOrden.id) {
      syncOrderToMongo({ id: activeNotesOrden.id, ...activeNotesOrden, notas: updatedNotas });
      showToast("Nota agregada correctamente");
    }

    if (db && activeNotesOrden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", activeNotesOrden.id);
        await updateDoc(docRef, {
          notas: arrayUnion(newNota),
        });
      } catch (err) {
        console.warn("Aviso Firebase al agregar nota:", err);
      }
    }

    setOrdenes((prev) =>
      prev.map((item) =>
        item.id === activeNotesOrden.id
          ? { ...item, notas: updatedNotas }
          : item
      )
    );

    setActiveNotesOrden((prev) =>
      prev ? { ...prev, notas: updatedNotas } : null
    );

    setNewNotaText("");
    setSavingNota(false);
  };

  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    setOrdenes((prev) =>
      prev.map((item) => (item.id === ordenId ? { ...item, ...updatedFields } : item))
    );
    syncOrderToMongo({ id: ordenId, ...updatedFields });
  };

  return (
    <AppLayout
      title="Seguimiento de Órdenes"
      subtitle="Visualización completa de órdenes, firmas requeridas, envíos y estado de entrega"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900/95 text-emerald-300 font-semibold text-xs shadow-2xl backdrop-blur-md border border-emerald-500/30 animate-in slide-in-from-bottom duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ========================================================
            1. TOP HERO HEADER (Modern Glass Panel)
            ======================================================== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#111726]/90 to-[#0b0f19]/90 border border-white/10 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shadow-inner">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
                    <span>Panel de Seguimiento Integral</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                      {stats.totalCount} órdenes
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 font-medium">
                    Consulta el estado de cada orden, firmas autorizadas, destinatarios de envío y entregas.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <DolarVentaBadge />

              {/* Load All From DB */}
              <button
                onClick={handleLoadAllFromDb}
                disabled={loadingAllDb || hasLoadedAllFromDb}
                className={`px-3.5 py-2 rounded-xl border font-bold text-xs transition-all flex items-center gap-2 shadow-sm ${
                  hasLoadedAllFromDb
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                    : "bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-200 hover:text-white cursor-pointer"
                }`}
                title={hasLoadedAllFromDb ? "Toda la base de datos ya está cargada" : "Cargar todas las órdenes históricas de la base de datos"}
              >
                {loadingAllDb ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : hasLoadedAllFromDb ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Database className="w-4 h-4 text-indigo-400" />
                )}
                <span>{loadingAllDb ? "Cargando..." : hasLoadedAllFromDb ? "BD Cargada" : "Cargar BD"}</span>
              </button>

              {/* Copiar Todas button */}
              {filteredOrdenes.length > 0 && (
                <button
                  onClick={handleCopyAll}
                  className="hidden sm:inline-flex px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all items-center gap-2 shadow-sm cursor-pointer"
                  title="Copiar todas las órdenes filtradas"
                >
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Copiar ({filteredOrdenes.length})</span>
                </button>
              )}

              {/* Export Excel button */}
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                title="Exportar listado a Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            2. INTERACTIVE KPI METRIC CARDS (Filter Toggles)
            ======================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          
          {/* Card: Total */}
          <button
            onClick={() => setStatusFilter("todas")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "todas"
                ? "bg-slate-800/90 border-slate-500/80 ring-2 ring-indigo-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-black text-white font-mono mt-1">
              {stats.totalCount}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {isSearching ? "En base de datos" : `Últimas ${visibleOrdenes.length}`}
            </div>
          </button>

          {/* Card: Sin Enviar */}
          <button
            onClick={() => setStatusFilter("sin_enviar")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "sin_enviar"
                ? "bg-rose-500/20 border-rose-400/70 ring-2 ring-rose-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Sin Enviar</span>
              <Clock className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400 font-mono mt-1">
              {stats.countSinEnviar}
            </div>
            <div className="text-[10px] text-rose-300/70 truncate">
              Falta despacho
            </div>
          </button>

          {/* Card: En Proceso */}
          <button
            onClick={() => setStatusFilter("mandada")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "mandada"
                ? "bg-amber-500/20 border-amber-400/70 ring-2 ring-amber-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">En Proceso</span>
              <Send className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 font-mono mt-1">
              {stats.countMandadas}
            </div>
            <div className="text-[10px] text-amber-300/70 truncate">
              Mandadas a firma
            </div>
          </button>

          {/* Card: Liberadas */}
          <button
            onClick={() => setStatusFilter("liberada")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "liberada"
                ? "bg-emerald-500/20 border-emerald-400/70 ring-2 ring-emerald-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Liberadas</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              {stats.countLiberadas}
            </div>
            <div className="text-[10px] text-emerald-300/70 truncate">
              Listas / Pagadas
            </div>
          </button>

          {/* Card: Entregadas */}
          <button
            onClick={() => setStatusFilter("entregada")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "entregada"
                ? "bg-blue-500/20 border-blue-400/70 ring-2 ring-blue-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Entregadas</span>
              <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black text-blue-400 font-mono mt-1">
              {stats.countEntregadas}
            </div>
            <div className="text-[10px] text-blue-300/70 truncate">
              Recepción final
            </div>
          </button>

        </div>

        {/* ========================================================
            3. FILTER BAR, SEARCH & CONTROLS
            ======================================================== */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0f1422] border border-white/10 space-y-3 shadow-md">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por OC, Solicitud, Proveedor, Creador o Firmante..."
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#0a0e18] border border-white/10 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right Group: Empresa & View Mode */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Segmented Empresa */}
              <div className="flex items-center bg-[#0a0e18] p-1 rounded-xl border border-white/10 shrink-0">
                {(["Todas", "Hoyts", "CMK"] as const).map((emp) => {
                  const isSelected = empresaFilter === emp;
                  return (
                    <button
                      key={emp}
                      onClick={() => setEmpresaFilter(emp)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? emp === "Hoyts"
                            ? "bg-purple-600 text-white shadow-sm"
                            : emp === "CMK"
                            ? "bg-teal-600 text-white shadow-sm"
                            : "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {emp === "CMK" ? "CMK (Cinemark)" : emp}
                    </button>
                  );
                })}
              </div>

              {/* View Switcher */}
              <div className="flex items-center bg-[#0a0e18] p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "cards" 
                      ? "bg-slate-800 text-indigo-400 shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista en Tarjetas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "table" 
                      ? "bg-slate-800 text-indigo-400 shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista Compacta en Tabla"
                >
                  <ListFilter className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Active Filter Counter */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">
                {visibleOrdenes.length} {visibleOrdenes.length === 1 ? "orden mostrada" : "órdenes mostradas"}
                {isSearching && ` de ${filteredOrdenes.length} coincidencias`}
              </span>
              {(statusFilter !== "todas" || empresaFilter !== "Todas" || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter("todas");
                    setEmpresaFilter("Todas");
                    setSearchQuery("");
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 ml-1 cursor-pointer font-medium"
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            {isSearchingDb && (
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-[11px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Buscando en base de datos...</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            4. ORDERS CONTENT (CARDS OR TABLE)
            ======================================================== */}
        {loading ? (
          <div className="p-16 text-center bg-[#0f1422] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-400">Cargando órdenes del sistema...</span>
          </div>
        ) : filteredOrdenes.length === 0 ? (
          <div className="p-16 text-center bg-[#0f1422] rounded-2xl border border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="text-base font-bold text-white">¡No se encontraron órdenes con los filtros aplicados!</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Probá cambiando los términos de búsqueda o seleccionando otro filtro de estado o empresa.
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* ========================================================
             COMPACT TABLE VIEW
             ======================================================== */
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1422] shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#0b0f19]">
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Empresa</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">OC / Solicitud</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Proveedor</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Estado</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider text-right">Monto</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">1ra Firma</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">2da Firma</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleOrdenes.map((orden) => {
                  const sigInfo = getOrderSignatureInfo(orden);
                  const numMonto = parseMontoToNumber(orden.monto);
                  const isCopied = copiedId === (orden.id || orden.numOC);
                  const orderStatusKey = getOrderStatus(orden);
                  const statusCfg = STATUS_CONFIG[orderStatusKey];
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={orden.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          orden.empresa === "Hoyts"
                            ? "bg-purple-950/60 text-purple-300 border-purple-800/60"
                            : "bg-teal-950/60 text-teal-300 border-teal-800/60"
                        }`}>
                          {orden.empresa}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-white flex items-center gap-1.5">
                          <span>OC {orden.numOC}</span>
                          <button
                            onClick={() => handleCopy(orden)}
                            className="text-slate-500 hover:text-emerald-400 p-0.5 rounded cursor-pointer"
                            title="Copiar datos de orden"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        {orden.numSolicitud && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            SC {orden.numSolicitud}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-200 max-w-[180px] truncate" title={orden.razonSocial}>
                        {orden.razonSocial || "Sin razón social"}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badgeClass}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          <span>{statusCfg.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                        $ {numMonto.toLocaleString("es-AR")}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {sigInfo.isF1Signed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            {sigInfo.f1Signer || "Tomás"}
                          </span>
                        ) : orden.enviadoA1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                            <Send className="w-2.5 h-2.5 text-blue-400" />
                            {orden.enviadoA1}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                            Sin enviar
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {sigInfo.isF2Signed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            {sigInfo.f2Signer}
                          </span>
                        ) : orden.enviadoA2 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                            <Send className="w-2.5 h-2.5 text-blue-400" />
                            {orden.enviadoA2}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                            Sin enviar
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setActiveNotesOrden(orden)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-semibold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================
             DETAILED CARD VIEW
             ======================================================== */
          <div className="space-y-3.5">
            {visibleOrdenes.map((orden) => {
              const sigInfo = getOrderSignatureInfo(orden);
              const numMonto = parseMontoToNumber(orden.monto);
              const isCopied = copiedId === (orden.id || orden.numOC);
              const orderStatusKey = getOrderStatus(orden);
              const statusCfg = STATUS_CONFIG[orderStatusKey];
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={orden.id}
                  className="rounded-2xl bg-[#0f1422] border border-white/10 hover:border-white/20 transition-all shadow-md overflow-hidden group"
                >
                  {/* Card Header Bar */}
                  <div className="p-4 sm:p-4.5 bg-gradient-to-r from-[#121829] to-[#0f1422] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono tracking-wider border shadow-sm ${
                        orden.empresa === "Hoyts"
                          ? "bg-purple-950/80 text-purple-300 border-purple-700/60"
                          : "bg-teal-950/80 text-teal-300 border-teal-700/60"
                      }`}>
                        {orden.empresa}
                      </span>

                      <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg">
                        <span className="text-sm font-black text-white font-mono tracking-tight">
                          OC {orden.numOC}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(orden)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Copiar datos de esta orden"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
                          )}
                        </button>
                      </div>

                      {orden.numSolicitud && (
                        <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                          SC: {orden.numSolicitud}
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 shadow-sm ${statusCfg.badgeClass}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusCfg.label}</span>
                      </span>

                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                        {sigInfo.tierName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-black text-emerald-400 font-mono tracking-tight">
                          $ {numMonto.toLocaleString("es-AR")}
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {orden.formaPago || "Transferencia"}
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveNotesOrden(orden)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Detalle</span>
                      </button>
                    </div>

                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-4.5 space-y-3.5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      
                      <div className="md:col-span-1 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          Proveedor
                        </span>
                        <div className="font-bold text-slate-100 text-sm">
                          {orden.razonSocial || "Sin razón social registrada"}
                        </div>
                        {orden.creadoPor && (
                          <div className="pt-1">
                            {(() => {
                              const creatorStyle = getCreadorBadgeStyle(orden.creadoPor);
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] ${creatorStyle.badge}`}>
                                  <span>Creado por: {orden.creadoPor}</span>
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Motivo / Detalle
                        </span>
                        <p className="text-slate-300 font-medium text-xs bg-[#0b0f19]/60 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                          {orden.motivo || "Sin detalle registrado"}
                        </p>
                      </div>

                    </div>

                    {/* Stepper Pipeline */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        
                        {/* 1ra Firma */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                          sigInfo.isF1Signed 
                            ? "bg-emerald-500/10 border-emerald-500/30" 
                            : orden.enviadoA1?.trim()
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-[#0b0f19]/70 border-white/5"
                        }`}>
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              sigInfo.isF1Signed 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                : orden.enviadoA1?.trim()
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "bg-white/5 text-slate-400 border-white/10"
                            }`}>
                              {sigInfo.isF1Signed ? <Check className="w-3.5 h-3.5" /> : orden.enviadoA1?.trim() ? <Send className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            </div>
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                1ra Firma ({sigInfo.f1Label})
                              </div>
                              <div className="text-xs font-semibold truncate">
                                {sigInfo.isF1Signed ? (
                                  <span className="text-emerald-300 font-bold">{sigInfo.f1Signer || "Tomás"}</span>
                                ) : orden.enviadoA1?.trim() ? (
                                  <span className="text-blue-300 font-medium">Enviado a {orden.enviadoA1}</span>
                                ) : (
                                  <span className="text-slate-400">Sin enviar</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            sigInfo.isF1Signed 
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                              : orden.enviadoA1?.trim()
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                          }`}>
                            {sigInfo.isF1Signed ? "Firmado" : orden.enviadoA1?.trim() ? "Enviado" : "Sin enviar"}
                          </span>
                        </div>

                        {/* 2da Firma */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                          sigInfo.isF2Signed 
                            ? "bg-emerald-500/10 border-emerald-500/30" 
                            : orden.enviadoA2?.trim()
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-[#0b0f19]/70 border-white/5"
                        }`}>
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              sigInfo.isF2Signed 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                : orden.enviadoA2?.trim()
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "bg-white/5 text-slate-400 border-white/10"
                            }`}>
                              {sigInfo.isF2Signed ? <Check className="w-3.5 h-3.5" /> : orden.enviadoA2?.trim() ? <Send className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            </div>
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                2da Firma ({sigInfo.f2Label})
                              </div>
                              <div className="text-xs font-semibold truncate">
                                {sigInfo.isF2Signed ? (
                                  <span className="text-emerald-300 font-bold">{sigInfo.f2Signer}</span>
                                ) : orden.enviadoA2?.trim() ? (
                                  <span className="text-blue-300 font-medium">Enviado a {orden.enviadoA2}</span>
                                ) : (
                                  <span className="text-slate-400">Sin enviar</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            sigInfo.isF2Signed 
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                              : orden.enviadoA2?.trim()
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                          }`}>
                            {sigInfo.isF2Signed ? "Firmado" : orden.enviadoA2?.trim() ? "Enviado" : "Sin enviar"}
                          </span>
                        </div>

                        {/* Entrega / Pago */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                          orden.entregada 
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                            : orden.liberada
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-[#0b0f19]/70 border-white/5"
                        }`}>
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              orden.entregada 
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30" 
                                : orden.liberada
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-white/5 text-slate-400 border-white/10"
                            }`}>
                              {orden.entregada ? <PackageCheck className="w-3.5 h-3.5" /> : orden.liberada ? <ShieldCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            </div>
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Entrega / Pago
                              </div>
                              <div className="text-xs font-semibold truncate">
                                {orden.entregada ? (
                                  <span className="text-blue-300 font-bold">Entregada</span>
                                ) : orden.liberada ? (
                                  <span className="text-emerald-300 font-bold">Liberada</span>
                                ) : (
                                  <span className="text-slate-400">En proceso</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            orden.entregada 
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                              : orden.liberada
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-white/5 text-slate-400 border border-white/10"
                          }`}>
                            {orden.entregada ? "Entregada" : orden.liberada ? "Liberada" : "Pendiente"}
                          </span>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              );
            })}

            {/* Pagination Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => setQueryLimit((prev) => prev + 20)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-sm"
                >
                  Cargar más órdenes
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal de Detalle */}
      <OrderDetailModal
        orden={activeNotesOrden ? (ordenes.find((o) => o.id === activeNotesOrden.id) || activeNotesOrden) : null}
        onClose={() => setActiveNotesOrden(null)}
        isOrdenesUser={false}
        onStatusChange={handleStatusChange}
        newNotaText={newNotaText}
        setNewNotaText={setNewNotaText}
        savingNota={savingNota}
        onAddNota={handleAddNota}
        showToast={showToast}
      />
    </AppLayout>
  );
}
