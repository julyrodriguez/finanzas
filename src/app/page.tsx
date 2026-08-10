"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2, 
  X, 
  AlertCircle, 
  Check, 
  Sparkles,
  Info
} from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc
} from "firebase/firestore";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  category: "finanzas" | "reunion" | "operaciones" | "personal";
}

const CATEGORY_STYLES = {
  finanzas: {
    bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    label: "Finanzas",
  },
  reunion: {
    bg: "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20",
    dot: "bg-sky-400",
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    label: "Reunión",
  },
  operaciones: {
    bg: "bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20",
    dot: "bg-violet-400",
    badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    label: "Operaciones",
  },
  personal: {
    bg: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20",
    dot: "bg-amber-400",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/20",
    label: "Personal",
  },
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8:00 to 22:00

export default function CalendarioPage() {
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formCategory, setFormCategory] = useState<"finanzas" | "reunion" | "operaciones" | "personal">("finanzas");
  const [formError, setFormError] = useState<string | null>(null);

  // Success toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Initial Load of Events (Firestore real-time listener + LocalStorage fallback)
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      // LocalStorage Fallback
      const saved = localStorage.getItem("finanzas-calendar-events");
      if (saved) {
        try {
          const parsedEvents = JSON.parse(saved);
          setTimeout(() => {
            setEvents(parsedEvents);
          }, 0);
        } catch (error) {
          console.error("Error parsing saved events:", error);
        }
      } else {
        setTimeout(() => {
          setEvents([]);
        }, 0);
      }
      return;
    }

    // Firestore Listener
    const colRef = collection(db, "calendar_events");
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: CalendarEvent[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || "",
            description: data.description || "",
            date: data.date || "",
            startTime: data.startTime || "",
            endTime: data.endTime || "",
            category: data.category || "finanzas",
          };
        });

        setTimeout(() => {
          setEvents(docs);
        }, 0);
      },
      (error) => {
        console.error("Firestore loading error, using local fallback:", error);
        const saved = localStorage.getItem("finanzas-calendar-events");
        if (saved) {
          try {
            const parsedEvents = JSON.parse(saved);
            setTimeout(() => {
              setEvents(parsedEvents);
            }, 0);
          } catch (err) {
            console.error("Error parsing saved events on fallback:", err);
          }
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Navigation Helpers
  const handlePrev = () => {
    if (viewMode === "month") {
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      setCurrentDate(prevMonth);
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      setCurrentDate(nextMonth);
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // 3. Modal Form Helpers
  const openAddModal = (dateStr?: string, defaultHour?: number) => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDescription("");
    
    // Date fallback
    if (dateStr) {
      setFormDate(dateStr);
    } else {
      setFormDate(selectedDate.toISOString().split("T")[0]);
    }

    // Time fallback
    if (defaultHour !== undefined) {
      const hourStr = defaultHour.toString().padStart(2, "0");
      setFormStartTime(`${hourStr}:00`);
      setFormEndTime(`${(defaultHour + 1).toString().padStart(2, "0")}:00`);
    } else {
      setFormStartTime("09:00");
      setFormEndTime("10:00");
    }
    
    setFormCategory("finanzas");
    setFormError(null);
    setShowEventModal(true);
  };

  const openEditModal = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering day/slot click
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || "");
    setFormDate(event.date);
    setFormStartTime(event.startTime);
    setFormEndTime(event.endTime);
    setFormCategory(event.category);
    setFormError(null);
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError("El título es obligatorio.");
      return;
    }

    // Validate times
    if (formStartTime >= formEndTime) {
      setFormError("La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }

    const eventId = editingEvent ? editingEvent.id : `evt-${Date.now()}`;
    const eventData = {
      title: formTitle.trim(),
      description: formDescription.trim() || "",
      date: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      category: formCategory,
    };

    const db = getFirebaseDb();
    if (db) {
      try {
        await setDoc(doc(db, "calendar_events", eventId), eventData);
        showToast(editingEvent ? "📝 Evento guardado en BD" : "➕ Evento creado en BD");
      } catch (err) {
        console.error("Error saving event to Firestore:", err);
        setFormError("Error al guardar el evento en la base de datos.");
        return;
      }
    } else {
      // LocalStorage Fallback
      const newLocalEvent: CalendarEvent = { id: eventId, ...eventData };
      let updatedEvents: CalendarEvent[];
      if (editingEvent) {
        updatedEvents = events.map(e => e.id === editingEvent.id ? newLocalEvent : e);
        showToast("📝 Evento modificado localmente");
      } else {
        updatedEvents = [...events, newLocalEvent];
        showToast("➕ Evento añadido localmente");
      }
      setEvents(updatedEvents);
      localStorage.setItem("finanzas-calendar-events", JSON.stringify(updatedEvents));
    }

    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;

    const db = getFirebaseDb();
    if (db) {
      try {
        await deleteDoc(doc(db, "calendar_events", editingEvent.id));
        showToast("🗑️ Evento eliminado de BD");
      } catch (err) {
        console.error("Error deleting event from Firestore:", err);
        setFormError("Error al eliminar el evento de la base de datos.");
        return;
      }
    } else {
      // LocalStorage Fallback
      const updatedEvents = events.filter(e => e.id !== editingEvent.id);
      setEvents(updatedEvents);
      localStorage.setItem("finanzas-calendar-events", JSON.stringify(updatedEvents));
      showToast("🗑️ Evento eliminado localmente");
    }

    setShowEventModal(false);
    setEditingEvent(null);
  };

  // 4. Date Math for Month View
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    // Shift so Monday is 0, Sunday is 6
    const startDayOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const dayCells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Previous month padding
    for (let i = startDayOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthTotalDays - i);
      dayCells.push({
        date: d,
        isCurrentMonth: false,
        key: `prev-${prevMonthTotalDays - i}`,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      dayCells.push({
        date: d,
        isCurrentMonth: true,
        key: `curr-${i}`,
      });
    }

    // Next month padding (total cells must be multiple of 7, usually 35 or 42)
    const totalCells = dayCells.length;
    const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= nextMonthPadding; i++) {
      const d = new Date(year, month + 1, i);
      dayCells.push({
        date: d,
        isCurrentMonth: false,
        key: `next-${i}`,
      });
    }

    return dayCells;
  };

  // 5. Date Math for Week View
  const getDaysInWeek = () => {
    // Shift so Monday is 0, Sunday is 6
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    
    // Get Monday of current week
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() - dayOfWeek);

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push(d);
    }
    return weekDays;
  };

  // Helpers for checking dates
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getFormattedDateStr = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = getFormattedDateStr(date);
    return events
      .filter(e => e.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // Get localized names
  const getMonthName = () => {
    return currentDate.toLocaleString("es-AR", { month: "long", year: "numeric" });
  };

  const getWeekRangeName = (weekDays: Date[]) => {
    if (weekDays.length === 0) return "";
    const start = weekDays[0];
    const end = weekDays[6];

    const formatDay = (d: Date) => d.toLocaleString("es-AR", { day: "numeric", month: "short" });
    const formatYear = (d: Date) => d.toLocaleString("es-AR", { year: "numeric" });

    if (start.getFullYear() !== end.getFullYear()) {
      return `Semana: ${formatDay(start)} ${formatYear(start)} - ${formatDay(end)} ${formatYear(end)}`;
    }
    return `Semana: ${formatDay(start)} - ${formatDay(end)} (${formatYear(start)})`;
  };

  const weekDays = getDaysInWeek();
  const monthDays = getDaysInMonth();
  const selectedDayEvents = getEventsForDate(selectedDate);

  return (
    <AppLayout 
      title="Calendario Operativo" 
      subtitle="Planifica tus tareas, reuniones y prorrateos de gastos"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0d131f] border border-emerald-500/30 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold text-emerald-400 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="space-y-6">
        {/* 1. Header Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0d131f] p-4 rounded-3xl border border-white/10 shadow-lg">
          {/* Month/Week Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleToday}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 transition-colors"
            >
              Hoy
            </button>

            <button
              onClick={handleNext}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <h2 className="ml-2 font-bold text-sm sm:text-base text-white capitalize tracking-wide">
              {viewMode === "month" ? getMonthName() : getWeekRangeName(weekDays)}
            </h2>
          </div>

          {/* View Toggles & Add Event */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Monthly / Weekly toggle */}
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl gap-1">
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "month"
                    ? "bg-emerald-500 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "week"
                    ? "bg-emerald-500 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Semanal
              </button>
            </div>

            {/* "+ Nuevo" Button */}
            <button
              onClick={() => openAddModal()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Evento</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>

        {/* 2. Calendar Views Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Main Grid: Left 3/4 on large screens */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* MONTH VIEW */}
            {viewMode === "month" && (
              <div className="rounded-3xl glass-card border border-white/10 overflow-hidden shadow-2xl">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 bg-white/5 border-b border-white/10 text-center font-bold text-gray-400 py-3 text-xs uppercase tracking-wider">
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mié</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sáb</div>
                  <div>Dom</div>
                </div>

                {/* Day cells grid */}
                <div className="grid grid-cols-7 grid-rows-6 auto-rows-fr min-h-[320px] md:min-h-[550px] divide-x divide-y divide-white/5 bg-[#090d16]/30">
                  {monthDays.map((cell) => {
                    const isSelected = isSameDay(cell.date, selectedDate);
                    const isToday = isSameDay(cell.date, new Date());
                    const dayEvents = getEventsForDate(cell.date);

                    return (
                      <div
                        key={cell.key}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`p-1.5 md:p-2 transition-all cursor-pointer relative min-h-[50px] md:min-h-[90px] flex flex-col justify-between ${
                          cell.isCurrentMonth ? "text-white" : "text-gray-600 bg-white/[0.01]"
                        } ${
                          isSelected ? "bg-emerald-500/5 ring-1 ring-emerald-500/30" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        {/* Day Number */}
                        <div className="flex justify-between items-center mb-1">
                          <span
                            className={`flex items-center justify-center text-[11px] md:text-xs font-bold w-5 h-5 md:w-6 md:h-6 rounded-lg ${
                              isToday
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                : cell.isCurrentMonth
                                ? "text-gray-200"
                                : "text-gray-600"
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>

                          {/* "+" quick add link shown on hover (Desktop only) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddModal(getFormattedDateStr(cell.date));
                            }}
                            className="hidden md:inline-flex opacity-0 hover:opacity-100 group-hover:opacity-100 p-0.5 rounded bg-white/5 text-gray-400 hover:text-white hover:bg-emerald-500/20 transition-all text-[10px]"
                            title="Añadir evento en este día"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Event dot indicators (Mobile only, replaces text list) */}
                        {dayEvents.length > 0 && (
                          <div className="flex md:hidden justify-center gap-0.5 mt-0.5 pb-0.5">
                            {dayEvents.slice(0, 3).map((evt) => {
                              const styles = CATEGORY_STYLES[evt.category] || CATEGORY_STYLES.finanzas;
                              return (
                                <span key={evt.id} className={`w-1 h-1 rounded-full ${styles.dot}`} />
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <span className="w-1 h-1 rounded-full bg-gray-400" />
                            )}
                          </div>
                        )}

                        {/* Events list inside day cell (Desktop only) */}
                        <div className="hidden md:flex flex-1 flex-col gap-1 overflow-hidden">
                          {dayEvents.slice(0, 3).map((event) => {
                            const styles = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.finanzas;
                            return (
                              <div
                                key={event.id}
                                onClick={(e) => openEditModal(event, e)}
                                className={`text-[10px] px-2 py-0.5 rounded border font-semibold truncate ${styles.bg}`}
                                title={`${event.startTime} - ${event.title}`}
                              >
                                {event.startTime} {event.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px] text-gray-500 font-bold pl-1">
                              + {dayEvents.length - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEEK TIMELINE VIEW */}
            {viewMode === "week" && (
              <div className="rounded-3xl glass-card border border-white/10 overflow-hidden shadow-2xl bg-[#090d16]/20">
                
                {/* 2.1 Desktop Week View (7 columns side-by-side) */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[700px] flex flex-col">
                    
                    {/* Header Columns */}
                    <div className="flex border-b border-white/10 bg-white/5">
                      {/* Empty corner for Hours label */}
                      <div className="w-16 flex-shrink-0 border-r border-white/10 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">
                        Hora
                      </div>
                      
                      {/* Weekday labels */}
                      {weekDays.map((day) => {
                        const isToday = isSameDay(day, new Date());
                        const isSelected = isSameDay(day, selectedDate);
                        
                        return (
                          <div
                            key={day.toString()}
                            onClick={() => setSelectedDate(day)}
                            className={`flex-1 py-3 text-center cursor-pointer border-r border-white/5 transition-colors ${
                              isSelected ? "bg-emerald-500/5" : "hover:bg-white/[0.01]"
                            }`}
                          >
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              {day.toLocaleString("es-AR", { weekday: "short" })}
                            </span>
                            <span
                              className={`inline-flex items-center justify-center font-bold text-sm w-7 h-7 rounded-lg mt-1 ${
                                isToday
                                  ? "bg-emerald-500 text-white shadow-lg"
                                  : "text-white"
                              }`}
                            >
                              {day.getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Timeline Body (Hour Rows + Absolute Event overlay) */}
                    <div className="relative flex" style={{ height: "600px" }}>
                      
                      {/* Hours Y-Axis sidebar */}
                      <div className="w-16 flex-shrink-0 border-r border-white/10 bg-white/[0.01] flex flex-col justify-between text-right pr-2 text-[10px] font-mono text-gray-500 py-1">
                        {HOURS.map((hour) => (
                          <div key={hour} style={{ height: `${600 / HOURS.length}px` }} className="flex items-start justify-end pt-1">
                            {hour.toString().padStart(2, "0")}:00
                          </div>
                        ))}
                      </div>

                      {/* Day Columns containing grid lines and events */}
                      <div className="flex-1 flex relative divide-x divide-white/5">
                        
                        {/* Background Grid Lines (Horizontal hour spans) */}
                        <div className="absolute inset-0 flex flex-col pointer-events-none divide-y divide-white/5">
                          {HOURS.map((hour) => (
                            <div key={hour} style={{ height: `${600 / HOURS.length}px` }} />
                          ))}
                        </div>

                        {/* Event placing columns */}
                        {weekDays.map((day) => {
                          const dateStr = getFormattedDateStr(day);
                          const dayEvents = getEventsForDate(day);
                          const isSelected = isSameDay(day, selectedDate);

                          return (
                            <div
                              key={day.toString()}
                              className={`flex-1 relative h-full transition-colors ${
                                isSelected ? "bg-emerald-500/[0.01]" : ""
                              }`}
                              // Click empty space in timeline to create an event at that day/hour!
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickY = e.clientY - rect.top;
                                const percentY = clickY / rect.height;
                                const clickedHourDecimal = 8 + percentY * 14;
                                const roundedHour = Math.floor(clickedHourDecimal);
                                openAddModal(dateStr, Math.min(21, Math.max(8, roundedHour)));
                              }}
                            >
                              {/* Render events inside this day column */}
                              {dayEvents.map((event) => {
                                const [sH, sM] = event.startTime.split(":").map(Number);
                                const [eH, eM] = event.endTime.split(":").map(Number);
                                const startDec = sH + sM / 60;
                                const endDec = eH + eM / 60;
                                
                                const timelineStart = 8;
                                const timelineEnd = 22;
                                
                                if (startDec >= timelineEnd || endDec <= timelineStart) {
                                  return null;
                                }
                                
                                const startClamped = Math.max(timelineStart, startDec);
                                const endClamped = Math.min(timelineEnd, endDec);
                                
                                const topPercent = ((startClamped - timelineStart) / (timelineEnd - timelineStart)) * 100;
                                const heightPercent = ((endClamped - startClamped) / (timelineEnd - timelineStart)) * 100;
                                
                                const styles = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.finanzas;

                                return (
                                  <div
                                    key={event.id}
                                    onClick={(e) => openEditModal(event, e)}
                                    style={{
                                      top: `${topPercent}%`,
                                      height: `${heightPercent}%`,
                                      width: "92%",
                                      left: "4%",
                                    }}
                                    className={`absolute rounded-xl border p-2 flex flex-col justify-between text-left overflow-hidden cursor-pointer shadow-lg transition-all hover:scale-[1.02] hover:z-20 ${styles.bg}`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1 text-[9px] font-bold opacity-80 font-mono">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{event.startTime} - {event.endTime}</span>
                                      </div>
                                      <h4 className="text-[11px] font-bold leading-tight truncate">
                                        {event.title}
                                      </h4>
                                    </div>
                                    
                                    <div className="flex items-center mt-1">
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${styles.badge}`}>
                                        {styles.label}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                </div>

                {/* 2.2 Mobile Single-Day Timeline View (Slide selector at top + wide column below) */}
                <div className="block md:hidden w-full flex flex-col">
                  {/* Horizontal week slider tabs */}
                  <div className="flex bg-white/5 border-b border-white/10 p-2 gap-1 overflow-x-auto justify-between">
                    {weekDays.map((day) => {
                      const isToday = isSameDay(day, new Date());
                      const isSelected = isSameDay(day, selectedDate);
                      return (
                        <button
                          key={day.toString()}
                          onClick={() => setSelectedDate(day)}
                          className={`flex-1 min-w-[46px] py-2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-bold shadow-lg"
                              : "bg-white/[0.02] border border-white/5 text-gray-400 hover:text-white"
                          }`}
                        >
                          <span className="text-[8px] uppercase font-bold tracking-wider">
                            {day.toLocaleString("es-AR", { weekday: "short" })}
                          </span>
                          <span className={`text-sm font-extrabold mt-0.5 ${isToday && !isSelected ? "text-emerald-400" : ""}`}>
                            {day.getDate()}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Single Column Hourly Grid */}
                  <div className="relative flex" style={{ height: "550px" }}>
                    
                    {/* Hours Y-Axis sidebar */}
                    <div className="w-14 flex-shrink-0 border-r border-white/10 bg-white/[0.01] flex flex-col justify-between text-right pr-2 text-[10px] font-mono text-gray-500 py-1">
                      {HOURS.map((hour) => (
                        <div key={hour} style={{ height: `${550 / HOURS.length}px` }} className="flex items-start justify-end pt-1">
                          {hour.toString().padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>

                    {/* Single column area containing events for selectedDate only */}
                    <div
                      className="flex-1 relative h-full bg-[#0d131f]/20"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const percentY = clickY / rect.height;
                        const clickedHourDecimal = 8 + percentY * 14;
                        const roundedHour = Math.floor(clickedHourDecimal);
                        openAddModal(getFormattedDateStr(selectedDate), Math.min(21, Math.max(8, roundedHour)));
                      }}
                    >
                      {/* Background Grid Lines (Horizontal hour spans) */}
                      <div className="absolute inset-0 flex flex-col pointer-events-none divide-y divide-white/5">
                        {HOURS.map((hour) => (
                          <div key={hour} style={{ height: `${550 / HOURS.length}px` }} />
                        ))}
                      </div>

                      {/* Render events for selected day only */}
                      {getEventsForDate(selectedDate).map((event) => {
                        const [sH, sM] = event.startTime.split(":").map(Number);
                        const [eH, eM] = event.endTime.split(":").map(Number);
                        const startDec = sH + sM / 60;
                        const endDec = eH + eM / 60;
                        
                        const timelineStart = 8;
                        const timelineEnd = 22;
                        
                        if (startDec >= timelineEnd || endDec <= timelineStart) {
                          return null;
                        }
                        
                        const startClamped = Math.max(timelineStart, startDec);
                        const endClamped = Math.min(timelineEnd, endDec);
                        
                        const topPercent = ((startClamped - timelineStart) / (timelineEnd - timelineStart)) * 100;
                        const heightPercent = ((endClamped - startClamped) / (timelineEnd - timelineStart)) * 100;
                        
                        const styles = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.finanzas;

                        return (
                          <div
                            key={event.id}
                            onClick={(e) => openEditModal(event, e)}
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                              width: "94%",
                              left: "3%",
                            }}
                            className={`absolute rounded-xl border p-2 flex flex-col justify-between text-left overflow-hidden cursor-pointer shadow-lg transition-all ${styles.bg}`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-[9px] font-bold opacity-85 font-mono">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{event.startTime} - {event.endTime}</span>
                              </div>
                              <h4 className="text-[11px] font-bold leading-tight">
                                {event.title}
                              </h4>
                              {event.description && (
                                <p className="text-[9px] text-gray-400 line-clamp-1 leading-normal">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center mt-1">
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${styles.badge}`}>
                                {styles.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Sidebar / Detailed Events panel: Right 1/4 on large screens */}
          <div className="xl:col-span-1 space-y-6">
            
            {/* Selected day summary card */}
            <div className="p-5 rounded-3xl glass-card border border-white/10 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-extrabold text-white">Eventos del Día</h3>
                  <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                    {selectedDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
              </div>

              {/* Day's events listing */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {selectedDayEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 space-y-2">
                    <Info className="w-8 h-8 mx-auto text-gray-600 opacity-60" />
                    <p className="text-xs">No hay eventos planificados para este día.</p>
                    <button
                      onClick={() => openAddModal(getFormattedDateStr(selectedDate))}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition-colors underline"
                    >
                      Añadir uno ahora
                    </button>
                  </div>
                ) : (
                  selectedDayEvents.map((event) => {
                    const styles = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.finanzas;
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => openEditModal(event, e)}
                        className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                            {event.title}
                          </h4>
                          <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${styles.dot}`} />
                        </div>
                        
                        {event.description && (
                          <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">
                            {event.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[9px] text-gray-500 font-bold font-mono pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-400/80" />
                            {event.startTime} - {event.endTime}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border uppercase ${styles.badge}`}>
                            {styles.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add event specifically for this day */}
              {selectedDayEvents.length > 0 && (
                <button
                  onClick={() => openAddModal(getFormattedDateStr(selectedDate))}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Evento</span>
                </button>
              )}
            </div>

            {/* Help guidelines widget */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-400 space-y-2.5 shadow-md">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Tips del Calendario</span>
              </span>
              <ul className="list-disc list-inside space-y-1.5 text-[11px]">
                <li>Haga clic en cualquier día del mes para ver sus eventos en este panel.</li>
                <li>En la vista **Semanal**, haga clic directo sobre cualquier bloque horario libre para crear un evento allí.</li>
                <li>Edite o elimine haciendo clic en el evento correspondiente.</li>
                <li>Los datos se guardan de manera local y automática.</li>
              </ul>
            </div>

          </div>
        </div>

      </div>

      {/* 3. EVENT CREATION/EDIT MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-card border border-white/10 shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                <span>{editingEvent ? "Modificar Evento" : "Crear Nuevo Evento"}</span>
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error alerts */}
            {formError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveEvent} className="space-y-4">
              
              {/* Event Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Título del Evento</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="ej: Cerrar conciliación bancaria"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  maxLength={50}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50 bg-[#0d131f]"
                />
              </div>

              {/* Start & End Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50 bg-[#0d131f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Hora Fin</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50 bg-[#0d131f]"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Categoría</label>
                <select
                  value={formCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormCategory(e.target.value as "finanzas" | "reunion" | "operaciones" | "personal")}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/50 bg-[#0d131f]"
                >
                  <option value="finanzas" className="bg-[#0d131f] text-white">Finanzas (Verde)</option>
                  <option value="reunion" className="bg-[#0d131f] text-white">Reunión (Azul)</option>
                  <option value="operaciones" className="bg-[#0d131f] text-white">Operaciones (Morado)</option>
                  <option value="personal" className="bg-[#0d131f] text-white">Personal (Naranja)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Descripción (Opcional)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalles del evento..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none"
                  maxLength={200}
                />
              </div>

              {/* Footer actions */}
              <div className="flex gap-2 pt-2 border-t border-white/5">
                {editingEvent && (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                    title="Eliminar Evento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                )}

                <div className="flex-1 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Guardar
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
