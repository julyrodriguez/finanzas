"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  doc, 
  updateDoc, 
  arrayUnion 
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
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
  ExternalLink,
  PackageCheck,
  FileSpreadsheet,
  Layers
} from "lucide-react";
import type { Nota, OrdenCompra } from "@/types/ordenes";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { getOrderStatus, STATUS_CONFIG } from "@/components/ordenes/OrderStatusMenu";
import { exportToExcel } from "@/lib/exportToExcel";

interface ApprovalConfig {
  limiteNivel1: number; // 5000000 (Tomás + Área)
  limiteNivel2: number; // 18000000 (Pablo Mondelo + Darío)
  limiteNivel3: number; // 150000000 (Hernán/Matías + Darío)
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
  const [config, setConfig] = useState<ApprovalConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search, Filters and Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [queryLimit, setQueryLimit] = useState(15);

  const isSearching = Boolean(searchQuery.trim());

  // Modals
  const [activeNotesOrden, setActiveNotesOrden] = useState<OrdenCompra | null>(null);
  const [newNotaText, setNewNotaText] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  const { user } = useAuth();
  const isOrdenesUser = Boolean(user?.email?.startsWith("ordenes"));
  const authorName = user?.email?.split("@")[0] || "Usuario";

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3000);
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

  // Real-time Firestore Listener: Reads ONLY 15 (+1) docs initially to save Firebase read quotas.
  // When searching, expands limit to 300 to search across all records.
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    const fetchLimit = isSearching ? 300 : queryLimit + 1;
    const q = query(
      collection(db, "ordenes_compra"),
      orderBy("createdAt", "desc"),
      limit(fetchLimit)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: OrdenCompra[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
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
            firmado1: Boolean(data.firmado1),
            firmado2: Boolean(data.firmado2),
            firmante1: data.firmante1 || "",
            firmante2: data.firmante2 || "",
            fechaFirma1: data.fechaFirma1 || "",
            fechaFirma2: data.fechaFirma2 || "",
            linkSharepoint: data.linkSharepoint || "",
            enviadoA1: data.enviadoA1 || "",
            enviadoA2: data.enviadoA2 || "",
            fechaEnvio1: data.fechaEnvio1 || "",
            fechaEnvio2: data.fechaEnvio2 || "",
          };
        });
        setOrdenes(items);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching ordenes:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [queryLimit, isSearching]);

  // Compute Signature and Tier Info
  const getOrderSignatureInfo = (orden: OrdenCompra) => {
    const numMonto = parseMontoToNumber(orden.monto);
    const limite1 = config.limiteNivel1;
    const limite2 = config.limiteNivel2;
    const limite3 = config.limiteNivel3;

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
        isComplete: isF1 && isF2,
      };
    }

    if (numMonto <= limite2) {
      const isF1 = Boolean(orden.firmado1 || (orden.firmante1 && orden.firmante1.trim().length > 0));
      const isF2 = Boolean(orden.firmado2 || (orden.firmante2 && orden.firmante2.trim().length > 0));
      return {
        tierName: "Nivel 2 ($5M - $18M)",
        tierKey: "Nivel 2",
        f1Label: "Pablo M.",
        f2Label: "Darío",
        f1Signer: orden.firmante1?.trim() || "",
        f2Signer: orden.firmante2?.trim() || "",
        isF1Signed: isF1,
        isF2Signed: isF2,
        isComplete: isF1 && isF2,
      };
    }

    if (numMonto <= limite3) {
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

    // Nivel 4 (> $150M)
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

  // Helper to check if an order's next pending signature has NOT been sent
  const isOrderNotSent = (orden: OrdenCompra) => {
    if (orden.liberada || orden.entregada || orden.cancelada) return false;
    const info = getOrderSignatureInfo(orden);
    if (!info.isF1Signed) {
      return !orden.enviadoA1?.trim();
    }
    if (!info.isF2Signed) {
      return !orden.enviadoA2?.trim();
    }
    return false;
  };

  // Helper to check if an order's next pending signature HAS been sent
  const isOrderSent = (orden: OrdenCompra) => {
    if (orden.liberada || orden.entregada || orden.cancelada) return false;
    const info = getOrderSignatureInfo(orden);
    if (!info.isF1Signed) {
      return Boolean(orden.enviadoA1?.trim());
    }
    if (!info.isF2Signed) {
      return Boolean(orden.enviadoA2?.trim());
    }
    return false;
  };

  // KPIs
  const stats = useMemo(() => {
    let totalMonto = 0;
    let countMandadas = 0;
    let countLiberadas = 0;
    let countEntregadas = 0;
    let countPendientes = 0;
    let countCanceladas = 0;
    let countSinEnviar = 0;
    let countEnviadas = 0;

    for (const ord of ordenes) {
      totalMonto += parseMontoToNumber(ord.monto);
      const st = getOrderStatus(ord);
      if (st === "mandada") countMandadas++;
      else if (st === "liberada") countLiberadas++;
      else if (st === "entregada") countEntregadas++;
      else if (st === "pendiente") countPendientes++;
      else if (st === "cancelada") countCanceladas++;

      if (isOrderNotSent(ord)) {
        countSinEnviar++;
      } else if (isOrderSent(ord)) {
        countEnviadas++;
      }
    }

    return {
      totalCount: ordenes.length,
      totalMonto,
      countMandadas,
      countLiberadas,
      countEntregadas,
      countPendientes,
      countCanceladas,
      countSinEnviar,
      countEnviadas,
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

      return true;
    });
  }, [ordenes, searchQuery, empresaFilter]);

  // Paginated visible orders: If searching, search across all DB orders and show all matches.
  // Otherwise, slice up to queryLimit.
  const visibleOrdenes = useMemo(() => {
    if (isSearching) {
      return filteredOrdenes;
    }
    return filteredOrdenes.slice(0, queryLimit);
  }, [filteredOrdenes, isSearching, queryLimit]);

  const hasMore = !isSearching && (ordenes.length > queryLimit || filteredOrdenes.length > queryLimit);

  // Reset pagination limit when changing primary filters
  useEffect(() => {
    setQueryLimit(15);
  }, [empresaFilter]);

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

  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    setOrdenes((prev) =>
      prev.map((item) => (item.id === ordenId ? { ...item, ...updatedFields } : item))
    );
  };

  return (
    <AppLayout
      title="Seguimiento de Órdenes"
      subtitle="Visualización completa de órdenes, firmas requeridas, envíos y estado de entrega"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl animate-in slide-in-from-bottom duration-200 border border-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header Banner */}
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#0b0f19] via-[#0f172a] to-[#0b0f19] border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Panel Integral de Órdenes</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {stats.totalCount} órdenes
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Consulta el estado de cada orden, firmas autorizadas, destinatarios de envío y entregas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Copiar Todas button (desktop only) */}
            {filteredOrdenes.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="hidden sm:inline-flex px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all items-center gap-2 shadow-sm cursor-pointer"
                title="Copiar todas las órdenes filtradas al portapapeles"
              >
                <Copy className="w-4 h-4 text-emerald-400" />
                <span>Copiar Todas ({filteredOrdenes.length})</span>
              </button>
            )}

            {/* Export to Excel button */}
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Exportar listado a Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* KPI Stats Grid */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-2xl bg-[#0b0f19] border border-slate-800 space-y-1 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Total Órdenes
              </span>
              <div className="text-2xl font-black text-white font-mono">
                {stats.totalCount}
              </div>
              <p className="text-[10.5px] text-slate-500">
                {isSearching ? "Encontradas en base de datos" : `Últimas ${visibleOrdenes.length} cargadas`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                📫 Sin Enviar
              </span>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {stats.countSinEnviar}
              </div>
              <p className="text-[10.5px] text-slate-400">
                {isSearching ? "En toda la base de datos" : `Ref. a las últimas ${visibleOrdenes.length}`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber-400" />
                🟡 En Proceso
              </span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {stats.countMandadas}
              </div>
              <p className="text-[10.5px] text-slate-400">
                {isSearching ? "En toda la base de datos" : `Ref. a las últimas ${visibleOrdenes.length}`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                ✅ Liberadas
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {stats.countLiberadas}
              </div>
              <p className="text-[10.5px] text-slate-400">
                {isSearching ? "En toda la base de datos" : `Ref. a las últimas ${visibleOrdenes.length}`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-1 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-teal-400" />
                📦 Entregadas
              </span>
              <div className="text-2xl font-black text-teal-400 font-mono">
                {stats.countEntregadas}
              </div>
              <p className="text-[10.5px] text-slate-400">
                {isSearching ? "En toda la base de datos" : `Ref. a las últimas ${visibleOrdenes.length}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
            <span className="text-indigo-400 font-bold">ℹ️ Nota:</span>
            <span>
              {isSearching
                ? "Búsqueda activa: Se están revisando todas las órdenes cargadas en la base de datos."
                : `Los totales son en referencia a las últimas ${visibleOrdenes.length} órdenes. Al utilizar el buscador se revisará en todas las órdenes cargadas en la base de datos.`}
            </span>
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
                placeholder="Buscar por OC, SC, Proveedor, Detalle o Firmante..."
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
              {(["Todas", "Hoyts", "CMK"] as const).map((emp) => {
                const isSelected = empresaFilter === emp;
                return (
                  <button
                    key={emp}
                    onClick={() => setEmpresaFilter(emp)}
                    className={"px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer " + (
                      isSelected
                        ? emp === "Hoyts"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : emp === "CMK"
                          ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
                          : "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {emp === "CMK" ? "CMK (Cinemark)" : emp}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search Feedback Banner */}
        {isSearching && (
          <div className="px-4 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Buscando en <strong>todas</strong> las órdenes de la base de datos</span>
            </span>
            <span className="font-mono font-bold text-white bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30">
              {filteredOrdenes.length} {filteredOrdenes.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>
        )}

        {/* Orders List / Cards */}
        {loading ? (
          <div className="p-12 text-center bg-[#0b0f19] rounded-3xl border border-slate-800 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-400">Cargando órdenes del sistema...</span>
          </div>
        ) : filteredOrdenes.length === 0 ? (
          <div className="p-12 text-center bg-[#0b0f19] rounded-3xl border border-slate-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto stroke-[1.5]" />
            <h4 className="text-base font-bold text-white">¡No se encontraron órdenes con los filtros aplicados!</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Probá cambiando los términos de búsqueda o seleccionando otro filtro de estado o empresa.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleOrdenes.map((orden) => {
              const sigInfo = getOrderSignatureInfo(orden);
              const numMonto = parseMontoToNumber(orden.monto);
              const orderStatusKey = getOrderStatus(orden);
              const statusCfg = STATUS_CONFIG[orderStatusKey];
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={orden.id}
                  className="rounded-3xl bg-[#0f1629] border-2 border-slate-700/70 hover:border-indigo-500/60 transition-all shadow-2xl shadow-black/60 overflow-hidden group"
                >
                  {/* Card Header Bar */}
                  <div className="px-5 py-3.5 bg-[#141d34] border-b border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={"px-2.5 py-0.5 rounded-lg text-[11px] font-bold font-mono tracking-wider border shadow-sm " + (
                          orden.empresa === "Hoyts"
                            ? "bg-purple-950/90 text-purple-300 border-purple-600/70"
                            : "bg-teal-950/90 text-teal-300 border-teal-600/70"
                        )}
                      >
                        {orden.empresa}
                      </span>

                      <div className="inline-flex items-center gap-1.5 bg-[#0b101e] border border-slate-600/80 px-2.5 py-0.5 rounded-lg shadow-sm">
                        <span className="text-sm font-black text-white font-mono tracking-tight">
                          OC: {orden.numOC}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(orden)}
                          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Copiar datos de esta orden"
                        >
                          <Copy className="w-3 h-3 text-emerald-400" />
                        </button>
                      </div>

                      {orden.numSolicitud && (
                        <span className="text-[11px] font-mono text-slate-300 bg-[#0b101e] px-2.5 py-0.5 rounded-md border border-slate-700">
                          SC: {orden.numSolicitud}
                        </span>
                      )}

                      {/* General Status Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 shadow-sm ${statusCfg.badgeClass}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusCfg.label}</span>
                      </span>

                      <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-600">
                        {sigInfo.tierName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-emerald-400 font-mono tracking-tight">
                        $ {numMonto.toLocaleString("es-AR")}
                      </span>

                      <button
                        onClick={() => setActiveNotesOrden(orden)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-950/50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Detalle</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4 bg-[#0a0f1d]">
                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="md:col-span-2 space-y-1.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Proveedor:</span>
                          <span className="text-white font-bold text-sm tracking-tight">{orden.razonSocial}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider shrink-0 mt-0.5">Motivo:</span>
                          <p className="text-slate-200 font-medium leading-relaxed">{orden.motivo}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 bg-[#0e1526] p-3 rounded-2xl border border-slate-700/70 text-[11px]">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Forma de Pago:</span>
                          <span className="text-white font-bold">{orden.formaPago}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Creado por:</span>
                          <span className="text-slate-200 font-medium">{orden.creadoPor || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Signatures and Sent Tracking Timeline Bar */}
                    <div className="p-3.5 rounded-2xl bg-[#070b14] border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                          Seguimiento de Firmas y Envíos
                        </span>
                        {orden.notas && orden.notas.length > 0 && (
                          <span className="text-[10.5px] text-amber-300 font-medium">
                            💬 {orden.notas.length} nota(s) registrada(s)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        
                        {/* 1ra Firma */}
                        <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                          sigInfo.isF1Signed 
                            ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
                            : orden.enviadoA1?.trim()
                            ? "bg-blue-950/40 border-blue-600/60 text-blue-300"
                            : "bg-[#0d1322] border-slate-700 text-slate-400"
                        }`}>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                            sigInfo.isF1Signed 
                              ? "bg-emerald-500 text-black" 
                              : orden.enviadoA1?.trim()
                              ? "bg-blue-500 text-white"
                              : "bg-slate-700 text-slate-300"
                          }`}>
                            1
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                                1ra Firma ({sigInfo.f1Label})
                              </span>
                              {sigInfo.isF1Signed ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                                  LISTA
                                </span>
                              ) : orden.enviadoA1?.trim() ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                                  ENVIADA
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300">
                                  SIN ENVIAR
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-semibold truncate text-white mt-0.5">
                              {sigInfo.isF1Signed ? (
                                `Firmado por ${sigInfo.f1Signer || "Tomás"}`
                              ) : orden.enviadoA1?.trim() ? (
                                `Enviado a ${orden.enviadoA1}`
                              ) : (
                                "Pendiente de envío"
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 2da Firma */}
                        <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                          sigInfo.isF2Signed 
                            ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
                            : orden.enviadoA2?.trim()
                            ? "bg-blue-950/40 border-blue-600/60 text-blue-300"
                            : "bg-[#0d1322] border-slate-700 text-slate-400"
                        }`}>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                            sigInfo.isF2Signed 
                              ? "bg-emerald-500 text-black" 
                              : orden.enviadoA2?.trim()
                              ? "bg-blue-500 text-white"
                              : "bg-slate-700 text-slate-300"
                          }`}>
                            2
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                                2da Firma ({sigInfo.f2Label})
                              </span>
                              {sigInfo.isF2Signed ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                                  LISTA
                                </span>
                              ) : orden.enviadoA2?.trim() ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                                  ENVIADA
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300">
                                  SIN ENVIAR
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-semibold truncate text-white mt-0.5">
                              {sigInfo.isF2Signed ? (
                                `Firmado por ${sigInfo.f2Signer}`
                              ) : orden.enviadoA2?.trim() ? (
                                `Enviado a ${orden.enviadoA2}`
                              ) : (
                                "Pendiente de envío"
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Estado Entrega / Pago */}
                        <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                          orden.entregada 
                            ? "bg-teal-950/50 border-teal-500/70 text-teal-300 shadow-sm"
                            : orden.liberada
                            ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
                            : "bg-[#0d1322] border-slate-700 text-slate-400"
                        }`}>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                            orden.entregada 
                              ? "bg-teal-400 text-black shadow-[0_0_10px_rgba(45,212,191,0.5)]" 
                              : orden.liberada
                              ? "bg-emerald-500 text-black"
                              : "bg-slate-700 text-slate-300"
                          }`}>
                            ✓
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                                Entrega / Pago
                              </span>
                              {orden.entregada ? (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-teal-500/25 text-teal-300 border border-teal-500/40">
                                  ENTREGADA
                                </span>
                              ) : orden.liberada ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                                  LIBERADA
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                  PENDIENTE
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-semibold truncate text-white mt-0.5">
                              {orden.entregada ? (
                                "Comprobante / pago entregado"
                              ) : orden.liberada ? (
                                "Autorizada para pago"
                              ) : (
                                "En proceso de autorización"
                              )}
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>
              );
            })}

            {/* Cargar más órdenes button */}
            {hasMore && (
              <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-2">
                <button
                  onClick={() => setQueryLimit((prev) => prev + 15)}
                  className="px-6 py-3 rounded-2xl bg-[#111726] hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-white font-bold text-xs transition-all shadow-lg flex items-center gap-2.5 cursor-pointer"
                >
                  <span>Cargar más órdenes (+15)</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    (Mostrando {visibleOrdenes.length} órdenes)
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal de Detalle / Notas */}
      <OrderDetailModal
        orden={activeNotesOrden}
        onClose={() => setActiveNotesOrden(null)}
        isOrdenesUser={isOrdenesUser}
        newNotaText={newNotaText}
        setNewNotaText={setNewNotaText}
        savingNota={savingNota}
        onAddNota={handleAddNota}
        onStatusChange={handleStatusChange}
        showToast={showToast}
      />
    </AppLayout>
  );
}
