"use client";

import React, { useState } from "react";
import { SearchEngineType, SearchDepthType } from "@/types/proveedor";
import { 
  Search, 
  Sparkles, 
  MapPin, 
  Briefcase, 
  SlidersHorizontal, 
  Flame, 
  Zap, 
  Settings2, 
  Loader2,
  FileText,
  Compass,
  Layers
} from "lucide-react";

interface ProveedorSearchFormProps {
  onSearch: (params: {
    rubro: string;
    zona: string;
    especificaciones?: string;
    engine: SearchEngineType;
    profundidad?: SearchDepthType;
    firecrawlApiKey?: string;
  }) => Promise<void>;
  isLoading: boolean;
  currentStepMessage?: string;
  onOpenSkillsModal: () => void;
  firecrawlApiKey: string;
}

const RUBRO_SUGGESTIONS = [
  "Electricistas & Grupos Electrógenos",
  "Mantenimiento HVAC & Climatización",
  "Construcción en Seco & Pintura",
  "Seguridad Privada & Alarmas",
  "Catering & Eventos Corporativos",
  "Proyectores, Audio & Sonido",
  "Limpieza Integral & Altura",
  "Cartelería Digital & LED",
];

const ZONA_SUGGESTIONS = [
  "CABA y GBA",
  "Córdoba Capital",
  "Mendoza",
  "Rosario, Santa Fe",
  "Neuquén",
  "Salta",
  "Todo el país",
];

export function ProveedorSearchForm({
  onSearch,
  isLoading,
  currentStepMessage,
  onOpenSkillsModal,
  firecrawlApiKey,
}: ProveedorSearchFormProps) {
  const [rubro, setRubro] = useState("");
  const [zona, setZona] = useState("");
  const [especificaciones, setEspecificaciones] = useState("");
  const [engine, setEngine] = useState<SearchEngineType>("hybrid");
  const [profundidad, setProfundidad] = useState<SearchDepthType>("profunda");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubro.trim() || !zona.trim() || isLoading) return;

    onSearch({
      rubro: rubro.trim(),
      zona: zona.trim(),
      especificaciones: especificaciones.trim() || undefined,
      engine,
      profundidad,
      firecrawlApiKey: firecrawlApiKey || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative bg-[#0d1322]/90 border border-white/[0.08] backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-2xl transition-all"
    >
      {/* Top Header & Engine Switcher */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Prompt de Búsqueda Inteligente & Extracción
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Rastreo profundo de empresas, antecedentes de obras y canales de contacto directo
            </p>
          </div>
        </div>

        {/* Engine & Depth Controls */}
        <div className="flex items-center gap-2 flex-wrap self-stretch lg:self-auto">
          {/* Depth Toggle */}
          <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setProfundidad("profunda")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                profundidad === "profunda"
                  ? "bg-cyan-600/90 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Rastreo exhaustivo en 4 fases (10 a 20+ proveedores)"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Búsqueda Exhaustiva</span>
            </button>
            <button
              type="button"
              onClick={() => setProfundidad("rapida")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                profundidad === "rapida"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Rastreo estándar (5 a 8 proveedores)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Rápida</span>
            </button>
          </div>

          {/* Engine Selector */}
          <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setEngine("hybrid")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                engine === "hybrid"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Híbrido IA</span>
            </button>
            <button
              type="button"
              onClick={() => setEngine("firecrawl")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                engine === "firecrawl"
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Firecrawl</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenSkillsModal}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition-colors"
            title="Configurar Skills & API Keys"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Rubro / Tipo de Proveedor */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            <span>¿Qué tipo o rubro de proveedor necesitas? *</span>
          </label>
          <input
            type="text"
            required
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            placeholder="Ej: Mantenimiento de aire acondicionado, Grupos electrógenos, etc."
            className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
          />
          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {RUBRO_SUGGESTIONS.slice(0, 4).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRubro(item)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  rubro === item
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Zona / Ubicación */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>¿En qué zona o ciudad? *</span>
          </label>
          <input
            type="text"
            required
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            placeholder="Ej: CABA, Córdoba Capital, Rosario, Neuquén, Mendoza..."
            className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
          />
          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ZONA_SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setZona(item)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  zona === item
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced / Specific Requirements toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-blue-300 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{showAdvanced ? "Ocultar especificaciones adicionales" : "+ Agregar especificaciones o condiciones (opcional)"}</span>
        </button>

        {showAdvanced && (
          <div className="mt-2.5 space-y-2 animate-in fade-in duration-200">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Requisitos o especificaciones técnicas particulares</span>
            </label>
            <textarea
              rows={2}
              value={especificaciones}
              onChange={(e) => setEspecificaciones(e.target.value)}
              placeholder="Ej: Deben contar con seguro ART al día, habilitación técnica municipal y experiencia comprobable con locales de alta afluencia o shopping centers."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>
        )}
      </div>

      {/* Submit Button & Progress Indicator */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.06]">
        <div className="text-xs text-slate-400">
          {isLoading && currentStepMessage ? (
            <div className="flex items-center gap-2 text-blue-400 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>{currentStepMessage}</span>
            </div>
          ) : (
            <span>
              La IA rastreará empresas activas, su catálogo de servicios, referencias y canales directos.
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !rubro.trim() || !zona.trim()}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Buscando Proveedores...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Buscar Proveedores con IA</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
