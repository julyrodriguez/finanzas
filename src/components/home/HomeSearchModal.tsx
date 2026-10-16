"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Loader2,
  Scale,
  ClipboardList,
  AlertCircle,
  Calendar,
  Briefcase,
  Building2,
  Copy,
  Check,
  Calculator,
  Percent,
  Moon,
  Sparkles,
  ArrowRight,
  Command,
  Star,
} from "lucide-react";
import { EyeTrackerCube } from "./EyeTrackerCube";
import {
  fetchCotizacionesFromMongo,
  fetchPendientesFromMongo,
  fetchProveedoresFromMongo,
  fetchCalendarEventsFromMongo,
} from "@/lib/serverSync";
import { useTheme } from "@/context/ThemeContext";
import { toast } from "@/context/ToastContext";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface SolomonComplexItem {
  cadena: "Cinemark" | "Hoyts" | "Corporativo";
  complejo: string;
  cuenta: string;
  solomon: string;
  salas: number;
}

export const SOLOMON_COMPLEXES: SolomonComplexItem[] = [
  { cadena: "Cinemark", complejo: "Adrogué", cuenta: "601", solomon: "601-00000000000000000", salas: 6 },
  { cadena: "Cinemark", complejo: "Puerto Madero", cuenta: "602", solomon: "602-00000000000000000", salas: 8 },
  { cadena: "Cinemark", complejo: "Caballito", cuenta: "603", solomon: "603-00000000000000000", salas: 6 },
  { cadena: "Cinemark", complejo: "Mendoza", cuenta: "604", solomon: "604-00000000000000000", salas: 10 },
  { cadena: "Cinemark", complejo: "Santa Fe", cuenta: "605", solomon: "605-00000000000000000", salas: 7 },
  { cadena: "Cinemark", complejo: "Malvinas Argentinas", cuenta: "606", solomon: "606-00000000000000000", salas: 10 },
  { cadena: "Cinemark", complejo: "Palermo", cuenta: "607", solomon: "607-00000000000000000", salas: 11 },
  { cadena: "Cinemark", complejo: "San Justo", cuenta: "608", solomon: "608-00000000000000000", salas: 6 },
  { cadena: "Cinemark", complejo: "Tortugas", cuenta: "609", solomon: "609-00000000000000000", salas: 12 },
  { cadena: "Cinemark", complejo: "Soleil", cuenta: "610", solomon: "610-00000000000000000", salas: 8 },
  { cadena: "Cinemark", complejo: "Salta", cuenta: "612", solomon: "612-00000000000000000", salas: 5 },
  { cadena: "Cinemark", complejo: "Neuquén", cuenta: "613", solomon: "613-00000000000000000", salas: 6 },
  { cadena: "Hoyts", complejo: "Abasto", cuenta: "701", solomon: "701-00000000000000000", salas: 12 },
  { cadena: "Hoyts", complejo: "Unicenter", cuenta: "702", solomon: "702-00000000000000000", salas: 15 },
  { cadena: "Hoyts", complejo: "Morón", cuenta: "703", solomon: "703-00000000000000000", salas: 8 },
  { cadena: "Hoyts", complejo: "Temperley", cuenta: "704", solomon: "704-00000000000000000", salas: 9 },
  { cadena: "Hoyts", complejo: "Quilmes", cuenta: "705", solomon: "705-00000000000000000", salas: 10 },
  { cadena: "Hoyts", complejo: "Patio Olmos", cuenta: "706", solomon: "706-00000000000000000", salas: 7 },
  { cadena: "Hoyts", complejo: "Nuevocentro", cuenta: "707", solomon: "707-00000000000000000", salas: 5 },
  { cadena: "Hoyts", complejo: "Salta Hoyts", cuenta: "708", solomon: "708-00000000000000000", salas: 8 },
  { cadena: "Hoyts", complejo: "DOT", cuenta: "709", solomon: "709-00000000000000000", salas: 10 },
  { cadena: "Hoyts", complejo: "Moreno", cuenta: "710", solomon: "710-00000000000000000", salas: 6 },
  { cadena: "Hoyts", complejo: "Rosario", cuenta: "711", solomon: "711-00000000000000000", salas: 10 },
  { cadena: "Corporativo", complejo: "Oficina Central", cuenta: "001", solomon: "001-00000000000000000", salas: 0 },
];

interface HomeSearchModalProps {
  isOpen: boolean;
  initialQuery?: string;
  isSubModalOpen?: boolean;
  openedByShortcut?: boolean;
  onClose: () => void;
  onSelectOC?: (orden: any) => void;
  onSelectCotizacion?: (quote: any) => void;
}

export function HomeSearchModal({
  isOpen,
  initialQuery = "",
  isSubModalOpen = false,
  openedByShortcut = false,
  onClose,
  onSelectCotizacion,
}: HomeSearchModalProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [resultsCotizaciones, setResultsCotizaciones] = useState<any[]>([]);
  const [resultsPendientes, setResultsPendientes] = useState<any[]>([]);
  const [resultsProveedores, setResultsProveedores] = useState<any[]>([]);
  const [resultsCalendario, setResultsCalendario] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanQ = query.trim();

  const matchingSolomon = useMemo(() => {
    if (!cleanQ) return [];
    const q = cleanQ.toLowerCase();
    return SOLOMON_COMPLEXES.filter(
      (c) =>
        c.complejo.toLowerCase().includes(q) ||
        c.cuenta.toLowerCase().includes(q) ||
        c.solomon.toLowerCase().includes(q) ||
        c.cadena.toLowerCase().includes(q) ||
        q === "solomon" ||
        q === "complejos" ||
        q === "cines"
    ).slice(0, 8);
  }, [cleanQ]);

  const handleCopyText = (text: string, label: string, key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    toast.success(`${label} copiado`, text);
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
  };

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || "");
      setResultsCotizaciones([]);
      setResultsPendientes([]);
      setResultsProveedores([]);
      setResultsCalendario([]);
      setHasSearched(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubModalOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubModalOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!cleanQ) {
      setResultsCotizaciones([]);
      setResultsPendientes([]);
      setResultsProveedores([]);
      setResultsCalendario([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchWord = cleanQ.toLowerCase();

        const [resQuotes, resPendientes, resProveedores, resCalendar] = await Promise.allSettled([
          fetchCotizacionesFromMongo(),
          fetchPendientesFromMongo(),
          fetchProveedoresFromMongo(),
          fetchCalendarEventsFromMongo(),
        ]);

        if (resQuotes.status === "fulfilled" && Array.isArray(resQuotes.value)) {
          const filteredQuotes = resQuotes.value.filter((q: any) => {
            const nameMatch = q.name?.toLowerCase().includes(searchWord);
            const provMatch = Array.isArray(q.providers) && q.providers.some((p: any) => p.name?.toLowerCase().includes(searchWord));
            const itemMatch = Array.isArray(q.items) && q.items.some((it: any) => it.name?.toLowerCase().includes(searchWord));
            const noteMatch = q.notes?.toLowerCase().includes(searchWord);
            return nameMatch || provMatch || itemMatch || noteMatch;
          });
          setResultsCotizaciones(filteredQuotes.slice(0, 10));
        } else {
          setResultsCotizaciones([]);
        }

        if (resProveedores.status === "fulfilled" && Array.isArray(resProveedores.value)) {
          const filteredProvs = resProveedores.value.filter((p: any) => {
            const nMatch = p.nombre?.toLowerCase().includes(searchWord);
            const rMatch = p.rubro?.toLowerCase().includes(searchWord);
            const eMatch = Array.isArray(p.emails) && p.emails.some((e: string) => e.toLowerCase().includes(searchWord));
            const uMatch = p.ubicacion?.toLowerCase().includes(searchWord);
            return nMatch || rMatch || eMatch || uMatch;
          });
          setResultsProveedores(filteredProvs.slice(0, 8));
        } else {
          setResultsProveedores([]);
        }

        if (resPendientes.status === "fulfilled" && resPendientes.value?.pendientes) {
          const list = resPendientes.value.pendientes;
          const filtered = list.filter((p: any) => {
            const textMatch = p.texto?.toLowerCase().includes(searchWord) || p.descripcion?.toLowerCase().includes(searchWord);
            const catMatch = p.categoria?.toLowerCase().includes(searchWord);
            const tagMatch = Array.isArray(p.tags) && p.tags.some((t: any) => String(t).toLowerCase().includes(searchWord));
            return textMatch || catMatch || tagMatch;
          });
          setResultsPendientes(filtered.slice(0, 8));
        } else {
          setResultsPendientes([]);
        }

        if (resCalendar.status === "fulfilled" && Array.isArray(resCalendar.value)) {
          const filteredEvents = resCalendar.value.filter((ev: any) => {
            return (
              ev.title?.toLowerCase().includes(searchWord) ||
              ev.notes?.toLowerCase().includes(searchWord) ||
              ev.date?.includes(searchWord)
            );
          });
          setResultsCalendario(filteredEvents.slice(0, 6));
        } else {
          setResultsCalendario([]);
        }
      } catch (err) {
        console.warn("Error en búsqueda:", err);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 180);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [cleanQ, isOpen]);

  const totalResults =
    resultsCotizaciones.length +
    resultsPendientes.length +
    resultsProveedores.length +
    resultsCalendario.length +
    matchingSolomon.length;

  const quickActions = [
    { label: "Ir a Cotizaciones & Comparador", href: "/cotizaciones", icon: Scale, color: "text-emerald-400" },
    { label: "Directorio de Proveedores IA", href: "/proveedores", icon: Briefcase, color: "text-indigo-400" },
    { label: "Distribución & Cuentas Solomon", href: "/distribucion", icon: Percent, color: "text-blue-400" },
    { label: "Tareas Pendientes", href: "/pendientes", icon: ClipboardList, color: "text-amber-400" },
    { label: "Calendario Operativo", href: "/calendario", icon: Calendar, color: "text-purple-400" },
    { label: "Calculadora Comercial & IVA", href: "/calculadora", icon: Calculator, color: "text-cyan-400" },
  ];

  const handleSelectQuote = (quote: any) => {
    if (onSelectCotizacion) {
      onSelectCotizacion(quote);
    } else {
      onClose();
      router.push("/cotizaciones");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          {/* Backdrop */}
          <motion.div
            initial={openedByShortcut ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: openedByShortcut ? 0 : 0.15 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={!isSubModalOpen ? onClose : undefined}
          />

          {/* Modal Card */}
          <motion.div
            initial={openedByShortcut ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: openedByShortcut ? 0 : 0.2, ease: EASE_OUT }}
            className="relative w-full max-w-4xl max-h-[88vh] bg-[#0c111e]/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-2xl"
          >
            {/* FLOATING CARITA IN MODAL BACKGROUND */}
            <div className="absolute right-4 -top-8 pointer-events-none opacity-25 sm:opacity-35 select-none transition-opacity duration-300">
              <EyeTrackerCube
                size={155}
                mood={loading ? "searching" : "thinking"}
                follow={85}
                bounce={25}
              />
            </div>

            {/* Modal Header & Search Bar */}
            <div className="p-4 sm:p-6 border-b border-white/[0.08] relative z-10 space-y-3 bg-[#0a0e1a]/70">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Command className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Command Palette & Buscador Universal</span>
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300">
                        ⌘K
                      </span>
                      {loading && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-mono font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Escaneando...</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Cotizaciones, Proveedores, Complejos Solomon (ej. &quot;Unicenter&quot; o &quot;702&quot;), Pendientes y Eventos
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar buscador"
                  className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Input Field */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscá cotizaciones, proveedores, cines/cuentas Solomon (ej. 702, Palermo), pendientes..."
                  className="w-full bg-[#080d19] border border-white/15 focus:border-blue-500/70 rounded-2xl pl-10 pr-10 py-3 text-xs sm:text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors shadow-inner"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-h-[62vh] scrollbar-thin">
              {loading && !hasSearched && matchingSolomon.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                  <span className="text-xs font-semibold">Buscando en tiempo real...</span>
                </div>
              ) : !cleanQ ? (
                /* Initial Quick Commands & Solomon shortcuts */
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                      Navegación & Acciones Rápidas
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {quickActions.map((act) => {
                        const Icon = act.icon;
                        return (
                          <button
                            key={act.href}
                            onClick={() => {
                              onClose();
                              router.push(act.href);
                            }}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/20 text-left transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className={`w-4 h-4 shrink-0 ${act.color}`} />
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                                {act.label}
                              </span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Theme Quick Switcher */}
                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Cambiar Tema Visual
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTheme("dark");
                          toast.info("Tema Oscuro activado");
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          theme === "dark"
                            ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                            : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" /> Oscuro Corporativo
                      </button>
                      <button
                        onClick={() => {
                          setTheme("pink");
                          toast.info("Tema Rosa Ejecutivo activado");
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          theme === "pink"
                            ? "bg-pink-600/25 border-pink-500/40 text-pink-200"
                            : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>🌸</span> Rosa
                      </button>
                      <button
                        onClick={() => {
                          setTheme("gold");
                          toast.info("Tema Cinema VIP Gold activado");
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          theme === "gold"
                            ? "bg-amber-500/25 border-amber-500/40 text-amber-200"
                            : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>🎬</span> Cinema Gold
                      </button>
                    </div>
                  </div>
                </div>
              ) : hasSearched && totalResults === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-white">No se encontraron resultados</h4>
                  <p className="text-xs text-slate-400">
                    No hubo coincidencias para &quot;{cleanQ}&quot;. Probá con el nombre de un complejo (ej. &quot;Unicenter&quot;), cuenta (&quot;702&quot;) o proveedor.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* COMPLEJOS & CUENTAS SOLOMON */}
                  {matchingSolomon.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                          <Building2 className="w-4 h-4" />
                          <span>Complejos & Cuentas Solomon</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300">
                          {matchingSolomon.length} complejos
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {matchingSolomon.map((item) => (
                          <div
                            key={item.cuenta}
                            className="p-3 rounded-2xl bg-[#080d1a] border border-white/[0.08] hover:border-cyan-500/40 flex items-center justify-between gap-2 transition-all"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    item.cadena === "Cinemark"
                                      ? "bg-red-500/15 text-red-300 border border-red-500/30"
                                      : item.cadena === "Hoyts"
                                      ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  {item.cadena}
                                </span>
                                <span className="text-xs font-bold text-white truncate">
                                  {item.complejo}
                                </span>
                                {item.salas > 0 && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({item.salas} salas)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-1 tabular-nums">
                                Cta: <strong className="text-white">{item.cuenta}</strong> • Solomon:{" "}
                                <span className="text-cyan-300">{item.solomon}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleCopyText(item.cuenta, `Cuenta ${item.complejo}`, `cta-${item.cuenta}`, e)
                                }
                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                                title="Copiar número de cuenta corto"
                              >
                                {copiedId === `cta-${item.cuenta}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                                {item.cuenta}
                              </button>
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleCopyText(
                                    item.solomon,
                                    `Solomon ${item.complejo}`,
                                    `sol-${item.cuenta}`,
                                    e
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-200 flex items-center gap-1 cursor-pointer"
                                title="Copiar Cuenta Solomon completa"
                              >
                                {copiedId === `sol-${item.cuenta}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-cyan-300" />
                                )}
                                Solomon
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PROVEEDORES */}
                  {resultsProveedores.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                          <Briefcase className="w-4 h-4" />
                          <span>Proveedores</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono font-bold text-indigo-300">
                          {resultsProveedores.length} encontrados
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {resultsProveedores.map((prov, idx) => {
                          const email = prov.emails?.[0] || "";
                          return (
                            <div
                              key={prov.id || idx}
                              onClick={() => {
                                onClose();
                                router.push("/proveedores");
                              }}
                              className="p-3 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-indigo-500/40 flex items-center justify-between gap-2 cursor-pointer transition-all"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-white truncate">{prov.nombre}</h4>
                                  {prov.rating > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                                      {prov.rating}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {prov.rubro || "Proveedor general"}{" "}
                                  {prov.ubicacion ? `• ${prov.ubicacion}` : ""}
                                </p>
                              </div>
                              {email && (
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCopyText(email, `Email de ${prov.nombre}`, `prov-${prov.id}`, e)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[10px] font-mono font-semibold text-indigo-200 flex items-center gap-1 shrink-0 cursor-pointer"
                                  title={`Copiar ${email}`}
                                >
                                  {copiedId === `prov-${prov.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  Email
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* COTIZACIONES */}
                  {resultsCotizaciones.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                          <Scale className="w-4 h-4" />
                          <span>Cotizaciones</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-bold text-emerald-300">
                          {resultsCotizaciones.length} resultados
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {resultsCotizaciones.map((quote, idx) => (
                          <div
                            key={quote.id || idx}
                            onClick={() => handleSelectQuote(quote)}
                            className="group p-3.5 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-emerald-500/50 transition-all shadow-sm cursor-pointer"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                                    Cotización
                                  </span>
                                  {quote.categoria && (
                                    <span className="text-[10px] text-slate-400">{quote.categoria}</span>
                                  )}
                                </div>

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    quote.status === "finalizada"
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : quote.status === "enviada"
                                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  }`}
                                >
                                  {quote.status || "Borrador"}
                                </span>
                              </div>

                              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                                {quote.name || "Cotización sin título"}
                              </h4>

                              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/[0.04]">
                                <div className="flex items-center gap-2">
                                  <span>{Array.isArray(quote.items) ? `${quote.items.length} ítems` : "Ítems"}</span>
                                  <span>•</span>
                                  <span>
                                    {Array.isArray(quote.providers)
                                      ? `${quote.providers.length} proveedores`
                                      : "Proveedores"}
                                  </span>
                                </div>
                                <span className="text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                  Abrir →
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PENDIENTES & CALENDARIO */}
                  {(resultsPendientes.length > 0 || resultsCalendario.length > 0) && (
                    <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-4">
                      {resultsPendientes.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>Pendientes ({resultsPendientes.length})</span>
                          </div>
                          <div className="space-y-1.5">
                            {resultsPendientes.map((pen, idx) => {
                              const isDone = Boolean(pen.completado || pen.done || pen.estado === "completado");
                              return (
                                <div
                                  key={pen.id || idx}
                                  onClick={() => {
                                    onClose();
                                    router.push("/pendientes");
                                  }}
                                  className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                >
                                  <span className="text-xs text-white truncate font-medium">
                                    {pen.texto || pen.descripcion || "Tarea"}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 border ${
                                      isDone
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                    }`}
                                  >
                                    {isDone ? "Completado" : pen.estado || "Pendiente"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {resultsCalendario.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Eventos de Calendario ({resultsCalendario.length})</span>
                          </div>
                          <div className="space-y-1.5">
                            {resultsCalendario.map((ev, idx) => (
                              <div
                                key={ev.id || idx}
                                onClick={() => {
                                  onClose();
                                  router.push("/calendario");
                                }}
                                className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <span className="text-xs text-white truncate font-medium">{ev.title}</span>
                                <span className="text-[10px] font-mono text-purple-300 shrink-0">
                                  {ev.date} {ev.time || ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-white/[0.08] bg-[#070b14] flex items-center justify-between text-[11px] text-slate-500">
              <span className="hidden sm:inline">
                Atajo global:{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 font-mono text-[10px]">
                  ⌘K / Ctrl+K
                </kbd>{" "}
                •{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 font-mono text-[10px]">
                  ESC
                </kbd>{" "}
                para cerrar
              </span>
              <span>Clic en cualquier resultado para abrir o copiar directo</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
