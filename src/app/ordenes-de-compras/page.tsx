"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Plus, 
  Search, 
  Copy, 
  CheckCircle2, 
  X, 
  ShoppingBag, 
  Trash2, 
  Edit3, 
  Loader2,
  AlertCircle,
  Check,
  Send,
  MessageSquare,
  User as UserIcon,
  Clock,
  SendHorizontal,
  ChevronDown
} from "lucide-react";

export interface Nota {
  id: string;
  texto: string;
  autor: string;
  fecha: string;
}

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
  mandada: boolean;
  entregada?: boolean;
  creadoPor?: string;
  notas?: Nota[];
  createdAt?: any;
}

export default function OrdenesDeComprasPage() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [filterEstado, setFilterEstado] = useState<"Todas" | "Liberadas" | "Mandadas" | "Pendientes">("Todas");
  
  // Pagination State: Limit initial view to 10
  const [displayLimit, setDisplayLimit] = useState(10);

  // Modal state for Add/Edit Order
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrden, setEditingOrden] = useState<OrdenCompra | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal state for Notes
  const [activeNotesOrden, setActiveNotesOrden] = useState<OrdenCompra | null>(null);
  const [newNotaText, setNewNotaText] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  // Form State
  const [empresa, setEmpresa] = useState<"Hoyts" | "CMK">("Hoyts");
  const [numSolicitud, setNumSolicitud] = useState("");
  const [numOC, setNumOC] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [formaPago, setFormaPago] = useState("30DFF");
  const [liberada, setLiberada] = useState(false);
  const [mandada, setMandada] = useState(false);

  // Notification Toast State for Clipboard Copy & Actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Get current clean username without @equipo.local
  const getCleanUsername = () => {
    if (!user) return "Usuario";
    if (user.displayName) return user.displayName;
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "Usuario";
  };

  // Load Firestore real-time data
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const colRef = collection(db, "ordenes_compra");
      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const docs: OrdenCompra[] = snapshot.docs.map((docSnap) => {
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
              creadoPor: data.creadoPor || "Usuario",
              notas: data.notas || [],
              createdAt: data.createdAt || null,
            };
          });

          // Sort manually on client to handle missing createdAt fields cleanly
          docs.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });

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

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingOrden(null);
    resetForm();
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (orden: OrdenCompra) => {
    setEditingOrden(orden);
    setEmpresa(orden.empresa || "Hoyts");
    setNumSolicitud(orden.numSolicitud || "");
    setNumOC(orden.numOC || "");
    setRazonSocial(orden.razonSocial || "");
    setMonto(orden.monto?.toString() || "");
    setMotivo(orden.motivo || "");
    setFormaPago(orden.formaPago || "30DFF");
    setLiberada(Boolean(orden.liberada));
    setMandada(Boolean(orden.mandada));
    setIsModalOpen(true);
  };

  // Handle Save (Add or Edit)
  const handleSaveOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const authorName = getCleanUsername();

    const dataToSave = {
      empresa,
      numSolicitud: numSolicitud.trim(),
      numOC: numOC.trim(),
      razonSocial: razonSocial.trim(),
      monto: Number(monto) || monto,
      motivo: motivo.trim(),
      formaPago: formaPago.trim() || "30DFF",
      liberada,
      mandada,
      entregada: editingOrden ? Boolean(editingOrden.entregada) : false,
      creadoPor: editingOrden?.creadoPor || authorName,
    };

    const db = getFirebaseDb();

    if (editingOrden && editingOrden.id) {
      // Update existing order
      setOrdenes((prev) =>
        prev.map((item) => (item.id === editingOrden.id ? { ...item, ...dataToSave } : item))
      );

      if (db) {
        try {
          const docRef = doc(db, "ordenes_compra", editingOrden.id);
          await updateDoc(docRef, dataToSave);
          showToast("¡Orden de compra actualizada!");
        } catch (err) {
          console.error("Error al actualizar orden:", err);
        }
      }
    } else {
      // Add new order
      const newOrden: Omit<OrdenCompra, "id"> = {
        ...dataToSave,
        notas: [],
        createdAt: serverTimestamp(),
      };

      if (db) {
        try {
          await addDoc(collection(db, "ordenes_compra"), newOrden);
          showToast("¡Orden de compra agregada!");
        } catch (err) {
          console.error("Error al agregar orden:", err);
          setOrdenes((prev) => [{ id: Date.now().toString(), ...newOrden }, ...prev]);
        }
      } else {
        setOrdenes((prev) => [{ id: Date.now().toString(), ...newOrden }, ...prev]);
      }
    }

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
    setFormaPago("30DFF");
    setLiberada(false);
    setMandada(false);
  };

  // Add Note to Order
  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotaText.trim() || !activeNotesOrden || !activeNotesOrden.id) return;

    setSavingNota(true);

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}`;

    const nuevaNota: Nota = {
      id: Date.now().toString(),
      texto: newNotaText.trim(),
      autor: getCleanUsername(),
      fecha: formattedDate,
    };

    const updatedNotas = [...(activeNotesOrden.notas || []), nuevaNota];

    // Optimistic UI update
    setOrdenes((prev) =>
      prev.map((item) => (item.id === activeNotesOrden.id ? { ...item, notas: updatedNotas } : item))
    );
    setActiveNotesOrden((prev) => (prev ? { ...prev, notas: updatedNotas } : null));

    const db = getFirebaseDb();
    if (db && activeNotesOrden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", activeNotesOrden.id);
        await updateDoc(docRef, { notas: updatedNotas });
        showToast("Nota agregada");
      } catch (err) {
        console.error("Error al agregar nota:", err);
      }
    }

    setNewNotaText("");
    setSavingNota(false);
  };

  // Toggle Liberada Status
  const handleToggleLiberada = async (orden: OrdenCompra) => {
    const newLiberada = !orden.liberada;
    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, liberada: newLiberada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { liberada: newLiberada });
      } catch (err) {
        console.error("Error al actualizar liberada:", err);
      }
    }
  };

  // Toggle Mandada Status
  const handleToggleMandada = async (orden: OrdenCompra) => {
    const newMandada = !orden.mandada;
    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, mandada: newMandada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { mandada: newMandada });
      } catch (err) {
        console.error("Error al actualizar mandada:", err);
      }
    }
  };

  // Toggle Entregada Status
  const handleToggleEntregada = async (orden: OrdenCompra) => {
    const newEntregada = !orden.entregada;
    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, entregada: newEntregada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { entregada: newEntregada });
      } catch (err) {
        console.error("Error al actualizar entregada:", err);
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

    const notasPart = orden.notas && orden.notas.length > 0
      ? "\nNotas:\n" + orden.notas.map(n => `- ${n.texto}`).join("\n")
      : "";

    const copyText = `OC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: ${formattedMonto}
Detalle: ${orden.motivo}
Forma de Pago: ${orden.formaPago}${notasPart}`;

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
      orden.motivo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (orden.creadoPor && orden.creadoPor.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesEmpresa =
      filterEmpresa === "Todas" || orden.empresa === filterEmpresa;

    const matchesEstado =
      filterEstado === "Todas" ||
      (filterEstado === "Liberadas" && orden.liberada) ||
      (filterEstado === "Mandadas" && orden.mandada) ||
      (filterEstado === "Pendientes" && !orden.liberada && !orden.mandada);

    return matchesSearch && matchesEmpresa && matchesEstado;
  });

  // Limit visible items to displayLimit
  const visibleOrdenes = filteredOrdenes.slice(0, displayLimit);
  const hasMore = filteredOrdenes.length > displayLimit;

  return (
    <AppLayout 
      title="Órdenes de Compra" 
      subtitle="Gestión, edición, notas internas y copia rápida de solicitudes"
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
              Mostrando {visibleOrdenes.length} de {filteredOrdenes.length} órdenes ({ordenes.filter(o => o.liberada).length} liberadas, {ordenes.filter(o => o.mandada).length} mandadas)
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Solicitud de OC</span>
          </button>
        </div>

        {/* Buscador & Filters Bar */}
        <div className="glass-card border border-white/10 p-4 rounded-2xl space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Buscador Search Input (achicado) */}
            <div className="relative w-full lg:max-w-xs">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDisplayLimit(10); // Reset limit when searching
                }}
                placeholder="Buscar..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDisplayLimit(10);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills for Empresa */}
            <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs flex-wrap">
              <span className="text-gray-400 text-[11px] px-2 font-medium">Empresa:</span>
              {(["Todas", "Hoyts", "CMK"] as const).map((emp) => (
                <button
                  key={emp}
                  onClick={() => {
                    setFilterEmpresa(emp);
                    setDisplayLimit(10);
                  }}
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

            {/* Filter Pills for Estado */}
            <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs flex-wrap">
              <span className="text-gray-400 text-[11px] px-2 font-medium">Estado:</span>
              {(["Todas", "Liberadas", "Mandadas", "Pendientes"] as const).map((est) => (
                <button
                  key={est}
                  onClick={() => {
                    setFilterEstado(est);
                    setDisplayLimit(10);
                  }}
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
        ) : visibleOrdenes.length === 0 ? (
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
          <div className="space-y-4">
            <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3.5">Estados</th>
                      <th className="px-4 py-3.5">Empresa</th>
                      <th className="px-4 py-3.5">N° Solicitud</th>
                      <th className="px-4 py-3.5">N° OC & Copiar</th>
                      <th className="px-4 py-3.5">Creado Por</th>
                      <th className="px-4 py-3.5">Proveedor</th>
                      <th className="px-4 py-3.5">Monto</th>
                      <th className="px-4 py-3.5">Forma Pago</th>
                      <th className="px-4 py-3.5">Notas</th>
                      <th className="px-4 py-3.5 text-right">Editar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {visibleOrdenes.map((orden) => {
                      const isPendingSend = orden.liberada && !orden.mandada;
                      const rowClass = isPendingSend
                        ? "bg-red-500/5 hover:bg-red-500/10 border-l-2 border-l-red-500 transition-all duration-200"
                        : "hover:bg-white/[0.02] transition-all duration-200";
                      return (
                        <tr key={orden.id} className={rowClass}>
                          {/* Tildes: Liberada & Mandada */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              {/* Tilde Liberada */}
                              <button
                                onClick={() => handleToggleLiberada(orden)}
                                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                  orden.liberada
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                    : "bg-white/5 text-gray-500 border-white/10 hover:border-gray-400"
                                }`}
                                title={orden.liberada ? "Liberada (Click para desmarcar)" : "Marcar como Liberada"}
                              >
                                <Check className={`w-3.5 h-3.5 ${orden.liberada ? "stroke-[3]" : "opacity-40"}`} />
                              </button>

                              {/* Tilde Mandada */}
                              <button
                                onClick={() => handleToggleMandada(orden)}
                                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                  orden.mandada
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                                    : isPendingSend
                                      ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30 animate-pulse"
                                      : "bg-white/5 text-gray-500 border-white/10 hover:border-gray-400"
                                }`}
                                title={orden.mandada ? "Mandada (Click para desmarcar)" : "Marcar como Mandada"}
                              >
                                <Send className={`w-3.5 h-3.5 ${orden.mandada ? "stroke-[2.5]" : isPendingSend ? "stroke-[2.5]" : "opacity-40"}`} />
                              </button>

                              {/* Tilde Entregada (Solo visible en filtro de Liberadas) */}
                              {filterEstado === "Liberadas" && (
                                <button
                                  onClick={() => handleToggleEntregada(orden)}
                                  className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                    orden.entregada
                                      ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30"
                                      : "bg-white/5 text-gray-500 border-white/10 hover:border-gray-400"
                                  }`}
                                  title={orden.entregada ? "Entregada (Click para desmarcar)" : "Marcar como Entregada"}
                                >
                                  <CheckCircle2 className={`w-3.5 h-3.5 ${orden.entregada ? "stroke-[2]" : "opacity-40"}`} />
                                </button>
                              )}
                            </div>
                          </td>

                        {/* Empresa Pill */}
                        <td className="px-4 py-4">
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

                        {/* N° Solicitud (Opcional) */}
                        <td className="px-4 py-4 font-mono text-gray-300">
                          {orden.numSolicitud || "-"}
                        </td>

                        {/* N° OC + Copy Button */}
                        <td className="px-4 py-4">
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

                        {/* Creado Por */}
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-medium text-[11px]">
                            <UserIcon className="w-3 h-3 text-emerald-400" />
                            {orden.creadoPor || "Usuario"}
                          </span>
                        </td>

                        {/* Proveedor */}
                        <td className="px-4 py-4 font-medium text-white max-w-xs truncate">
                          {orden.razonSocial}
                        </td>

                        {/* Monto */}
                        <td className="px-4 py-4 font-semibold text-emerald-300">
                          {typeof orden.monto === "number"
                            ? `$ ${orden.monto.toLocaleString("es-AR")}`
                            : orden.monto}
                        </td>

                        {/* Forma Pago */}
                        <td className="px-4 py-4 text-gray-300 font-medium">
                          {orden.formaPago || "30DFF"}
                        </td>

                        {/* Botón Ver/Agregar Notas */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setActiveNotesOrden(orden)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                            <span>Notas ({orden.notas?.length || 0})</span>
                          </button>
                        </td>

                        {/* Action: Open Edit Form */}
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleOpenEditModal(orden)}
                            className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 font-semibold flex items-center justify-end gap-1.5 ml-auto transition-colors"
                            title="Editar orden (Incluye eliminar)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Editar</span>
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Cards View */}
              <div className="lg:hidden divide-y divide-white/10">
                {visibleOrdenes.map((orden) => {
                  const isPendingSend = orden.liberada && !orden.mandada;
                  const cardClass = isPendingSend
                    ? "p-4 space-y-3 bg-red-500/5 border-l-2 border-l-red-500 transition-all duration-200"
                    : "p-4 space-y-3 transition-all duration-200";
                  return (
                    <div key={orden.id} className={cardClass}>
                      <div className="flex items-center justify-between">
                        {/* Tildes */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleLiberada(orden)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 ${
                              orden.liberada
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "bg-white/5 text-gray-500 border-white/10"
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            Liberada
                          </button>

                          <button
                            onClick={() => handleToggleMandada(orden)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all ${
                              orden.mandada
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                                : isPendingSend
                                  ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30 animate-pulse"
                                  : "bg-white/5 text-gray-500 border-white/10"
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            Mandada
                          </button>

                          {/* Tilde Entregada (Solo visible en filtro de Liberadas) */}
                          {filterEstado === "Liberadas" && (
                            <button
                              onClick={() => handleToggleEntregada(orden)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all ${
                                orden.entregada
                                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30"
                                  : "bg-white/5 text-gray-500 border-white/10"
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Entregada
                            </button>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              orden.empresa === "Hoyts"
                                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                            }`}
                          >
                            {orden.empresa}
                          </span>
                        </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(orden)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(orden)}
                          className="px-2 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10 text-xs font-medium flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-emerald-400 font-bold text-sm">
                          OC: {orden.numOC}
                        </span>
                        <span className="text-gray-400 text-[11px] flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-emerald-400" />
                          {orden.creadoPor || "Usuario"}
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
                        <span className="text-gray-200 font-medium">{orden.formaPago || "30DFF"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <span className="text-gray-400 text-[11px] truncate max-w-[200px]">
                        {orden.motivo}
                      </span>
                      <button
                        onClick={() => setActiveNotesOrden(orden)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-[10px] font-semibold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Notas ({orden.notas?.length || 0})</span>
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Botón Cargar Más */}
            {hasMore && (
              <div className="py-4 text-center">
                <button
                  onClick={() => setDisplayLimit((prev) => prev + 10)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition-all shadow-lg inline-flex items-center gap-2 group"
                >
                  <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                  <span>Cargar más órdenes ({filteredOrdenes.length - visibleOrdenes.length} restantes)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para Ver y Agregar Notas de la Orden */}
      {activeNotesOrden && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-card border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  Notas de la OC {activeNotesOrden.numOC} ({activeNotesOrden.empresa})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Proveedor: {activeNotesOrden.razonSocial}
                </p>
              </div>
              <button
                onClick={() => setActiveNotesOrden(null)}
                className="p-1 rounded-xl bg-white/5 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de Notas Existentes */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {!activeNotesOrden.notas || activeNotesOrden.notas.length === 0 ? (
                <div className="p-6 text-center bg-white/5 rounded-2xl border border-white/5 text-gray-400 text-xs">
                  Aún no hay notas registradas para esta orden. ¡Agrega la primera abajo!
                </div>
              ) : (
                activeNotesOrden.notas.map((nota) => (
                  <div key={nota.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-gray-400 text-[11px]">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {nota.autor}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        {nota.fecha}
                      </span>
                    </div>
                    <p className="text-gray-200 leading-relaxed">{nota.texto}</p>
                  </div>
                ))
              )}
            </div>

            {/* Formulario para agregar una nueva Nota */}
            <form onSubmit={handleAddNota} className="pt-3 border-t border-white/10 space-y-3">
              <label className="block text-xs font-semibold text-gray-300">
                Agregar nueva nota
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={newNotaText}
                  onChange={(e) => setNewNotaText(e.target.value)}
                  placeholder="Escribe un comentario o nota sobre esta orden..."
                  className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  disabled={savingNota || !newNotaText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingNota ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <SendHorizontal className="w-4 h-4" />
                      <span className="hidden sm:inline">Enviar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Form para Agregar o Editar Solicitud de OC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-card border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {editingOrden ? (
                  <>
                    <Edit3 className="w-5 h-5 text-emerald-400" />
                    Editar Orden de Compra
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-emerald-400" />
                    Agregar Solicitud de OC
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl bg-white/5 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrden} className="space-y-4 text-xs">
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

              {/* N° Solicitud (Opcional) & N° OC (Obligatorio) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-medium mb-1">
                    N° Solicitud de Orden <span className="text-gray-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={numSolicitud}
                    onChange={(e) => setNumSolicitud(e.target.value)}
                    placeholder="ej: SOL-1002 (Opcional)"
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

              {/* Monto & Forma de Pago (Predeterminado 30DFF) */}
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
                    placeholder="ej: 30DFF"
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

              {/* Checkboxes: Liberada & Mandada */}
              <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="liberadaCheckbox"
                    checked={liberada}
                    onChange={(e) => setLiberada(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  <label htmlFor="liberadaCheckbox" className="text-gray-300 font-medium cursor-pointer">
                    Liberada
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mandadaCheckbox"
                    checked={mandada}
                    onChange={(e) => setMandada(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/40"
                  />
                  <label htmlFor="mandadaCheckbox" className="text-gray-300 font-medium cursor-pointer">
                    Mandada
                  </label>
                </div>
              </div>

              {/* Action Buttons: Delete (when editing) + Cancel + Save */}
              <div className="pt-4 flex items-center justify-between gap-3 border-t border-white/10">
                {editingOrden ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleDelete(editingOrden.id);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Orden</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
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
                        {editingOrden ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span>{editingOrden ? "Guardar Cambios" : "Guardar Orden"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
