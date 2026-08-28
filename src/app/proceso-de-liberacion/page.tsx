"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  doc, 
  query,
  where
} from "firebase/firestore";
import { 
  Clock, 
  Check, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Search,
  X,
  Copy
} from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";

export default function ProcesoDeLiberacionPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEnvio, setFilterEnvio] = useState<"Todas" | "Enviadas" | "No Enviadas" | "1 firma">("Todas");

  const filteredOrdenes = ordenes.filter((o) => {
    // 1. Filter by search query
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      const matchesSearch = (
        o.numOC.toLowerCase().includes(queryLower) ||
        o.numSolicitud.toLowerCase().includes(queryLower) ||
        o.razonSocial.toLowerCase().includes(queryLower) ||
        o.motivo.toLowerCase().includes(queryLower)
      );
      if (!matchesSearch) return false;
    }

    // 2. Filter by envio status
    if (filterEnvio === "Enviadas") {
      return o.enviado === true;
    } else if (filterEnvio === "No Enviadas") {
      return !o.enviado;
    } else if (filterEnvio === "1 firma") {
      const signatureCount = (o.firmado1 ? 1 : 0) + (o.firmado2 ? 1 : 0);
      return signatureCount === 1;
    }

    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load ONLY 'Mandadas' and non-released, non-cancelled orders from Firestore
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
            monto: data.monto ?? "",
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
            firmado1: Boolean(data.firmado1),
            firmado2: Boolean(data.firmado2),
            linkSharepoint: data.linkSharepoint || "",
          } as OrdenCompra;
        });

        // Filter out cancelled orders on client side
        const activeDocs = docs.filter(o => !o.cancelada);

        // Sort manually by creation time
        activeDocs.sort((a, b) => {
          const timeA = (a.createdAt && "seconds" in a.createdAt) ? a.createdAt.seconds : 0;
          const timeB = (b.createdAt && "seconds" in b.createdAt) ? b.createdAt.seconds : 0;
          return timeB - timeA;
        });

        setOrdenes(activeDocs);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching mandadas orders:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Toggle step values
  const handleTogglePasoLiberacion = async (orden: OrdenCompra, paso: "enviado" | "firmado1" | "firmado2") => {
    const db = getFirebaseDb();
    if (!db || !orden.id) return;

    const currentValue = Boolean(orden[paso]);
    const newValue = !currentValue;

    const updates: Partial<OrdenCompra> = { [paso]: newValue };
    
    // Auto-complete firmado1 if firmado2 is being set to true and enviado is already true
    const autoCompletesFirmado1 = (paso === "firmado2" && newValue && Boolean(orden.enviado));
    if (autoCompletesFirmado1) {
      updates.firmado1 = true;
    }

    // Optimistic update
    setOrdenes((prev) =>
      prev.map((o) => (o.id === orden.id ? { ...o, ...updates } : o))
    );

    try {
      const docRef = doc(db, "ordenes_compra", orden.id);
      await updateDoc(docRef, updates);
      showToast(`Estado '${paso === 'enviado' ? 'Enviado' : paso === 'firmado1' ? 'Firmado 1' : 'Firmado 2'}' actualizado`);
    } catch (err) {
      console.error("Error al actualizar paso de liberación:", err);
      // Rollback
      setOrdenes((prev) =>
        prev.map((o) => (o.id === orden.id ? { 
          ...o, 
          [paso]: currentValue,
          ...(autoCompletesFirmado1 ? { firmado1: Boolean(orden.firmado1) } : {})
        } : o))
      );
    }
  };

  // Approve final release
  const handleAprobarLiberacion = async (orden: OrdenCompra) => {
    const msg = `¿Confirmar la liberación de la OC ${orden.numOC}?`;
    if (!confirm(msg)) return;

    // Optimistic update
    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, liberada: true } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { liberada: true });
        showToast("¡Orden de compra liberada con éxito!");
      } catch (err) {
        console.error("Error al liberar orden:", err);
        // Rollback
        setOrdenes((prev) =>
          prev.map((item) => (item.id === orden.id ? { ...item, liberada: false } : item))
        );
      }
    }
  };

  // Copy Order Format to Clipboard (plain text format)
  const handleCopy = (orden: OrdenCompra) => {
    const formattedMonto = typeof orden.monto === "number"
      ? `$ ${orden.monto.toLocaleString("es-AR")}`
      : orden.monto;

    const notasPart = orden.notas && orden.notas.length > 0
      ? "\nNotas:\n" + orden.notas.map(n => `- ${n.texto}`).join("\n")
      : "";

    const linkPart = orden.linkSharepoint ? `\nLink: ${orden.linkSharepoint}` : "";

    const copyText = `\n\n\nOC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: ${formattedMonto}
Detalle: ${orden.motivo}
Forma de Pago: ${orden.formaPago}${notasPart}${linkPart}`;

    navigator.clipboard.writeText(copyText);
    showToast(`¡Copiado OC ${orden.numOC}!`);
  };

  return (
    <AppLayout 
      title="Proceso de Liberación" 
      subtitle="Aprobación final de órdenes de compra mediante firma en tres pasos"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-500 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="glass-card border border-white/10 p-5 rounded-3xl space-y-4 shadow-xl bg-[#0e1322]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/10">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Proceso de Liberación
                </h3>
                <p className="text-xs text-slate-400">Verificación y firmas de órdenes mandadas para habilitar su liberación</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs font-bold text-amber-400 self-start sm:self-auto shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {filteredOrdenes.length} Mandadas Pendientes
            </span>
          </div>

          {/* Buscador y Filtros */}
          {!loading && ordenes.length > 0 && (
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 pt-1">
              {/* Buscador */}
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por OC, Solicitud, Proveedor o Motivo..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[#080c16] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtros de Envío */}
              <div className="inline-flex items-center p-1 bg-[#080c16] rounded-xl border border-slate-700/80 text-xs shadow-inner flex-wrap gap-0.5">
                <span className="text-slate-400 text-[11px] px-2.5 font-semibold uppercase tracking-wider">Envío</span>
                {(["Todas", "Enviadas", "No Enviadas", "1 firma"] as const).map((filterOpt) => (
                  <button
                    key={filterOpt}
                    onClick={() => setFilterEnvio(filterOpt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      filterEnvio === filterOpt
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {filterOpt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs">Cargando proceso de liberación...</p>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-slate-800 bg-[#080c16] p-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No hay órdenes pendientes</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Todas las órdenes en estado &quot;Mandada&quot; ya han sido debidamente liberadas.
              </p>
            </div>
          ) : filteredOrdenes.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-slate-800 bg-[#080c16] p-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">Sin resultados</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No se encontraron órdenes que coincidan con la búsqueda o filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOrdenes.map((orden) => {
                const isEnviado = Boolean(orden.enviado);
                const isFirmado1 = Boolean(orden.firmado1);
                const isFirmado2 = Boolean(orden.firmado2);
                const isAprobadoParaLiberar = isEnviado && isFirmado1 && isFirmado2;

                return (
                  <div 
                    key={orden.id} 
                    className="p-4 sm:p-5 rounded-2xl bg-[#111726] border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 shadow-lg transition-all duration-200"
                  >
                    {/* Header info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          orden.empresa === "Hoyts" 
                            ? "bg-purple-950 text-purple-300 border border-purple-800/50" 
                            : "bg-teal-950 text-teal-300 border border-teal-800/50"
                        }`}>
                          {orden.empresa}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          N° Solicitud: {orden.numSolicitud}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pb-1">
                        <h4 className="text-sm font-black text-white font-mono">
                          OC: {orden.numOC}
                        </h4>
                        <button
                          onClick={() => handleCopy(orden)}
                          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-[#080c16] text-slate-300 hover:text-white hover:bg-white/5 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="Copiar resumen"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-1 font-medium">
                        <strong className="text-slate-400 font-semibold">Prov:</strong> {orden.razonSocial}
                      </p>
                      <p className="text-[11px] text-gray-400 line-clamp-1">
                        <strong>Monto:</strong> ${Number(orden.monto).toLocaleString("es-AR")} | <strong>Motivo:</strong> {orden.motivo}
                      </p>
                    </div>

                    {/* Timeline / 3 Tildes */}
                    <div className="py-2 border-t border-b border-white/5 flex items-center justify-around">
                      {/* Step 1: Enviado */}
                      <button
                        onClick={() => handleTogglePasoLiberacion(orden, 'enviado')}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                          isEnviado
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : "bg-white/5 border-white/10 text-gray-500 group-hover:border-white/20"
                        }`}>
                          <Check className={`w-4 h-4 ${isEnviado ? "stroke-[3]" : "opacity-30"}`} />
                        </div>
                        <span className="text-[9px] font-semibold text-gray-400 group-hover:text-white">Enviado</span>
                      </button>

                      {/* Connect line */}
                      <div className={`h-[2px] flex-1 max-w-[20px] -mt-4 transition-colors ${
                        isEnviado && isFirmado1 ? "bg-emerald-500" : "bg-white/10"
                      }`} />

                      {/* Step 2: Firmado 1 */}
                      <button
                        onClick={() => handleTogglePasoLiberacion(orden, 'firmado1')}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                          isFirmado1
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : "bg-white/5 border-white/10 text-gray-500 group-hover:border-white/20"
                        }`}>
                          <Check className={`w-4 h-4 ${isFirmado1 ? "stroke-[3]" : "opacity-30"}`} />
                        </div>
                        <span className="text-[9px] font-semibold text-gray-400 group-hover:text-white">Firmado 1</span>
                      </button>

                      {/* Connect line */}
                      <div className={`h-[2px] flex-1 max-w-[20px] -mt-4 transition-colors ${
                        isFirmado1 && isFirmado2 ? "bg-emerald-500" : "bg-white/10"
                      }`} />

                      {/* Step 3: Firmado 2 */}
                      <button
                        onClick={() => handleTogglePasoLiberacion(orden, 'firmado2')}
                        className="flex flex-col items-center gap-1 group cursor-pointer"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                          isFirmado2
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : "bg-white/5 border-white/10 text-gray-500 group-hover:border-white/20"
                        }`}>
                          <Check className={`w-4 h-4 ${isFirmado2 ? "stroke-[3]" : "opacity-30"}`} />
                        </div>
                        <span className="text-[9px] font-semibold text-gray-400 group-hover:text-white">Firmado 2</span>
                      </button>
                    </div>

                    {/* Approve button (only active when all 3 ticks are set) */}
                    <button
                      onClick={() => handleAprobarLiberacion(orden)}
                      disabled={!isAprobadoParaLiberar}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow ${
                        isAprobadoParaLiberar
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10 cursor-pointer"
                          : "bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
                      }`}
                    >
                      {isAprobadoParaLiberar ? "🎉 Aprobar Liberación" : "Faltan firmas"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
