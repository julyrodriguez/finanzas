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
import { 
  Clock, 
  Check, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  X, 
  Copy, 
  ShieldCheck, 
  PenTool, 
  Eye, 
  DollarSign, 
  Building2, 
  Settings, 
  Filter, 
  Calendar,
  Send,
  ExternalLink,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import type { OrdenCompra, Nota } from "@/types/ordenes";
import { 
  getStoredApprovalConfig, 
  DEFAULT_APPROVAL_CONFIG, 
  parseMontoToNumber,
  cleanName,
  isNameInList
} from "@/lib/approvalConfig";
import { BatchLiberateModal } from "@/components/ordenes/BatchLiberateModal";
import { BatchSendToSignModal } from "@/components/ordenes/BatchSendToSignModal";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { ApprovalConfigModal } from "@/components/ordenes/ApprovalConfigModal";
import { useAuth } from "@/context/AuthContext";

export default function ProcesoDeLiberacionPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [allOrdersForBatch, setAllOrdersForBatch] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "falta_2da" | "falta_1ra">("todas");
  const [empresaFilter, setEmpresaFilter] = useState<"Todas" | "Hoyts" | "Cinemark">("Todas");
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

  // Load Mandadas (In Process of Liberation)
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const colRef = collection(db, "ordenes_compra");
    const q = query(
      colRef,
      where("mandada", "==", true),
      where("liberada", "==", false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            empresa: data.empresa || "Hoyts",
            numSolicitud: data.numSolicitud || "",
            numOC: data.numOC || "",
            razonSocial: data.razonSocial || "",
            monto: data.monto ?? 0,
            motivo: data.motivo || "",
            formaPago: data.formaPago || "30DFF",
            liberada: Boolean(data.liberada),
            mandada: Boolean(data.mandada),
            entregada: Boolean(data.entregada),
            cancelada: Boolean(data.cancelada),
            creadoPor: data.creadoPor || "Usuario",
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
          } as OrdenCompra;
        }).filter(o => !o.cancelada);

        setOrdenes(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error al escuchar órdenes mandadas:", err);
        setLoading(false);
      }
    );

    // Also load all orders for BatchLiberateModal and BatchSendToSignModal reference
    const qAll = query(colRef);
    const unsubAll = onSnapshot(qAll, (snapshot) => {
      const allDocs = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          empresa: data.empresa || "Hoyts",
          numSolicitud: data.numSolicitud || "",
          numOC: data.numOC || "",
          razonSocial: data.razonSocial || "",
          monto: data.monto ?? 0,
          motivo: data.motivo || "",
          formaPago: data.formaPago || "30DFF",
          liberada: Boolean(data.liberada),
          mandada: Boolean(data.mandada),
          entregada: Boolean(data.entregada),
          cancelada: Boolean(data.cancelada),
          creadoPor: data.creadoPor || "Usuario",
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
        } as OrdenCompra;
      });
      setAllOrdersForBatch(allDocs);
    });

    return () => {
      unsubscribe();
      unsubAll();
    };
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

  // KPIs
  const stats = useMemo(() => {
    let totalMonto = 0;
    let countFalta2da = 0;
    let countFalta1ra = 0;

    for (const ord of ordenes) {
      totalMonto += parseMontoToNumber(ord.monto);
      const info = getOrderSignatureInfo(ord);
      if (info.isPartial) {
        countFalta2da++;
      } else if (info.isPendingBoth) {
        countFalta1ra++;
      }
    }

    return {
      totalCount: ordenes.length,
      totalMonto,
      countFalta2da,
      countFalta1ra,
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
      if (empresaFilter !== "Todas" && ord.empresa !== empresaFilter) {
        return false;
      }

      // 3. Signature Status Filter
      const info = getOrderSignatureInfo(ord);
      if (statusFilter === "falta_2da") {
        if (!info.isPartial) return false;
      } else if (statusFilter === "falta_1ra") {
        if (!info.isPendingBoth) return false;
      }

      // 4. Tier Filter
      if (tierFilter !== "Todos") {
        if (info.tierKey !== tierFilter) return false;
      }

      return true;
    });
  }, [ordenes, searchQuery, empresaFilter, statusFilter, tierFilter, config]);

  // Status Change handler for OrderDetailModal
  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    setOrdenes((prev) =>
      prev.map((item) => (item.id === ordenId ? { ...item, ...updatedFields } : item))
        .filter(item => !item.liberada && !item.cancelada)
    );
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

    if (db && activeNotesOrden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", activeNotesOrden.id);
        await updateDoc(docRef, {
          notas: arrayUnion(newNota),
        });
        showToast("Nota agregada correctamente");
      } catch (err) {
        console.error("Error al agregar nota:", err);
        showToast("Error al agregar la nota");
      }
    }

    setOrdenes((prev) =>
      prev.map((item) =>
        item.id === activeNotesOrden.id
          ? { ...item, notas: [...(item.notas || []), newNota] }
          : item
      )
    );

    setActiveNotesOrden((prev) =>
      prev ? { ...prev, notas: [...(prev.notas || []), newNota] } : null
    );

    setNewNotaText("");
    setSavingNota(false);
  };

  return (
    <AppLayout
      title="Proceso de Liberación"
      subtitle="Seguimiento en vivo de órdenes mandadas, doble firma y autorizaciones por nivel"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl animate-in slide-in-from-bottom duration-200 border border-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Action Bar & KPIs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0c1222] via-[#0f172a] to-[#0c1222] p-5 rounded-3xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Panel de Órdenes Mandadas</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    {stats.totalCount} en proceso
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Visualizá quién firmó y a quién le falta autorizar antes de la liberación final
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsBatchSendOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-950/50 flex items-center gap-2 cursor-pointer border border-blue-400/30"
              title="Pegar texto de órdenes y marcar como enviadas a firmar"
            >
              <Send className="w-4 h-4" />
              <span>📤 Pegar y Enviar a Firmar</span>
            </button>

            <button
              onClick={() => setIsBatchLiberateOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer border border-emerald-400/30"
              title="Pegar texto de órdenes y registrar autorizaciones / liberar"
            >
              <PenTool className="w-4 h-4" />
              <span>✍️ Pegar y Autorizar / Liberar</span>
            </button>

            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer"
              title="Configuración de Firmantes y Límites"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-[#0b0f19] border border-slate-800 space-y-1 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-amber-400" />
              Órdenes Mandadas
            </span>
            <div className="text-2xl font-black text-white font-mono">
              {stats.totalCount}
            </div>
            <p className="text-[10.5px] text-slate-500">Total en proceso de seguimiento</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Con 1 Firma Lista
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {stats.countFalta2da}
            </div>
            <p className="text-[10.5px] text-slate-400">Falta 2da firma para liberar</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-1 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Pendientes de 1ra Firma
            </span>
            <div className="text-2xl font-black text-slate-300 font-mono">
              {stats.countFalta1ra}
            </div>
            <p className="text-[10.5px] text-slate-500">Aún no tienen firmas cargadas</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 rounded-3xl bg-[#0b0f19] border border-slate-800 space-y-3.5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por OC, Solicitud, Proveedor o Motivo..."
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#111726] border border-slate-700/80 text-white text-xs font-semibold placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Empresa Selector */}
            <div className="flex items-center gap-1.5 bg-[#111726] p-1 rounded-2xl border border-slate-700/80 shrink-0">
              {(["Todas", "Hoyts", "Cinemark"] as const).map((emp) => (
                <button
                  key={emp}
                  onClick={() => setEmpresaFilter(emp)}
                  className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer " + (
                    empresaFilter === emp
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {emp}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setStatusFilter("todas")}
                className={"px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer " + (
                  statusFilter === "todas"
                    ? "bg-slate-700 text-white border border-slate-600"
                    : "bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                Todas ({ordenes.length})
              </button>

              <button
                onClick={() => setStatusFilter("falta_2da")}
                className={"px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " + (
                  statusFilter === "falta_2da"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                <span>🟡 Con 1 Firma</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-[10px] font-mono">
                  {stats.countFalta2da}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter("falta_1ra")}
                className={"px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " + (
                  statusFilter === "falta_1ra"
                    ? "bg-slate-700 text-white border border-slate-600"
                    : "bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                <span>⚪ Sin Firmas</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-600 text-[10px] font-mono">
                  {stats.countFalta1ra}
                </span>
              </button>
            </div>

            {/* Tier / Level Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold text-[11px]">Nivel:</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-2.5 py-1 rounded-xl bg-[#111726] border border-slate-700 text-slate-300 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Todos">Todos los niveles</option>
                <option value="Nivel 1">Nivel 1 (Hasta $5M)</option>
                <option value="Nivel 2">Nivel 2 ($5M - $18M)</option>
                <option value="Nivel 3">Nivel 3 ($18M - $150M)</option>
                <option value="Nivel 4">Nivel 4 (&gt; $150M)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List / Cards */}
        {loading ? (
          <div className="p-12 text-center bg-[#0b0f19] rounded-3xl border border-slate-800 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-400">Cargando órdenes en proceso de liberación...</span>
          </div>
        ) : filteredOrdenes.length === 0 ? (
          <div className="p-12 text-center bg-[#0b0f19] rounded-3xl border border-slate-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto stroke-[1.5]" />
            <h4 className="text-base font-bold text-white">¡No hay órdenes mandadas pendientes en esta vista!</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Todas las órdenes han sido liberadas o no coinciden con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrdenes.map((orden) => {
              const sigInfo = getOrderSignatureInfo(orden);
              const numMonto = parseMontoToNumber(orden.monto);

              return (
                <div
                  key={orden.id}
                  className="p-4 sm:p-5 rounded-3xl bg-[#0b0f19] border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-3.5 group"
                >
                  {/* Top Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={"px-2.5 py-0.5 rounded-lg text-[11px] font-bold font-mono tracking-wider border shadow-sm " + (
                          orden.empresa === "Hoyts"
                            ? "bg-purple-950/80 text-purple-300 border-purple-700/60"
                            : "bg-teal-950/80 text-teal-300 border-teal-700/60"
                        )}
                      >
                        {orden.empresa}
                      </span>

                      <span className="text-sm font-black text-white font-mono tracking-tight">
                        OC: {orden.numOC}
                      </span>

                      {orden.numSolicitud && (
                        <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                          Sol: {orden.numSolicitud}
                        </span>
                      )}

                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                        {sigInfo.tierName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-emerald-400 font-mono">
                        $ {numMonto.toLocaleString("es-AR")}
                      </span>

                      <button
                        onClick={() => setActiveNotesOrden(orden)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ml-2"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Descripción / Firmar</span>
                      </button>
                    </div>
                  </div>

                  {/* Middle Row: Proveedor & Motivo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                    <div className="md:col-span-1 space-y-0.5">
                      <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        Proveedor
                      </span>
                      <div className="font-bold text-slate-200 truncate">
                        {orden.razonSocial || "Sin razón social"}
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-0.5">
                      <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Motivo / Descripción
                      </span>
                      <p className="text-slate-300 font-medium line-clamp-2 leading-relaxed bg-[#111726]/50 p-2 rounded-xl border border-slate-800/80 text-[11.5px]">
                        {orden.motivo || "Sin motivo registrado"}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Signatures Tracking Grid */}
                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    
                    {/* Firma 1 Tracker */}
                    <div className={"p-2.5 rounded-xl border flex items-center justify-between gap-2 " + (
                      sigInfo.isF1Signed 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : orden.enviadoA1
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-[#111726]/60 border-slate-800"
                    )}>
                      <div className="space-y-0.5">
                        <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                          Firma 1 ({sigInfo.f1Label})
                        </div>
                        <div className="text-xs font-semibold text-white">
                          {sigInfo.isF1Signed ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {sigInfo.f1Signer}
                            </span>
                          ) : orden.enviadoA1 ? (
                            <span className="text-blue-300 font-bold flex items-center gap-1">
                              <Send className="w-3 h-3 text-blue-400" />
                              Enviado a {orden.enviadoA1}
                            </span>
                          ) : (
                            <span className="text-slate-400">Falta autorizar</span>
                          )}
                        </div>
                      </div>

                      <span className={"px-2 py-0.5 rounded-md text-[10px] font-bold " + (
                        sigInfo.isF1Signed 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : orden.enviadoA1
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10"
                      )}>
                        {sigInfo.isF1Signed ? "Firmado" : orden.enviadoA1 ? "Enviado" : "Pendiente"}
                      </span>
                    </div>

                    {/* Firma 2 Tracker */}
                    <div className={"p-2.5 rounded-xl border flex items-center justify-between gap-2 " + (
                      sigInfo.isF2Signed 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : orden.enviadoA2
                        ? "bg-indigo-500/10 border-indigo-500/30"
                        : "bg-[#111726]/60 border-slate-800"
                    )}>
                      <div className="space-y-0.5">
                        <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                          Firma 2 ({sigInfo.f2Label})
                        </div>
                        <div className="text-xs font-semibold text-white">
                          {sigInfo.isF2Signed ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {sigInfo.f2Signer}
                            </span>
                          ) : orden.enviadoA2 ? (
                            <span className="text-indigo-300 font-bold flex items-center gap-1">
                              <Send className="w-3 h-3 text-indigo-400" />
                              Enviado a {orden.enviadoA2}
                            </span>
                          ) : (
                            <span className="text-slate-400">Falta autorizar</span>
                          )}
                        </div>
                      </div>

                      <span className={"px-2 py-0.5 rounded-md text-[10px] font-bold " + (
                        sigInfo.isF2Signed 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : orden.enviadoA2
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10"
                      )}>
                        {sigInfo.isF2Signed ? "Firmado" : orden.enviadoA2 ? "Enviado" : "Pendiente"}
                      </span>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

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
            }).filter(o => !o.liberada && !o.cancelada)
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
            }).filter(o => !o.liberada && !o.cancelada)
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
