"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  Loader2, 
  ShoppingBag, 
  Scale, 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  FileText,
  Building2,
  DollarSign,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react";
import { EyeTrackerCube } from "./EyeTrackerCube";
import { 
  fetchOrdersFromMongo, 
  fetchCotizacionesFromMongo, 
  fetchPendientesFromMongo,
  parseMongoDocToOrdenCompra 
} from "@/lib/serverSync";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface HomeSearchModalProps {
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelectOC: (orden: any) => void;
  onSelectCotizacion: (quote: any) => void;
}

export function HomeSearchModal({ 
  isOpen, 
  initialQuery = "", 
  onClose,
  onSelectOC,
  onSelectCotizacion
}: HomeSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [resultsOC, setResultsOC] = useState<any[]>([]);
  const [resultsCotizaciones, setResultsCotizaciones] = useState<any[]>([]);
  const [resultsPendientes, setResultsPendientes] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanQ = query.trim();
  const isNumericQuery = cleanQ.length > 0 && /^[#\s]*(oc[-\s]*)?\d+$/i.test(cleanQ);

  // Sync initialQuery when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || "");
      setResultsOC([]);
      setResultsCotizaciones([]);
      setResultsPendientes([]);
      setHasSearched(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialQuery]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Execute search with debounce
  useEffect(() => {
    if (!isOpen) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!cleanQ) {
      setResultsOC([]);
      setResultsCotizaciones([]);
      setResultsPendientes([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const isNum = /^[#\s]*(oc[-\s]*)?\d+$/i.test(cleanQ);
        const searchWord = cleanQ.toLowerCase();

        // 1. If it's a number, focus primarily on Orders (OCs)
        if (isNum) {
          const res = await fetchOrdersFromMongo({
            search: cleanQ.replace(/[#\s]|oc[-\s]*/gi, ""),
            limit: 12,
          });
          const rawDocs = res?.ordenes || res?.data || (Array.isArray(res) ? res : []);
          const parsed = rawDocs.map(parseMongoDocToOrdenCompra);
          setResultsOC(parsed);
          setResultsCotizaciones([]);
          setResultsPendientes([]);
        } else {
          // 2. If it's words, search in parallel across Orders, Cotizaciones, and Pendientes
          const [resOrders, resQuotes, resPendientes] = await Promise.allSettled([
            fetchOrdersFromMongo({ search: cleanQ, limit: 10 }),
            fetchCotizacionesFromMongo(),
            fetchPendientesFromMongo(),
          ]);

          // Process Orders
          if (resOrders.status === "fulfilled" && resOrders.value) {
            const rawDocs = resOrders.value?.ordenes || resOrders.value?.data || (Array.isArray(resOrders.value) ? resOrders.value : []);
            setResultsOC(rawDocs.map(parseMongoDocToOrdenCompra));
          } else {
            setResultsOC([]);
          }

          // Process Cotizaciones
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

          // Process Pendientes
          if (resPendientes.status === "fulfilled" && resPendientes.value?.pendientes) {
            const list = resPendientes.value.pendientes;
            const filtered = list.filter((p: any) => {
              const textMatch = p.texto?.toLowerCase().includes(searchWord) || p.descripcion?.toLowerCase().includes(searchWord);
              const catMatch = p.categoria?.toLowerCase().includes(searchWord);
              const tagMatch = Array.isArray(p.tags) && p.tags.some((t: any) => String(t).toLowerCase().includes(searchWord));
              return textMatch || catMatch || tagMatch;
            });
            setResultsPendientes(filtered.slice(0, 6));
          } else {
            setResultsPendientes([]);
          }
        }
      } catch (err) {
        console.warn("Error en búsqueda:", err);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 220);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [cleanQ, isOpen]);

  const totalResults = resultsOC.length + resultsCotizaciones.length + resultsPendientes.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          {/* Backdrop with Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="relative w-full max-w-5xl max-h-[88vh] bg-[#0c111e]/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-2xl"
          >
            {/* FLOATING CARITA IN MODAL BACKGROUND: SCANNING WHEN SEARCHING, THINKING WHEN IDLE */}
            <div className="absolute right-4 -top-8 pointer-events-none opacity-25 sm:opacity-40 select-none transition-opacity duration-300">
              <EyeTrackerCube 
                size={160} 
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
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Buscador Unificado</span>
                      {loading && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-mono font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Escaneando...</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isNumericQuery
                        ? "Modo número: buscando en Órdenes de Compra (OCs)"
                        : "Buscando en simultáneo: Órdenes de Compra a la izquierda y Cotizaciones a la derecha"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
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
                  placeholder="Escribí un N° de OC o palabras clave (proveedor, insumo, cotización)..."
                  className="w-full bg-[#080d19] border border-white/15 focus:border-blue-500/70 rounded-2xl pl-10 pr-10 py-3 text-xs sm:text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors shadow-inner"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-h-[60vh] scrollbar-thin">
              {loading && !hasSearched ? (
                <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                  <span className="text-xs font-semibold">Buscando en Órdenes y Cotizaciones...</span>
                </div>
              ) : !cleanQ ? (
                /* Initial empty prompt */
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-400 mx-auto">
                    <Search className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">¿Qué estás buscando?</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Ingresá un <span className="text-blue-400 font-semibold">número</span> para ver la OC y abrir su detalle, o <span className="text-emerald-400 font-semibold">palabras</span> para comparar Órdenes y Cotizaciones lado a lado.
                    </p>
                  </div>
                </div>
              ) : hasSearched && totalResults === 0 ? (
                /* No results found */
                <div className="py-14 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-white">No se encontraron resultados</h4>
                  <p className="text-xs text-slate-400">
                    No hubo coincidencias para &quot;{cleanQ}&quot;.
                  </p>
                </div>
              ) : (
                /* SPLIT 2-COLUMN VIEW: ÓRDENES A LA IZQUIERDA | COTIZACIONES A LA DERECHA */
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    
                    {/* COLUMNA IZQUIERDA: ÓRDENES DE COMPRA */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                          <ShoppingBag className="w-4 h-4" />
                          <span>Órdenes de Compra</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono font-bold text-blue-300">
                          {resultsOC.length} resultados
                        </span>
                      </div>

                      {resultsOC.length === 0 ? (
                        <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-500">
                          Sin órdenes coincidentes
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1 scrollbar-thin">
                          {resultsOC.map((oc, idx) => {
                            const isLiberada = Boolean(oc.liberada);
                            const isMandada = Boolean(oc.mandada) && !isLiberada;

                            return (
                              <div
                                key={oc.id || idx}
                                onClick={() => onSelectOC(oc)}
                                className="group p-3.5 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-blue-500/50 transition-all shadow-sm cursor-pointer"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 font-mono text-xs font-bold">
                                        OC #{oc.numOC || "S/N"}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                                        oc.empresa === "CMK"
                                          ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                          : "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                      }`}>
                                        {oc.empresa || "Hoyts"}
                                      </span>
                                    </div>

                                    {/* Estado Actual */}
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                                      isLiberada
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                        : isMandada
                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                                    }`}>
                                      {isLiberada ? "Liberada" : isMandada ? "Mandada a firma" : "Pendiente"}
                                    </span>
                                  </div>

                                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                                    {oc.razonSocial || "Proveedor sin nombre"}
                                  </h4>

                                  {oc.motivo && (
                                    <p className="text-[11px] text-slate-400 line-clamp-1">
                                      {oc.motivo}
                                    </p>
                                  )}

                                  <div className="pt-1.5 flex items-center justify-between border-t border-white/[0.04] text-xs">
                                    <span className="font-mono font-black text-emerald-400">
                                      $ {Number(oc.monto || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                      Ver detalle →
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* COLUMNA DERECHA: COTIZACIONES */}
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

                      {resultsCotizaciones.length === 0 ? (
                        <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-500">
                          Sin cotizaciones coincidentes
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1 scrollbar-thin">
                          {resultsCotizaciones.map((quote, idx) => (
                            <div
                              key={quote.id || idx}
                              onClick={() => onSelectCotizacion(quote)}
                              className="group p-3.5 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-emerald-500/50 transition-all shadow-sm cursor-pointer"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                                      Cotización
                                    </span>
                                    {quote.categoria && (
                                      <span className="text-[10px] text-slate-400">
                                        {quote.categoria}
                                      </span>
                                    )}
                                  </div>

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    quote.status === "finalizada"
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : quote.status === "enviada"
                                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  }`}>
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
                                    <span>{Array.isArray(quote.providers) ? `${quote.providers.length} proveedores` : "Proveedores"}</span>
                                  </div>
                                  <span className="text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                    Ver cotización →
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* SECCIÓN INFERIOR: PENDIENTES (si existen) */}
                  {resultsPendientes.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>Pendientes & Estado ({resultsPendientes.length})</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {resultsPendientes.map((pen, idx) => {
                          const isDone = Boolean(pen.completado || pen.done || pen.estado === "completado");
                          return (
                            <div
                              key={pen.id || idx}
                              className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2"
                            >
                              <span className="text-xs text-white truncate font-medium">
                                {pen.texto || pen.descripcion || "Tarea"}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 border ${
                                isDone
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              }`}>
                                {isDone ? "Completado" : pen.estado || "Pendiente"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t border-white/[0.08] bg-[#070b14] flex items-center justify-between text-[11px] text-slate-500">
              <span className="hidden sm:inline">Presioná <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-400 font-mono text-[10px]">ESC</kbd> para cerrar</span>
              <span>Clic en cualquier resultado para abrir su detalle directo</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
