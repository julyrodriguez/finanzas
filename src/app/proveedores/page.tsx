"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Proveedor, SearchEngineType, SearchDepthType } from "@/types/proveedor";
import { ProveedorCard } from "@/components/proveedores/ProveedorCard";
import { ProveedorSearchForm } from "@/components/proveedores/ProveedorSearchForm";
import { ProveedorDraftEmailModal } from "@/components/proveedores/ProveedorDraftEmailModal";
import { ProveedorSkillsModal } from "@/components/proveedores/ProveedorSkillsModal";
import { ProveedorAiChatModal } from "@/components/proveedores/ProveedorAiChatModal";
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
  AlertCircle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [savedProveedores, setSavedProveedores] = useState<Proveedor[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState("");
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
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
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState("");
  const [currentRubro, setCurrentRubro] = useState("");
  const [currentZona, setCurrentZona] = useState("");
  const [draftTargetProveedores, setDraftTargetProveedores] = useState<Proveedor[]>([]);
  const [copiedAllEmails, setCopiedAllEmails] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

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
    setShowLogs(true);
    setLastQuery(`${params.rubro} en ${params.zona}`);
    setLastEngine(params.engine);
    setCurrentRubro(params.rubro);
    setCurrentZona(params.zona);
    setCurrentStepMessage(`Iniciando búsqueda multicriterio para "${params.rubro}"...`);

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

  const handleInvestigateProvider = (prov: Proveedor) => {
    setChatInitialQuery(`Buscame más info de ${prov.nombre}`);
    setIsChatModalOpen(true);
  };

  const handleOpenChatFree = (customPrompt?: string) => {
    setChatInitialQuery(customPrompt || "");
    setIsChatModalOpen(true);
  };

  const handleAddNewProveedores = (newOnes: Proveedor[]) => {
    setProveedores((prev) => {
      const existingNames = new Set(prev.map((p) => (p.nombre || "").toLowerCase().trim()));
      const filteredNew = newOnes.filter((p) => !existingNames.has((p.nombre || "").toLowerCase().trim()));
      return [...filteredNew, ...prev];
    });
    setActiveTab("search");
  };

  // List of items currently displayed based on activeTab
  const currentList = activeTab === "search" ? proveedores : savedProveedores;

  // Filtered list based on search term & email filter
  const filteredList = useMemo(() => {
    const s = (searchTerm || "").toLowerCase().trim();
    if (!currentList || !Array.isArray(currentList)) return [];

    return currentList.filter((p) => {
      if (!p) return false;
      const nombre = (p.nombre || "").toLowerCase();
      const rubro = (p.rubro || "").toLowerCase();
      const zona = (p.zona || "").toLowerCase();
      const pais = (p.pais || "").toLowerCase();
      const desc = (p.descripcion_trabajos || "").toLowerCase();
      const clientes = (p.clientes_proyectos || "").toLowerCase();

      const matchesText =
        !s ||
        nombre.includes(s) ||
        rubro.includes(s) ||
        zona.includes(s) ||
        pais.includes(s) ||
        desc.includes(s) ||
        clientes.includes(s);

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

  // Copy Logs
  const handleCopyLogs = () => {
    if (searchLogs.length === 0) return;
    navigator.clipboard.writeText(searchLogs.join("\n"));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Buscador Inteligente de Proveedores con IA
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Localizá empresas, contratistas y talleres por rubro y zona, con extracción automática de obras realizadas, clientes atendidos y canales directos de cotización.
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-950/90 rounded-2xl border border-white/[0.08] self-start md:self-auto shadow-inner">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === "search"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Búsqueda Activa</span>
              {proveedores.length > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/20 text-white leading-tight">
                  {proveedores.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === "saved"
                  ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Mis Guardados</span>
              {savedProveedores.length > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/20 text-white leading-tight">
                  {savedProveedores.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Prompt Form */}
        {activeTab === "search" && (
          <ProveedorSearchForm
            onSearch={handleSearch}
            isLoading={isLoading}
            currentStepMessage={currentStepMessage}
            onOpenSkillsModal={() => setIsSkillsModalOpen(true)}
            firecrawlApiKey={firecrawlApiKey}
          />
        )}

        {/* Live Terminal / Search Logs */}
        {searchLogs.length > 0 && activeTab === "search" && (
          <div className="bg-[#090e18]/90 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl transition-all">
            <div className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-b border-white/[0.04]">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>Registro del Agente IA & Rastreo Web ({searchLogs.length} eventos)</span>
                {showLogs ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              <button
                onClick={handleCopyLogs}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                title="Copiar log completo"
              >
                {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLogs ? "Copiado" : "Copiar"}</span>
              </button>
            </div>

            {showLogs && (
              <div className="p-4 bg-slate-950/80 font-mono text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
                {searchLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className="text-cyan-400 font-bold select-none text-[10px] pt-0.5">›</span>
                    <span className="leading-relaxed">{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-4 pt-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-sm text-blue-400 font-medium">
              <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
              <span>Extrayendo candidatos y estructurando proveedores con IA...</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-5 sm:p-6 rounded-2xl bg-[#0d1424]/60 border border-white/[0.06] space-y-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-44 bg-slate-800 rounded-lg" />
                    <div className="h-6 w-20 bg-slate-800 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-12 bg-slate-800/60 rounded-xl" />
                    <div className="h-12 bg-slate-800/60 rounded-xl" />
                  </div>
                  <div className="h-9 bg-slate-800/40 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Header, Metrics & Toolbar */}
        {!isLoading && currentList.length > 0 && (
          <div className="space-y-4 pt-2">
            {/* Metric Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-base">
                  {totalFound}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Total Localizados</div>
                  <div className="text-sm font-bold text-white tracking-tight">Proveedores</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">
                  {totalWithEmail}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Canales Directos</div>
                  <div className="text-sm font-bold text-white tracking-tight">Con Correo</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-base">
                  {verifiedCount}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Alta Confiabilidad</div>
                  <div className="text-sm font-bold text-white tracking-tight">Verificados</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base">
                  {savedProveedores.length}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Favoritos</div>
                  <div className="text-sm font-bold text-white tracking-tight">Guardados</div>
                </div>
              </div>
            </div>

            {/* Filtering & Action Toolbar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-b from-[#0d1424]/95 to-[#080d18]/95 border border-white/[0.08] shadow-lg">
              {/* Left: Search input & checkbox */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por nombre, cliente o especialidad..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/70 border border-white/[0.08] hover:border-white/15 focus:border-blue-500/70 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
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
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Deseleccionar</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectAll(filteredList)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Seleccionar Todo</span>
                  </button>
                )}

                {/* Copy All Emails */}
                <button
                  onClick={handleCopyAllEmails}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Copiar lista de correos separados por coma"
                >
                  {copiedAllEmails ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAllEmails ? "Copiados" : "Copiar Correos"}</span>
                </button>

                {/* Export Excel */}
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 hover:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-500/10"
                  title="Descargar planilla Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Excel (.xlsx)</span>
                </button>

                {/* AI Copilot Button in toolbar */}
                <button
                  onClick={() => handleOpenChatFree()}
                  className="px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm shadow-blue-500/10"
                  title="Abrir Asistente IA de Proveedores"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Consultar IA</span>
                </button>

                {/* Draft RFP Email */}
                <button
                  onClick={handleOpenDraftForSelected}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/25 active:scale-[0.98] cursor-pointer"
                  title="Redactar correo formal de solicitud de presupuesto"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Pedir Cotización {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredList.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Interactive Post-Search Copilot Banner */}
            {activeTab === "search" && proveedores.length > 0 && (
              <div className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/90 border border-blue-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg shadow-blue-950/20">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>Asistente Inteligente de Compras & Proveedores</span>
                      <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/20">
                        IA Activa
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Podés pedirle más antecedentes de una empresa o que busque <strong>nuevas opciones distintas</strong> a estas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                  <button
                    onClick={() => handleOpenChatFree("Buscá nuevas empresas que no sean las que busco recién y traeme opciones distintas")}
                    className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar Nuevas Distintas</span>
                  </button>
                  <button
                    onClick={() => handleOpenChatFree()}
                    className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Preguntar a la IA</span>
                  </button>
                </div>
              </div>
            )}

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
                      onInvestigate={handleInvestigateProvider}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-[#0b111e]/90 border border-white/[0.08] text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-sm font-semibold text-slate-300">
                  Ningún proveedor coincide con los filtros aplicados
                </div>
                <p className="text-xs text-slate-500">
                  Probá desactivando "Solo con correo confirmado" o modificando el término en el buscador.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State for Search tab when no search made */}
        {activeTab === "search" && proveedores.length === 0 && !isLoading && (
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#0d1424]/60 to-[#070b14]/60 border border-white/[0.06] text-center space-y-4 max-w-2xl mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Búsqueda Inteligente de Nuevos Proveedores
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Ingresá el rubro y la zona geográfica en el prompt superior para que la IA rastree la web, extraiga experiencia, clientes previos y canales de cotización.
              </p>
            </div>
          </div>
        )}

        {/* Empty State for Saved tab when no saved items */}
        {activeTab === "saved" && savedProveedores.length === 0 && (
          <div className="p-12 rounded-3xl bg-gradient-to-b from-[#0d1424]/60 to-[#070b14]/60 border border-white/[0.06] text-center space-y-4 max-w-md mx-auto shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Bookmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">No tenés proveedores guardados</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Hacé clic en el ícono de marcador de cualquier tarjeta para guardar proveedores en tu lista permanente.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Floating Copilot Launcher Button */}
      {proveedores.length > 0 && (
        <button
          onClick={() => handleOpenChatFree()}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-2xl shadow-blue-600/40 border border-blue-400/30 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
          title="Abrir Asistente IA de Proveedores"
        >
          <Sparkles className="w-4 h-4 text-blue-200 animate-pulse" />
          <span>Asistente IA</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      )}

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

      <ProveedorAiChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setChatInitialQuery("");
        }}
        currentProveedores={proveedores}
        rubro={currentRubro || lastQuery.split(" en ")[0] || ""}
        zona={currentZona || lastQuery.split(" en ")[1] || ""}
        geminiApiKey={geminiApiKey}
        initialQuery={chatInitialQuery}
        onAddNewProveedores={handleAddNewProveedores}
      />
    </AppLayout>
  );
}
