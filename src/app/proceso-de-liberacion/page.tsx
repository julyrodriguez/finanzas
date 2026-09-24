"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc,
  arrayUnion
} from "firebase/firestore";
import { syncOrderToMongo, fetchOrdersFromMongo, parseMongoDocToOrdenCompra } from "@/lib/serverSync";
import { 
  Clock, 
  Check, 
  Loader2, 
  CheckCircle2, 
  Search, 
  X, 
  Copy, 
  ShieldCheck, 
  PenTool, 
  Eye, 
  Building2, 
  Settings, 
  Send, 
  ExternalLink, 
  ChevronRight, 
  LayoutGrid, 
  ListFilter, 
  Sparkles, 
  ArrowUpRight, 
  MessageSquare,
  AlertCircle
} from "lucide-react";
import type { OrdenCompra, Nota } from "@/types/ordenes";
import { 
  getStoredApprovalConfig, 
  DEFAULT_APPROVAL_CONFIG, 
  parseMontoToNumber
} from "@/lib/approvalConfig";
import { BatchLiberateModal } from "@/components/ordenes/BatchLiberateModal";
import { BatchSendToSignModal } from "@/components/ordenes/BatchSendToSignModal";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { ApprovalConfigModal } from "@/components/ordenes/ApprovalConfigModal";
import { useAuth } from "@/context/AuthContext";

type StatusFilterType = 
  | "todas" 
  | "sin_firmas_sin_enviar" 
  | "enviado_1ra" 
  | "con_1ra_esperando" 
  | "con_1ra_enviado_2da"
  | "completas";

export default function ProcesoDeLiberacionPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [allOrdersForBatch, setAllOrdersForBatch] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // View Mode: Cards or Compact Table
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("todas");
  const [empresaFilter, setEmpresaFilter] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [tierFilter, setTierFilter] = useState<string>("Todos");

  // Modals
  const [isBatchLiberateOpen, setIsBatchLiberateOpen] = useState(false);
  const [isBatchSendOpen, setIsBatchSendOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeNotesOrden, setActiveNotesOrden] = useState<OrdenCompra | null>(null);

  // Notes state for OrderDetailModal
  const [newNotaText, setNewNotaText] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  const { user } = useAuth();
  const isOrdenesUser = Boolean(user?.email?.startsWith("ordenes"));
  const authorName = user?.email?.split("@")[0] || "Usuario";

  const [config, setConfig] = useState(DEFAULT_APPROVAL_CONFIG);

  useEffect(() => {
    try {
      setConfig(getStoredApprovalConfig() || DEFAULT_APPROVAL_CONFIG);
    } catch {
      setConfig(DEFAULT_APPROVAL_CONFIG);
    }

    const handleConfigUpdate = () => {
      try {
        setConfig(getStoredApprovalConfig() || DEFAULT_APPROVAL_CONFIG);
      } catch {
        setConfig(DEFAULT_APPROVAL_CONFIG);
      }
    };
    window.addEventListener("approval_config_updated", handleConfigUpdate);
    return () => window.removeEventListener("approval_config_updated", handleConfigUpdate);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
        setAllOrdersForBatch(allDocs);
        const mandadas = allDocs.filter((o) => o.mandada && !o.liberada && !o.cancelada);
        setOrdenes(mandadas);
      }
    } catch (err) {
      console.error("Error al cargar órdenes de proceso de liberación desde el servidor local:", err);
      showToast("Error al cargar órdenes desde el servidor local");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersFromServer();
  }, []);

  const limite1 = config?.limiteNivel1 || 5000000;
  const limite2 = config?.limiteNivel2 || 18000000;
  const limite3 = config?.limiteNivel3 || 150000000;

  // Helper to determine signature statuses for an order
  const getOrderSignatureInfo = (orden: OrdenCompra) => {
    const numMonto = parseMontoToNumber(orden.monto);

    if (numMonto <= limite1) {
      const isF1 = Boolean(orden.firmante1?.trim() || orden.mandada || orden.liberada);
      const isF2 = Boolean(orden.firmante2?.trim() || orden.liberada);
      return {
        tierName: "Nivel 1 (Hasta $5M)",
        tierBadge: "≤ $5M",
        tierKey: "Nivel 1",
        f1Label: "Tomás",
        f2Label: "Área",
        f1Signer: orden.firmante1?.trim() || (isF1 ? "Tomas" : ""),
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isPartial: (isF1 && !isF2) || (!isF1 && isF2),
        isComplete: isF1 && isF2,
        isPendingBoth: !isF1 && !isF2,
      };
    } else if (numMonto > limite1 && numMonto <= limite2) {
      const isF1 = Boolean(orden.firmante1?.trim());
      const isF2 = Boolean(orden.firmante2?.trim());
      return {
        tierName: "Nivel 2 ($5M - $18M)",
        tierBadge: "$5M-$18M",
        tierKey: "Nivel 2",
        f1Label: "Pablo Mondelo",
        f2Label: "Darío",
        f1Signer: orden.firmante1?.trim() || "",
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isPartial: (isF1 && !isF2) || (!isF1 && isF2),
        isComplete: isF1 && isF2,
        isPendingBoth: !isF1 && !isF2,
      };
    } else if (numMonto > limite2 && numMonto <= limite3) {
      const isF1 = Boolean(orden.firmante1?.trim());
      const isF2 = Boolean(orden.firmante2?.trim());
      return {
        tierName: "Nivel 3 ($18M - $150M)",
        tierBadge: "$18M-$150M",
        tierKey: "Nivel 3",
        f1Label: "Matías / Hernán",
        f2Label: "Darío",
        f1Signer: orden.firmante1?.trim() || "",
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isPartial: (isF1 && !isF2) || (!isF1 && isF2),
        isComplete: isF1 && isF2,
        isPendingBoth: !isF1 && !isF2,
      };
    } else {
      const isF1 = Boolean(orden.firmante1?.trim());
      const isF2 = Boolean(orden.firmante2?.trim());
      return {
        tierName: "Nivel 4 (> $150M)",
        tierBadge: "> $150M",
        tierKey: "Nivel 4",
        f1Label: "Darío / Hernán",
        f2Label: "Martín",
        f1Signer: orden.firmante1?.trim() || "",
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isPartial: (isF1 && !isF2) || (!isF1 && isF2),
        isComplete: isF1 && isF2,
        isPendingBoth: !isF1 && !isF2,
      };
    }
  };

  // Helper to determine workflow stage regarding signatures and sends
  const getOrderWorkflowStage = (ord: OrdenCompra, info: ReturnType<typeof getOrderSignatureInfo>): StatusFilterType => {
    const isSentToF1 = Boolean(ord.enviadoA1?.trim() || (ord.enviado && !info.isF1Signed));
    const isSentToF2 = Boolean(ord.enviadoA2?.trim());

    if (info.isComplete) {
      return "completas";
    }
    if (!info.isF1Signed && !info.isF2Signed) {
      return isSentToF1 ? "enviado_1ra" : "sin_firmas_sin_enviar";
    }
    if (info.isF1Signed && !info.isF2Signed) {
      return isSentToF2 ? "con_1ra_enviado_2da" : "con_1ra_esperando";
    }
    if (!info.isF1Signed && info.isF2Signed) {
      return isSentToF1 ? "con_1ra_enviado_2da" : "con_1ra_esperando";
    }
    return "completas";
  };

  // KPIs
  const stats = useMemo(() => {
    let totalMonto = 0;
    let countSinFirmasSinEnviar = 0;
    let countEnviado1ra = 0;
    let countCon1raEsperando = 0;
    let countCon1raEnviado2da = 0;
    let countCompletas = 0;

    for (const ord of ordenes) {
      totalMonto += parseMontoToNumber(ord.monto);
      const info = getOrderSignatureInfo(ord);
      const stage = getOrderWorkflowStage(ord, info);

      if (stage === "sin_firmas_sin_enviar") countSinFirmasSinEnviar++;
      else if (stage === "enviado_1ra") countEnviado1ra++;
      else if (stage === "con_1ra_esperando") countCon1raEsperando++;
      else if (stage === "con_1ra_enviado_2da") countCon1raEnviado2da++;
      else if (stage === "completas") countCompletas++;
    }

    return {
      totalCount: ordenes.length,
      totalMonto,
      countSinFirmasSinEnviar,
      countEnviado1ra,
      countCon1raEsperando,
      countCon1raEnviado2da,
      countCompletas,
    };
  }, [ordenes, config]);

  // Filtered Orders
  const filteredOrdenes = useMemo(() => {
    return ordenes.filter((ord) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = (
          ord.numOC.toLowerCase().includes(q) ||
          ord.numSolicitud.toLowerCase().includes(q) ||
          ord.razonSocial.toLowerCase().includes(q) ||
          ord.motivo.toLowerCase().includes(q)
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

      // 3. Signature / Sent Status Filter
      const info = getOrderSignatureInfo(ord);
      const stage = getOrderWorkflowStage(ord, info);
      if (statusFilter !== "todas") {
        if (stage !== statusFilter) return false;
      }

      // 4. Tier Filter
      if (tierFilter !== "Todos") {
        if (info.tierKey !== tierFilter) return false;
      }

      return true;
    });
  }, [ordenes, searchQuery, empresaFilter, statusFilter, tierFilter, config]);

  const filteredTotalMonto = useMemo(() => {
    return filteredOrdenes.reduce((acc, ord) => acc + parseMontoToNumber(ord.monto), 0);
  }, [filteredOrdenes]);

  // Status Change handler for OrderDetailModal
  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    setOrdenes((prev) =>
      prev.map((item) => (item.id === ordenId ? { ...item, ...updatedFields } : item))
        .filter(item => !item.liberada && !item.entregada && !item.cancelada)
    );
    syncOrderToMongo({ id: ordenId, ...updatedFields });
  };

  // Add Note handler
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
      prev ? { ...prev, notas: [...(prev.notas || []), newNota] } : null
    );

    setNewNotaText("");
    setSavingNota(false);
  };

  // Helper to format copy text for an order
  const getOrderCopyText = (orden: OrdenCompra) => {
    if (orden.liberada) {
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

  // Copy Single Order Format
  const handleCopy = (orden: OrdenCompra) => {
    const copyText = getOrderCopyText(orden);
    navigator.clipboard.writeText(copyText);
    setCopiedId(orden.id || orden.numOC);
    setTimeout(() => setCopiedId(null), 2000);
    showToast(`¡Copiada OC ${orden.numOC}!`);
  };

  // Copy All Filtered Orders to Clipboard
  const handleCopyAll = () => {
    if (filteredOrdenes.length === 0) return;
    const joinedText = filteredOrdenes
      .map((orden) => getOrderCopyText(orden))
      .join("\n");
    navigator.clipboard.writeText(joinedText);
    showToast(`¡Copiadas ${filteredOrdenes.length} órdenes al portapapeles!`);
  };

  return (
    <AppLayout
      title="Proceso de Liberación"
      subtitle="Flujo en vivo de órdenes mandadas, doble firma escalonada y despacho financiero"
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
            1. HERO ACTION HEADER (Modern Glass Panel)
            ======================================================== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#111726]/90 to-[#0b0f19]/90 border border-white/10 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-inner">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
                    <span>Módulo de Liberación de Pagos</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                      {stats.totalCount} en curso
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 font-medium">
                    Control de firmas por tramos de importe, verificación de autorizaciones y marcado masivo.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {filteredOrdenes.length > 0 && (
                <button
                  onClick={handleCopyAll}
                  className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  title="Copiar todas las órdenes visibles en formato de texto"
                >
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Copiar ({filteredOrdenes.length})</span>
                </button>
              )}

              <button
                onClick={() => setIsBatchSendOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-900/30 flex items-center gap-2 cursor-pointer border border-blue-400/30 hover:scale-[1.01] active:scale-[0.99]"
                title="Pegar texto de órdenes y marcarlas como enviadas a firmar"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviadas a Firmar</span>
              </button>

              <button
                onClick={() => setIsBatchLiberateOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-900/30 flex items-center gap-2 cursor-pointer border border-emerald-400/30 hover:scale-[1.01] active:scale-[0.99]"
                title="Pegar texto de órdenes y registrar autorizaciones / liberar"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Registrar Autorizadas</span>
              </button>

              <button
                onClick={() => setIsConfigOpen(true)}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                title="Configuración de Firmantes y Límites de Aprobación"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            2. INTERACTIVE KPI METRIC CARDS (Filter Toggles)
            ======================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Card: Todas */}
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
              $ {stats.totalMonto.toLocaleString("es-AR")}
            </div>
          </button>

          {/* Card: Sin Firmas y Sin Enviar */}
          <button
            onClick={() => setStatusFilter("sin_firmas_sin_enviar")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "sin_firmas_sin_enviar"
                ? "bg-slate-800/90 border-slate-500/80 ring-2 ring-slate-400/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin Despachar</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-200 font-mono mt-1">
              {stats.countSinFirmasSinEnviar}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              Aún sin enviar
            </div>
          </button>

          {/* Card: Enviado a 1ra */}
          <button
            onClick={() => setStatusFilter("enviado_1ra")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "enviado_1ra"
                ? "bg-blue-500/20 border-blue-400/70 ring-2 ring-blue-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">En 1ra Firma</span>
              <Send className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black text-blue-400 font-mono mt-1">
              {stats.countEnviado1ra}
            </div>
            <div className="text-[10px] text-blue-300/70 truncate">
              Esperando 1ra
            </div>
          </button>

          {/* Card: Con 1ra Esperando */}
          <button
            onClick={() => setStatusFilter("con_1ra_esperando")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "con_1ra_esperando"
                ? "bg-amber-500/20 border-amber-400/70 ring-2 ring-amber-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">1ra Firmada</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 font-mono mt-1">
              {stats.countCon1raEsperando}
            </div>
            <div className="text-[10px] text-amber-300/70 truncate">
              Falta enviar 2da
            </div>
          </button>

          {/* Card: Enviado a 2da */}
          <button
            onClick={() => setStatusFilter("con_1ra_enviado_2da")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "con_1ra_enviado_2da"
                ? "bg-purple-500/20 border-purple-400/70 ring-2 ring-purple-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">En 2da Firma</span>
              <Send className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-400 font-mono mt-1">
              {stats.countCon1raEnviado2da}
            </div>
            <div className="text-[10px] text-purple-300/70 truncate">
              Esperando 2da
            </div>
          </button>

          {/* Card: Completas (Listas para Liberar) */}
          <button
            onClick={() => setStatusFilter("completas")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === "completas"
                ? "bg-emerald-500/20 border-emerald-400/70 ring-2 ring-emerald-500/40 shadow-lg"
                : "bg-[#0d121f]/70 border-white/5 hover:border-white/15 hover:bg-[#12192b]/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Listas</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              {stats.countCompletas}
            </div>
            <div className="text-[10px] text-emerald-300/70 truncate">
              Ambas firmadas
            </div>
          </button>

        </div>

        {/* ========================================================
            3. FILTER BAR, SEARCH & VIEW MODE SWITCH
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
                placeholder="Buscar por OC, Solicitud, Proveedor o Motivo..."
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#0a0e18] border border-white/10 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
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

            {/* Controls Right Group */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Segmented Empresa Selector */}
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
                            : "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {emp === "CMK" ? "CMK (Cinemark)" : emp}
                    </button>
                  );
                })}
              </div>

              {/* Tier Filter */}
              <div className="flex items-center gap-1.5 text-xs bg-[#0a0e18] px-2.5 py-1 rounded-xl border border-white/10">
                <span className="text-slate-400 font-semibold text-[11px]">Nivel:</span>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="bg-transparent border-none text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="Todos" className="bg-slate-900 text-white">Todos</option>
                  <option value="Nivel 1" className="bg-slate-900 text-white">Nivel 1 (≤ $5M)</option>
                  <option value="Nivel 2" className="bg-slate-900 text-white">Nivel 2 ($5M - $18M)</option>
                  <option value="Nivel 3" className="bg-slate-900 text-white">Nivel 3 ($18M - $150M)</option>
                  <option value="Nivel 4" className="bg-slate-900 text-white">Nivel 4 (&gt; $150M)</option>
                </select>
              </div>

              {/* View Switcher (Cards / Table) */}
              <div className="flex items-center bg-[#0a0e18] p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "cards" 
                      ? "bg-slate-800 text-blue-400 shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista en Tarjetas con Flujo de Firmas"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === "table" 
                      ? "bg-slate-800 text-blue-400 shadow-sm" 
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista Compacta en Tabla"
                >
                  <ListFilter className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Active Filter Badges Counter */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">
                {filteredOrdenes.length} órdenes encontradas
              </span>
              {(statusFilter !== "todas" || empresaFilter !== "Todas" || tierFilter !== "Todos" || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter("todas");
                    setEmpresaFilter("Todas");
                    setTierFilter("Todos");
                    setSearchQuery("");
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-1 cursor-pointer font-medium"
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            <div className="font-mono text-emerald-400 font-bold">
              Subtotal: $ {filteredTotalMonto.toLocaleString("es-AR")}
            </div>
          </div>
        </div>

        {/* ========================================================
            4. ORDERS CONTENT (CARDS OR COMPACT TABLE)
            ======================================================== */}
        {loading ? (
          <div className="p-16 text-center bg-[#0f1422] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-400">Cargando órdenes en proceso de liberación...</span>
          </div>
        ) : filteredOrdenes.length === 0 ? (
          <div className="p-16 text-center bg-[#0f1422] rounded-2xl border border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="text-base font-bold text-white">¡No hay órdenes mandadas pendientes en esta vista!</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Todas las órdenes han sido liberadas o no coinciden con los filtros aplicados.
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* ========================================================
             COMPACT TABLE VIEW (High density for financial scanning)
             ======================================================== */
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1422] shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#0b0f19]">
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Empresa</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">OC / Solicitud</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Proveedor</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Motivo</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider text-right">Monto</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">1ra Firma</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">2da Firma</th>
                  <th className="py-3 px-4 text-slate-400 font-semibold uppercase text-[10px] tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrdenes.map((orden) => {
                  const sigInfo = getOrderSignatureInfo(orden);
                  const numMonto = parseMontoToNumber(orden.monto);
                  const isCopied = copiedId === (orden.id || orden.numOC);

                  return (
                    <tr key={orden.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Empresa */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          orden.empresa === "Hoyts"
                            ? "bg-purple-950/60 text-purple-300 border-purple-800/60"
                            : "bg-teal-950/60 text-teal-300 border-teal-800/60"
                        }`}>
                          {orden.empresa}
                        </span>
                      </td>

                      {/* OC / Solicitud */}
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

                      {/* Proveedor */}
                      <td className="py-3 px-4 font-semibold text-slate-200 max-w-[180px] truncate" title={orden.razonSocial}>
                        {orden.razonSocial || "Sin razón social"}
                      </td>

                      {/* Motivo */}
                      <td className="py-3 px-4 text-slate-300 max-w-[240px] truncate text-[11px]" title={orden.motivo}>
                        {orden.motivo || "Sin motivo"}
                      </td>

                      {/* Monto */}
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                        $ {numMonto.toLocaleString("es-AR")}
                      </td>

                      {/* 1ra Firma */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {sigInfo.isF1Signed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            {sigInfo.f1Signer || "Firmado"}
                          </span>
                        ) : orden.enviadoA1?.trim() ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Send className="w-2.5 h-2.5 text-purple-400" />
                            Enviado a {orden.enviadoA1.trim()}
                          </span>
                        ) : (orden.enviado && !sigInfo.isF1Signed) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Send className="w-2.5 h-2.5 text-purple-400" />
                            Enviado a {sigInfo.f1Label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10">
                            Pendiente ({sigInfo.f1Label})
                          </span>
                        )}
                      </td>

                      {/* 2da Firma */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {sigInfo.isF2Signed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            {sigInfo.f2Signer || "Firmado"}
                          </span>
                        ) : orden.enviadoA2?.trim() ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Send className="w-2.5 h-2.5 text-purple-400" />
                            Enviado a {orden.enviadoA2.trim()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10">
                            Pendiente ({sigInfo.f2Label})
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
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
             DETAILED CARD VIEW (Visual Pipeline Stepper)
             ======================================================== */
          <div className="space-y-3.5">
            {filteredOrdenes.map((orden) => {
              const sigInfo = getOrderSignatureInfo(orden);
              const numMonto = parseMontoToNumber(orden.monto);
              const isCopied = copiedId === (orden.id || orden.numOC);
              const hasNotes = Boolean(orden.notas && orden.notas.length > 0);

              return (
                <div
                  key={orden.id}
                  className="rounded-2xl bg-[#0f1422] border border-white/10 hover:border-white/20 transition-all shadow-md overflow-hidden group"
                >
                  {/* Card Header Bar */}
                  <div className="p-4 sm:p-4.5 bg-gradient-to-r from-[#121829] to-[#0f1422] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Empresa Pill */}
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono tracking-wider border shadow-sm ${
                        orden.empresa === "Hoyts"
                          ? "bg-purple-950/80 text-purple-300 border-purple-700/60"
                          : "bg-teal-950/80 text-teal-300 border-teal-700/60"
                      }`}>
                        {orden.empresa}
                      </span>

                      {/* OC Number & Quick Copy */}
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

                      {/* SC Number */}
                      {orden.numSolicitud && (
                        <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                          SC: {orden.numSolicitud}
                        </span>
                      )}

                      {/* Tier Badge */}
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                        {sigInfo.tierName}
                      </span>

                      {/* Notes Badge */}
                      {hasNotes && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                          <MessageSquare className="w-3 h-3" />
                          {orden.notas!.length} {orden.notas!.length === 1 ? "nota" : "notas"}
                        </span>
                      )}
                    </div>

                    {/* Amount & Main Detail Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-black text-emerald-400 font-mono tracking-tight">
                          $ {numMonto.toLocaleString("es-AR")}
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {orden.formaPago || "30DFF"}
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveNotesOrden(orden)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalle / Firmar</span>
                      </button>
                    </div>

                  </div>

                  {/* Card Body: Vendor & Motivo */}
                  <div className="p-4 sm:p-4.5 space-y-3.5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Vendor */}
                      <div className="md:col-span-1 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          Proveedor
                        </span>
                        <div className="font-bold text-slate-100 text-sm">
                          {orden.razonSocial || "Sin razón social registrada"}
                        </div>
                      </div>

                      {/* Description / Motivo */}
                      <div className="md:col-span-2 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Motivo / Descripción
                        </span>
                        <p className="text-slate-300 font-medium text-xs bg-[#0b0f19]/60 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                          {orden.motivo || "Sin detalle registrado"}
                        </p>
                      </div>
                    </div>

                    {/* ========================================================
                        VISUAL SIGNATURE STEPPER PIPELINE
                        ======================================================== */}
                    <div className="pt-2 border-t border-white/5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        
                        {/* Step 1: Envio inicial */}
                        <div className="p-2.5 rounded-xl bg-[#0b0f19]/70 border border-white/5 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paso 1</div>
                            <div className="text-xs font-semibold text-slate-200 truncate">Orden Mandada</div>
                          </div>
                        </div>

                        {/* Step 2: 1ra Firma */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                          sigInfo.isF1Signed 
                            ? "bg-emerald-500/10 border-emerald-500/30" 
                            : orden.enviadoA1
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-[#0b0f19]/70 border-white/5"
                        }`}>
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              sigInfo.isF1Signed 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                : orden.enviadoA1
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "bg-white/5 text-slate-400 border-white/10"
                            }`}>
                              {sigInfo.isF1Signed ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : orden.enviadoA1 ? (
                                <Send className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                1ra Firma ({sigInfo.f1Label})
                              </div>
                              <div className="text-xs font-semibold truncate">
                                {sigInfo.isF1Signed ? (
                                  <span className="text-emerald-300 font-bold">{sigInfo.f1Signer}</span>
                                ) : orden.enviadoA1 ? (
                                  <span className="text-blue-300 font-medium">Enviado a {orden.enviadoA1}</span>
                                ) : (
                                  <span className="text-slate-400">Pendiente</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            sigInfo.isF1Signed 
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                              : orden.enviadoA1
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-white/5 text-slate-400 border border-white/10"
                          }`}>
                            {sigInfo.isF1Signed ? "Firmado" : orden.enviadoA1 ? "Enviado" : "Pendiente"}
                          </span>
                        </div>

                        {/* Step 3: 2da Firma */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                          sigInfo.isF2Signed 
                            ? "bg-emerald-500/10 border-emerald-500/30" 
                            : orden.enviadoA2
                            ? "bg-purple-500/10 border-purple-500/30"
                            : "bg-[#0b0f19]/70 border-white/5"
                        }`}>
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              sigInfo.isF2Signed 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                : orden.enviadoA2
                                ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                : "bg-white/5 text-slate-400 border-white/10"
                            }`}>
                              {sigInfo.isF2Signed ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : orden.enviadoA2 ? (
                                <Send className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="truncate">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                2da Firma ({sigInfo.f2Label})
                              </div>
                              <div className="text-xs font-semibold truncate">
                                {sigInfo.isF2Signed ? (
                                  <span className="text-emerald-300 font-bold">{sigInfo.f2Signer}</span>
                                ) : orden.enviadoA2 ? (
                                  <span className="text-purple-300 font-medium">Enviado a {orden.enviadoA2}</span>
                                ) : (
                                  <span className="text-slate-400">Pendiente</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            sigInfo.isF2Signed 
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                              : orden.enviadoA2
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-white/5 text-slate-400 border border-white/10"
                          }`}>
                            {sigInfo.isF2Signed ? "Firmado" : orden.enviadoA2 ? "Enviado" : "Pendiente"}
                          </span>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ========================================================
          MODALS & SYSTEM OVERLAYS
          ======================================================== */}
      
      {/* Modal de Detalle, Descripción y Firma Manual */}
      <OrderDetailModal
        orden={activeNotesOrden ? (ordenes.find((o) => o.id === activeNotesOrden.id) || activeNotesOrden) : null}
        onClose={() => setActiveNotesOrden(null)}
        isOrdenesUser={isOrdenesUser}
        onStatusChange={handleStatusChange}
        newNotaText={newNotaText}
        setNewNotaText={setNewNotaText}
        savingNota={savingNota}
        onAddNota={handleAddNota}
        showToast={showToast}
      />

      {/* Modal para Pegar y Marcar Órdenes como Enviadas a Firmar en Lote */}
      <BatchSendToSignModal
        isOpen={isBatchSendOpen}
        onClose={() => setIsBatchSendOpen(false)}
        ordenes={allOrdersForBatch.length > 0 ? allOrdersForBatch : ordenes}
        onBatchSuccess={(updatedEntries) => {
          const updateMap = new Map<string, Partial<OrdenCompra>>();
          for (const entry of updatedEntries) {
            updateMap.set(entry.id, entry.updates);
          }
          setOrdenes((prev) =>
            prev.map((o) => {
              if (o.id && updateMap.has(o.id)) {
                return { ...o, ...updateMap.get(o.id) };
              }
              return o;
            }).filter(o => !o.liberada && !o.entregada && !o.cancelada)
          );
        }}
        showToast={showToast}
      />

      {/* Modal para Pegar y Marcar Órdenes como Liberadas en Lote */}
      <BatchLiberateModal
        isOpen={isBatchLiberateOpen}
        onClose={() => setIsBatchLiberateOpen(false)}
        ordenes={allOrdersForBatch.length > 0 ? allOrdersForBatch : ordenes}
        onBatchSuccess={(updatedEntries) => {
          const updateMap = new Map<string, Partial<OrdenCompra>>();
          for (const entry of updatedEntries) {
            updateMap.set(entry.id, entry.updates);
          }
          setOrdenes((prev) =>
            prev.map((o) => {
              if (o.id && updateMap.has(o.id)) {
                return { ...o, ...updateMap.get(o.id) };
              }
              return o;
            }).filter(o => !o.liberada && !o.entregada && !o.cancelada)
          );
        }}
        showToast={showToast}
      />

      {/* Modal de Configuración de Aprobaciones */}
      <ApprovalConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigSaved={(newConfig) => {
          setConfig(newConfig);
          showToast("¡Configuración de aprobaciones guardada con éxito!");
        }}
        showToast={showToast}
      />
    </AppLayout>
  );
}
