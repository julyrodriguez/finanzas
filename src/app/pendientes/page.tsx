"use client";

import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  getDoc,
  Timestamp
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Circle,
  FileText,
  Clock,
  Sparkles,
  Search,
  AlertCircle,
  Check,
  StickyNote,
  X,
  ListTodo,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Flag
} from "lucide-react";

const generateUniqueId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

// Interfaces
interface Etapa {
  id: string;
  titulo: string;
  completado: boolean;
  esFinal?: boolean;
  completedAt?: string | null;
  createdAt?: string | null;
}

interface Pendiente {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  completado: boolean;
  creadoPor: string;
  createdAt: Timestamp | null;
  completedAt: Timestamp | null;
  notasAdicionales: string;
  etapas?: Etapa[];
  fechaLimite?: string | null;
}

export default function PendientesPage() {
  const db = getFirebaseDb();
  const { user } = useAuth();

  // State lists
  const [allItems, setAllItems] = useState<Pendiente[]>([]);
  const [completedLimit, setCompletedLimit] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // General Notepad (for when no project is selected)
  const [generalNotes, setGeneralNotes] = useState<string>("");
  const [savingGeneral, setSavingGeneral] = useState<boolean>(false);
  const [generalLastSaved, setGeneralLastSaved] = useState<Date | null>(null);

  // Selection & Editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorNotes, setEditorNotes] = useState<string>("");
  const [editorDescription, setEditorDescription] = useState<string>("");
  const [editorFechaLimite, setEditorFechaLimite] = useState<string>("");
  const [isEditorDirty, setIsEditorDirty] = useState<boolean>(false);
  const [savingEditor, setSavingEditor] = useState<boolean>(false);
  const [editorLastSaved, setEditorLastSaved] = useState<Date | null>(null);

  // Stepper / Etapas state
  const [insertingAtIndex, setInsertingAtIndex] = useState<number | null>(null);
  const [newStepTitle, setNewStepTitle] = useState<string>("");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<"todos" | "pendientes" | "completados">("pendientes");
  const [filterPrioridad, setFilterPrioridad] = useState<"todas" | "alta" | "media" | "baja">("todas");

  // New Item Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newPriority, setNewPriority] = useState<"alta" | "media" | "baja">("media");
  const [newFechaLimite, setNewFechaLimite] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Success Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  // Toast Helper
  const showToast = (text: string, type: "success" | "info" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getCleanUsername = () => {
    if (!user) return "Usuario";
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split("@")[0];
    return "Usuario";
  };

  const isSearching = searchTerm.trim() !== "";

  // Split and sort in memory to avoid Firestore composite index errors
  const pendingItems = useMemo(() => {
    return allItems.filter(item => !item.completado);
  }, [allItems]);

  const completedItemsAll = useMemo(() => {
    const list = allItems.filter(item => item.completado);
    const sorted = [...list];
    sorted.sort((a, b) => {
      const timeA = (a.completedAt && "seconds" in a.completedAt) ? a.completedAt.seconds : (a.createdAt?.seconds || 0);
      const timeB = (b.completedAt && "seconds" in b.completedAt) ? b.completedAt.seconds : (b.createdAt?.seconds || 0);
      return timeB - timeA;
    });
    return sorted;
  }, [allItems]);

  const completedItems = useMemo(() => {
    return completedItemsAll.slice(0, completedLimit);
  }, [completedItemsAll, completedLimit]);

  const hasMoreCompleted = useMemo(() => {
    return completedItemsAll.length > completedLimit;
  }, [completedItemsAll, completedLimit]);

  // Combine pending and completed items depending on filterEstado
  const pendientes = useMemo(() => {
    let list: Pendiente[] = [];
    if (filterEstado === "todos") {
      const activeCompleted = isSearching ? completedItemsAll : completedItems;
      list = [...pendingItems, ...activeCompleted];
    } else if (filterEstado === "pendientes") {
      list = pendingItems;
    } else {
      list = isSearching ? completedItemsAll : completedItems;
    }
    
    // Sort by priority: alta (0) > media (1) > baja (2). If same priority, sort by createdAt desc.
    const priorityOrder = { alta: 0, media: 1, baja: 2 };
    const sorted = [...list];
    sorted.sort((a, b) => {
      const ordA = priorityOrder[a.prioridad] ?? 1;
      const ordB = priorityOrder[b.prioridad] ?? 1;
      if (ordA !== ordB) {
        return ordA - ordB;
      }
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    
    return sorted;
  }, [pendingItems, completedItems, completedItemsAll, filterEstado, isSearching]);

  // 1. Fetch all items in real time
  useEffect(() => {
    if (!db) {
      setTimeout(() => {
        setError("No se pudo conectar a la base de datos de Firebase.");
        setLoading(false);
      }, 0);
      return;
    }

    const colRef = collection(db, "pendientes");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Pendiente[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            titulo: data.titulo || "",
            descripcion: data.descripcion || "",
            prioridad: data.prioridad || "media",
            completado: Boolean(data.completado),
            creadoPor: data.creadoPor || "Usuario",
            createdAt: data.createdAt || null,
            completedAt: data.completedAt || null,
            notasAdicionales: data.notasAdicionales || "",
            etapas: data.etapas || [],
            fechaLimite: data.fechaLimite || null
          };
        });

        setTimeout(() => {
          setAllItems(list);
          setLoading(false);
          setError(null);
        }, 0);
      },
      (err) => {
        console.error("Error loading pending items:", err);
        setTimeout(() => {
          setError("No se pudieron cargar los pendientes.");
          setLoading(false);
        }, 0);
      }
    );

    return () => unsubscribe();
  }, [db]);

  // 2. Fetch General Notepad contents once
  useEffect(() => {
    if (!db) return;

    const fetchGeneralNotepad = async () => {
      try {
        const docRef = doc(db, "pendientes_config", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTimeout(() => {
            setGeneralNotes(data.content || "");
            if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
              setGeneralLastSaved(data.updatedAt.toDate());
            }
          }, 0);
        }
      } catch (err) {
        console.warn("Could not read general notepad, might not exist yet:", err);
      }
    };

    fetchGeneralNotepad();
  }, [db]);

  // Selected item sync: update editor state when selection changes
  const selectedItem = pendientes.find((p) => p.id === selectedId);

  useEffect(() => {
    setTimeout(() => {
      if (selectedItem) {
        setEditorNotes(selectedItem.notasAdicionales || "");
        setEditorDescription(selectedItem.descripcion || "");
        setEditorFechaLimite(selectedItem.fechaLimite || "");
        setIsEditorDirty(false);
        setEditorLastSaved(
          selectedItem.completedAt && typeof selectedItem.completedAt.toDate === "function"
            ? selectedItem.completedAt.toDate()
            : null
        );
      } else {
        setEditorNotes("");
        setEditorDescription("");
        setEditorFechaLimite("");
        setIsEditorDirty(false);
      }
    }, 0);
  }, [selectedId, selectedItem]);

  // 3. Save general notes to Firestore
  const handleSaveGeneralNotes = async () => {
    if (!db) return;
    setSavingGeneral(true);
    try {
      const docRef = doc(db, "pendientes_config", "general");
      await setDoc(docRef, {
        content: generalNotes,
        updatedAt: serverTimestamp(),
        updatedBy: getCleanUsername()
      }, { merge: true });
      
      setGeneralLastSaved(new Date());
      showToast("Bloc general guardado correctamente", "success");
    } catch (err) {
      console.error("Error saving general notes:", err);
      showToast("Error al guardar notas generales", "error");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveEditorNotes = async () => {
    if (!db || !selectedId) return;
    setSavingEditor(true);
    try {
      const docRef = doc(db, "pendientes", selectedId);
      await updateDoc(docRef, {
        notasAdicionales: editorNotes,
        descripcion: editorDescription,
        fechaLimite: editorFechaLimite || null,
        updatedAt: serverTimestamp()
      });
      setIsEditorDirty(false);
      setEditorLastSaved(new Date());
      showToast("Notas del proyecto guardadas", "success");
    } catch (err) {
      console.error("Error saving project notes:", err);
      showToast("Error al guardar notas de proyecto", "error");
    } finally {
      setSavingEditor(false);
    }
  };

  const handleInsertEtapa = async (index: number) => {
    if (!db || !selectedId || !newStepTitle.trim()) return;
    try {
      const docRef = doc(db, "pendientes", selectedId);
      const newStep: Etapa = {
        id: "etapa-" + generateUniqueId(),
        titulo: newStepTitle.trim(),
        completado: false,
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      
      const currentEtapas = selectedItem?.etapas || [];
      const updated = [...currentEtapas];
      updated.splice(index, 0, newStep);

      await updateDoc(docRef, { etapas: updated });
      setInsertingAtIndex(null);
      setNewStepTitle("");
      showToast("Etapa agregada", "success");
    } catch (err) {
      console.error("Error inserting stage:", err);
      showToast("Error al agregar etapa", "error");
    }
  };

  const handleToggleEtapa = async (stepId: string, currentCompletado: boolean) => {
    if (!db || !selectedId) return;
    try {
      const docRef = doc(db, "pendientes", selectedId);
      const currentEtapas = selectedItem?.etapas || [];
      const updated = currentEtapas.map(step => {
        if (step.id === stepId) {
          const nextCompletado = !currentCompletado;
          return {
            ...step,
            completado: nextCompletado,
            completedAt: nextCompletado ? new Date().toISOString() : null
          };
        }
        return step;
      });

      await updateDoc(docRef, { etapas: updated });
    } catch (err) {
      console.error("Error toggling stage:", err);
      showToast("Error al actualizar etapa", "error");
    }
  };

  const handleSetEtapaFinal = async (stepId: string) => {
    if (!db || !selectedId) return;
    try {
      const docRef = doc(db, "pendientes", selectedId);
      const currentEtapas = selectedItem?.etapas || [];
      const updated = currentEtapas.map(step => ({
        ...step,
        esFinal: step.id === stepId ? !step.esFinal : false
      }));

      await updateDoc(docRef, { etapas: updated });
      showToast("Etapa final establecida", "success");
    } catch (err) {
      console.error("Error setting final stage:", err);
      showToast("Error al definir etapa final", "error");
    }
  };

  const handleDeleteEtapa = async (stepId: string) => {
    if (!db || !selectedId) return;
    try {
      const docRef = doc(db, "pendientes", selectedId);
      const currentEtapas = selectedItem?.etapas || [];
      const updated = currentEtapas.filter(step => step.id !== stepId);

      await updateDoc(docRef, { etapas: updated });
      showToast("Etapa eliminada", "info");
    } catch (err) {
      console.error("Error deleting stage:", err);
      showToast("Error al eliminar etapa", "error");
    }
  };

  const renderInsertionLine = (index: number) => {
    const isInsertingHere = insertingAtIndex === index;

    if (isInsertingHere) {
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleInsertEtapa(index);
          }}
          className="flex items-center gap-1.5 py-1 px-2.5 bg-white/5 rounded-xl border border-white/10 my-1 animate-fade-in"
        >
          <input
            type="text"
            placeholder="Nombre de la etapa..."
            value={newStepTitle}
            onChange={(e) => setNewStepTitle(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none py-0.5"
            autoFocus
          />
          <button
            type="submit"
            className="px-2 py-0.5 rounded bg-emerald-500 text-[10px] font-bold text-white hover:bg-emerald-400"
          >
            Insertar
          </button>
          <button
            type="button"
            onClick={() => {
              setInsertingAtIndex(null);
              setNewStepTitle("");
            }}
            className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-semibold text-gray-400 hover:text-white"
          >
            Cancelar
          </button>
        </form>
      );
    }

    return (
      <div className="group/line flex items-center justify-center h-4.5 relative my-0.5">
        <div className="absolute inset-x-0 h-px bg-white/5 group-hover/line:bg-emerald-500/20 transition-colors" />
        <button
          onClick={() => {
            setInsertingAtIndex(index);
            setNewStepTitle("");
          }}
          className="z-10 w-5 h-5 rounded-full bg-[#0d131f] border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 flex items-center justify-center opacity-40 group-hover/line:opacity-100 transition-all scale-90 hover:scale-100 cursor-pointer"
          title="Insertar etapa aquí"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const handleAddPendiente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast("Por favor, introduce un título descriptivo", "error");
      return;
    }
    if (!db) return;

    setIsAdding(true);
    try {
      const docRef = await addDoc(collection(db, "pendientes"), {
        titulo: newTitle.trim(),
        descripcion: newDescription.trim(),
        prioridad: newPriority,
        completado: false,
        creadoPor: getCleanUsername(),
        createdAt: serverTimestamp(),
        completedAt: null,
        notasAdicionales: "",
        fechaLimite: newFechaLimite || null
      });

      // Auto-select the newly created item
      setSelectedId(docRef.id);
      
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewPriority("media");
      setNewFechaLimite("");
      setIsModalOpen(false);

      showToast("Proyecto pendiente creado", "success");
    } catch (err) {
      console.error("Error adding pendiente:", err);
      showToast("Error al crear pendiente", "error");
    } finally {
      setIsAdding(false);
    }
  };

  // 6. Toggle completado status
  const handleToggleCompletado = async (id: string, currentStatus: boolean) => {
    if (!db) return;
    try {
      const docRef = doc(db, "pendientes", id);
      const isCompleting = !currentStatus;
      await updateDoc(docRef, {
        completado: isCompleting,
        completedAt: isCompleting ? serverTimestamp() : null
      });

      showToast(
        isCompleting ? "¡Proyecto marcado como terminado! 🎉" : "Proyecto reabierto",
        isCompleting ? "success" : "info"
      );
    } catch (err) {
      console.error("Error toggling completion:", err);
      showToast("Error al cambiar estado", "error");
    }
  };

  // 7. Change priority directly
  const handleChangePriority = async (id: string, newPriority: "alta" | "media" | "baja") => {
    if (!db) return;
    try {
      const docRef = doc(db, "pendientes", id);
      await updateDoc(docRef, {
        prioridad: newPriority
      });
      showToast(`Prioridad cambiada a ${newPriority}`, "info");
    } catch (err) {
      console.error("Error updating priority:", err);
      showToast("Error al cambiar prioridad", "error");
    }
  };

  // 8. Delete Pendiente
  const handleDeletePendiente = async (id: string) => {
    if (!db) return;
    if (!confirm("¿Estás seguro de que quieres eliminar este pendiente? Se borrarán también todas sus notas.")) {
      return;
    }

    try {
      const docRef = doc(db, "pendientes", id);
      await deleteDoc(docRef);
      if (selectedId === id) {
        setSelectedId(null);
      }
      showToast("Proyecto pendiente eliminado", "info");
    } catch (err) {
      console.error("Error deleting pendiente:", err);
      showToast("Error al eliminar", "error");
    }
  };

  // Filters computation
  const filteredPendientes = pendientes.filter((p) => {
    const matchSearch =
      p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEstado =
      filterEstado === "todos"
        ? true
        : filterEstado === "completados"
        ? p.completado === true
        : p.completado === false;

    const matchPrioridad =
      filterPrioridad === "todas" ? true : p.prioridad === filterPrioridad;

    return matchSearch && matchEstado && matchPrioridad;
  });

  const pendingCount = pendientes.filter((p) => !p.completado).length;
  const completedCount = pendientes.filter((p) => p.completado).length;

  const priorityStyles = {
    alta: {
      border: "border-rose-500/30 hover:border-rose-500/50",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
      bg: "from-rose-500/5 to-transparent"
    },
    media: {
      border: "border-amber-500/30 hover:border-amber-500/50",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
      bg: "from-amber-500/5 to-transparent"
    },
    baja: {
      border: "border-sky-500/30 hover:border-sky-500/50",
      badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      dot: "bg-sky-500",
      bg: "from-sky-500/5 to-transparent"
    }
  };

  const itemsToRender = selectedId
    ? (selectedId === "general" ? [] : filteredPendientes.filter((p) => p.id === selectedId))
    : filteredPendientes;

  return (
    <AppLayout
      title="Pendientes"
      subtitle="Organizador y notas de proyectos corporativos pendientes"
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
          <div
            className={`flex items-center gap-3 px-4.5 py-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 ${
              toastMessage.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : toastMessage.type === "error"
                ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                : "bg-sky-500/15 border-sky-500/30 text-sky-300"
            }`}
          >
            {toastMessage.type === "success" && <CheckCircle2 className="w-5 h-5" />}
            {toastMessage.type === "error" && <AlertTriangle className="w-5 h-5" />}
            {toastMessage.type === "info" && <Sparkles className="w-5 h-5" />}
            <span className="text-sm font-medium">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Grid: Left sidebar of items, Right workspace notepad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-12rem)] items-stretch">
        
        {/* LEFT COLUMN: List of Pendientes */}
        <section className={`flex flex-col gap-4 transition-all duration-300 ${
          selectedId !== null
            ? "lg:col-span-5 xl:col-span-5"
            : "col-span-12"
        }`}>
          
          {/* Header Stats & Action */}
          {selectedId === null ? (
            <div className="glass-card p-3.5 border border-white/10 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-base flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-emerald-400" />
                    Notero de Pendientes
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pendingCount} activos • {completedCount} terminados
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedId("general")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-white/5 border-white/10 hover:bg-white/10 text-gray-300 hover:text-white"
                    title="Abrir bloc de notas general"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    <span>Bloc General</span>
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-xs font-semibold text-white shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo
                  </button>
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap gap-1 bg-[#090d16] p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setFilterEstado("pendientes")}
                  className={`flex-1 text-center py-1 text-xs font-medium rounded-lg transition-all ${
                    filterEstado === "pendientes"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setFilterEstado("completados")}
                  className={`flex-1 text-center py-1 text-xs font-medium rounded-lg transition-all ${
                    filterEstado === "completados"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Terminados
                </button>
                <button
                  onClick={() => setFilterEstado("todos")}
                  className={`flex-1 text-center py-1 text-xs font-medium rounded-lg transition-all ${
                    filterEstado === "todos"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Todos
                </button>
              </div>

              {/* Search and Priority filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar proyectos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#090d16] border border-white/10 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <select
                  value={filterPrioridad}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterPrioridad(e.target.value as "todas" | "alta" | "media" | "baja")}
                  className="bg-[#090d16] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500/50 transition-colors"
                >
                  <option value="todas">Prioridad: Todas</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="glass-card p-3 border border-white/10 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-xs flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-emerald-400" />
                  {selectedId === "general" ? "Bloc General" : "Modo Edición"}
                </h2>
                <button
                  onClick={() => setSelectedId(null)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                >
                  Volver a la Lista
                </button>
              </div>
            </div>
          )}

          {/* Items List */}
          <div className={
            selectedId !== null
              ? "flex-initial flex flex-col gap-1.5"
              : "flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 overflow-y-auto max-h-[calc(100vh-16rem)] pr-1 scrollbar-thin"
          }>
            {loading ? (
              <div className="glass-card p-8 text-center flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <p className="text-xs text-gray-400">Cargando bitácora de pendientes...</p>
              </div>
            ) : error ? (
              <div className="glass-card p-6 border-rose-500/20 text-center flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-7 h-7 text-rose-400" />
                <p className="text-xs text-rose-300 font-medium">{error}</p>
              </div>
            ) : filteredPendientes.length === 0 ? (
              <div className="glass-card p-10 text-center flex flex-col items-center justify-center gap-3 border border-dashed border-white/10">
                <StickyNote className="w-8 h-8 text-gray-600" />
                <div className="space-y-1">
                  <p className="text-xs text-gray-300 font-semibold">No se encontraron pendientes</p>
                  <p className="text-[11px] text-gray-500 max-w-[200px] mx-auto">
                    {filterEstado === "pendientes" 
                      ? "¡Excelente! No tienes tareas sin resolver."
                      : "Crea tu primer pendiente con el botón 'Nuevo'."}
                  </p>
                </div>
              </div>
            ) : (
              itemsToRender.map((item) => {
                const isSelected = item.id === selectedId;
                const style = priorityStyles[item.prioridad] || priorityStyles.media;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(isSelected ? null : item.id)}
                    className={`group relative flex flex-col p-2.5 rounded-xl border transition-all cursor-pointer bg-gradient-to-br ${
                      isSelected
                        ? "bg-[#0d131f] border-emerald-500/50 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30"
                        : "bg-[#0d131f]/40 hover:bg-[#0d131f]/75 border-white/5 " + style.border
                    }`}
                  >
                    {/* Glowing side accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${style.dot}`} />

                    {/* Card Content */}
                    <div className="pl-1.5 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        
                        {/* Title & Priority Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[8.5px] uppercase tracking-wider font-bold px-1.5 py-0 rounded-full border ${style.badge}`}
                          >
                            {item.prioridad}
                          </span>
                          {item.completado && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Terminado
                            </span>
                          )}
                        </div>

                        {/* Title Text */}
                        <h3
                          className={`text-xs font-semibold leading-relaxed transition-all truncate ${
                            item.completado
                              ? "text-gray-500 line-through"
                              : isSelected
                              ? "text-white text-sm"
                              : "text-gray-200 group-hover:text-white"
                          }`}
                        >
                          {item.titulo}
                        </h3>

                        {/* Description Snippet */}
                        {item.descripcion && (
                          <p className="text-[10px] text-gray-400 line-clamp-1 leading-relaxed">
                            {item.descripcion}
                          </p>
                        )}

                        {/* Date Limit / Invoice Deadline Info */}
                        {item.fechaLimite && (
                          (() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const limitDate = new Date(item.fechaLimite + "T00:00:00");
                            const isOverdue = limitDate < today;
                            const formattedDate = limitDate.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

                            return (
                              <div className={`mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-semibold border ${
                                item.completado
                                  ? "bg-white/5 border-white/5 text-gray-500"
                                  : isOverdue
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse"
                                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              }`}>
                                {isOverdue ? (
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Clock className="w-3 h-3 shrink-0" />
                                )}
                                <span className="truncate">
                                  {isOverdue 
                                    ? `Plazo vencido (${formattedDate})` 
                                    : `Recibiendo hasta: ${formattedDate}`}
                                </span>
                              </div>
                            );
                          })()
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center justify-between gap-2.5 pt-0.5 text-[9px] text-gray-500">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="w-2.5 h-2.5 text-gray-600" />
                              {item.createdAt 
                                ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("es-AR")
                                : "Reciente"}
                            </span>
                            <span className="truncate">Por: {item.creadoPor}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {item.etapas && item.etapas.some(e => e.esFinal && e.completado) && (
                              <span className="flex items-center gap-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1 py-0.2 rounded text-[7.5px] font-extrabold uppercase">
                                <Flag className="w-2.5 h-2.5" /> Meta
                              </span>
                            )}
                            {item.etapas && item.etapas.length > 0 && (
                              <span className="flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded text-[8px] font-bold">
                                {item.etapas.filter(e => e.completado).length}/{item.etapas.length} pasos
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tiny progress bar */}
                        {item.etapas && item.etapas.length > 0 && (
                          <div className="w-full bg-white/5 rounded-full h-1 mt-1.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                              style={{ width: `${(item.etapas.filter(e => e.completado).length / item.etapas.length) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right actions inside card (Checkmark toggle, Edit & Delete) */}
                      <div className="flex flex-col items-center justify-between h-full gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        
                        {/* Circle checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompletado(item.id, item.completado);
                          }}
                          className={`p-1.5 rounded-lg border transition-all ${
                            item.completado
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "bg-white/5 border-white/10 hover:border-emerald-500/40 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/5"
                          }`}
                          title={item.completado ? "Reabrir proyecto" : "Marcar como terminado"}
                        >
                          {item.completado ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(isSelected ? null : item.id);
                          }}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-white/5 border-white/10 hover:border-emerald-500/30 text-gray-400 hover:text-emerald-400"
                          }`}
                          title="Editar notas y detalles"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePendiente(item.id);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/25 transition-all"
                          title="Eliminar pendiente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })
            )}

            {/* Cargar más terminadas */}
            {hasMoreCompleted && !isSearching && (filterEstado === "completados" || filterEstado === "todos") && (
              <div className="col-span-full flex justify-center py-2">
                <button
                  onClick={() => setCompletedLimit((prev) => prev + 10)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/5"
                >
                  <Plus className="w-3.5 h-3.5" /> Cargar más terminadas
                </button>
              </div>
            )}
          </div>

          {/* Stepper map: only in edit mode (selectedItem is defined) */}
          {selectedId !== null && selectedId !== "general" && selectedItem && (
            <div className="glass-card p-4 border border-white/10 rounded-2xl flex flex-col gap-2.5 bg-[#090d16]/10 animate-fade-in mt-1 flex-1 min-h-[300px] max-h-[500px]">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                <h3 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-emerald-400" />
                  <span>Mapa de Etapas</span>
                </h3>
                {selectedItem.etapas && selectedItem.etapas.length > 0 && (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                    {selectedItem.etapas.filter(e => e.completado).length}/{selectedItem.etapas.length}
                  </span>
                )}
              </div>

              <div className="space-y-0.5 overflow-y-auto pr-1 scrollbar-thin flex-1">
                {/* Render insertion line at index 0 */}
                {renderInsertionLine(0)}

                {(!selectedItem.etapas || selectedItem.etapas.length === 0) ? (
                  <div className="text-center py-4 bg-[#090d16]/20 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center gap-2">
                    <span className="text-[10px] text-gray-500 leading-normal px-2">Sin etapas definidas.</span>
                    {insertingAtIndex === 0 ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleInsertEtapa(0);
                        }}
                        className="flex items-center gap-1 w-full py-0.5 px-2 bg-[#090d16] rounded-lg border border-white/10 animate-fade-in"
                      >
                        <input
                          type="text"
                          placeholder="Etapa inicial..."
                          value={newStepTitle}
                          onChange={(e) => setNewStepTitle(e.target.value)}
                          className="flex-1 bg-transparent text-[10px] text-white placeholder-gray-600 focus:outline-none py-0.5"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] font-bold text-white hover:bg-emerald-400"
                        >
                          Ok
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setInsertingAtIndex(0);
                          setNewStepTitle("");
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 text-[9px] font-semibold flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-2.5 h-2.5" /> Crear Etapa Inicial
                      </button>
                    )}
                  </div>
                ) : (
                  (() => {
                    const etapasList = selectedItem.etapas || [];
                    const activeStepIndex = etapasList.findIndex(e => !e.completado);
                    return etapasList.map((step, idx) => {
                      const isActive = idx === activeStepIndex;
                      return (
                        <div key={step.id} className="relative">
                          {/* Vertical timeline line segment */}
                          {idx < etapasList.length - 1 && (
                            <div className="absolute left-[13px] top-[26px] bottom-0 w-[1px] bg-white/10 z-0" />
                          )}
                          
                          {/* Step card */}
                          <div className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl border transition-all duration-500 z-10 relative ${
                            step.completado
                              ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300/70"
                              : isActive
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.08)] ring-1 ring-emerald-500/20"
                              : "bg-[#090d16]/30 border-white/5 text-gray-300"
                          } ${step.esFinal ? "border-amber-500/25 shadow-[0_0_8px_rgba(245,158,11,0.03)]" : ""}`}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              
                              {/* Status Icon / Pulsing indicator */}
                              <div className="relative shrink-0 flex items-center justify-center">
                                <button
                                  onClick={() => handleToggleEtapa(step.id, step.completado)}
                                  className={`p-0.5 rounded-md border transition-all ${
                                    step.completado
                                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                      : "bg-white/5 border-white/10 hover:border-emerald-500/40 text-gray-500 hover:text-emerald-400"
                                  }`}
                                >
                                  {step.completado ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full bg-white/5" />}
                                </button>
                                {isActive && !step.completado && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
                                )}
                              </div>

                              <div className="flex flex-col min-w-0 flex-1">
                                <span className={`text-[11px] font-medium flex flex-wrap items-center gap-1.5 whitespace-normal break-words ${step.completado ? "italic text-emerald-400/90" : ""}`}>
                                  {step.titulo}
                                  {step.esFinal && (
                                    <span className="flex items-center gap-0.5 text-[7px] font-extrabold text-amber-400 bg-amber-500/10 px-1 py-0 rounded border border-amber-500/20 uppercase tracking-wide shrink-0">
                                      <Flag className="w-2 h-2" /> Final
                                    </span>
                                  )}
                                </span>
                                {(step.createdAt || step.completado) && (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[9px] font-medium text-gray-500">
                                    {step.createdAt && (
                                      <span>
                                        Creado: {new Date(step.createdAt).toLocaleDateString("es-AR")}
                                      </span>
                                    )}
                                    {step.createdAt && step.completado && <span>•</span>}
                                    {step.completado && (
                                      <span className="text-emerald-300 font-semibold">
                                        {step.completedAt ? (
                                          (() => {
                                            try {
                                              const dateObj = typeof step.completedAt === "string"
                                                ? new Date(step.completedAt)
                                                : (step.completedAt && typeof step.completedAt === "object" && "toDate" in step.completedAt && typeof (step.completedAt as { toDate?: unknown }).toDate === "function")
                                                ? (step.completedAt as { toDate: () => Date }).toDate()
                                                : new Date(step.completedAt);
                                              return `Hecho: ${dateObj.toLocaleDateString("es-AR")}`;
                                            } catch {
                                              return "Hecho (fecha inválida)";
                                            }
                                          })()
                                        ) : (
                                          "Hecho (sin fecha registrada)"
                                        )}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                              {/* Toggle final stage button */}
                              <button
                                  onClick={() => handleSetEtapaFinal(step.id)}
                                  className={`p-0.5 rounded bg-white/5 border transition-all ${
                                    step.esFinal
                                      ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                      : "border-white/5 text-gray-500 hover:text-amber-400"
                                  }`}
                                  title={step.esFinal ? "Desmarcar como etapa final" : "Marcar como etapa final"}
                              >
                                <Flag className="w-2.5 h-2.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteEtapa(step.id)}
                                className="p-0.5 rounded bg-white/5 border border-white/5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                title="Eliminar etapa"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* Render insertion line at index idx + 1 */}
                          {renderInsertionLine(idx + 1)}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Notepad Editor Workspace */}
        {selectedId !== null && (
          <section className="lg:col-span-7 xl:col-span-7 flex flex-col animate-fade-in">
            
            {selectedId === "general" ? (
              /* GENERAL NOTEPAD */
              <div className="glass-card border border-white/10 rounded-2xl flex flex-col flex-1 overflow-hidden transition-all duration-300">
                
                {/* Notepad Header */}
                <div className="p-5 border-b border-white/10 bg-[#0d131f]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-white font-extrabold text-base flex items-center gap-2">
                      <StickyNote className="w-5 h-5 text-emerald-400" />
                      Bloc de Notas Rápido / Notero General
                    </h2>
                    <p className="text-xs text-gray-400">
                      Espacio compartido para anotaciones rápidas, links temporales y recordatorios globales.
                    </p>
                  </div>
                </div>

                {/* Textarea Workspace */}
                <div className="flex-1 flex flex-col p-5 bg-[#090d16]/30">
                  <textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Utiliza este bloc de notas general para plasmar recordatorios rápidos, ideas o pegar textos que necesites tener a mano mientras trabajas en los proyectos..."
                    className="w-full flex-1 bg-[#090d16]/50 border border-white/5 hover:border-white/10 focus:border-emerald-500/40 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-all resize-none leading-relaxed font-mono shadow-inner min-h-[300px]"
                  />
                </div>

                {/* Notepad Footer */}
                <div className="p-4 border-t border-white/10 bg-[#0d131f]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    {generalLastSaved ? (
                      <>
                        <span>Último guardado:</span>
                        <span className="font-medium text-gray-400">
                          {generalLastSaved.toLocaleTimeString("es-AR")} - {generalLastSaved.toLocaleDateString("es-AR")}
                        </span>
                      </>
                    ) : (
                      <span>Bloc de notas en la nube. Escribe y pulsa guardar.</span>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Cerrar Bloc
                    </button>
                    <button
                      onClick={handleSaveGeneralNotes}
                      disabled={savingGeneral}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all"
                    >
                      {savingGeneral ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Guardar Bloc General
                    </button>
                  </div>
                </div>

              </div>
            ) : selectedItem ? (
              /* PROJECT NOTEPAD */
              <div className="glass-card border border-white/10 rounded-2xl flex flex-col flex-1 overflow-hidden transition-all duration-300">
                
                {/* Notepad Header */}
                <div className="p-5 border-b border-white/10 bg-[#0d131f]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${priorityStyles[selectedItem.prioridad]?.badge}`}>
                        Prioridad {selectedItem.prioridad}
                      </span>
                      {selectedItem.completado ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                          Terminado
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25 flex items-center gap-1 animate-pulse">
                          Pendiente
                        </span>
                      )}
                    </div>
                    <h2 className="text-white font-extrabold text-lg tracking-tight leading-snug">
                      {selectedItem.titulo}
                    </h2>
                    <div className="w-full mt-1.5 max-w-2xl flex flex-col sm:flex-row gap-3 items-stretch">
                      <div className="flex-1">
                        <textarea
                          value={editorDescription}
                          onChange={(e) => {
                            setEditorDescription(e.target.value);
                            setIsEditorDirty(true);
                          }}
                          placeholder="Descripción breve del pendiente (puedes editarla aquí)..."
                          className="w-full bg-[#090d16]/30 border border-white/5 hover:border-white/10 focus:border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-500 focus:outline-none transition-all resize-none leading-relaxed h-14"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 justify-center">
                        <label className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Plazo de Recepción</span>
                        </label>
                        <input
                          type="date"
                          value={editorFechaLimite}
                          onChange={(e) => {
                            setEditorFechaLimite(e.target.value);
                            setIsEditorDirty(true);
                          }}
                          className="bg-[#090d16] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 text-[10px] text-gray-500 shrink-0">
                    <div className="flex gap-2">
                      {/* Toggle status directly from header */}
                      <button
                        onClick={() => handleToggleCompletado(selectedItem.id, selectedItem.completado)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          selectedItem.completado
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {selectedItem.completado ? (
                          <>Reabrir</>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Terminar
                          </>
                        )}
                      </button>
                      
                      {/* Change Priority dropdown directly in header */}
                      <select
                        value={selectedItem.prioridad}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChangePriority(selectedItem.id, e.target.value as "alta" | "media" | "baja")}
                        className="bg-[#090d16] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </div>

                    <span className="mt-1">Creado por {selectedItem.creadoPor}</span>
                </div>
              </div>

              {/* Textarea Workspace */}
                <div className="flex-1 flex flex-col p-5 bg-[#090d16]/30 relative">
                  <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
                    <label htmlFor="project-notepad" className="font-semibold flex items-center gap-1.5 text-gray-300">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      Bitácora de Notas / Notepad de Trabajo
                    </label>
                    {isEditorDirty && (
                      <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Cambios sin guardar
                      </span>
                    )}
                  </div>

                  <textarea
                    id="project-notepad"
                    value={editorNotes}
                    onChange={(e) => {
                      setEditorNotes(e.target.value);
                      setIsEditorDirty(true);
                    }}
                    placeholder="Escribe notas de reuniones, llamadas, bitácoras de avance, tareas pendientes del proyecto, etc..."
                    className="w-full flex-1 bg-[#090d16]/50 border border-white/5 hover:border-white/10 focus:border-emerald-500/40 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-all resize-none leading-relaxed font-sans shadow-inner min-h-[300px]"
                  />
                </div>

                {/* Notepad Footer */}
                <div className="p-4 border-t border-white/10 bg-[#0d131f]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    {editorLastSaved ? (
                      <>
                        <span>Notas guardadas el:</span>
                        <span className="font-medium text-gray-400">
                          {editorLastSaved.toLocaleTimeString("es-AR")}
                        </span>
                      </>
                    ) : (
                      <span>Escribe arriba y presiona Guardar.</span>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Cerrar Bloc
                    </button>
                    <button
                      onClick={handleSaveEditorNotes}
                      disabled={savingEditor}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg active:scale-95 transition-all ${
                        isEditorDirty
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/10"
                          : "bg-white/10 text-gray-400 cursor-not-allowed border border-white/5"
                      }`}
                    >
                      {savingEditor ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Guardar Notas
                    </button>
                  </div>
                </div>

              </div>
            ) : null}
          </section>
        )}

      </div>

      {/* MODAL: Nuevo Proyecto Pendiente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity">
          <div className="glass-card w-full max-w-lg border border-white/15 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/10 bg-[#0d131f] flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  Nuevo Proyecto Pendiente
                </h3>
                <p className="text-xs text-gray-400">Añade una bitácora para hacer seguimiento de un asunto no resuelto.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddPendiente}>
              <div className="p-6 space-y-4">
                
                {/* Title */}
                <div className="space-y-1.5">
                  <label htmlFor="new-title" className="text-xs font-semibold text-gray-300">
                    Título del Proyecto / Asunto *
                  </label>
                  <input
                    id="new-title"
                    type="text"
                    required
                    placeholder="Ej. Conciliación de saldos Hoyts 2026"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#090d16] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label htmlFor="new-description" className="text-xs font-semibold text-gray-300">
                    Descripción Breve
                  </label>
                  <textarea
                    id="new-description"
                    rows={3}
                    placeholder="Describe de qué se trata y qué falta resolver..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full bg-[#090d16] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                  />
                </div>

                {/* Fecha Límite */}
                <div className="space-y-1.5">
                  <label htmlFor="new-fecha-limite" className="text-xs font-semibold text-gray-300">
                    Fecha Límite / Plazo de Recepción (Opcional)
                  </label>
                  <input
                    id="new-fecha-limite"
                    type="date"
                    value={newFechaLimite}
                    onChange={(e) => setNewFechaLimite(e.target.value)}
                    className="w-full bg-[#090d16] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">
                    Prioridad Inicial
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPriority("alta")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        newPriority === "alta"
                          ? "bg-rose-500/15 border-rose-500 text-rose-400"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      Alta
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPriority("media")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        newPriority === "media"
                          ? "bg-amber-500/15 border-amber-500 text-amber-400"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      Media
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPriority("baja")}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        newPriority === "baja"
                          ? "bg-sky-500/15 border-sky-500 text-sky-400"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      Baja
                    </button>
                  </div>
                </div>

              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4.5 bg-[#0d131f]/50 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/15 active:scale-95 transition-all"
                >
                  {isAdding ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Crear Pendiente
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </AppLayout>
  );
}
