"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  FolderOpen,
  Scale,
  Send,
  Clock,
  Lock,
  Eye,
  ArrowLeft,
  ArrowRight,
  Search,
  Bot,
  Sparkles,
  CheckCircle2,
  User,
  Layers,
  FileText,
  Calendar,
  X,
  AlertCircle,
  Trophy,
  Filter
} from "lucide-react";
import { formatCreatorName } from "@/lib/cotizacionesUtils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export type CategoryStatusFilter = "enviadas" | "pendientes" | "finalizadas" | "todos";

export interface CategoryCardQuote {
  id?: string;
  firebaseId?: string;
  _id?: string;
  name: string;
  notes?: string;
  items?: any[];
  providers?: any[];
  winningProviderId?: string;
  status?: string;
  isFinalized?: boolean;
  categoria?: string;
  createdBy?: string;
  sentAt?: string;
  updatedAt?: any;
  createdAt?: any;
  attachments?: any[];
}

interface CotizacionesCategoriasViewProps {
  quotations: CategoryCardQuote[];
  allCategories: string[];
  onOpenDetail: (quote: CategoryCardQuote) => void;
  isOrdenesUser?: boolean;
  onSwitchToStandard?: () => void;
}

export function isQuoteFinalized(q: CategoryCardQuote): boolean {
  const isFin = q.status === "finalizada" || Boolean(q.isFinalized);
  const raw = (q.status || (isFin ? "finalizada" : "borrador")).toLowerCase().trim();
  return isFin || raw === "finalizada" || raw === "finalizados";
}

export function isQuoteSent(q: CategoryCardQuote): boolean {
  if (isQuoteFinalized(q)) return false;
  const raw = (q.status || "borrador").toLowerCase().trim();
  return raw === "enviada" || raw === "enviados";
}

export function isQuotePending(q: CategoryCardQuote): boolean {
  if (isQuoteFinalized(q)) return false;
  if (isQuoteSent(q)) return false;
  const raw = (q.status || "borrador").toLowerCase().trim();
  return raw !== "cancelada";
}

function formatDate(val: any): string {
  if (!val) return "Fecha sin registrar";
  try {
    const d = val?.seconds ? new Date(val.seconds * 1000) : new Date(val);
    if (isNaN(d.getTime())) return "Fecha sin registrar";
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "Fecha sin registrar";
  }
}

export function CotizacionesCategoriasView({
  quotations,
  allCategories,
  onOpenDetail,
  isOrdenesUser = false,
  onSwitchToStandard,
}: CotizacionesCategoriasViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Filtro activo por defecto al entrar a una categoría: "enviadas"
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>("enviadas");
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);

  // Trigger global AI agent widget
  const handleOpenBot = (initialPrompt?: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-agent-widget", {
          detail: {
            prompt:
              initialPrompt ||
              (selectedCategory
                ? `Hola, ¿me podés resumir el estado de las cotizaciones de ${selectedCategory}?`
                : "Hola, ¿me podés ayudar a consultar las cotizaciones y categorías?"),
          },
        })
      );
    }
  };

  // Group quotes by category
  const categoriesStats = useMemo(() => {
    const catsMap = new Map<
      string,
      {
        name: string;
        total: number;
        pendientes: number;
        enviadas: number;
        finalizadas: number;
        quotes: CategoryCardQuote[];
      }
    >();

    allCategories.forEach((cat) => {
      const trimmed = cat.trim();
      if (!trimmed) return;
      catsMap.set(trimmed.toLowerCase(), {
        name: trimmed,
        total: 0,
        pendientes: 0,
        enviadas: 0,
        finalizadas: 0,
        quotes: [],
      });
    });

    let uncategorizedCount = 0;
    const uncategorizedQuotes: CategoryCardQuote[] = [];

    quotations.forEach((q) => {
      const cat = (q.categoria || "").trim();
      if (!cat) {
        uncategorizedCount++;
        uncategorizedQuotes.push(q);
        return;
      }

      const key = cat.toLowerCase();
      let entry = catsMap.get(key);
      if (!entry) {
        entry = { name: cat, total: 0, pendientes: 0, enviadas: 0, finalizadas: 0, quotes: [] };
        catsMap.set(key, entry);
      }
      entry.total++;
      if (isQuoteFinalized(q)) {
        entry.finalizadas++;
      } else if (isQuoteSent(q)) {
        entry.enviadas++;
      } else {
        entry.pendientes++;
      }
      entry.quotes.push(q);
    });

    // Solo mostrar categorías que tengan al menos 1 cotización (ocultar las de 0)
    const list = Array.from(catsMap.values()).filter((item) => item.total > 0);

    if (uncategorizedCount > 0) {
      let unPend = 0;
      let unEnv = 0;
      let unFin = 0;
      uncategorizedQuotes.forEach((q) => {
        if (isQuoteFinalized(q)) unFin++;
        else if (isQuoteSent(q)) unEnv++;
        else unPend++;
      });
      list.push({
        name: "Sin Rubro / Área",
        total: uncategorizedCount,
        pendientes: unPend,
        enviadas: unEnv,
        finalizadas: unFin,
        quotes: uncategorizedQuotes,
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [quotations, allCategories]);

  // Overall metrics
  const totalCotizaciones = quotations.length;
  const totalEnviadas = useMemo(() => quotations.filter(isQuoteSent).length, [quotations]);
  const totalFinalizadas = useMemo(() => quotations.filter(isQuoteFinalized).length, [quotations]);
  const totalPendientes = useMemo(() => quotations.filter(isQuotePending).length, [quotations]);

  // Filtered categories for Level 1 grid
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categoriesStats;
    const q = searchQuery.toLowerCase().trim();
    return categoriesStats.filter((cat) => {
      if (cat.name.toLowerCase().includes(q)) return true;
      return cat.quotes.some((quote) => (quote.name || "").toLowerCase().includes(q));
    });
  }, [categoriesStats, searchQuery]);

  // Handler to open category with default filter "enviadas"
  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName);
    setStatusFilter("enviadas"); // Apenas entra, siempre activas las enviadas
    setSearchQuery("");
  };

  // Selected Category quotes: partitioned into Pendientes, Enviadas, Finalizadas
  const selectedCategoryData = useMemo(() => {
    if (!selectedCategory) return null;
    const entry = categoriesStats.find(
      (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
    );
    if (!entry) return null;

    let quotes = entry.quotes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      quotes = quotes.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(q) ||
          (item.createdBy || "").toLowerCase().includes(q)
      );
    }

    const pendientes = quotes.filter(isQuotePending);
    const enviadas = quotes.filter(isQuoteSent);
    const finalizadas = quotes.filter(isQuoteFinalized);

    return {
      categoryName: entry.name,
      total: quotes.length,
      pendientes,
      enviadas,
      finalizadas,
    };
  }, [categoriesStats, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d1326] via-[#0b1020] to-[#0d1326] border border-white/[0.08] p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-bold tracking-wide uppercase">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>Compras - Cotizaciones</span>
              </span>
              {isOrdenesUser && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[11px] font-semibold">
                  <Lock className="w-3 h-3" />
                  <span>Modo Consulta</span>
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {selectedCategory ? `Rubro: ${selectedCategory}` : "Áreas & Rubros de Cotización"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              {selectedCategory
                ? "Filtra por Enviadas, Pendientes, Finalizadas o Todas. Las enviadas permiten consultar sus detalles."
                : "Selecciona una categoría para explorar sus cotizaciones enviadas, pendientes y finalizadas."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Bot Button (No visible para usuario ordenes) */}
            {!isOrdenesUser && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => handleOpenBot()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all cursor-pointer group"
                title="Abrir chat con el Asistente IA"
              >
                <Bot className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
                <span>Asistente IA</span>
                <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
              </motion.button>
            )}

            {/* If non-ordenes user, allow returning to standard view */}
            {!isOrdenesUser && onSwitchToStandard && (
              <button
                type="button"
                onClick={onSwitchToStandard}
                className="px-3 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Vista Estándar
              </button>
            )}
          </div>
        </div>

        {/* Global Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-white/[0.06]">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold block">
              Categorías
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg sm:text-2xl font-black text-white">{categoriesStats.length}</span>
              <span className="text-[10px] text-slate-500">activas</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10">
            <span className="text-[10px] sm:text-xs text-emerald-300/80 uppercase tracking-wider font-semibold block">
              ✉️ Enviadas
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg sm:text-2xl font-black text-emerald-300">{totalEnviadas}</span>
              <span className="text-[10px] text-emerald-400/60">disponibles</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/[0.04] border border-amber-500/10">
            <span className="text-[10px] sm:text-xs text-amber-300/80 uppercase tracking-wider font-semibold block">
              ⏳ Pendientes
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg sm:text-2xl font-black text-amber-300">{totalPendientes}</span>
              <span className="text-[10px] text-amber-400/60">en preparación</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-500/[0.04] border border-purple-500/10">
            <span className="text-[10px] sm:text-xs text-purple-300/80 uppercase tracking-wider font-semibold block">
              🏆 Finalizadas
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg sm:text-2xl font-black text-purple-300">{totalFinalizadas}</span>
              <span className="text-[10px] text-purple-400/60">adjudicadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Notice when user tries to enter a pending quotation */}
      <AnimatePresence>
        {blockedNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{blockedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setBlockedNotice(null)}
              className="text-amber-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {selectedCategory ? (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setSearchQuery("");
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-xs font-bold border border-white/[0.08] transition-colors cursor-pointer w-fit group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>← Volver a todas las categorías</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Selecciona un rubro para abrir sus cotizaciones</span>
          </div>
        )}

        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={
              selectedCategory
                ? `Buscar en ${selectedCategory}...`
                : "Buscar categoría o cotización..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#080c16] border border-white/[0.08] focus:border-amber-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          LEVEL 1: CATEGORY CARDS GRID (When no category is selected)
          ============================================================ */}
      {!selectedCategory && (
        <div>
          {filteredCategories.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#090d18] border border-white/[0.06] space-y-3">
              <Folder className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No se encontraron categorías</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No hay categorías que coincidan con la búsqueda "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((cat) => (
                <motion.div
                  key={cat.name}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  onClick={() => handleSelectCategory(cat.name)}
                  className="group relative p-5 rounded-3xl bg-[#090d19]/80 hover:bg-[#0d1324] border border-white/[0.08] hover:border-amber-500/40 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.03] rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />

                  <div className="space-y-3 relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 group-hover:border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 transition-colors">
                        <Folder className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </div>
                      <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-300 border border-white/[0.06]">
                        {cat.total} {cat.total === 1 ? "cotización" : "cotizaciones"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                        {cat.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Toca para abrir cotizaciones de este rubro
                      </p>
                    </div>

                    {/* Breakdown Pills */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        <Send className="w-2.5 h-2.5" />
                        <span>{cat.enviadas} Enviadas</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{cat.pendientes} Pendientes</span>
                      </span>
                      {cat.finalizadas > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          <Trophy className="w-2.5 h-2.5" />
                          <span>{cat.finalizadas}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer action */}
                  <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400 group-hover:text-amber-300 transition-colors">
                    <span className="text-[11px] font-medium">Ver cotizaciones</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          LEVEL 2: CATEGORY DRILL-DOWN (Selected Category)
          Filtros de estado en la parte superior:
          - ENVIADAS (ACTIVO POR DEFECTO)
          - PENDIENTES
          - FINALIZADAS
          - TODOS (Pendientes primero, luego Enviadas, luego Finalizadas)
          ============================================================ */}
      {selectedCategory && selectedCategoryData && (
        <div className="space-y-6">
          {/* Quick AI Chips helper inside category (No visible para usuario ordenes) */}
          {!isOrdenesUser && (
            <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Bot className="w-3 h-3 text-indigo-400" />
                <span>Preguntas rápidas para la IA:</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  handleOpenBot(`¿Qué cotizaciones enviadas tenemos en el área de ${selectedCategory}?`)
                }
                className="text-[10px] text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer"
              >
                "¿Qué cotizaciones enviadas hay en {selectedCategory}?"
              </button>
              <button
                type="button"
                onClick={() =>
                  handleOpenBot(`¿Cuántas cotizaciones pendientes quedan en ${selectedCategory} y de qué tratan?`)
                }
                className="text-[10px] text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/20 transition-colors cursor-pointer"
              >
                "¿Cuáles quedan pendientes?"
              </button>
            </div>
          )}

          {/* ============================================================
              BARRA DE FILTROS DE ESTADO (Apenas entra a la categoría)
              Requisito del usuario:
              "que aparezcan en filtros, que esten apenas entro a una categoria
               que aparezcan enviadas pendientes finalizadas, y qye haya ub todos.
               qje el que este activo principalmente sea enviadas"
              ============================================================ */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#090d18] border border-white/[0.08] shadow-lg flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 px-1 mr-0.5">
                <Filter className="w-3 h-3 text-amber-400" />
                <span>Estado:</span>
              </span>

              {/* 1. Botón ENVIADAS (ACTIVO PRINCIPALMENTE / DEFAULT) */}
              <button
                type="button"
                onClick={() => setStatusFilter("enviadas")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "enviadas"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400/50"
                    : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                }`}
              >
                <Send className="w-3.5 h-3.5 text-emerald-300" />
                <span>Enviadas</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    statusFilter === "enviadas"
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {selectedCategoryData.enviadas.length}
                </span>
              </button>

              {/* 2. Botón PENDIENTES */}
              <button
                type="button"
                onClick={() => setStatusFilter("pendientes")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "pendientes"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400/50"
                    : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Pendientes</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    statusFilter === "pendientes"
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {selectedCategoryData.pendientes.length}
                </span>
              </button>

              {/* 3. Botón FINALIZADAS */}
              <button
                type="button"
                onClick={() => setStatusFilter("finalizadas")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "finalizadas"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400/50"
                    : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-purple-300" />
                <span>Finalizadas</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    statusFilter === "finalizadas"
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {selectedCategoryData.finalizadas.length}
                </span>
              </button>

              {/* 4. Botón TODOS */}
              <button
                type="button"
                onClick={() => setStatusFilter("todos")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "todos"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/50"
                    : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-300" />
                <span>Todos</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    statusFilter === "todos"
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {selectedCategoryData.total}
                </span>
              </button>
            </div>

            {/* Quick status summary label */}
            <span className="text-[11px] text-slate-400 hidden md:inline">
              Mostrando:{" "}
              <strong className="text-white capitalize">
                {statusFilter === "todos" ? "Todas las cotizaciones" : statusFilter}
              </strong>
            </span>
          </div>

          {/* ============================================================
              CONTENIDO SEGÚN FILTRO ACTIVO
              ============================================================ */}

          {/* 1. SECCIÓN PENDIENTES (Visible si statusFilter === 'pendientes' o 'todos')
              Siempre antes que las enviadas si se muestran todas */}
          {(statusFilter === "pendientes" || statusFilter === "todos") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Cotizaciones Pendientes</span>
                      <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {selectedCategoryData.pendientes.length}
                      </span>
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  En preparación • Sin acceso a detalles
                </span>
              </div>

              {selectedCategoryData.pendientes.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                  <p className="text-xs text-slate-400">
                    No hay cotizaciones pendientes en este rubro.
                  </p>
                  {selectedCategoryData.enviadas.length > 0 && statusFilter === "pendientes" && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("enviadas")}
                      className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Ver las {selectedCategoryData.enviadas.length} enviadas →</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {selectedCategoryData.pendientes.map((quote) => {
                    const qId = quote.id || quote.firebaseId || quote._id;
                    const itemsCount = Array.isArray(quote.items) ? quote.items.length : 0;
                    const creatorName = formatCreatorName(quote.createdBy) || "Sin asignar";

                    return (
                      <div
                        key={qId}
                        onClick={() => {
                          setBlockedNotice(
                            `La cotización "${quote.name}" está pendiente de envío. Los detalles estarán disponibles cuando sea enviada.`
                          );
                        }}
                        className="p-4 rounded-2xl bg-[#090d18]/70 border border-white/[0.06] space-y-3 cursor-not-allowed select-none opacity-85 hover:opacity-100 transition-opacity relative overflow-hidden group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/25 text-amber-300 uppercase">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Pendiente</span>
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-200 mt-1.5 truncate">
                              {quote.name || "Cotización sin título"}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap pt-1">
                          <span className="flex items-center gap-1 bg-white/[0.03] px-2 py-0.5 rounded-md">
                            <User className="w-2.5 h-2.5 text-indigo-400" />
                            <span className="truncate max-w-[100px]">Por: {creatorName}</span>
                          </span>
                          <span className="flex items-center gap-1 bg-white/[0.03] px-2 py-0.5 rounded-md">
                            <FileText className="w-2.5 h-2.5 text-slate-500" />
                            <span>{itemsCount} ítems</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{formatDate(quote.createdAt || quote.updatedAt)}</span>
                          </span>
                        </div>

                        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-slate-500">
                          <span className="flex items-center gap-1 italic">
                            <Lock className="w-2.5 h-2.5 text-amber-400/60" />
                            <span>Solo lectura bloqueada hasta envío</span>
                          </span>
                          <span className="text-[10px] font-semibold text-amber-400/50">
                            Borrador
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. SECCIÓN ENVIADAS (Visible si statusFilter === 'enviadas' o 'todos') */}
          {(statusFilter === "enviadas" || statusFilter === "todos") && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Cotizaciones Enviadas</span>
                      <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {selectedCategoryData.enviadas.length}
                      </span>
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-400/80 hidden sm:inline">
                  Haz clic para ver comparativo y detalles
                </span>
              </div>

              {selectedCategoryData.enviadas.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                  <p className="text-xs font-semibold text-slate-300">
                    No hay cotizaciones con estado Enviada en este rubro todavía.
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Cuando una cotización pase a estado "Enviada", podrás consultar sus proveedores y precios aquí.
                  </p>
                  {selectedCategoryData.pendientes.length > 0 && statusFilter === "enviadas" && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("pendientes")}
                      className="mt-2 text-xs text-amber-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Hay {selectedCategoryData.pendientes.length} pendiente(s) en este rubro →</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {selectedCategoryData.enviadas.map((quote) => {
                    const qId = quote.id || quote.firebaseId || quote._id;
                    const providersCount = Array.isArray(quote.providers) ? quote.providers.length : 0;
                    const itemsCount = Array.isArray(quote.items) ? quote.items.length : 0;
                    const creatorName = formatCreatorName(quote.createdBy) || "Sin asignar";

                    return (
                      <motion.div
                        key={qId}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        onClick={() => onOpenDetail(quote)}
                        className="p-4 rounded-2xl bg-[#0c1222] hover:bg-[#0f172b] border border-emerald-500/20 hover:border-emerald-500/40 space-y-3 cursor-pointer transition-all shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between group"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border bg-emerald-500/15 text-emerald-300 border-emerald-500/25">
                                <Send className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Enviada</span>
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors mt-1.5 truncate">
                                {quote.name || "Cotización sin título"}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
                            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 rounded-md">
                              <User className="w-2.5 h-2.5 text-indigo-400" />
                              <span className="truncate max-w-[100px]">Por: {creatorName}</span>
                            </span>
                            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 rounded-md">
                              <FileText className="w-2.5 h-2.5 text-slate-400" />
                              <span>{itemsCount} ítems</span>
                            </span>
                            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 rounded-md text-emerald-300 font-semibold">
                              <Scale className="w-2.5 h-2.5" />
                              <span>{providersCount} {providersCount === 1 ? "prov." : "provs."}</span>
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>
                              {quote.sentAt
                                ? `Enviada: ${formatDate(quote.sentAt)}`
                                : `Fecha: ${formatDate(quote.updatedAt || quote.createdAt)}`}
                            </span>
                          </div>
                        </div>

                        {/* Footer: Ver Detalle Button */}
                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 italic">Solo consulta</span>
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver detalles</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. SECCIÓN FINALIZADAS (Visible si statusFilter === 'finalizadas' o 'todos') */}
          {(statusFilter === "finalizadas" || statusFilter === "todos") && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Cotizaciones Finalizadas</span>
                      <span className="px-2 py-0.2 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {selectedCategoryData.finalizadas.length}
                      </span>
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] text-purple-400/80 hidden sm:inline">
                  Proveedor ganador adjudicado
                </span>
              </div>

              {selectedCategoryData.finalizadas.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-xs text-slate-400">
                    No hay cotizaciones finalizadas en este rubro.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {selectedCategoryData.finalizadas.map((quote) => {
                    const qId = quote.id || quote.firebaseId || quote._id;
                    const providersCount = Array.isArray(quote.providers) ? quote.providers.length : 0;
                    const itemsCount = Array.isArray(quote.items) ? quote.items.length : 0;
                    const creatorName = formatCreatorName(quote.createdBy) || "Sin asignar";

                    return (
                      <motion.div
                        key={qId}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        onClick={() => onOpenDetail(quote)}
                        className="p-4 rounded-2xl bg-[#120d24] hover:bg-[#16102c] border border-purple-500/25 hover:border-purple-500/45 space-y-3 cursor-pointer transition-all shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between group"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border bg-purple-500/15 text-purple-300 border-purple-500/25">
                                <CheckCircle2 className="w-2.5 h-2.5 text-purple-400" />
                                <span>Finalizada</span>
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-300 transition-colors mt-1.5 truncate">
                                {quote.name || "Cotización sin título"}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
                            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 rounded-md">
                              <User className="w-2.5 h-2.5 text-indigo-400" />
                              <span className="truncate max-w-[100px]">Por: {creatorName}</span>
                            </span>
                            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 rounded-md">
                              <FileText className="w-2.5 h-2.5 text-slate-400" />
                              <span>{itemsCount} ítems</span>
                            </span>
                            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-0.5 rounded-md text-purple-300 font-semibold">
                              <Scale className="w-2.5 h-2.5" />
                              <span>{providersCount} provs.</span>
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>
                              {quote.sentAt
                                ? `Enviada: ${formatDate(quote.sentAt)}`
                                : `Fecha: ${formatDate(quote.updatedAt || quote.createdAt)}`}
                            </span>
                          </div>
                        </div>

                        {/* Footer: Ver Detalle Button */}
                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 italic">Solo consulta</span>
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver detalles</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
