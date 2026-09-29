"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  fetchPendientesFromMongo,
  syncPendienteToMongo,
  deletePendienteFromMongo,
} from "@/lib/serverSync";
import {
  Plus,
  Trash2,
  Check,
  Search,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
  Circle,
  Edit3,
  Calendar,
  Layers,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

// Emil Kowalski animation curves
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function getTimestampSeconds(val: any): number {
  if (!val) return 0;
  if (typeof val === "object" && val !== null) {
    if ("seconds" in val && typeof (val as any).seconds === "number") {
      return (val as any).seconds;
    }
    if ("toDate" in val && typeof (val as any).toDate === "function") {
      const d = (val as any).toDate();
      return Math.floor(d.getTime() / 1000);
    }
    if (val instanceof Date) {
      return Math.floor(val.getTime() / 1000);
    }
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
  }
  return 0;
}

export function formatStepDate(val: any): string {
  if (!val) return "";
  let date: Date | null = null;
  if (typeof val === "object" && val !== null) {
    if ("seconds" in val && typeof (val as any).seconds === "number") {
      date = new Date((val as any).seconds * 1000);
    } else if ("toDate" in val && typeof (val as any).toDate === "function") {
      date = (val as any).toDate();
    } else if (val instanceof Date) {
      date = val;
    }
  } else if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) date = d;
  }

  if (!date) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${mins} hs`;
}

export interface Etapa {
  id: string;
  titulo: string;
  completado: boolean;
  completedAt?: string | null;
  createdAt?: string | null;
}

export interface Pendiente {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  categoria?: string;
  completado: boolean;
  creadoPor: string;
  createdAt: Timestamp | null;
  completedAt: Timestamp | null;
  notasAdicionales?: string;
  etapas?: Etapa[];
  fechaLimite?: string | null;
  cotizacionesIds?: string[];
}

interface ToastInfo {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

// Circular progress indicator with SVG animated stroke
function CircularProgressRing({
  completed,
  total,
  size = 44,
  strokeWidth = 3.5,
  showLabel = true,
}: {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const isAllDone = total > 0 && completed === total;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        className="w-full h-full -rotate-90 transform"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isAllDone ? "#10b981" : "#6366f1"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
            transition:
              "stroke-dashoffset 350ms cubic-bezier(0.23, 1, 0.32, 1), stroke 250ms ease",
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          {isAllDone ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
          ) : (
            <span className="text-[10px] font-bold text-white tracking-tight tabular-nums">
              {percent}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PendientesPage() {
  const db = getFirebaseDb();
  const { user } = useAuth();

  // State
  const [items, setItems] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [filterStatus, setFilterStatus] = useState<"pendientes" | "completados" | "todos">("pendientes");
  const [filterPriority, setFilterPriority] = useState<"todas" | "alta" | "media" | "baja">("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [editingItem, setEditingItem] = useState<Pendiente | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);

  // New item form state
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newPriority, setNewPriority] = useState<"alta" | "media" | "baja">("media");
  const [newInitialSteps, setNewInitialSteps] = useState<{ id: string; titulo: string; createdAt: string }[]>([]);
  const [stepInputVal, setStepInputVal] = useState<string>("");
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);

  // Edit modal draft state
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPriority, setEditPriority] = useState<"alta" | "media" | "baja">("media");
  const [editEtapas, setEditEtapas] = useState<Etapa[]>([]);
  const [editNewStepTitle, setEditNewStepTitle] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Server connection status & step expand tracking
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});

  const toggleExpandSteps = (itemId: string) => {
    setExpandedStepsMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Toasts
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const addToast = useCallback((text: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const getCleanUsername = () => {
    if (!user) return "Usuario";
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split("@")[0];
    return "Usuario";
  };

  // Load items from server (MongoDB primary, Firebase fallback)
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    let loadedFromMongo = false;

    // 1. Intentar cargar directamente del servidor MongoDB
    try {
      const mongoRes = await fetchPendientesFromMongo();
      if (mongoRes && Array.isArray(mongoRes.pendientes)) {
        setItems(mongoRes.pendientes as Pendiente[]);
        setIsServerConnected(true);
        loadedFromMongo = true;
        if (isManualRefresh) {
          addToast("Pendientes recargados desde el servidor", "success");
        }
      }
    } catch (mongoErr) {
      console.warn("MongoDB fetch falló, probando Firebase:", mongoErr);
      setIsServerConnected(false);
    }

    // 2. Si MongoDB falló, respaldo con Firebase
    if (!loadedFromMongo) {
      try {
        if (db) {
          const colRef = collection(db, "pendientes");
          const snapshot = await getDocs(colRef);
          const fbItems: Pendiente[] = [];
          snapshot.forEach((d) => {
            fbItems.push({ id: d.id, ...d.data() } as Pendiente);
          });
          setItems(fbItems);
          if (isManualRefresh) {
            addToast("Cargado desde Firebase (servidor no disponible)", "info");
          }
        }
      } catch (fbErr: any) {
        console.error("Error loading pendientes:", fbErr);
        setError("No se pudieron cargar los pendientes. Verifica la conexión.");
      }
    }

    setLoading(false);
    setIsRefreshing(false);
  }, [db, addToast]);

  // Load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived counts
  const pendingCount = useMemo(() => items.filter((i) => !i.completado).length, [items]);
  const completedCount = useMemo(() => items.filter((i) => i.completado).length, [items]);
  const totalCount = items.length;

  // Filtered & sorted items
  const filteredItems = useMemo(() => {
    let list = items;

    if (filterStatus === "pendientes") {
      list = list.filter((i) => !i.completado);
    } else if (filterStatus === "completados") {
      list = list.filter((i) => i.completado);
    }

    if (filterPriority !== "todas") {
      list = list.filter((i) => i.prioridad === filterPriority);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.titulo.toLowerCase().includes(q) ||
          i.descripcion?.toLowerCase().includes(q) ||
          i.etapas?.some((e) => e.titulo.toLowerCase().includes(q))
      );
    }

    // Sort: priority (alta > media > baja), then date descending
    const pWeight = { alta: 0, media: 1, baja: 2 };
    return [...list].sort((a, b) => {
      const wa = pWeight[a.prioridad] ?? 1;
      const wb = pWeight[b.prioridad] ?? 1;
      if (wa !== wb) return wa - wb;
      return getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt);
    });
  }, [items, filterStatus, filterPriority, searchQuery]);

  // Handle open edit modal
  const openEditModal = (item: Pendiente) => {
    setEditingItem(item);
    setEditTitle(item.titulo || "");
    setEditDescription(item.descripcion || "");
    setEditPriority(item.prioridad || "media");
    setEditEtapas(item.etapas ? JSON.parse(JSON.stringify(item.etapas)) : []);
    setEditNewStepTitle("");
  };

  const closeEditModal = () => {
    setEditingItem(null);
  };

  // Toggle pendiente completion
  const handleTogglePendiente = async (id: string, currentStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const newStatus = !currentStatus;
    const nowIso = new Date().toISOString();

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          completado: newStatus,
          completedAt: newStatus ? (Timestamp.now() as any) : null,
        };
      })
    );

    addToast(newStatus ? "Pendiente completado" : "Pendiente reabierto", "info");

    try {
      const updatedFields: any = {
        completado: newStatus,
        completedAt: newStatus ? nowIso : null,
      };

      // 1. Guardar primero en MongoDB del servidor
      await syncPendienteToMongo({ id, ...updatedFields });

      // 2. Firebase de respaldo no bloqueante
      if (db) {
        try {
          await updateDoc(doc(db, "pendientes", id), {
            completado: newStatus,
            completedAt: newStatus ? serverTimestamp() : null,
          });
        } catch (fbErr) {
          console.warn("⚠️ Firebase toggle skipped:", fbErr);
        }
      }
    } catch (err) {
      console.error("Error updating completion status:", err);
      addToast("Error al guardar estado en el servidor", "error");
    }
  };

  // Toggle an individual step on a card
  const handleToggleCardStep = async (pendienteId: string, etapaId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const parent = items.find((i) => i.id === pendienteId);
    if (!parent || !parent.etapas) return;

    const nowIso = new Date().toISOString();
    const updatedEtapas = parent.etapas.map((step) => {
      if (step.id !== etapaId) return step;
      const willBeCompleted = !step.completado;
      return {
        ...step,
        completado: willBeCompleted,
        createdAt: step.createdAt || nowIso,
        completedAt: willBeCompleted ? nowIso : null,
      };
    });

    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== pendienteId) return p;
        return {
          ...p,
          etapas: updatedEtapas,
        };
      })
    );

    const targetStep = updatedEtapas.find((s) => s.id === etapaId);
    const allStepsFinished = updatedEtapas.length > 0 && updatedEtapas.every((s) => s.completado);
    addToast(
      allStepsFinished
        ? "¡Todos los pasos completados!"
        : targetStep?.completado
        ? `Paso completado (${formatStepDate(nowIso)})`
        : "Paso marcado como pendiente",
      "success"
    );

    try {
      const payload: any = { etapas: updatedEtapas };
      // 1. Guardar primero en MongoDB del servidor
      await syncPendienteToMongo({ id: pendienteId, ...payload });

      // 2. Firebase de respaldo no bloqueante
      if (db) {
        try {
          await updateDoc(doc(db, "pendientes", pendienteId), payload);
        } catch (fbErr) {
          console.warn("⚠️ Firebase step toggle skipped:", fbErr);
        }
      }
    } catch (err) {
      console.error("Error updating step:", err);
    }
  };

  // Delete a pendiente
  const handleDeletePendiente = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!confirm("¿Deseas eliminar este pendiente definitivamente?")) return;

    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingItem?.id === id) {
      closeEditModal();
    }
    addToast("Pendiente eliminado", "info");

    try {
      // 1. Eliminar de MongoDB
      await deletePendienteFromMongo(id);

      // 2. Eliminar de Firebase no bloqueante
      if (db) {
        try {
          await deleteDoc(doc(db, "pendientes", id));
        } catch (fbErr) {
          console.warn("⚠️ Firebase delete skipped:", fbErr);
        }
      }
    } catch (err) {
      console.error("Error deleting pendiente:", err);
      addToast("Error al eliminar del servidor", "error");
    }
  };

  // Add a step in edit modal
  const handleAddEditStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = editNewStepTitle.trim();
    if (!title) return;

    const newEtapa: Etapa = {
      id: "step-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      titulo: title,
      completado: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    setEditEtapas((prev) => [...prev, newEtapa]);
    setEditNewStepTitle("");
  };

  // Toggle step inside edit modal
  const handleToggleEditModalStep = (stepId: string) => {
    const nowIso = new Date().toISOString();
    setEditEtapas((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const willBeCompleted = !s.completado;
        return {
          ...s,
          completado: willBeCompleted,
          createdAt: s.createdAt || nowIso,
          completedAt: willBeCompleted ? nowIso : null,
        };
      })
    );
  };

  // Remove step in edit modal
  const handleRemoveEditStep = (stepId: string) => {
    setEditEtapas((prev) => prev.filter((s) => s.id !== stepId));
  };

  // Save changes from edit modal
  const handleSaveEditModal = async () => {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      addToast("El título no puede estar vacío", "error");
      return;
    }

    setIsSavingEdit(true);

    const isCompleted = editingItem.completado;

    // Asegurar que cada etapa tenga su fecha de creación registrada
    const nowIso = new Date().toISOString();
    const sanitizedEtapas: Etapa[] = editEtapas.map((et, idx) => ({
      ...et,
      id: et.id || `step-${Date.now()}-${idx}`,
      createdAt: et.createdAt || nowIso,
      completedAt: et.completado ? (et.completedAt || nowIso) : null,
    }));

    const updatedData: Partial<Pendiente> = {
      titulo: editTitle.trim(),
      descripcion: editDescription.trim(),
      prioridad: editPriority,
      etapas: sanitizedEtapas,
      completado: isCompleted,
      completedAt: isCompleted ? (editingItem.completedAt || (Timestamp.now() as any)) : null,
    };

    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== editingItem.id) return i;
        return { ...i, ...updatedData };
      })
    );

    try {
      // 1. Guardar primero en MongoDB del servidor
      const mongoSaved = await syncPendienteToMongo({ id: editingItem.id, ...updatedData });

      // 2. Firebase de respaldo no bloqueante
      if (db) {
        try {
          const fbPayload: any = {
            ...updatedData,
            completedAt: isCompleted ? (editingItem.completedAt || serverTimestamp()) : null,
          };
          await updateDoc(doc(db, "pendientes", editingItem.id), fbPayload);
        } catch (fbErr) {
          console.warn("⚠️ Firebase edit skipped:", fbErr);
        }
      }

      if (mongoSaved) {
        addToast("Cambios guardados en el servidor", "success");
      } else {
        addToast("Cambios guardados localmente", "info");
      }
      closeEditModal();
    } catch (err) {
      console.error("Error saving edit:", err);
      addToast("Error al guardar cambios", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Add a step in New Modal draft
  const handleAddNewDraftStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!stepInputVal.trim()) return;
    setNewInitialSteps((prev) => [
      ...prev,
      {
        id: "step-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        titulo: stepInputVal.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
    setStepInputVal("");
  };

  // Submit New Pendiente
  const handleCreatePendiente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      addToast("Ingresa un título para el pendiente", "error");
      return;
    }

    setIsSubmittingNew(true);

    const generatedId = (db ? doc(collection(db, "pendientes")).id : null) || `pen-${Date.now()}`;
    const initialEtapas: Etapa[] = newInitialSteps.map((st, idx) => ({
      id: st.id || `step-${Date.now()}-${idx}`,
      titulo: st.titulo,
      completado: false,
      createdAt: st.createdAt || new Date().toISOString(),
      completedAt: null,
    }));

    const newObj: Pendiente = {
      id: generatedId,
      titulo: newTitle.trim(),
      descripcion: newDescription.trim(),
      prioridad: newPriority,
      completado: false,
      creadoPor: getCleanUsername(),
      createdAt: Timestamp.now(),
      completedAt: null,
      etapas: initialEtapas,
    };

    setItems((prev) => [newObj, ...prev]);

    try {
      // 1. Guardar primero en el servidor MongoDB del usuario
      const mongoSaved = await syncPendienteToMongo(newObj);

      // 2. Firebase de respaldo no bloqueante
      if (db) {
        try {
          await setDoc(doc(db, "pendientes", generatedId), {
            ...newObj,
            createdAt: serverTimestamp(),
          });
        } catch (fbErr) {
          console.warn("⚠️ Firebase save skipped:", fbErr);
        }
      }

      if (mongoSaved) {
        addToast("Pendiente guardado en el servidor", "success");
      } else {
        addToast("Pendiente guardado localmente", "info");
      }

      setIsNewModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("media");
      setNewInitialSteps([]);
      setStepInputVal("");
    } catch (err) {
      console.error("Error creating pendiente:", err);
      addToast("Error al guardar pendiente", "error");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const priorityMeta = {
    alta: {
      label: "Alta",
      dot: "bg-rose-500",
      badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",
      accent: "#f43f5e",
    },
    media: {
      label: "Media",
      dot: "bg-amber-400",
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      accent: "#fbbf24",
    },
    baja: {
      label: "Baja",
      dot: "bg-emerald-400",
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      accent: "#10b981",
    },
  };

  return (
    <AppLayout title="Pendientes" subtitle="Organizador de tareas, proyectos y pasos de trabajo">
      {/* Toast notifications container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 bg-[#0d121f]/90 shadow-2xl backdrop-blur-md text-xs font-medium text-white"
            >
              {t.type === "success" && <Check className="w-4 h-4 text-emerald-400" />}
              {t.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {t.type === "info" && <Sparkles className="w-4 h-4 text-indigo-400" />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 pb-16">
        {/* TOP BAR / DASHBOARD HEADER */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-[#0d1220]/80 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Flujo de Pendientes
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {pendingCount} activos
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Control circular de etapas, seguimiento y cumplimiento de tareas.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Recargar Servidor button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              title="Recargar pendientes directamente desde tu servidor"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Recargar Servidor</span>
              <span
                className={`w-2 h-2 rounded-full ${isServerConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
                title={isServerConnected ? "Servidor conectado" : "Modo local / reconectando"}
              />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 border border-white/10 cursor-pointer transition-shadow"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo Pendiente</span>
            </motion.button>
          </div>
        </section>

        {/* CONTROLS: Segmented Tabs & Search */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter Pills with Motion layoutId */}
          <div className="inline-flex p-1 bg-[#090d18] border border-white/[0.08] rounded-xl self-start">
            {(
              [
                { id: "pendientes", label: "En Curso", count: pendingCount },
                { id: "completados", label: "Completados", count: completedCount },
                { id: "todos", label: "Todos", count: totalCount },
              ] as const
            ).map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors duration-150 ${
                    isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeFilterTab"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      className="absolute inset-0 bg-indigo-600 rounded-lg shadow-md shadow-indigo-600/30"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.label}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-white/[0.05] text-slate-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Priority Selector */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por título o paso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#090d18] border border-white/[0.08] focus:border-indigo-500 rounded-xl py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="bg-[#090d18] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 outline-none cursor-pointer focus:border-indigo-500"
            >
              <option value="todas">Prioridad: Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </section>

        {/* ITEMS GRID */}
        {loading ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-xs text-slate-400">Cargando tus tareas pendientes...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <p className="text-xs text-rose-300 font-medium">{error}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-14 text-center rounded-3xl bg-[#090d18]/50 border border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">
                No hay pendientes en esta vista
              </h3>
              <p className="text-xs text-slate-500 max-w-xs">
                {filterStatus === "pendientes"
                  ? "¡Genial! No tienes tareas sin resolver en este momento."
                  : "No se encontraron tareas con los filtros actuales."}
              </p>
            </div>
            {filterStatus === "pendientes" && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsNewModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white border border-white/[0.08] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear nuevo</span>
              </motion.button>
            )}
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => {
                const etapas = item.etapas || [];
                const completedStepsCount = etapas.filter((e) => e.completado).length;
                const totalSteps = etapas.length;
                const pInfo = priorityMeta[item.prioridad] || priorityMeta.media;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                    whileHover={{ y: -2 }}
                    className={`group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
                      item.completado
                        ? "bg-[#0c101a]/60 border-white/[0.06] opacity-75 hover:opacity-100"
                        : "bg-[#0d1222] border-white/[0.08] hover:border-white/[0.18] shadow-lg shadow-black/30"
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Card Header: Priority & Quick Complete */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${pInfo.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${pInfo.dot}`} />
                            {pInfo.label}
                          </span>
                          {item.completado && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Listo
                            </span>
                          )}
                        </div>

                        {/* Circular complete button */}
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={(e) => handleTogglePendiente(item.id, item.completado, e)}
                          title={item.completado ? "Reabrir pendiente" : "Marcar como terminado"}
                          className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                            item.completado
                              ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30"
                              : "bg-white/[0.04] border-white/[0.12] hover:border-emerald-400/50 text-slate-400 hover:text-emerald-400"
                          }`}
                        >
                          {item.completado ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 stroke-[2]" />
                          )}
                        </motion.button>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1">
                        <h3
                          onClick={() => openEditModal(item)}
                          className={`text-sm font-bold text-white tracking-tight cursor-pointer hover:text-indigo-300 transition-colors leading-snug ${
                            item.completado ? "line-through text-slate-400" : ""
                          }`}
                        >
                          {item.titulo}
                        </h3>
                        {item.descripcion ? (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {item.descripcion}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 italic">Sin descripción</p>
                        )}
                      </div>

                      {/* CIRCULAR STEPS PIPELINE (on card) */}
                      {totalSteps > 0 ? (
                        <div className="pt-2 border-t border-white/[0.05] space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">
                              Pasos del pendiente
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums font-bold text-indigo-400">
                                {completedStepsCount}/{totalSteps}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandSteps(item.id);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                              >
                                <span>{expandedStepsMap[item.id] ? "Ocultar" : "Ver fechas"}</span>
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform duration-200 ${
                                    expandedStepsMap[item.id] ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Interconnected Circular Step Nodes */}
                          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                            {etapas.map((step, sIdx) => {
                              const isStepDone = step.completado;
                              const createdLabel = step.createdAt ? formatStepDate(step.createdAt) : "";
                              const completedLabel = step.completedAt ? formatStepDate(step.completedAt) : "";
                              const tooltip = `Paso ${sIdx + 1}: ${step.titulo}${
                                createdLabel ? `\n📅 Creado: ${createdLabel}` : ""
                              }${completedLabel ? `\n✓ Completado: ${completedLabel}` : ""}`;

                              return (
                                <div key={step.id} className="flex items-center gap-1.5 shrink-0">
                                  {/* Step Circular Node */}
                                  <motion.button
                                    whileTap={{ scale: 0.85 }}
                                    onClick={(e) => handleToggleCardStep(item.id, step.id, e)}
                                    title={tooltip}
                                    className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer ${
                                      isStepDone
                                        ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm"
                                        : "bg-white/[0.04] border-white/[0.12] text-slate-400 hover:border-indigo-400 hover:text-white"
                                    }`}
                                  >
                                    {isStepDone ? (
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    ) : (
                                      <span>{sIdx + 1}</span>
                                    )}
                                  </motion.button>

                                  {/* Connecting line */}
                                  {sIdx < totalSteps - 1 && (
                                    <div
                                      className={`w-3.5 h-[2px] rounded-full transition-colors ${
                                        isStepDone ? "bg-emerald-500/70" : "bg-white/[0.08]"
                                      }`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Expandable Step List with registered dates */}
                          {expandedStepsMap[item.id] ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: EASE_OUT }}
                              className="space-y-1.5 pt-1"
                            >
                              {etapas.map((step, sIdx) => {
                                const isStepDone = step.completado;
                                return (
                                  <div
                                    key={step.id}
                                    onClick={(e) => handleToggleCardStep(item.id, step.id, e)}
                                    className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] cursor-pointer transition-colors"
                                  >
                                    <div className="pt-0.5 shrink-0">
                                      <div
                                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                                          isStepDone
                                            ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                            : "bg-white/[0.04] border-white/[0.12] text-slate-400"
                                        }`}
                                      >
                                        {isStepDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : sIdx + 1}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-xs leading-snug ${
                                          isStepDone
                                            ? "line-through text-slate-400"
                                            : "text-slate-200 font-medium"
                                        }`}
                                      >
                                        {step.titulo}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px]">
                                        {step.createdAt && (
                                          <span className="flex items-center gap-1 text-slate-400">
                                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                                            <span>Creado: {formatStepDate(step.createdAt)}</span>
                                          </span>
                                        )}
                                        {isStepDone && step.completedAt && (
                                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                            <span>Listo: {formatStepDate(step.completedAt)}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </motion.div>
                          ) : (
                            /* Compact preview of current active step */
                            (() => {
                              const activeStep = etapas.find((s) => !s.completado) || etapas[etapas.length - 1];
                              if (!activeStep) return null;
                              return (
                                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[11px]">
                                  <div className="flex items-center gap-1.5 truncate text-slate-300 min-w-0">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        activeStep.completado ? "bg-emerald-400" : "bg-indigo-400"
                                      }`}
                                    />
                                    <span className="truncate">{activeStep.titulo}</span>
                                  </div>
                                  {activeStep.createdAt && (
                                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                                      {formatStepDate(activeStep.createdAt)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-white/[0.05] flex items-center gap-2 text-[11px] text-slate-500">
                          <Circle className="w-3 h-3 text-slate-600" />
                          <span>Sin pasos definidos</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3.5 mt-3.5 border-t border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CircularProgressRing
                          completed={completedStepsCount}
                          total={totalSteps}
                          size={28}
                          strokeWidth={2.5}
                          showLabel={false}
                        />
                        <span className="text-[10px] text-slate-500">
                          {totalSteps > 0
                            ? `${Math.round((completedStepsCount / totalSteps) * 100)}% completado`
                            : "0% completado"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[11px] font-semibold text-slate-300 hover:text-white border border-white/[0.06] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-indigo-400" />
                          <span>Editar</span>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={(e) => handleDeletePendiente(item.id, e)}
                          title="Eliminar pendiente"
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ============================================================
          EDIT PENDIENTE MODAL (FOCUSED ON CIRCULAR STEPS & DESCRIPTION)
          ============================================================ */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={closeEditModal}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="relative w-full max-w-xl max-h-[90vh] bg-[#0d1222] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#0a0e1a]/80">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const newStatus = !editingItem.completado;
                      setEditingItem({ ...editingItem, completado: newStatus });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                      editingItem.completado
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {editingItem.completado ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Completado</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3 h-3 stroke-[2]" />
                        <span>En Curso</span>
                      </>
                    )}
                  </motion.button>

                  {/* Priority selector pill */}
                  <div className="inline-flex p-0.5 bg-[#070a14] rounded-lg border border-white/[0.06]">
                    {(["alta", "media", "baja"] as const).map((p) => {
                      const isSel = editPriority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditPriority(p)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            isSel
                              ? p === "alta"
                                ? "bg-rose-500 text-white shadow-sm"
                                : p === "media"
                                ? "bg-amber-500 text-slate-950 shadow-sm"
                                : "bg-emerald-500 text-slate-950 shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={closeEditModal}
                  className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
                {/* 1. TÍTULO */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Título del Asunto
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título del asunto..."
                    className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm font-semibold text-white placeholder-slate-600 outline-none transition-colors"
                  />
                </div>

                {/* 2. DESCRIPCIÓN */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Descripción
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Escribe una breve descripción del asunto a resolver..."
                    className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* 3. PASOS CIRCULARES */}
                <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                  {/* Stepper Header with Circular Gauge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CircularProgressRing
                        completed={editEtapas.filter((e) => e.completado).length}
                        total={editEtapas.length}
                        size={48}
                        strokeWidth={4}
                      />
                      <div>
                        <h4 className="text-xs font-bold text-white tracking-tight">
                          Pasos del Pendiente
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {editEtapas.filter((e) => e.completado).length} de {editEtapas.length}{" "}
                          pasos completados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Circular Step List */}
                  <div className="space-y-2 pt-1">
                    <AnimatePresence mode="popLayout">
                      {editEtapas.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-5 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.08] text-center text-xs text-slate-500"
                        >
                          Aún no has agregado pasos. Añade el primer paso abajo.
                        </motion.div>
                      ) : (
                        editEtapas.map((step, idx) => {
                          const isDone = step.completado;
                          return (
                            <motion.div
                              key={step.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.18, ease: EASE_OUT }}
                              className="group flex flex-col p-3 rounded-2xl bg-[#080b15] border border-white/[0.06] hover:border-white/[0.12] transition-colors gap-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Circular step toggle button */}
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.88 }}
                                    onClick={() => handleToggleEditModalStep(step.id)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                                      isDone
                                        ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20"
                                        : "bg-white/[0.04] border-white/[0.12] hover:border-indigo-400 text-slate-400 hover:text-white"
                                    }`}
                                  >
                                    {isDone ? (
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    ) : (
                                      <span className="text-[11px] font-bold">{idx + 1}</span>
                                    )}
                                  </motion.button>

                                  {/* Step title editable inline */}
                                  <input
                                    type="text"
                                    value={step.titulo}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditEtapas((prev) =>
                                        prev.map((s) =>
                                          s.id === step.id ? { ...s, titulo: val } : s
                                        )
                                      );
                                    }}
                                    className={`flex-1 bg-transparent text-xs text-white outline-none font-medium ${
                                      isDone ? "line-through text-slate-500" : ""
                                    }`}
                                  />
                                </div>

                                {/* Remove step */}
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleRemoveEditStep(step.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>

                              {/* Registered Date Details */}
                              <div className="flex flex-wrap items-center gap-3 pl-10 text-[10px]">
                                {step.createdAt ? (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span>Creado: <strong className="text-slate-300 font-medium">{formatStepDate(step.createdAt)}</strong></span>
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">Fecha de inicio registrada al guardar</span>
                                )}

                                {isDone && step.completedAt && (
                                  <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Listo: {formatStepDate(step.completedAt)}</span>
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Add Step Input */}
                  <form onSubmit={handleAddEditStep} className="flex items-center gap-2 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Escribe un nuevo paso..."
                        value={editNewStepTitle}
                        onChange={(e) => setEditNewStepTitle(e.target.value)}
                        className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none transition-colors"
                      />
                    </div>
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.94 }}
                      disabled={!editNewStepTitle.trim()}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir</span>
                    </motion.button>
                  </form>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/[0.08] bg-[#0a0e1a]/80 flex items-center justify-between gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDeletePendiente(editingItem.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
                >
                  Eliminar
                </motion.button>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={closeEditModal}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSaveEditModal}
                    disabled={isSavingEdit}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-md shadow-indigo-600/25 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isSavingEdit ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar Cambios</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================
          NEW PENDIENTE MODAL (CLEAN & MINIMAL)
          ============================================================ */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setIsNewModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="relative w-full max-w-lg bg-[#0d1222] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0a0e1a]/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-400 stroke-[2.5]" />
                  <span>Nuevo Pendiente</span>
                </h3>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setIsNewModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <form onSubmit={handleCreatePendiente}>
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Título *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Revisión y autorización de fondos..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-white placeholder-slate-600 outline-none transition-colors"
                      autoFocus
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Descripción
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Breve detalle de la tarea..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Prioridad
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["baja", "media", "alta"] as const).map((p) => {
                        const isSel = newPriority === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewPriority(p)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold uppercase border transition-all cursor-pointer ${
                              isSel
                                ? p === "alta"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : p === "media"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-[#080b15] border-white/[0.06] text-slate-400 hover:text-white"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Initial Steps Creator */}
                  <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Pasos Iniciales (Opcional)</span>
                      <span className="text-slate-500 tabular-nums">
                        {newInitialSteps.length} pasos
                      </span>
                    </label>

                    {newInitialSteps.length > 0 && (
                      <div className="space-y-1.5">
                        {newInitialSteps.map((st, idx) => (
                          <div
                            key={st.id || idx}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#080b15] border border-white/[0.06] text-xs text-white"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <span className="truncate font-medium">{st.titulo}</span>
                              <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1 ml-auto">
                                <Clock className="w-2.5 h-2.5 text-slate-500" />
                                <span>{formatStepDate(st.createdAt)}</span>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setNewInitialSteps((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer ml-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Escribe un paso y presiona Enter..."
                        value={stepInputVal}
                        onChange={(e) => setStepInputVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddNewDraftStep();
                          }
                        }}
                        className="flex-1 bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNewDraftStep()}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-white/[0.08] bg-[#0a0e1a]/80 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isSubmittingNew || !newTitle.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isSubmittingNew ? "Creando..." : "Crear Pendiente"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
