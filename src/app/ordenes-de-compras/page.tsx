"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Plus, 
  Search, 
  Copy, 
  CheckCircle2, 
  X, 
  Filter, 
  ShoppingBag, 
  Building2, 
  DollarSign, 
  CreditCard, 
  FileText, 
  Trash2, 
  Loader2,
  AlertCircle,
  Check
} from "lucide-react";

export interface OrdenCompra {
  id?: string;
  empresa: "Hoyts" | "CMK";
  numSolicitud: string;
  numOC: string;
  razonSocial: string;
  monto: number | string;
  motivo: string;
  formaPago: string;
  liberada: boolean;
  createdAt?: any;
}

export default function OrdenesDeComprasPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [filterEstado, setFilterEstado] = useState<"Todas" | "Liberadas" | "Pendientes">("Todas");
  
  // Modal state for New Order
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [empresa, setEmpresa] = useState<"Hoyts" | "CMK">("Hoyts");
  const [numSolicitud, setNumSolicitud] = useState("");
  const [numOC, setNumOC] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [formaPago, setFormaPago] = useState("Transferencia");
  const [liberada, setLiberada] = useState(false);

  // Notification Toast State for Clipboard Copy
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Firestore real-time data
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, "ordenes_compra"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs: OrdenCompra[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<OrdenCompra, "id">),
          }));
          setOrdenes(docs);
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore snapshot listener error:", error);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn("Firestore collection error:", err);
      setLoading(false);
    }
  }, []);

  // Handle Add Order
  const handleCreateOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const newOrden: Omit<OrdenCompra, "id"> = {
      empresa,
      numSolicitud: numSolicitud.trim(),
      numOC: numOC.trim(),
      razonSocial: razonSocial.trim(),
      monto: Number(monto) || monto,
      motivo: motivo.trim(),
      formaPago: formaPago.trim(),
      liberada,
      createdAt: serverTimestamp(),
    };

    const db = getFirebaseDb();
    if (db) {
      try {
        await addDoc(collection(db, "ordenes_compra"), newOrden);
        showToast("¡Orden de compra agregada exitosamente!");
      } catch (err) {
        console.error("Error al agregar orden:", err);
        // Fallback local addition if db error
        setOrdenes((prev) => [{ id: Date.now().toString(), ...newOrden }, ...prev]);
        showToast("Agregada localmente");
      }
    } else {
      setOrdenes((prev) => [{ id: Date.now().toString(), ...newOrden }, ...prev]);
      showToast("Agregada en memoria local");
    }

    // Reset Form
    resetForm();
    setIsModalOpen(false);
    setSubmitting(false);
  };

  const resetForm = () => {
    setEmpresa("Hoyts");
    setNumSolicitud("");
    setNumOC("");
    setRazonSocial("");
    setMonto("");
    setMotivo("");
    setFormaPago("Transferencia");
    setLiberada(false);
  };

  // Toggle Liberada Status
  const handleToggleLiberada = async (orden: OrdenCompra) => {
    const newLiberada = !orden.liberada;

    // Optimistic UI update
    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, liberada: newLiberada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { liberada: newLiberada });
      } catch (err) {
        console.error("Error al actualizar estado liberada:", err);
      }
    }
  };

  // Delete Order
  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm("¿Estás seguro de eliminar esta orden de compra?")) return;

    setOrdenes((prev) => prev.filter((item) => item.id !== id));
    const db = getFirebaseDb();
    if (db) {
      try {
        await deleteDoc(doc(db, "ordenes_compra", id));
        showToast("Orden eliminada");
      } catch (err) {
        console.error("Error al eliminar orden:", err);
      }
    }
  };

  // Copy Order Format to Clipboard
  const handleCopy = (orden: OrdenCompra) => {
    const formattedMonto = typeof orden.monto === "number"
      ? `$ ${orden.monto.toLocaleString("es-AR")}`
      : orden.monto;

    const copyText = `OC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: ${formattedMonto}
Detalle: ${orden.motivo}
Forma de Pago: ${orden.formaPago}`;

    navigator.clipboard.writeText(copyText);
    showToast(`¡Copiado OC ${orden.numOC} ${orden.empresa}!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered list
  const filteredOrdenes = ordenes.filter((orden) => {
    const matchesSearch =
      orden.numOC.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orden.numSolicitud.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orden.razonSocial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orden.motivo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEmpresa =
      filterEmpresa === "Todas" || orden.empresa === filterEmpresa;

    const matchesEstado =
      filterEstado === "Todas" ||
      (filterEstado === "Liberadas" && orden.liberada) ||
      (filterEstado === "Pendientes" && !orden.liberada);

    return matchesSearch && matchesEmpresa && matchesEstado;
  });

  return (
    <AppLayout 
      title="Órdenes de Compra" 
      subtitle="Gestión, filtrado y copia rápida de solicitudes de compra"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-500 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Top Header Controls: Add Button & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              Solicitudes de Órdenes
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Total: {ordenes.length} órdenes ({ordenes.filter(o => o.liberada).length} liberadas)
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Solicitud de OC</span>
          </button>
        </div>

        {/* Buscador & Filters Bar */}
        <div className="glass-card border border-white/10 p-4 rounded-2xl space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Buscador Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por N° OC, N° Solicitud, Proveedor o Motivo..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills for Empresa */}
            <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs">
              <span className="text-gray-400 text-[11px] px-2 font-medium">Empresa:</span>
              {(["Todas", "Hoyts", "CMK"] as const).map((emp) => (
                <button
                  key={emp}
                  onClick={() => setFilterEmpresa(emp)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filterEmpresa === emp
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {emp}
                </button>
              ))}
            </div>

            {/* Filter Pills for Estado Liberada */}
            <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs">
              <span className="text-gray-400 text-[11px] px-2 font-medium">Estado:</span>
              {(["Todas", "Liberadas", "Pendientes"] as const).map((est) => (
                <button
                  key={est}
                  onClick={() => setFilterEstado(est)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filterEstado === est
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table / List View */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs">Cargando órdenes de compra de Firestore...</p>
          </div>
        ) : filteredOrdenes.length === 0 ? (
          <div className="py-16 text-center rounded-3xl glass-card border border-white/10 p-8 space-y-3">
            <AlertCircle className="w-10 h-10 text-gray-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No se encontraron órdenes</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {searchQuery || filterEmpresa !== "Todas" || filterEstado !== "Todas"
                ? "Intenta modificar los filtros o la búsqueda."
                : "Aún no hay órdenes de compra registradas. ¡Agrega la primera!"}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Liberada</th>
                    <th className="px-5 py-3.5">Empresa</th>
                    <th className="px-5 py-3.5">N° Solicitud</th>
                    <th className="px-5 py-3.5">N° OC & Copiar</th>
                    <th className="px-5 py-3.5">Proveedor</th>
                    <th className="px-5 py-3.5">Monto</th>
                    <th className="px-5 py-3.5">Forma Pago</th>
                    <th className="px-5 py-3.5">Detalle / Motivo</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {filteredOrdenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Tilde / Liberada Checkbox Toggle */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleLiberada(orden)}
                          className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                            orden.liberada
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-white/5 text-gray-500 border-white/10 hover:border-gray-400"
                          }`}
                          title={orden.liberada ? "Liberada (Click para desmarcar)" : "Marcar como Liberada"}
                        >
                          <Check className={`w-4 h-4 ${orden.liberada ? "stroke-[3]" : "opacity-40"}`} />
                        </button>
                      </td>

                      {/* Empresa Pill */}
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            orden.empresa === "Hoyts"
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                              : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                          }`}
                        >
                          {orden.empresa}
                        </span>
                      </td>

                      {/* N° Solicitud */}
                      <td className="px-5 py-4 font-mono text-gray-300">
                        {orden.numSolicitud || "-"}
                      </td>

                      {/* N° OC + Copy Button */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                          <span className="font-mono font-bold text-emerald-400">
                            {orden.numOC}
                          </span>
                          <button
                            onClick={() => handleCopy(orden)}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-colors"
                            title="Copiar resumen de OC"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Proveedor */}
                      <td className="px-5 py-4 font-medium text-white max-w-xs truncate">
                        {orden.razonSocial}
                      </td>

                      {/* Monto */}
                      <td className="px-5 py-4 font-semibold text-emerald-300">
                        {typeof orden.monto === "number"
                          ? `$ ${orden.monto.toLocaleString("es-AR")}`
                          : orden.monto}
                      </td>

                      {/* Forma Pago */}
                      <td className="px-5 py-4 text-gray-300">
                        {orden.formaPago}
                      </td>

                      {/* Detalle / Motivo */}
                      <td className="px-5 py-4 text-gray-400 max-w-xs truncate" title={orden.motivo}>
                        {orden.motivo}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(orden.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                          title="Eliminar orden"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="lg:hidden divide-y divide-white/10">
              {filteredOrdenes.map((orden) => (
                <div key={orden.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleLiberada(orden)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          orden.liberada
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-white/5 text-gray-500 border-white/10"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          orden.empresa === "Hoyts"
                            ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                            : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                        }`}
                      >
                        {orden.empresa}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(orden)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </button>
                      <button
                        onClick={() => handleDelete(orden.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-400 font-bold text-sm">
                        OC: {orden.numOC}
                      </span>
                      <span className="font-mono text-gray-400 text-[11px]">
                        Sol: {orden.numSolicitud || "-"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Proveedor: {orden.razonSocial}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                    <div>
                      <span className="text-gray-400 text-[11px] block">Monto</span>
                      <span className="font-semibold text-emerald-300">
                        {typeof orden.monto === "number"
                          ? `$ ${orden.monto.toLocaleString("es-AR")}`
                          : orden.monto}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Forma de Pago</span>
                      <span className="text-gray-200">{orden.formaPago}</span>
                    </div>
                  </div>

                  <div className="text-xs bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="text-gray-400 text-[11px] block">Detalle / Motivo</span>
                    <span className="text-gray-300">{orden.motivo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal / Form para Agregar Solicitud de OC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-card border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Agregar Solicitud de OC
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl bg-white/5 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrden} className="space-y-4 text-xs">
              {/* Selección de Empresa: Hoyts vs CMK */}
              <div>
                <label className="block text-gray-300 font-medium mb-1.5">Empresa</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEmpresa("Hoyts")}
                    className={`py-2.5 rounded-xl border font-semibold transition-all ${
                      empresa === "Hoyts"
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md"
                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    Hoyts
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmpresa("CMK")}
                    className={`py-2.5 rounded-xl border font-semibold transition-all ${
                      empresa === "CMK"
                        ? "bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-md"
                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    CMK
                  </button>
                </div>
              </div>

              {/* N° Solicitud & N° OC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">
                    N° Solicitud de Orden
                  </label>
                  <input
                    type="text"
                    required
                    value={numSolicitud}
                    onChange={(e) => setNumSolicitud(e.target.value)}
                    placeholder="ej: SOL-1002"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-1">
                    N° Orden de Compra (OC)
                  </label>
                  <input
                    type="text"
                    required
                    value={numOC}
                    onChange={(e) => setNumOC(e.target.value)}
                    placeholder="ej: 45892"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Razón Social / Proveedor */}
              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Razón Social / Proveedor
                </label>
                <input
                  type="text"
                  required
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="ej: Suministros Industriales S.A."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Monto & Forma de Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">
                    Monto ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="ej: 150000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-medium mb-1">
                    Forma de Pago
                  </label>
                  <input
                    type="text"
                    required
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value)}
                    placeholder="ej: Transferencia, Cheque..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Detalle / Motivo */}
              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Detalle / Motivo
                </label>
                <textarea
                  required
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="ej: Adquisición de insumos de papelería y cartuchos"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Checkbox Liberada */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="liberadaCheckbox"
                  checked={liberada}
                  onChange={(e) => setLiberada(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/40"
                />
                <label htmlFor="liberadaCheckbox" className="text-gray-300 font-medium cursor-pointer">
                  Marcar como Liberada
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Guardar Orden</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
