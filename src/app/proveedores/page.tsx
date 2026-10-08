"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Proveedor, SearchEngineType, SearchDepthType } from "@/types/proveedor";
import { ProveedorCard } from "@/components/proveedores/ProveedorCard";
import { ProveedorSearchForm } from "@/components/proveedores/ProveedorSearchForm";
import { ProveedorDraftEmailModal } from "@/components/proveedores/ProveedorDraftEmailModal";
import { ProveedorSkillsModal } from "@/components/proveedores/ProveedorSkillsModal";
import { exportToExcel } from "@/lib/exportToExcel";
import { 
  Building2, 
  Search, 
  Bookmark, 
  Mail, 
  Download, 
  Send, 
  Filter, 
  CheckSquare, 
  Square, 
  Copy, 
  Check, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from "lucide-react";

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [savedProveedores, setSavedProveedores] = useState<Proveedor[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState("");
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [lastEngine, setLastEngine] = useState<SearchEngineType>("hybrid");

  // Local filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);

  // Modals & settings
  const [firecrawlApiKey, setFirecrawlApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [draftTargetProveedores, setDraftTargetProveedores] = useState<Proveedor[]>([]);
  const [copiedAllEmails, setCopiedAllEmails] = useState(false);

  // Load saved state from localStorage on mount
  useEffect(() => {
    try {
      const storedSaved = localStorage.getItem("cinemark_saved_proveedores");
      if (storedSaved) {
        setSavedProveedores(JSON.parse(storedSaved));
      }
      const storedKey = localStorage.getItem("firecrawl_api_key");
      if (storedKey) {
        setFirecrawlApiKey(storedKey);
      }
      const storedGem = localStorage.getItem("gemini_api_key");
      if (storedGem) {
        setGeminiApiKey(storedGem);
      }
    } catch (e) {
      console.error("Error loading localStorage:", e);
    }
  }, []);

  const handleSaveFirecrawlKey = (key: string) => {
    setFirecrawlApiKey(key);
    try {
      localStorage.setItem("firecrawl_api_key", key);
    } catch {}
  };

  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    try {
      localStorage.setItem("gemini_api_key", key);
    } catch {}
  };

  // Toggle bookmark in savedProveedores
  const handleToggleSave = (item: Proveedor) => {
    setSavedProveedores((prev) => {
      const exists = prev.some((p) => p.nombre === item.nombre);
      let updated: Proveedor[];
      if (exists) {
        updated = prev.filter((p) => p.nombre !== item.nombre);
      } else {
        updated = [{ ...item, guardado: true }, ...prev];
      }
      try {
        localStorage.setItem("cinemark_saved_proveedores", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Toggle selection for bulk actions
  const handleToggleSelect = (item: Proveedor) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleSelectAll = (list: Proveedor[]) => {
    setSelectedIds(new Set(list.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Execute Search
  const handleSearch = async (params: {
    rubro: string;
    zona: string;
    especificaciones?: string;
    engine: SearchEngineType;
    profundidad?: SearchDepthType;
    firecrawlApiKey?: string;
  }) => {
    setIsLoading(true);
    setSearchLogs([]);
    setSelectedIds(new Set());
    setActiveTab("search");
    setLastQuery(`${params.rubro} en ${params.zona}`);
    setLastEngine(params.engine);

    const apiEndpoint = process.env.NEXT_PUBLIC_PROVEEDORES_API || "https://apivacas.jariel.com.ar/api/proveedores-ia/search";

    try {
      let res: Response | null = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          geminiApiKey: geminiApiKey || undefined,
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback resiliente a ruta interna Next.js
        res = await fetch("/api/proveedores/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...params,
            geminiApiKey: geminiApiKey || undefined,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al procesar la búsqueda de proveedores");
      }

      setProveedores(data.proveedores || []);
      setSearchLogs(data.logs || []);
    } catch (err: any) {
      console.error("Error en búsqueda:", err);
      alert(`Error en la búsqueda: ${err.message}`);
    } finally {
      setIsLoading(false);
      setCurrentStepMessage("");
    }
  };

  // List of items currently displayed based on activeTab
  const currentList = activeTab === "search" ? proveedores : savedProveedores;

  // Filtered list based on search term & email filter
  const filteredList = useMemo(() => {
    return currentList.filter((p) => {
      const matchesText =
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.rubro.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.zona.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.descripcion_trabajos.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.clientes_proyectos.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEmail = onlyWithEmail ? Boolean(p.email) : true;

      return matchesText && matchesEmail;
    });
  }, [currentList, searchTerm, onlyWithEmail]);

  // Bulk copy emails
  const handleCopyAllEmails = () => {
    const emails = filteredList.map((p) => p.email).filter(Boolean);
    if (emails.length === 0) return;

    navigator.clipboard.writeText(emails.join(", "));
    setCopiedAllEmails(true);
    setTimeout(() => setCopiedAllEmails(false), 2000);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredList.length === 0) return;

    const dataToExport = filteredList.map((p, index) => ({
      "N°": index + 1,
      "Empresa / Proveedor": p.nombre,
      "Rubro / Especialidad": p.rubro,
      "Zona de Cobertura": p.zona,
      "Trabajos & Capacidad Técnica": p.descripcion_trabajos,
      "Con quién trabajó / Clientes": p.clientes_proyectos,
      "Correo de Contacto": p.email || "No informado",
      "Teléfono / WhatsApp": p.telefono || "No informado",
      "Sitio Web": p.sitio_web || "",
      "Fuente / De dónde se extrajo": p.fuente_nombre ? `${p.fuente_nombre} (${p.fuente})` : p.fuente || "Web",
      "Nivel Confiabilidad": p.confiabilidad || "media",
    }));

    const filename = `Proveedores_${(lastQuery || "Cinemark").replace(/[^a-zA-Z0-9]/g, "_")}`;
    exportToExcel(dataToExport, filename, "Proveedores");
  };

  // Open Draft RFP email modal
  const handleOpenDraftForSingle = (item: Proveedor) => {
    setDraftTargetProveedores([item]);
    setIsDraftModalOpen(true);
  };

  const handleOpenDraftForSelected = () => {
    const selected = currentList.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) {
      setDraftTargetProveedores(filteredList.filter((p) => Boolean(p.email)));
    } else {
      setDraftTargetProveedores(selected);
    }
    setIsDraftModalOpen(true);
  };

  // Metrics
  const totalFound = currentList.length;
  const totalWithEmail = currentList.filter((p) => Boolean(p.email)).length;
  const verifiedCount = currentList.filter((p) => p.confiabilidad === "alta").length;

  return (
    <AppLayout title="Buscador de Proveedores IA" subtitle="Cinemark & Hoyts">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Compras & Contrataciones • Cadena Cinemark & Hoyts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Buscador de Proveedores con IA & Web Scraping
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Localizá empresas y contratistas por rubro y zona, con extracción automática de antecedentes, clientes con los que trabajaron y correos de contacto directo.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-950/80 rounded-2xl border border-white/[0.08] self-start md:self-auto">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "search"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Búsqueda Activa {proveedores.length > 0 && `(${proveedores.length})`}</span>
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "saved"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Mis Guardados ({savedProveedores.length})</span>
            </button>
          </div>
        </div>

        {/* Search Prompt Form (Always visible or in Search Tab) */}
        {activeTab === "search" && (
          <ProveedorSearchForm
            onSearch={handleSearch}
            isLoading={isLoading}
            currentStepMessage={currentStepMessage}
            onOpenSkillsModal={() => setIsSkillsModalOpen(true)}
            firecrawlApiKey={firecrawlApiKey}
          />
        )}

        {/* Optional Search Logs Dropdown */}
        {searchLogs.length > 0 && activeTab === "search" && (
          <div className="bg-[#0b111e]/90 border border-white/[0.06] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>Registro del Agente IA & Rastreo Web ({searchLogs.length} eventos)</span>
              </span>
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showLogs && (
              <div className="p-4 border-t border-white/[0.06] bg-slate-950/70 font-mono text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
                {searchLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold select-none">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results Header, Metrics & Toolbar */}
        {currentList.length > 0 && (
          <div className="space-y-4 pt-2">
            {/* Metric Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#0b111e] border border-white/[0.06] flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                  {totalFound}
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Encontrados</div>
                  <div className="text-sm font-bold text-white">Proveedores</div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0b111e] border border-white/[0.06] flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  {totalWithEmail}
                </div>
                <div>
                  <div className="text-xs text-slate-400">Canales Directos</div>
                  <div className="text-sm font-bold text-white">Con Correo</div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0b111e] border border-white/[0.06] flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                  {verifiedCount}
                </div>
                <div>
                  <div className="text-xs text-slate-400">Alta Confiabilidad</div>
                  <div className="text-sm font-bold text-white">Verificados</div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0b111e] border border-white/[0.06] flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  {savedProveedores.length}
                </div>
                <div>
                  <div className="text-xs text-slate-400">Favoritos</div>
                  <div className="text-sm font-bold text-white">Guardados</div>
                </div>
              </div>
            </div>

            {/* Filtering & Action Toolbar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0b111e] border border-white/[0.08]">
              {/* Left: Search input & checkbox */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por nombre, cliente o trabajo..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithEmail}
                    onChange={(e) => setOnlyWithEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 accent-blue-500 cursor-pointer"
                  />
                  <span>Solo con correo confirmado</span>
                </label>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Select/Deselect all */}
                {selectedIds.size === filteredList.length && filteredList.length > 0 ? (
                  <button
                    onClick={handleDeselectAll}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Deseleccionar</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectAll(filteredList)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Seleccionar Todo</span>
                  </button>
                )}

                {/* Copy All Emails */}
                <button
                  onClick={handleCopyAllEmails}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Copiar lista de correos separados por coma"
                >
                  {copiedAllEmails ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAllEmails ? "Copiados" : "Copiar Correos"}</span>
                </button>

                {/* Export Excel */}
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Descargar planilla Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>

                {/* Draft RFP Email */}
                <button
                  onClick={handleOpenDraftForSelected}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Redactar correo de solicitud de presupuesto para los proveedores seleccionados"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Pedir Cotización {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredList.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Providers Grid */}
            {filteredList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredList.map((item) => {
                  const isSaved = savedProveedores.some((p) => p.nombre === item.nombre);
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <ProveedorCard
                      key={item.id}
                      proveedor={item}
                      isSaved={isSaved}
                      isSelected={isSelected}
                      onToggleSave={handleToggleSave}
                      onToggleSelect={handleToggleSelect}
                      onDraftEmail={handleOpenDraftForSingle}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-[#0b111e] border border-white/[0.06] text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-sm font-semibold text-slate-300">
                  Ningún proveedor coincide con los filtros aplicados
                </div>
                <p className="text-xs text-slate-500">
                  Probá desactivando "Solo con correo confirmado" o modificando el término de búsqueda.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State for Search tab when no search made */}
        {activeTab === "search" && proveedores.length === 0 && !isLoading && (
          <div className="p-8 sm:p-12 rounded-3xl bg-[#0b111e]/60 border border-white/[0.06] text-center space-y-4 max-w-2xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Búsqueda Rápida de Nuevos Proveedores
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1">
                Completá el rubro y la zona arriba para que el motor busque proveedores activos, extraiga qué trabajos realizan, clientes con los que trabajaron y sus correos de cotización.
              </p>
            </div>
          </div>
        )}

        {/* Empty State for Saved tab when no saved items */}
        {activeTab === "saved" && savedProveedores.length === 0 && (
          <div className="p-12 rounded-3xl bg-[#0b111e]/60 border border-white/[0.06] text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Bookmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No tenés proveedores guardados</h3>
              <p className="text-xs text-slate-400 mt-1">
                Hacé clic en el ícono de marcador de cualquier tarjeta para guardar proveedores en tu lista permanente.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      <ProveedorSkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        firecrawlApiKey={firecrawlApiKey}
        geminiApiKey={geminiApiKey}
        onSaveFirecrawlApiKey={handleSaveFirecrawlKey}
        onSaveGeminiApiKey={handleSaveGeminiKey}
      />

      <ProveedorDraftEmailModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        selectedProveedores={draftTargetProveedores}
      />
    </AppLayout>
  );
}
