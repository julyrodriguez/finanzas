"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  RefreshCw,
  Flame,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  Check,
  Tag
} from "lucide-react";
import {
  fetchPendientesFromMongo,
  syncPendienteToMongo,
  fetchCalendarEventsFromMongo,
  syncCalendarEventToMongo,
} from "@/lib/serverSync";
import {
  Recordatorio,
  fetchRecordatorios,
  toggleRecordatorioStatus,
  saveRecordatorio,
} from "@/lib/agent/recordatoriosService";
import { getFirebaseDb, isFirestoreDisabled, handleFirestoreError } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { toast } from "@/context/ToastContext";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface UnifiedAgendaItem {
  id: string;
  source: "pendiente" | "calendario" | "recordatorio";
  titulo: string;
  descripcion?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  completado: boolean;
  prioridad: "alta" | "media" | "baja";
  categoria?: string;
  etapas?: { id: string; titulo: string; completado: boolean }[];
  isOverdue?: boolean;
  rawItem: any;
}

// Helper timezone Argentina (America/Argentina/Buenos_Aires)
function getArgentinaDateStr(d: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d);
  } catch {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

function formatDisplayDate(dateStr: string, isToday = false, isTomorrow = false): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const dayName = d.toLocaleDateString("es-AR", { weekday: "long" });
    const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const monthName = d.toLocaleDateString("es-AR", { month: "short" });
    return `${capitalized}, ${day} ${monthName}`;
  } catch {
    return dateStr;
  }
}

export function HomeAgendaPendientes() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<UnifiedAgendaItem[]>([]);

  // Quick addition states
  const [isAddingToday, setIsAddingToday] = useState(false);
  const [todayNewTitle, setTodayNewTitle] = useState("");
  const [todayNewPriority, setTodayNewPriority] = useState<"alta" | "media" | "baja">("media");
  const [todayNewCategory, setTodayNewCategory] = useState("General");

  const [isAddingTomorrow, setIsAddingTomorrow] = useState(false);
  const [tomorrowNewTitle, setTomorrowNewTitle] = useState("");
  const [tomorrowNewPriority, setTomorrowNewPriority] = useState<"alta" | "media" | "baja">("media");
  const [tomorrowNewCategory, setTomorrowNewCategory] = useState("General");

  // Dates
  const todayStr = useMemo(() => getArgentinaDateStr(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getArgentinaDateStr(d);
  }, []);

  // Fetch all items from Mongo + Firestore
  const loadAgenda = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const unified: UnifiedAgendaItem[] = [];

      // 1. Fetch Pendientes
      let pendientesList: any[] = [];
      try {
        const mongoRes = await fetchPendientesFromMongo();
        if (mongoRes && Array.isArray(mongoRes.pendientes)) {
          pendientesList = mongoRes.pendientes;
        }
      } catch (e) {
        console.warn("Aviso Mongo pendientes en agenda:", e);
      }

      if (pendientesList.length === 0 && !isFirestoreDisabled()) {
        try {
          const db = getFirebaseDb();
          if (db) {
            const snap = await getDocs(collection(db, "pendientes"));
            pendientesList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          }
        } catch {}
      }

      // Process Pendientes
      pendientesList.forEach((p) => {
        const pId = p.id || p.firebaseId || p._id;
        let date = p.fechaLimite || "";
        if (!date && typeof p.createdAt === "string" && p.createdAt.includes("T")) {
          date = p.createdAt.split("T")[0];
        }

        // Si no tiene fecha, pero está pendiente y tiene prioridad alta, agendarlo para hoy
        if (!date && !p.completado && p.prioridad === "alta") {
          date = todayStr;
        }

        if (date) {
          const isOverdue = !p.completado && date < todayStr;
          unified.push({
            id: `pen-${pId}`,
            source: "pendiente",
            titulo: p.titulo || p.texto || "Tarea pendiente",
            descripcion: p.descripcion || "",
            date,
            time: p.hora || undefined,
            completado: Boolean(p.completado),
            prioridad: p.prioridad || "media",
            categoria: p.categoria || "Pendiente",
            etapas: Array.isArray(p.etapas)
              ? p.etapas.map((e: any, idx: number) => ({
                  id: e.id || `step-${idx}`,
                  titulo: e.titulo || e.texto || "",
                  completado: Boolean(e.completado ?? e.completada),
                }))
              : [],
            isOverdue,
            rawItem: p,
          });
        }
      });

      // 2. Fetch Calendar Events
      try {
        const mongoCal = await fetchCalendarEventsFromMongo();
        if (Array.isArray(mongoCal)) {
          mongoCal.forEach((ev: any) => {
            if (ev.date) {
              unified.push({
                id: `cal-${ev.id || ev.firebaseId || ev._id}`,
                source: "calendario",
                titulo: ev.title || "Evento de Calendario",
                descripcion: ev.description || "",
                date: ev.date,
                time: ev.startTime || "09:00",
                completado: Boolean(ev.completed),
                prioridad: ev.category === "finanzas" ? "alta" : "media",
                categoria: ev.category || "Calendario",
                isOverdue: false,
                rawItem: ev,
              });
            }
          });
        }
      } catch (e) {}

      // 3. Fetch Recordatorios
      try {
        const recList = await fetchRecordatorios();
        if (Array.isArray(recList)) {
          recList.forEach((r) => {
            if (r.fecha) {
              unified.push({
                id: `rec-${r.id}`,
                source: "recordatorio",
                titulo: r.titulo,
                descripcion: r.descripcion,
                date: r.fecha,
                time: r.hora,
                completado: Boolean(r.completado),
                prioridad: r.prioridad || "media",
                categoria: r.categoria || "Recordatorio",
                isOverdue: !r.completado && r.fecha < todayStr,
                rawItem: r,
              });
            }
          });
        }
      } catch (e) {}

      // Deduplicate by title & date if repeated across sources
      const seen = new Set<string>();
      const deduped = unified.filter((item) => {
        const key = `${item.date}_${item.titulo.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setItems(deduped);
      if (isManual) {
        toast.success("Agenda actualizada", "Pendientes y compromisos sincronizados.");
      }
    } catch (err: any) {
      console.error("Error cargando agenda de pendientes:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  // Filter Today Items
  const todayItems = useMemo(() => {
    return items
      .filter((it) => it.date === todayStr || it.isOverdue)
      .sort((a, b) => {
        // Incompleted first
        if (a.completado !== b.completado) return a.completado ? 1 : -1;
        // Overdue first
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        // Priority high first
        const pOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
        return (pOrder[a.prioridad] ?? 1) - (pOrder[b.prioridad] ?? 1);
      });
  }, [items, todayStr]);

  // Filter Tomorrow Items
  const tomorrowItems = useMemo(() => {
    return items
      .filter((it) => it.date === tomorrowStr && !it.isOverdue)
      .sort((a, b) => {
        if (a.completado !== b.completado) return a.completado ? 1 : -1;
        const pOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
        return (pOrder[a.prioridad] ?? 1) - (pOrder[b.prioridad] ?? 1);
      });
  }, [items, tomorrowStr]);

  // Toggle item status
  const handleToggle = async (item: UnifiedAgendaItem) => {
    const nextCompletado = !item.completado;

    // Optimistic state update
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, completado: nextCompletado, isOverdue: false } : it
      )
    );

    if (item.source === "pendiente") {
      const updated = {
        ...item.rawItem,
        completado: nextCompletado,
        completedAt: nextCompletado ? new Date().toISOString() : null,
      };

      try {
        await syncPendienteToMongo(updated);
      } catch (e) {}

      if (!isFirestoreDisabled()) {
        const db = getFirebaseDb();
        const pId = item.rawItem.id || item.rawItem.firebaseId;
        if (db && pId) {
          updateDoc(doc(db, "pendientes", pId), {
            completado: nextCompletado,
            completedAt: updated.completedAt,
          }).catch(handleFirestoreError);
        }
      }
    } else if (item.source === "recordatorio") {
      await toggleRecordatorioStatus(item.rawItem.id, nextCompletado);
    }

    if (nextCompletado) {
      toast.success("Tarea completada", `"${item.titulo}" marcada como realizada.`);
    } else {
      toast.info("Tarea reactivada", `"${item.titulo}" devuelta a pendientes.`);
    }
  };

  // Quick create for Today
  const handleCreateToday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayNewTitle.trim()) return;

    const pendId = `pend-${Date.now()}`;
    const newPendiente = {
      id: pendId,
      firebaseId: pendId,
      titulo: todayNewTitle.trim(),
      descripcion: "",
      prioridad: todayNewPriority,
      categoria: todayNewCategory,
      completado: false,
      creadoPor: "Usuario",
      fechaLimite: todayStr,
      etapas: [],
      createdAt: new Date().toISOString(),
    };

    // Optimistic
    setItems((prev) => [
      {
        id: `pen-${pendId}`,
        source: "pendiente",
        titulo: newPendiente.titulo,
        date: todayStr,
        completado: false,
        prioridad: newPendiente.prioridad,
        categoria: newPendiente.categoria,
        etapas: [],
        rawItem: newPendiente,
      },
      ...prev,
    ]);

    setTodayNewTitle("");
    setIsAddingToday(false);

    try {
      await syncPendienteToMongo(newPendiente);
      if (!isFirestoreDisabled()) {
        const db = getFirebaseDb();
        if (db) setDoc(doc(db, "pendientes", pendId), newPendiente).catch(handleFirestoreError);
      }
      toast.success("Tarea agregada para Hoy", `"${newPendiente.titulo}" agendada.`);
    } catch (err: any) {
      toast.error("Error al guardar", err.message);
    }
  };

  // Quick create for Tomorrow
  const handleCreateTomorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tomorrowNewTitle.trim()) return;

    const pendId = `pend-${Date.now()}`;
    const newPendiente = {
      id: pendId,
      firebaseId: pendId,
      titulo: tomorrowNewTitle.trim(),
      descripcion: "",
      prioridad: tomorrowNewPriority,
      categoria: tomorrowNewCategory,
      completado: false,
      creadoPor: "Usuario",
      fechaLimite: tomorrowStr,
      etapas: [],
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [
      {
        id: `pen-${pendId}`,
        source: "pendiente",
        titulo: newPendiente.titulo,
        date: tomorrowStr,
        completado: false,
        prioridad: newPendiente.prioridad,
        categoria: newPendiente.categoria,
        etapas: [],
        rawItem: newPendiente,
      },
      ...prev,
    ]);

    setTomorrowNewTitle("");
    setIsAddingTomorrow(false);

    try {
      await syncPendienteToMongo(newPendiente);
      if (!isFirestoreDisabled()) {
        const db = getFirebaseDb();
        if (db) setDoc(doc(db, "pendientes", pendId), newPendiente).catch(handleFirestoreError);
      }
      toast.success("Tarea programada para Mañana", `"${newPendiente.titulo}" agendada.`);
    } catch (err: any) {
      toast.error("Error al guardar", err.message);
    }
  };

  const pendingTodayCount = todayItems.filter((i) => !i.completado).length;
  const pendingTomorrowCount = tomorrowItems.filter((i) => !i.completado).length;

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-sm">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              Agenda de Pendientes & Calendario
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 hidden sm:inline">
                Hoy & Mañana
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Vencimientos y tareas conectadas en tiempo real con MongoDB y Calendario
            </p>
          </div>
        </div>

        {/* Global Navigation Links */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadAgenda(true)}
            disabled={refreshing}
            className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors cursor-pointer"
            title="Refrescar agenda"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => router.push("/pendientes")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            <span>Ver Tablero Pendientes</span>
            <ArrowRight className="w-3 h-3 text-indigo-400" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/calendario")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            <span>Ver Calendario</span>
            <ExternalLink className="w-3 h-3 text-purple-400" />
          </button>
        </div>
      </div>

      {/* Two-Column Grid: Hoy & Mañana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLUMN 1: HOY */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-4 sm:p-5 flex flex-col shadow-xl">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>HOY</span>
                  <span className="text-slate-400 font-normal text-xs">• {formatDisplayDate(todayStr, true, false)}</span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  pendingTodayCount > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                }`}
              >
                {pendingTodayCount} {pendingTodayCount === 1 ? "pendiente" : "pendientes"}
              </span>

              <button
                type="button"
                onClick={() => setIsAddingToday((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Agregar tarea para hoy"
              >
                <Plus className="w-3 h-3" />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Quick Add Form Today */}
          <AnimatePresence>
            {isAddingToday && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                onSubmit={handleCreateToday}
                className="mt-3 p-3 rounded-xl bg-white/5 border border-amber-500/30 space-y-2.5 overflow-hidden"
              >
                <input
                  type="text"
                  value={todayNewTitle}
                  onChange={(e) => setTodayNewTitle(e.target.value)}
                  placeholder="¿Qué hay que resolver hoy?"
                  autoFocus
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400">Prioridad:</span>
                    {(["baja", "media", "alta"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTodayNewPriority(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-all ${
                          todayNewPriority === p
                            ? p === "alta"
                              ? "bg-rose-500 text-white"
                              : p === "media"
                              ? "bg-amber-400 text-slate-950"
                              : "bg-emerald-500 text-white"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingToday(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!todayNewTitle.trim()}
                      className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Items List Today */}
          <div className="mt-3.5 space-y-2.5 flex-1 min-h-[140px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                <span className="text-xs">Cargando pendientes de hoy...</span>
              </div>
            ) : todayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                <Sparkles className="w-6 h-6 text-emerald-400 mb-1.5" />
                <p className="text-xs font-bold text-slate-200">¡Todo al día para hoy!</p>
                <p className="text-[11px] text-slate-400 max-w-[240px] mt-0.5">
                  No hay tareas pendientes ni vencimientos registrados para esta jornada.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingToday(true)}
                  className="mt-3 text-xs text-amber-300 hover:text-amber-200 underline font-medium"
                >
                  + Agregar un pendiente para hoy
                </button>
              </div>
            ) : (
              todayItems.map((item) => (
                <div
                  key={item.id}
                  className={`group relative p-3 rounded-xl border transition-all ${
                    item.completado
                      ? "bg-white/[0.02] border-white/5 opacity-60"
                      : item.isOverdue
                      ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50"
                      : "bg-white/[0.04] border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Toggle Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        item.completado
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "border-slate-500 hover:border-amber-400 bg-white/5"
                      }`}
                      title={item.completado ? "Marcar como pendiente" : "Marcar como completada"}
                    >
                      {item.completado && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold break-words ${
                            item.completado ? "line-through text-slate-400" : "text-white"
                          }`}
                        >
                          {item.titulo}
                        </span>

                        {/* Priority / Overdue tag */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.isOverdue && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>ATRASADO</span>
                            </span>
                          )}

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                              item.prioridad === "alta"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                : item.prioridad === "media"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                            }`}
                          >
                            {item.prioridad === "alta" && "🔥 "}
                            {item.prioridad}
                          </span>
                        </div>
                      </div>

                      {item.descripcion && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {item.descripcion}
                        </p>
                      )}

                      {/* Sub-metas / Etapas */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-400">
                        {item.categoria && (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span>{item.categoria}</span>
                          </span>
                        )}

                        {item.time && (
                          <span className="flex items-center gap-1 font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded-md">
                            <Clock className="w-2.5 h-2.5 text-sky-400" />
                            <span>{item.time} hs</span>
                          </span>
                        )}

                        {item.etapas && item.etapas.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Layers className="w-2.5 h-2.5 text-indigo-400" />
                            <span>
                              {item.etapas.filter((e) => e.completado).length}/{item.etapas.length} etapas
                            </span>
                          </span>
                        )}

                        <span className="text-[9px] text-slate-400 font-mono ml-auto">
                          {item.source === "pendiente" ? "📋 Pendiente" : item.source === "calendario" ? "📅 Calendario" : "⏰ Recordatorio"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: MAÑANA */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-4 sm:p-5 flex flex-col shadow-xl">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>MAÑANA</span>
                  <span className="text-slate-400 font-normal text-xs">• {formatDisplayDate(tomorrowStr, false, true)}</span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  pendingTomorrowCount > 0
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                }`}
              >
                {pendingTomorrowCount} {pendingTomorrowCount === 1 ? "programado" : "programados"}
              </span>

              <button
                type="button"
                onClick={() => setIsAddingTomorrow((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Programar tarea para mañana"
              >
                <Plus className="w-3 h-3" />
                <span>Programar</span>
              </button>
            </div>
          </div>

          {/* Quick Add Form Tomorrow */}
          <AnimatePresence>
            {isAddingTomorrow && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                onSubmit={handleCreateTomorrow}
                className="mt-3 p-3 rounded-xl bg-white/5 border border-indigo-500/30 space-y-2.5 overflow-hidden"
              >
                <input
                  type="text"
                  value={tomorrowNewTitle}
                  onChange={(e) => setTomorrowNewTitle(e.target.value)}
                  placeholder="¿Qué tarea programar para mañana?"
                  autoFocus
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400">Prioridad:</span>
                    {(["baja", "media", "alta"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTomorrowNewPriority(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-all ${
                          tomorrowNewPriority === p
                            ? p === "alta"
                              ? "bg-rose-500 text-white"
                              : p === "media"
                              ? "bg-indigo-400 text-slate-950"
                              : "bg-emerald-500 text-white"
                            : "bg-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingTomorrow(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!tomorrowNewTitle.trim()}
                      className="px-3 py-1 bg-indigo-400 hover:bg-indigo-300 text-slate-950 font-bold rounded-lg text-xs disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Items List Tomorrow */}
          <div className="mt-3.5 space-y-2.5 flex-1 min-h-[140px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-xs">Cargando compromisos de mañana...</span>
              </div>
            ) : tomorrowItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                <Calendar className="w-6 h-6 text-indigo-400 mb-1.5" />
                <p className="text-xs font-bold text-slate-200">Mañana despejado</p>
                <p className="text-[11px] text-slate-400 max-w-[240px] mt-0.5">
                  No hay compromisos ni tareas asignadas para mañana todavía.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingTomorrow(true)}
                  className="mt-3 text-xs text-indigo-300 hover:text-indigo-200 underline font-medium"
                >
                  + Programar tarea para mañana
                </button>
              </div>
            ) : (
              tomorrowItems.map((item) => (
                <div
                  key={item.id}
                  className={`group relative p-3 rounded-xl border transition-all ${
                    item.completado
                      ? "bg-white/[0.02] border-white/5 opacity-60"
                      : "bg-white/[0.04] border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Toggle Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        item.completado
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "border-slate-500 hover:border-indigo-400 bg-white/5"
                      }`}
                      title={item.completado ? "Marcar como pendiente" : "Marcar como completada"}
                    >
                      {item.completado && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold break-words ${
                            item.completado ? "line-through text-slate-400" : "text-white"
                          }`}
                        >
                          {item.titulo}
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border flex-shrink-0 ${
                            item.prioridad === "alta"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : item.prioridad === "media"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                          }`}
                        >
                          {item.prioridad}
                        </span>
                      </div>

                      {item.descripcion && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {item.descripcion}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-400">
                        {item.categoria && (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span>{item.categoria}</span>
                          </span>
                        )}

                        {item.time && (
                          <span className="flex items-center gap-1 font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded-md">
                            <Clock className="w-2.5 h-2.5 text-sky-400" />
                            <span>{item.time} hs</span>
                          </span>
                        )}

                        {item.etapas && item.etapas.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Layers className="w-2.5 h-2.5 text-indigo-400" />
                            <span>
                              {item.etapas.filter((e) => e.completado).length}/{item.etapas.length} etapas
                            </span>
                          </span>
                        )}

                        <span className="text-[9px] text-slate-400 font-mono ml-auto">
                          {item.source === "pendiente" ? "📋 Pendiente" : item.source === "calendario" ? "📅 Calendario" : "⏰ Recordatorio"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
