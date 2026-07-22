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
  serverTimestamp,
  query,
  orderBy,
  limit,
  where,
  QueryConstraint,
  getDocs
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
  ChevronDown,
  Link2
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
  relatedOC?: string;
}

export default function OrdenesDeComprasPage() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"todos" | "numSolicitud" | "numOC" | "razonSocial">("todos");
  const [filterEmpresa, setFilterEmpresa] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [filterEstado, setFilterEstado] = useState<"Todas" | "Liberadas" | "Mandadas" | "Entregadas" | "Pendientes">("Todas");
  
  // Pagination State: Limit initial query reads to 15
  const [queryLimit, setQueryLimit] = useState(15);

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
  const [relatedOC, setRelatedOC] = useState("");

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

  const isSearching = searchQuery.trim() !== "";

  // Load Firestore real-time data with query limits and status filters
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    let unsubscribe: () => void = () => {};

    const startListener = (useFilters: boolean) => {
      try {
        const colRef = collection(db, "ordenes_compra");
        let q;

        if (isSearching) {
          q = query(colRef, orderBy("createdAt", "desc"), limit(300));
        } else if (useFilters) {
          // Dynamic status filtering in Firestore to only read matching documents
          const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
          
          if (filterEstado === "Liberadas") {
            constraints.unshift(where("liberada", "==", true));
          } else if (filterEstado === "Mandadas") {
            constraints.unshift(where("mandada", "==", true));
          } else if (filterEstado === "Entregadas") {
            constraints.unshift(where("entregada", "==", true));
          } else if (filterEstado === "Pendientes") {
            // Pendientes are !liberada && !mandada, query by liberada === false
            constraints.unshift(where("liberada", "==", false));
          }

          constraints.push(limit(queryLimit + 1));
          q = query(colRef, ...constraints);
        } else {
          // Fallback query (or when state is 'Todas')
          q = query(colRef, orderBy("createdAt", "desc"), limit(queryLimit + 100));
        }

        unsubscribe = onSnapshot(
          q,
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
                relatedOC: data.relatedOC || "",
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
          (error: any) => {
            // Check if error is due to missing index
            if (useFilters && error.message && error.message.includes("index")) {
              console.warn("Firestore index missing. Falling back to client-side filtering query...", error);
              // Retry without Firestore status filters (fall back to client-side filtering)
              startListener(false);
            } else {
              console.warn("Firestore snapshot listener error:", error);
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.warn("Firestore collection error:", err);
        setLoading(false);
      }
    };

    startListener(true);
    return () => unsubscribe();
  }, [queryLimit, isSearching, filterEstado]);

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
    setRelatedOC(orden.relatedOC || "");
    setIsModalOpen(true);
  };

  // Sync Bidirectional relationships for OCs in Firestore (Full Clique/Transitive Sync)
  const syncBidirectional = async (
    currentOC: string,
    oldOC: string,
    newRelatedStr: string,
    oldRelatedStr: string
  ) => {
    const db = getFirebaseDb();
    if (!db) return;

    const newOcs = newRelatedStr.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean);
    const oldOcs = oldRelatedStr.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean);

    const hasNameChanged = oldOC && oldOC !== currentOC;

    const colRef = collection(db, "ordenes_compra");

    // Helper to get search values for any format (string/number/leading zeros)
    const getSearchValues = (val: string) => {
      const searchValues: (string | number)[] = [val];
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        searchValues.push(numVal);
        searchValues.push(numVal.toString());
      }
      return Array.from(new Set(searchValues));
    };

    // Calculate cliques
    const newClique = Array.from(new Set([currentOC, ...newOcs]));
    const oldClique = oldOC ? Array.from(new Set([oldOC, ...oldOcs])) : [];

    // OCs that were removed from the relationship
    const removedOcs = oldClique.filter(x => !newClique.includes(x));

    // 1. Sync all active members of the new clique so they all list each other
    for (const member of newClique) {
      try {
        const uniqueSearchValues = getSearchValues(member);
        const q = query(colRef, where("numOC", "in", uniqueSearchValues));
        const querySnapshot = await getDocs(q);

        const linksToAdd = newClique.filter(x => x !== member);

        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          let relList = (data.relatedOC || "").split(/[\s,/\-]+/).map((s: string) => s.trim()).filter(Boolean);

          // Clean old reference if name changed
          if (hasNameChanged && oldOC) {
            relList = relList.filter((x: string) => x !== oldOC && Number(x) !== Number(oldOC));
          }

          // Clean any removed member references
          for (const rem of removedOcs) {
            relList = relList.filter((x: string) => x !== rem && Number(x) !== Number(rem));
          }

          // Add links from new clique
          for (const link of linksToAdd) {
            const hasLink = relList.some((x: string) => x === link || Number(x) === Number(link));
            if (!hasLink) {
              relList.push(link);
            }
          }

          await updateDoc(doc(db, "ordenes_compra", docSnap.id), {
            relatedOC: relList.join(", ")
          });
        }
      } catch (err) {
        console.error("Error syncing clique member:", err);
      }
    }

    // 2. Remove references from the removed OCs
    for (const rem of removedOcs) {
      try {
        const uniqueSearchValues = getSearchValues(rem);
        const q = query(colRef, where("numOC", "in", uniqueSearchValues));
        const querySnapshot = await getDocs(q);

        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          let relList = (data.relatedOC || "").split(/[\s,/\-]+/).map((s: string) => s.trim()).filter(Boolean);

          // Remove all members of the new clique from the removed OC
          for (const member of newClique) {
            relList = relList.filter((x: string) => x !== member && Number(x) !== Number(member));
          }

          // Also remove oldOC if name changed
          if (oldOC) {
            relList = relList.filter((x: string) => x !== oldOC && Number(x) !== Number(oldOC));
          }

          await updateDoc(doc(db, "ordenes_compra", docSnap.id), {
            relatedOC: relList.join(", ")
          });
        }
      } catch (err) {
        console.error("Error cleaning removed clique member:", err);
      }
    }
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
      relatedOC: relatedOC.trim(),
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
          // Sync bidirectional relationships in Firestore
          syncBidirectional(numOC.trim(), editingOrden.numOC.trim(), relatedOC.trim(), editingOrden.relatedOC || "");
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
          // Sync bidirectional relationships in Firestore
          syncBidirectional(numOC.trim(), numOC.trim(), relatedOC.trim(), "");
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
    setRelatedOC("");
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
    const msg = orden.liberada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO liberada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como LIBERADA?`;
    if (!confirm(msg)) return;

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
    const msg = orden.mandada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO mandada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como MANDADA?`;
    if (!confirm(msg)) return;

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
    const msg = orden.entregada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO entregada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como ENTREGADA?`;
    if (!confirm(msg)) return;

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
    let copyText = "";
    if (filterEstado === "Liberadas") {
      copyText = `OC 0${orden.numOC} - ${orden.razonSocial}`;
    } else {
      const formattedMonto = typeof orden.monto === "number"
        ? `$ ${orden.monto.toLocaleString("es-AR")}`
        : orden.monto;

      const notasPart = orden.notas && orden.notas.length > 0
        ? "\nNotas:\n" + orden.notas.map(n => `- ${n.texto}`).join("\n")
        : "";

      copyText = `OC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: ${formattedMonto}
Detalle: ${orden.motivo}
Forma de Pago: ${orden.formaPago}${notasPart}`;
    }

    navigator.clipboard.writeText(copyText);
    showToast(`¡Copiado OC ${orden.numOC}!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered list
  const filteredOrdenes = ordenes.filter((orden) => {
    const matchesSearch = (() => {
      if (!searchQuery.trim()) return true;
      const queryText = searchQuery.toLowerCase();
      switch (searchField) {
        case "numSolicitud":
          return orden.numSolicitud.toLowerCase().includes(queryText);
        case "numOC":
          return (
            orden.numOC.toLowerCase().includes(queryText) ||
            (orden.relatedOC && orden.relatedOC.toLowerCase().includes(queryText))
          );
        case "razonSocial":
          return orden.razonSocial.toLowerCase().includes(queryText);
        case "todos":
        default:
          return (
            orden.numOC.toLowerCase().includes(queryText) ||
            (orden.relatedOC && orden.relatedOC.toLowerCase().includes(queryText)) ||
            orden.numSolicitud.toLowerCase().includes(queryText) ||
            orden.razonSocial.toLowerCase().includes(queryText) ||
            orden.motivo.toLowerCase().includes(queryText) ||
            (orden.creadoPor && orden.creadoPor.toLowerCase().includes(queryText))
          );
      }
    })();

    const matchesEmpresa =
      filterEmpresa === "Todas" || orden.empresa === filterEmpresa;

    const matchesEstado =
      filterEstado === "Todas" ||
      (filterEstado === "Liberadas" && orden.liberada && !orden.entregada) ||
      (filterEstado === "Mandadas" && orden.mandada && !orden.liberada) ||
      (filterEstado === "Entregadas" && orden.entregada) ||
      (filterEstado === "Pendientes" && !orden.liberada && !orden.mandada);

    return matchesSearch && matchesEmpresa && matchesEstado;
  });

  // Limit visible items to queryLimit (slicing off the extra placeholder item we fetched to check hasMore)
  // Bypass slice when actively searching so they can see all matched items up to 300 documents
  const visibleOrdenes = isSearching ? filteredOrdenes : filteredOrdenes.slice(0, queryLimit);
  const hasMore = isSearching ? false : ordenes.length > queryLimit;

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
            {/* Buscador Search Input Group */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:max-w-xl">
              {/* Dropdown de campo */}
              <div className="relative flex-shrink-0">
                <select
                  value={searchField}
                  onChange={(e) => {
                    setSearchField(e.target.value as any);
                    setQueryLimit(15);
                  }}
                  className="w-full sm:w-auto pl-3 pr-8 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 cursor-pointer appearance-none"
                >
                  <option value="todos" className="bg-[#0d131f] text-white">Todos los campos</option>
                  <option value="numOC" className="bg-[#0d131f] text-white">N° OC</option>
                  <option value="numSolicitud" className="bg-[#0d131f] text-white">N° Solicitud</option>
                  <option value="razonSocial" className="bg-[#0d131f] text-white">Proveedor</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Input de búsqueda */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setQueryLimit(15);
                  }}
                  placeholder="Buscar..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setQueryLimit(15);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills for Empresa */}
            <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 text-xs flex-wrap">
              <span className="text-gray-400 text-[11px] px-2 font-medium">Empresa:</span>
              {(["Todas", "Hoyts", "CMK"] as const).map((emp) => (
                <button
                  key={emp}
                  onClick={() => {
                    setFilterEmpresa(emp);
                    setQueryLimit(15);
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
              {(["Todas", "Pendientes", "Mandadas", "Liberadas", "Entregadas"] as const).map((est) => (
                <button
                  key={est}
                  onClick={() => {
                    setFilterEstado(est);
                    setQueryLimit(15);
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

          {/* Leyenda de Estados */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 text-[11px] text-gray-400 border-t border-white/5">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mr-1">Guía de Estados:</span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-xl border border-emerald-500/20 font-medium">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>🟢 Liberada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-500/20 font-medium">
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>🟢 Mandada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-xl border border-indigo-500/20 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>🔵 Entregada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-purple-500/15 text-purple-300 px-2.5 py-1 rounded-xl border border-purple-500/30 font-medium">
              <Link2 className="w-3.5 h-3.5" />
              <span>Ref: Solicitadas por la misma persona</span>
            </span>
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

                              {/* Tilde Entregada (Visible en filtro de Todas, Liberadas o Entregadas) */}
                              {(filterEstado === "Todas" || filterEstado === "Liberadas" || filterEstado === "Entregadas") && (
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
                          <div className="flex flex-col items-start gap-1">
                            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                              <span className="font-mono font-bold text-emerald-400">
                                {orden.numOC}
                              </span>
                              <button
                                onClick={() => handleCopy(orden)}
                                className={`p-1 rounded transition-colors ${
                                  filterEstado === "Liberadas"
                                    ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white"
                                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white"
                                }`}
                                title="Copiar resumen de OC"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {orden.relatedOC && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 max-w-[200px]">
                                {orden.relatedOC.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean).map((ocNum, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setSearchQuery(ocNum)}
                                    className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 transition-all"
                                    title={`Click para buscar la OC ${ocNum}`}
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                    <span>Ref: OC {ocNum}</span>
                                  </button>
                                ))}
                              </div>
                            )}
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
              <div className="lg:hidden space-y-4">
                {visibleOrdenes.map((orden) => {
                  const isPendingSend = orden.liberada && !orden.mandada;
                  const cardClass = isPendingSend
                    ? "p-4 space-y-3 bg-red-500/5 border-l-4 border-l-red-500 border border-white/10 rounded-2xl glass-card transition-all duration-200 shadow-md"
                    : "p-4 space-y-3 border border-white/10 rounded-2xl glass-card transition-all duration-200 shadow-md";
                  return (
                    <div key={orden.id} className={cardClass}>
                      {/* Top Row: Empresa, OC number and Actions (Copiar/Editar) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              orden.empresa === "Hoyts"
                                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                            }`}
                          >
                            {orden.empresa}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold text-xs">
                            #{orden.numOC}
                          </span>
                          {orden.relatedOC && (
                            <div className="flex flex-wrap items-center gap-1 ml-1.5">
                              {orden.relatedOC.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean).map((ocNum, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSearchQuery(ocNum)}
                                  className="flex items-center gap-1 text-[8px] text-purple-300 font-bold bg-purple-500/15 px-1 rounded border border-purple-500/20 active:bg-purple-500/30 transition-all"
                                  title={`Click para buscar la OC ${ocNum}`}
                                >
                                  <Link2 className="w-2 h-2" />
                                  <span>Ref: {ocNum}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions (Copiar & Editar) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(orden)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-colors ${
                              filterEstado === "Liberadas"
                                ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                                : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                            }`}
                            title="Copiar resumen"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(orden)}
                            className="px-2 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/10 text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3 h-3 text-emerald-400" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>

                      {/* Middle Details (Proveedor, Monto, Forma Pago) */}
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-semibold text-white truncate">
                          <span className="text-gray-400 font-normal">Proveedor: </span>
                          {orden.razonSocial}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-white/5">
                          <div>
                            <span className="text-gray-400 block text-[10px]">Monto</span>
                            <span className="font-bold text-emerald-300 text-xs">
                              {typeof orden.monto === "number"
                                ? `$ ${orden.monto.toLocaleString("es-AR")}`
                                : orden.monto}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px]">Forma de Pago</span>
                            <span className="text-gray-200 font-medium">{orden.formaPago || "30DFF"}</span>
                          </div>
                        </div>

                        {orden.motivo && (
                          <div className="pt-1 text-[11px] text-gray-400 truncate">
                            <span className="text-gray-500">Detalle: </span>
                            {orden.motivo}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-500 flex items-center gap-1 pt-1">
                          <UserIcon className="w-3 h-3 text-emerald-400" />
                          <span>Creado por: {orden.creadoPor || "Usuario"}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Status Checkboxes & Notes Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                        {/* Status Checkbox Toggles */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleToggleLiberada(orden)}
                            className={`px-2 py-1 rounded-lg border text-[9px] font-bold flex items-center gap-1 transition-all ${
                              orden.liberada
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "bg-white/5 text-gray-500 border-white/10"
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Lib</span>
                          </button>

                          <button
                            onClick={() => handleToggleMandada(orden)}
                            className={`px-2 py-1 rounded-lg border text-[9px] font-bold flex items-center gap-1 transition-all ${
                              orden.mandada
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                                : isPendingSend
                                  ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30 animate-pulse"
                                  : "bg-white/5 text-gray-500 border-white/10"
                            }`}
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span>Mand</span>
                          </button>

                          {(filterEstado === "Todas" || filterEstado === "Liberadas" || filterEstado === "Entregadas") && (
                            <button
                              onClick={() => handleToggleEntregada(orden)}
                              className={`px-2 py-1 rounded-lg border text-[9px] font-bold flex items-center gap-1 transition-all ${
                                orden.entregada
                                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/30"
                                  : "bg-white/5 text-gray-500 border-white/10"
                              }`}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Entreg</span>
                            </button>
                          )}
                        </div>

                        {/* Internal Notes Button */}
                        <button
                          onClick={() => setActiveNotesOrden(orden)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3 text-emerald-400" />
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
                  onClick={() => setQueryLimit((prev) => prev + 15)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition-all shadow-lg inline-flex items-center gap-2 group"
                >
                  <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                  <span>Cargar más órdenes</span>
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

              {/* OC Relacionada (Opcional) */}
              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  OC Relacionada (Opcional - Para mandar juntas)
                </label>
                <input
                  type="text"
                  value={relatedOC}
                  onChange={(e) => setRelatedOC(e.target.value)}
                  placeholder="ej: 04859 (N° de OC vinculada)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
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
