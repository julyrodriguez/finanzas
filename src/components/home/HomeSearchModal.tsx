"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
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
  AlertCircle
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
  onClose: () => void;
}

export function HomeSearchModal({ isOpen, onClose }: HomeSearchModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultsOC, setResultsOC] = useState<any[]>([]);
  const [resultsCotizaciones, setResultsCotizaciones] = useState<any[]>([]);
  const [resultsPendientes, setResultsPendientes] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<"todos" | "ordenes" | "cotizaciones" | "pendientes">("todos");

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if query is numeric (number search) or words
  const cleanQ = query.trim();
  const isNumericQuery = cleanQ.length > 0 && /^[#\s]*(oc[-\s]*)?\d+$/i.test(cleanQ);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResultsOC([]);
      setResultsCotizaciones([]);
      setResultsPendientes([]);
      setHasSearched(false);
      setActiveTab("todos");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

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
          // 2. If it's words, search across Orders, Cotizaciones and Pendientes in parallel
          const [resOrders, resQuotes, resPendientes] = await Promise.allSettled([
            fetchOrdersFromMongo({ search: cleanQ, limit: 8 }),
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
            setResultsCotizaciones(filteredQuotes.slice(0, 8));
          } else {
            setResultsCotizaciones([]);
          }

          // Process Pendientes & Status
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
        }
      } catch (err) {
        console.warn("Error en búsqueda:", err);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 240);

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
            className="relative w-full max-w-3xl max-h-[85vh] bg-[#0c111e]/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-2xl"
          >
            {/* FLOATING THOUGHTFUL CARITA IN MODAL BACKGROUND */}
            <div className="absolute right-4 -top-8 pointer-events-none opacity-20 sm:opacity-35 select-none transition-all duration-300">
              <EyeTrackerCube size={150} mood="thinking" follow={80} bounce={25} />
            </div>

            {/* Modal Header & Search Bar */}
            <div className="p-4 sm:p-6 border-b border-white/[0.08] relative z-10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Buscador General Inteligente
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isNumericQuery
                        ? "Modo numérico: Buscando órdenes de compra (OC)"
                        : "Buscando en Órdenes, Cotizaciones y Pendientes"}
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

              {/* Main Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Escribí un N° de OC o palabras (proveedor, motivo, cotización, pendiente)..."
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

              {/* Category Filter Tabs (visible when searching words) */}
              {!isNumericQuery && hasSearched && totalResults > 0 && (
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setActiveTab("todos")}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === "todos"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "bg-white/[0.04] text-slate-400 hover:text-white"
                    }`}
                  >
                    Todos ({totalResults})
                  </button>
                  {resultsOC.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("ordenes")}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        activeTab === "ordenes"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "bg-white/[0.04] text-slate-400 hover:text-white"
                      }`}
                    >
                      Órdenes ({resultsOC.length})
                    </button>
                  )}
                  {resultsCotizaciones.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("cotizaciones")}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        activeTab === "cotizaciones"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                          : "bg-white/[0.04] text-slate-400 hover:text-white"
                      }`}
                    >
                      Cotizaciones ({resultsCotizaciones.length})
                    </button>
                  )}
                  {resultsPendientes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("pendientes")}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        activeTab === "pendientes"
                          ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                          : "bg-white/[0.04] text-slate-400 hover:text-white"
                      }`}
                    >
                      Pendientes ({resultsPendientes.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Results Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[55vh] scrollbar-thin">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="text-xs font-semibold">Consultando base de datos...</span>
                </div>
              ) : !cleanQ ? (
                /* Initial empty prompt */
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-400 mx-auto">
                    <Search className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">¿Qué estás buscando?</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Ingresá un <span className="text-blue-400 font-semibold">número</span> para localizar una Orden de Compra, o <span className="text-emerald-400 font-semibold">palabras</span> para buscar cotizaciones, proveedores o pendientes.
                    </p>
                  </div>
                </div>
              ) : hasSearched && totalResults === 0 ? (
                /* No results found */
                <div className="py-12 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-white">No se encontraron resultados</h4>
                  <p className="text-xs text-slate-400">
                    No hubo coincidencias para &quot;{cleanQ}&quot;. Verificá el término o el número ingresado.
                  </p>
                </div>
              ) : (
                /* Displaying Results */
                <div className="space-y-5">
                  {/* SECCIÓN 1: ÓRDENES DE COMPRA */}
                  {(activeTab === "todos" || activeTab === "ordenes") && resultsOC.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Órdenes de Compra ({resultsOC.length})</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {resultsOC.map((oc, idx) => {
                          const isLiberada = Boolean(oc.liberada);
                          const isMandada = Boolean(oc.mandada) && !isLiberada;
                          const isPendiente = !isLiberada && !isMandada;

                          return (
                            <Link
                              key={oc.id || idx}
                              href={`/ordenes-de-compras?search=${encodeURIComponent(oc.numOC || oc.razonSocial || "")}`}
                              onClick={onClose}
                              className="group block p-3.5 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-blue-500/40 transition-all shadow-sm"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 font-mono text-xs font-bold">
                                      OC #{oc.numOC || "S/N"}
                                    </span>
                                    {oc.numSolicitud && (
                                      <span className="text-[11px] text-slate-400 font-mono">
                                        Sol: #{oc.numSolicitud}
                                      </span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                                      oc.empresa === "CMK"
                                        ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                        : "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                    }`}>
                                      {oc.empresa || "Hoyts"}
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
                                </div>

                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.04]">
                                  <span className="text-xs sm:text-sm font-black font-mono text-emerald-400">
                                    $ {Number(oc.monto || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                  </span>

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
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SECCIÓN 2: COTIZACIONES */}
                  {(activeTab === "todos" || activeTab === "cotizaciones") && resultsCotizaciones.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                        <Scale className="w-3.5 h-3.5" />
                        <span>Cotizaciones ({resultsCotizaciones.length})</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {resultsCotizaciones.map((quote, idx) => (
                          <Link
                            key={quote.id || idx}
                            href="/cotizaciones"
                            onClick={onClose}
                            className="group block p-3.5 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-emerald-500/40 transition-all shadow-sm"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                                    Cotización
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {quote.categoria || "General"}
                                  </span>
                                </div>

                                <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                                  {quote.name || "Cotización sin nombre"}
                                </h4>

                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <span>{Array.isArray(quote.items) ? `${quote.items.length} ítems` : "Ítems"}</span>
                                  <span>•</span>
                                  <span>{Array.isArray(quote.providers) ? `${quote.providers.length} proveedores` : "Proveedores"}</span>
                                </div>
                              </div>

                              <div className="flex items-center sm:flex-col sm:items-end gap-1.5 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  quote.status === "finalizada"
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                    : quote.status === "enviada"
                                    ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                }`}>
                                  {quote.status || "Borrador"}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] text-emerald-400 group-hover:translate-x-0.5 transition-transform font-semibold">
                                  <span>Ver cotización</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECCIÓN 3: PENDIENTES & ESTADO ACTUAL */}
                  {(activeTab === "todos" || activeTab === "pendientes") && resultsPendientes.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>Pendientes & Estado Actual ({resultsPendientes.length})</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {resultsPendientes.map((pen, idx) => {
                          const isDone = Boolean(pen.completado || pen.done || pen.estado === "completado");
                          const estadoLabel = isDone 
                            ? "Completado" 
                            : pen.estado || "Pendiente";

                          return (
                            <Link
                              key={pen.id || idx}
                              href="/pendientes"
                              onClick={onClose}
                              className="group block p-3.5 rounded-2xl bg-[#080d1a] hover:bg-[#0f172a] border border-white/[0.08] hover:border-amber-500/40 transition-all shadow-sm"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 font-mono text-[10px] font-bold">
                                      {pen.categoria || "Tarea"}
                                    </span>
                                    {pen.creador && (
                                      <span className="text-[10px] text-slate-400">
                                        por {pen.creador}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                                    {pen.texto || pen.descripcion || "Sin descripción"}
                                  </h4>
                                </div>

                                <div className="flex items-center sm:flex-col sm:items-end gap-1.5 shrink-0">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    isDone
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  }`}>
                                    {estadoLabel}
                                  </span>
                                  <div className="flex items-center gap-1 text-[11px] text-amber-300 group-hover:translate-x-0.5 transition-transform font-semibold">
                                    <span>Ir a pendientes</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Shortcut Helper */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#070b14] flex items-center justify-between text-[11px] text-slate-500">
              <span className="hidden sm:inline">Presioná <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-400 font-mono text-[10px]">ESC</kbd> para salir</span>
              <span>Búsqueda directa en base de datos</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
