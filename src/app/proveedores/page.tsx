"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { AppLayout } from "@/components/AppLayout";
import { Proveedor, SearchEngineType, SearchDepthType } from "@/types/proveedor";
import { ProveedorCard } from "@/components/proveedores/ProveedorCard";
import { ProveedorSearchForm } from "@/components/proveedores/ProveedorSearchForm";

// Dynamically loaded modals to optimize bundle size and avoid chunk load failures
const ProveedorDraftEmailModal = dynamic(
  () => import("@/components/proveedores/ProveedorDraftEmailModal").then((m) => m.ProveedorDraftEmailModal),
  { ssr: false }
);
const ProveedorSkillsModal = dynamic(
  () => import("@/components/proveedores/ProveedorSkillsModal").then((m) => m.ProveedorSkillsModal),
  { ssr: false }
);
const ProveedorAiChatModal = dynamic(
  () => import("@/components/proveedores/ProveedorAiChatModal").then((m) => m.ProveedorAiChatModal),
  { ssr: false }
);
const ProveedorDetailModal = dynamic(
  () => import("@/components/proveedores/ProveedorDetailModal").then((m) => m.ProveedorDetailModal),
  { ssr: false }
);
const ProveedorEnrichModal = dynamic(
  () => import("@/components/proveedores/ProveedorEnrichModal").then((m) => m.ProveedorEnrichModal),
  { ssr: false }
);
import {
  fetchProveedoresFromMongo,
  saveProveedorToMongo,
  updateProveedorInMongo,
  deleteProveedorFromMongo,
} from "@/lib/serverSync";
import { bulkSaveEnrichedProveedores } from "@/lib/proveedores/providerEnrichService";
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
  Plus,
  RefreshCw,
  FileText,
  Layers,
  ArrowRight
} from "lucide-react";

export default function ProveedoresPage() {
  // Registry state (from MongoDB: cotizaciones + saved providers)
  const [registryProveedores, setRegistryProveedores] = useState<Proveedor[]>([]);
  const [isRegistryLoading, setIsRegistryLoading] = useState(true);
  const [isRefreshingRegistry, setIsRefreshingRegistry] = useState(false);
  const [registryFilter, setRegistryFilter] = useState<"todos" | "cotizaciones" | "guardados" | "con_email">("todos");

  // Search state (from active IA web search)
  const [searchProveedores, setSearchProveedores] = useState<Proveedor[]>([]);
  const [savedProveedores, setSavedProveedores] = useState<Proveedor[]>([]);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"registry" | "search" | "saved">("registry");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Search loading & logs
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState("");
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [lastQuery, setLastQuery] = useState("");
  const [lastEngine, setLastEngine] = useState<SearchEngineType>("hybrid");

  // Local filtering & sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "rating" | "wins" | "quotes" | "alpha">("default");

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

  // Detail Modal State
  const [selectedDetailProveedor, setSelectedDetailProveedor] = useState<Proveedor | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // AI Enrichment Modal State
  const [isEnrichModalOpen, setIsEnrichModalOpen] = useState(false);
  const [enrichTargetProveedores, setEnrichTargetProveedores] = useState<Proveedor[]>([]);
  const [isBulkSavingEnriched, setIsBulkSavingEnriched] = useState(false);

  // Load registry from MongoDB and local storage on mount
  useEffect(() => {
    loadRegistryFromMongo();

    try {
      const storedSaved = localStorage.getItem("cinemark_saved_proveedores");
      if (storedSaved) {
        try {
          const parsed = JSON.parse(storedSaved);
          if (Array.isArray(parsed)) setSavedProveedores(parsed);
        } catch {}
      }
      const storedKey = localStorage.getItem("firecrawl_api_key");
      if (storedKey) setFirecrawlApiKey(storedKey);
      const storedGem = localStorage.getItem("gemini_api_key");
      if (storedGem) setGeminiApiKey(storedGem);
    } catch (e) {
      console.error("Error loading localStorage:", e);
    }
  }, []);

  const loadRegistryFromMongo = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshingRegistry(true);
    else setIsRegistryLoading(true);

    try {
      const getDeletedList = (): string[] => {
        if (typeof window === "undefined") return [];
        try {
          const raw = localStorage.getItem("finanzas_deleted_proveedores");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      };

      const deletedList = getDeletedList();
      const filterDeleted = (items: Proveedor[]): Proveedor[] => {
        if (!Array.isArray(items)) return [];
        if (deletedList.length === 0) return items;
        return items.filter((p) => {
          const id = p.id;
          const name = (p.nombre || "").toLowerCase().trim();
          const norm = (p.norm || "").toLowerCase().trim();
          return !deletedList.includes(id) && !deletedList.includes(name) && (!norm || !deletedList.includes(norm));
        });
      };

      // 1. Try reading cached registry for 0ms render
      if (!isManualRefresh && typeof window !== "undefined") {
        const cached = localStorage.getItem("finanzas_proveedores_unified_cache");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const cleanCache = filterDeleted(parsed);
              setRegistryProveedores(cleanCache);
              setIsRegistryLoading(false);
            }
          } catch {}
        }
      }

      // 2. Fetch fresh data from MongoDB
      const list = await fetchProveedoresFromMongo();
      if (list && Array.isArray(list)) {
        const cleanList = filterDeleted(list);
        setRegistryProveedores(cleanList);
        try {
          localStorage.setItem("finanzas_proveedores_unified_cache", JSON.stringify(cleanList));
        } catch {}
      }
    } catch (err) {
      console.warn("Error cargando registro de proveedores:", err);
    } finally {
      setIsRegistryLoading(false);
      setIsRefreshingRegistry(false);
    }
  };

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

  // Toggle bookmark / save in MongoDB database
  const handleToggleSave = async (item: Proveedor) => {
    const isCurrentlySaved = Boolean(item.guardado) || savedProveedores.some((p) => p.nombre === item.nombre);
    const newSavedStatus = !isCurrentlySaved;

    // Normalizar lista de correos
    const emailsList = Array.isArray(item.emails) && item.emails.length > 0
      ? item.emails
      : item.email ? [item.email] : [];

    const payload = {
      ...item,
      guardado: newSavedStatus,
      emails: emailsList,
      ubicacion: item.ubicacion || item.zona || "",
      fuente: item.fuente || (activeTab === "search" ? "busqueda_ia" : "manual")
    };

    // 1. Optimistic local update in savedProveedores
    setSavedProveedores((prev) => {
      const exists = prev.some((p) => (p.id && p.id === item.id) || p.nombre === item.nombre);
      let updated: Proveedor[];
      if (exists) {
        updated = prev.filter((p) => (p.id ? p.id !== item.id : true) && p.nombre !== item.nombre);
      } else {
        updated = [{ ...item, guardado: true, emails: emailsList }, ...prev];
      }
      try {
        localStorage.setItem("cinemark_saved_proveedores", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Optimistic update in searchProveedores
    setSearchProveedores((prev) =>
      prev.map((p) => {
        if (p.id === item.id || (p._id && item._id && p._id === item._id) || p.nombre === item.nombre) {
          return { ...p, guardado: newSavedStatus };
        }
        return p;
      })
    );

    // 3. Optimistic update in registryProveedores
    setRegistryProveedores((prev) => {
      const idx = prev.findIndex((p) => (p.id && p.id === item.id) || (p._id && item._id && p._id === item._id) || (p.norm && item.norm && p.norm === item.norm) || p.nombre === item.nombre);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], guardado: newSavedStatus };
        return next;
      } else if (newSavedStatus) {
        return [{ ...item, guardado: true, emails: emailsList }, ...prev];
      }
      return prev;
    });

    // 4. Optimistic update for open detail modal
    setSelectedDetailProveedor((prev) => {
      if (prev && (prev.id === item.id || prev.nombre === item.nombre)) {
        return { ...prev, guardado: newSavedStatus };
      }
      return prev;
    });

    // 5. Persist to MongoDB (apivacas.jariel.com.ar)
    try {
      await saveProveedorToMongo(payload);
    } catch (e) {
      console.warn("No se pudo persistir estado en MongoDB:", e);
    }
  };

  // Save changes from Detail Modal
  const handleSaveProveedorDetail = async (updated: Proveedor) => {
    try {
      const originalProv = selectedDetailProveedor;

      // Pass previous identifiers so MongoDB updates existing document even if renamed
      const payloadToSend = {
        ...updated,
        originalNombre: originalProv?.nombre || updated.nombre,
        originalId: originalProv?.id || updated.id,
        _id: originalProv?._id || updated._id,
        guardado: true,
      };

      const savedDoc = await saveProveedorToMongo(payloadToSend);
      
      const finalItem: Proveedor = {
        ...updated,
        id: savedDoc?._id || updated.id || `prov-${Date.now()}`,
        _id: savedDoc?._id || updated._id,
        guardado: true
      };

      // 1. Update in registry
      setRegistryProveedores((prev) => {
        const idx = prev.findIndex((p) =>
          (originalProv?.id && p.id === originalProv.id) ||
          (originalProv?._id && p._id === originalProv._id) ||
          (originalProv?.nombre && (p.nombre || "").toLowerCase().trim() === originalProv.nombre.toLowerCase().trim()) ||
          (p.id && (p.id === updated.id || p.id === finalItem.id)) ||
          (p._id && (p._id === updated._id || p._id === finalItem._id)) ||
          (p.nombre || "").toLowerCase().trim() === updated.nombre.toLowerCase().trim()
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...finalItem };
          return next;
        }
        return [finalItem, ...prev];
      });

      // 2. CRITICAL: Update in active search results so the card on screen immediately displays the edits!
      setSearchProveedores((prev) =>
        prev.map((p) => {
          const isMatch =
            (originalProv?.id && p.id === originalProv.id) ||
            (originalProv?._id && p._id === originalProv._id) ||
            (originalProv?.nombre && (p.nombre || "").toLowerCase().trim() === originalProv.nombre.toLowerCase().trim()) ||
            (p.id && (p.id === updated.id || p.id === finalItem.id)) ||
            (p._id && (p._id === updated._id || p._id === finalItem._id)) ||
            (p.nombre || "").toLowerCase().trim() === updated.nombre.toLowerCase().trim();

          return isMatch ? { ...p, ...finalItem } : p;
        })
      );

      // 3. Update in saved providers (and persist to localStorage)
      setSavedProveedores((prev) => {
        const idx = prev.findIndex((p) =>
          (originalProv?.id && p.id === originalProv.id) ||
          (originalProv?._id && p._id === originalProv._id) ||
          (originalProv?.nombre && (p.nombre || "").toLowerCase().trim() === originalProv.nombre.toLowerCase().trim()) ||
          (p.id && (p.id === updated.id || p.id === finalItem.id)) ||
          (p._id && (p._id === updated._id || p._id === finalItem._id)) ||
          (p.nombre || "").toLowerCase().trim() === updated.nombre.toLowerCase().trim()
        );
        let next: Proveedor[];
        if (idx !== -1) {
          next = [...prev];
          next[idx] = { ...next[idx], ...finalItem };
        } else {
          next = [{ ...finalItem, guardado: true }, ...prev];
        }
        try {
          localStorage.setItem("cinemark_saved_proveedores", JSON.stringify(next));
        } catch {}
        return next;
      });

      // 4. Update the active modal provider
      setSelectedDetailProveedor(finalItem);

      // 5. Update local unified cache
      try {
        const cached = localStorage.getItem("finanzas_proveedores_unified_cache");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const i = list.findIndex((p: any) =>
              (originalProv?.id && p.id === originalProv.id) ||
              (originalProv?._id && p._id === originalProv._id) ||
              (originalProv?.nombre && (p.nombre || "").toLowerCase().trim() === originalProv.nombre.toLowerCase().trim()) ||
              (p.id && (p.id === updated.id || p.id === finalItem.id)) ||
              (p._id && (p._id === updated._id || p._id === finalItem._id)) ||
              (p.nombre || "").toLowerCase().trim() === updated.nombre.toLowerCase().trim()
            );
            if (i !== -1) list[i] = { ...list[i], ...finalItem };
            else list.unshift(finalItem);
            localStorage.setItem("finanzas_proveedores_unified_cache", JSON.stringify(list));
          }
        }
      } catch {}
    } catch (e: any) {
      console.error("Error al guardar proveedor:", e);
      throw e;
    }
  };

  // Delete / Unlink a provider permanently so it never reappears or relinks
  const handleDeleteProveedor = async (item: Proveedor) => {
    if (!item) return;
    const confirmMessage = `¿Estás seguro de que querés eliminar a "${item.nombre}"? No volverá a aparecer en el registro ni se volverá a vincular con cotizaciones.`;
    if (!window.confirm(confirmMessage)) return;

    const targetId = item.id;
    const targetNorm = item.norm || "";
    const targetName = item.nombre;
    const targetAliases = Array.isArray(item.aliases) ? item.aliases : [];

    // 1. Optimistic removal from all states
    setRegistryProveedores((prev) =>
      prev.filter((p) => p.id !== targetId && p.nombre !== targetName && (!targetNorm || p.norm !== targetNorm))
    );
    setSavedProveedores((prev) => {
      const updated = prev.filter(
        (p) => p.id !== targetId && p.nombre !== targetName && (!targetNorm || p.norm !== targetNorm)
      );
      try {
        localStorage.setItem("cinemark_saved_proveedores", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSearchProveedores((prev) =>
      prev.filter((p) => p.id !== targetId && p.nombre !== targetName && (!targetNorm || p.norm !== targetNorm))
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    // 2. Persist to local blacklist and update unified cache
    if (typeof window !== "undefined") {
      try {
        const deletedRaw = localStorage.getItem("finanzas_deleted_proveedores");
        const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
        const toAdd = [
          targetId,
          targetName.toLowerCase().trim(),
          targetNorm.toLowerCase().trim(),
          ...targetAliases.map((a) => a.toLowerCase().trim()),
        ].filter(Boolean);

        toAdd.forEach((entry) => {
          if (!deletedList.includes(entry)) deletedList.push(entry);
        });
        localStorage.setItem("finanzas_deleted_proveedores", JSON.stringify(deletedList));

        const cached = localStorage.getItem("finanzas_proveedores_unified_cache");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const cleanList = list.filter(
              (p: any) =>
                p.id !== targetId &&
                p.nombre !== targetName &&
                (!targetNorm || p.norm !== targetNorm)
            );
            localStorage.setItem("finanzas_proveedores_unified_cache", JSON.stringify(cleanList));
          }
        }
      } catch (e) {
        console.warn("Aviso actualizando caché local de eliminados:", e);
      }
    }

    // 3. Close modal if active
    if (
      selectedDetailProveedor &&
      (selectedDetailProveedor.id === targetId || selectedDetailProveedor.nombre === targetName)
    ) {
      setIsDetailModalOpen(false);
      setSelectedDetailProveedor(null);
    }

    // 4. Notify backend to permanently mark as deleted and unlinked in MongoDB
    try {
      await deleteProveedorFromMongo(targetId, {
        nombre: targetName,
        norm: targetNorm,
        aliases: targetAliases,
      });
    } catch (err) {
      console.warn("Aviso eliminando proveedor en servidor:", err);
    }
  };

  // Open detail modal for a provider
  const handleOpenDetail = (prov: Proveedor) => {
    setSelectedDetailProveedor(prov);
    setIsDetailModalOpen(true);
  };

  // Open modal to add a brand new supplier
  const handleOpenAddNewProvider = () => {
    const blank: Proveedor = {
      id: `manual-${Date.now()}`,
      nombre: "",
      rubro: "",
      zona: "",
      ubicacion: "",
      sitio_web: "",
      linkedin: "",
      emails: [],
      email: "",
      telefono: "",
      descripcion_trabajos: "",
      clientes_proyectos: "",
      notas: "",
      guardado: true,
      fuente: "manual",
      cotizaciones: []
    };
    setSelectedDetailProveedor(blank);
    setIsDetailModalOpen(true);
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

  // Execute IA Web Search
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

      setSearchProveedores(data.proveedores || []);
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
    setSearchProveedores((prev) => {
      const existingNames = new Set(prev.map((p) => (p.nombre || "").toLowerCase().trim()));
      const filteredNew = newOnes.filter((p) => !existingNames.has((p.nombre || "").toLowerCase().trim()));
      return [...filteredNew, ...prev];
    });
    setActiveTab("search");
  };

  // Active list according to selected Tab
  const baseList = useMemo(() => {
    if (activeTab === "registry") {
      let list = registryProveedores;
      if (registryFilter === "cotizaciones") {
        list = list.filter((p) => (p.cotizaciones || []).length > 0);
      } else if (registryFilter === "guardados") {
        list = list.filter((p) => Boolean(p.guardado));
      } else if (registryFilter === "con_email") {
        list = list.filter((p) => (Array.isArray(p.emails) && p.emails.length > 0) || Boolean(p.email));
      }
      return list;
    }
    if (activeTab === "saved") {
      // Unir guardados de base de datos con locales
      const dbSaved = registryProveedores.filter((p) => Boolean(p.guardado));
      const map = new Map<string, Proveedor>();
      dbSaved.forEach((p) => map.set((p.nombre || "").toLowerCase().trim(), p));
      savedProveedores.forEach((p) => {
        const k = (p.nombre || "").toLowerCase().trim();
        if (!map.has(k)) map.set(k, p);
      });
      return Array.from(map.values());
    }
    return searchProveedores;
  }, [activeTab, registryProveedores, savedProveedores, searchProveedores, registryFilter]);

  // Filtered list based on search term, email filter & sorting
  const filteredList = useMemo(() => {
    const s = (searchTerm || "").toLowerCase().trim();
    if (!baseList || !Array.isArray(baseList)) return [];

    const filtered = baseList.filter((p) => {
      if (!p) return false;
      const nombre = (p.nombre || "").toLowerCase();
      const norm = (p.norm || "").toLowerCase();
      const aliases = Array.isArray(p.aliases) ? p.aliases.filter(Boolean).join(" ").toLowerCase() : "";
      const rubro = (p.rubro || "").toLowerCase();
      const zona = (p.zona || p.ubicacion || "").toLowerCase();
      const pais = (p.pais || "").toLowerCase();
      const desc = (p.descripcion_trabajos || "").toLowerCase();
      const clientes = (p.clientes_proyectos || "").toLowerCase();
      const emailsStr = (Array.isArray(p.emails) ? p.emails.filter(Boolean).join(" ") : p.email || "").toLowerCase();
      const quotesStr = (Array.isArray(p.cotizaciones) ? p.cotizaciones.map((c) => c?.name || "").join(" ") : "").toLowerCase();
      const tagsStr = (Array.isArray(p.slaTags) ? p.slaTags.join(" ") : "").toLowerCase();

      const matchesText =
        !s ||
        nombre.includes(s) ||
        norm.includes(s) ||
        aliases.includes(s) ||
        rubro.includes(s) ||
        zona.includes(s) ||
        pais.includes(s) ||
        desc.includes(s) ||
        clientes.includes(s) ||
        emailsStr.includes(s) ||
        quotesStr.includes(s) ||
        tagsStr.includes(s);

      const hasEmail = (Array.isArray(p.emails) && p.emails.length > 0) || Boolean(p.email);
      const matchesEmail = onlyWithEmail ? hasEmail : true;

      return matchesText && matchesEmail;
    });

    if (sortBy === "default") return filtered;

    return [...filtered].sort((a, b) => {
      if (sortBy === "rating") {
        return (Number(b.rating || 0) - Number(a.rating || 0)) || ((b.cotizaciones || []).length - (a.cotizaciones || []).length);
      }
      if (sortBy === "wins") {
        const winsA = (a.cotizaciones || []).filter((c) => c.isWinner).length;
        const winsB = (b.cotizaciones || []).filter((c) => c.isWinner).length;
        return (winsB - winsA) || ((b.cotizaciones || []).length - (a.cotizaciones || []).length);
      }
      if (sortBy === "quotes") {
        return (b.cotizaciones || []).length - (a.cotizaciones || []).length;
      }
      if (sortBy === "alpha") {
        return (a.nombre || "").localeCompare(b.nombre || "");
      }
      return 0;
    });
  }, [baseList, searchTerm, onlyWithEmail, sortBy]);

  // Bulk copy all emails of filtered list
  const handleCopyAllEmails = () => {
    const allMails: string[] = [];
    filteredList.forEach((p) => {
      if (Array.isArray(p.emails)) {
        p.emails.forEach((e) => {
          if (e && !allMails.includes(e.trim())) allMails.push(e.trim());
        });
      }
      if (p.email && !allMails.includes(p.email.trim())) {
        allMails.push(p.email.trim());
      }
    });

    if (allMails.length === 0) {
      alert("No hay correos en la selección actual para copiar.");
      return;
    }

    navigator.clipboard.writeText(allMails.join(", "));
    setCopiedAllEmails(true);
    setTimeout(() => setCopiedAllEmails(false), 2200);
  };

  // Copy Logs
  const handleCopyLogs = () => {
    if (searchLogs.length === 0) return;
    navigator.clipboard.writeText(searchLogs.join("\n"));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (filteredList.length === 0) return;

    const dataToExport = filteredList.map((p, index) => {
      const emailList = Array.isArray(p.emails) && p.emails.length > 0
        ? p.emails.join(", ")
        : p.email || "No registrado";

      const cotsList = (p.cotizaciones || []).map((c) => c.name).join(" • ");

      return {
        "N°": index + 1,
        "Empresa / Proveedor": p.nombre,
        "Variantes / Nombres Asimilados": (p.aliases || []).join(", "),
        "Rubro / Especialidad": p.rubro || "General",
        "Ubicación / Cobertura": p.ubicacion || p.zona || "No especificada",
        "Correos Electrónicos": emailList,
        "Teléfono / WhatsApp": p.telefono || "No registrado",
        "Sitio Web": p.sitio_web || "",
        "LinkedIn": p.linkedin || "",
        "Cotizaciones en las que Participó": (p.cotizaciones || []).length,
        "Nombres de Cotizaciones": cotsList || "Sin cotizaciones previas",
        "Trabajos & Capacidad Técnica": p.descripcion_trabajos || "",
        "Clientes & Referencias": p.clientes_proyectos || "",
        "Origen": p.fuente || "Registro",
        "Guardado en Favoritos": p.guardado ? "Sí" : "No",
      };
    });

    const filename = `Proveedores_${activeTab}_${new Date().toISOString().slice(0, 10)}`;
    const { exportToExcel } = await import("@/lib/exportToExcel");
    exportToExcel(dataToExport, filename, "Registro de Proveedores");
  };

  // Open Draft RFP email modal
  const handleOpenDraftForSingle = (item: Proveedor) => {
    setDraftTargetProveedores([item]);
    setIsDraftModalOpen(true);
  };

  const handleOpenDraftForSelected = () => {
    const selected = baseList.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) {
      setDraftTargetProveedores(filteredList.filter((p) => (Array.isArray(p.emails) && p.emails.length > 0) || Boolean(p.email)));
    } else {
      setDraftTargetProveedores(selected);
    }
    setIsDraftModalOpen(true);
  };

  // AI Enrichment Handlers
  const handleOpenEnrichModal = () => {
    const selected = baseList.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) {
      if (filteredList.length === 0) {
        alert("No hay proveedores disponibles para enriquecer con IA.");
        return;
      }
      setEnrichTargetProveedores(filteredList);
    } else {
      setEnrichTargetProveedores(selected);
    }
    setIsEnrichModalOpen(true);
  };

  const handleOpenEnrichForSingle = (item: Proveedor) => {
    setEnrichTargetProveedores([item]);
    setIsEnrichModalOpen(true);
  };

  const handleApplyEnriched = (enrichedList: Proveedor[]) => {
    if (!Array.isArray(enrichedList) || enrichedList.length === 0) return;

    const enrichedMap = new Map<string, Proveedor>();
    enrichedList.forEach((p) => {
      if (p.id) enrichedMap.set(p.id, p);
      if (p._id) enrichedMap.set(p._id, p);
      if (p.nombre) enrichedMap.set(p.nombre.toLowerCase().trim(), p);
      if (p.norm) enrichedMap.set(p.norm.toLowerCase().trim(), p);
    });

    const mergeList = (prev: Proveedor[]) => {
      return prev.map((p) => {
        const match =
          enrichedMap.get(p.id) ||
          (p._id ? enrichedMap.get(p._id) : null) ||
          enrichedMap.get((p.nombre || "").toLowerCase().trim()) ||
          (p.norm ? enrichedMap.get(p.norm.toLowerCase().trim()) : null);

        return match ? { ...p, ...match } : p;
      });
    };

    setRegistryProveedores((prev) => mergeList(prev));
    setSearchProveedores((prev) => mergeList(prev));
    setSavedProveedores((prev) => {
      const next = mergeList(prev);
      try {
        localStorage.setItem("cinemark_saved_proveedores", JSON.stringify(next));
      } catch {}
      return next;
    });

    // Update local cache
    try {
      const cached = localStorage.getItem("finanzas_proveedores_unified_cache");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const updated = mergeList(list);
          localStorage.setItem("finanzas_proveedores_unified_cache", JSON.stringify(updated));
        }
      }
    } catch {}
  };

  const handleSavedToDb = (savedList: Proveedor[]) => {
    if (!Array.isArray(savedList) || savedList.length === 0) return;
    const marked = savedList.map((p) => ({ ...p, guardado: true }));
    handleApplyEnriched(marked);
  };

  const handleBulkSaveAllEnriched = async () => {
    const toSave = filteredList.filter((p) => Boolean((p as any)._enriched) && !p.guardado);
    if (toSave.length === 0) return;

    setIsBulkSavingEnriched(true);
    try {
      const { savedCount } = await bulkSaveEnrichedProveedores(toSave);
      handleSavedToDb(toSave);
      alert(`✅ Se guardaron con éxito ${savedCount} proveedores en la base de datos MongoDB.`);
    } catch (err: any) {
      console.error("Error al guardar proveedores en lote:", err);
      alert(`Error al guardar proveedores: ${err?.message || "Ocurrió un error inesperado"}`);
    } finally {
      setIsBulkSavingEnriched(false);
    }
  };

  // Metrics & Counts
  const unsavedEnrichedCount = filteredList.filter((p) => Boolean((p as any)._enriched) && !p.guardado).length;

  // Metrics
  const totalRegistry = registryProveedores.length;
  const totalFromQuotes = registryProveedores.filter((p) => (p.cotizaciones || []).length > 0).length;
  const totalSavedCount = registryProveedores.filter((p) => Boolean(p.guardado)).length || savedProveedores.length;
  const totalWithEmailCount = registryProveedores.filter((p) => (Array.isArray(p.emails) && p.emails.length > 0) || Boolean(p.email)).length;

  return (
    <AppLayout title="Registro y Buscador de Proveedores" subtitle="Cinemark & Hoyts">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Compras & Contrataciones • Base Centralizada MongoDB</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Registro & Buscador de Proveedores
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Padrón inteligente de proveedores con asimilación automática de nombres en cotizaciones, múltiples correos de contacto, LinkedIn, ubicación e historial de comparativas.
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-950/90 rounded-2xl border border-white/[0.08] self-start md:self-auto shadow-inner flex-wrap sm:flex-nowrap gap-1">
            {/* Tab: Registro Central */}
            <button
              onClick={() => setActiveTab("registry")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === "registry"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Registro de Proveedores</span>
              {totalRegistry > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/20 text-white leading-tight">
                  {totalRegistry}
                </span>
              )}
            </button>

            {/* Tab: Búsqueda IA */}
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === "search"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Búsqueda Web con IA</span>
              {searchProveedores.length > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/20 text-white leading-tight">
                  {searchProveedores.length}
                </span>
              )}
            </button>

            {/* Tab: Guardados */}
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === "saved"
                  ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Guardados</span>
              {totalSavedCount > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/20 text-white leading-tight">
                  {totalSavedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: REGISTRO DE PROVEEDORES (Directorio + Cotizaciones) */}
        {/* ================================================================ */}
        {activeTab === "registry" && (
          <div className="space-y-4">
            {/* Metric Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-base">
                  {totalRegistry}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Total Registrados</div>
                  <div className="text-sm font-bold text-white tracking-tight">Proveedores</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-base">
                  {totalFromQuotes}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">De Cotizaciones</div>
                  <div className="text-sm font-bold text-white tracking-tight">Con Historial</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">
                  {totalWithEmailCount}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Canales Directos</div>
                  <div className="text-sm font-bold text-white tracking-tight">Con Correo</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0d1424]/90 to-[#080d18]/90 border border-white/[0.08] flex items-center gap-3.5 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base">
                  {totalSavedCount}
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-medium">Favoritos</div>
                  <div className="text-sm font-bold text-white tracking-tight">Guardados</div>
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setRegistryFilter("todos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  registryFilter === "todos"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-white/5"
                }`}
              >
                Todos ({totalRegistry})
              </button>
              <button
                onClick={() => setRegistryFilter("cotizaciones")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  registryFilter === "cotizaciones"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-white/5"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-300" />
                <span>De Cotizaciones ({totalFromQuotes})</span>
              </button>
              <button
                onClick={() => setRegistryFilter("guardados")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  registryFilter === "guardados"
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-white/5"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-300" />
                <span>Guardados ({totalSavedCount})</span>
              </button>
              <button
                onClick={() => setRegistryFilter("con_email")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  registryFilter === "con_email"
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-white/5"
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-emerald-300" />
                <span>Con Correo ({totalWithEmailCount})</span>
              </button>

              <button
                onClick={() => loadRegistryFromMongo(true)}
                disabled={isRefreshingRegistry}
                className="ml-auto px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Actualizar registro desde MongoDB"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRegistry ? "animate-spin text-blue-400" : ""}`} />
                <span>{isRefreshingRegistry ? "Sincronizando..." : "Sincronizar"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: SEARCH FORM (Cuando se selecciona Búsqueda Web con IA) */}
        {/* ================================================================ */}
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
                {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
        {(isLoading || (activeTab === "registry" && isRegistryLoading)) && (
          <div className="space-y-4 pt-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-sm text-blue-400 font-medium">
              <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
              <span>
                {isLoading
                  ? "Extrayendo candidatos y estructurando proveedores con IA..."
                  : "Cargando padrón unificado de proveedores y cotizaciones..."}
              </span>
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

        {/* ================================================================ */}
        {/* TOOLBAR COMÚN: BUSCADOR, FILTROS Y ACCIONES GLOBALES */}
        {/* ================================================================ */}
        {!isLoading && !(activeTab === "registry" && isRegistryLoading) && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-b from-[#0d1424]/95 to-[#080d18]/95 border border-white/[0.08] shadow-lg">
              {/* Left: Input búsqueda, ordenamiento & checkbox */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por empresa, alias, cotización, SLA, rubro o email..."
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

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/[0.08] text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  title="Ordenar proveedores"
                >
                  <option value="default">Orden: Relevancia</option>
                  <option value="rating">⭐ Mejor Calificación</option>
                  <option value="wins">🏆 Más Adjudicaciones</option>
                  <option value="quotes">📄 Más Cotizaciones</option>
                  <option value="alpha">🔤 Alfabético (A-Z)</option>
                </select>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    type="checkbox"
                    checked={onlyWithEmail}
                    onChange={(e) => setOnlyWithEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 accent-blue-500 cursor-pointer"
                  />
                  <span>Solo con correo</span>
                </label>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botón: Nuevo Proveedor manual */}
                <button
                  onClick={handleOpenAddNewProvider}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-600/20"
                  title="Registrar nuevo proveedor en MongoDB"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Proveedor</span>
                </button>

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

                {/* Copiar todos los correos de la lista */}
                <button
                  onClick={handleCopyAllEmails}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Copiar todos los correos de los proveedores listados"
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

                {/* Rellenar con IA */}
                <button
                  onClick={handleOpenEnrichModal}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/25 active:scale-95 cursor-pointer"
                  title="Rellenar ficha y contactos de proveedores con IA y búsqueda web"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>
                    Rellenar con IA {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredList.length})`}
                  </span>
                </button>

                {/* Pedir Cotización */}
                <button
                  onClick={handleOpenDraftForSelected}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/25 active:scale-[0.98] cursor-pointer"
                  title="Redactar pliego formal de solicitud de presupuesto"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Pedir Cotización {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredList.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Aviso y botón de Guardar Todos para proveedores enriquecidos con IA pendientes */}
            {unsavedEnrichedCount > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/30 text-amber-200 shadow-lg">
                <div className="flex items-center gap-2.5 text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                  <span>
                    <strong>{unsavedEnrichedCount}</strong> proveedor{unsavedEnrichedCount === 1 ? "" : "es"} con información encontrada por IA cargada en pantalla pendiente de guardar.
                  </span>
                </div>
                <button
                  onClick={handleBulkSaveAllEnriched}
                  disabled={isBulkSavingEnriched}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-500/20 self-end sm:self-auto"
                  title="Guardar todos los proveedores enriquecidos en la base de datos MongoDB"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBulkSavingEnriched ? "animate-spin" : ""}`} />
                  <span>{isBulkSavingEnriched ? "Guardando..." : "Guardar Todos en Base de Datos"}</span>
                </button>
              </div>
            )}

            {/* Providers Grid */}
            {filteredList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredList.map((item) => {
                  const isSaved = Boolean(item.guardado) || savedProveedores.some((p) => p.nombre === item.nombre);
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
                      onOpenDetail={handleOpenDetail}
                      onDelete={handleDeleteProveedor}
                      onEnrichWithIa={handleOpenEnrichForSingle}
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
                  Probá ajustando el término de búsqueda o cambiando el filtro seleccionado.
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Floating Copilot Launcher Button */}
      {baseList.length > 0 && (
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

      {/* Detail Modal */}
      <ProveedorDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailProveedor(null);
        }}
        proveedor={selectedDetailProveedor}
        onSaveProveedor={handleSaveProveedorDetail}
        onDeleteProveedor={handleDeleteProveedor}
        onDraftEmail={handleOpenDraftForSingle}
        onToggleSave={handleToggleSave}
        isSaved={selectedDetailProveedor ? Boolean(selectedDetailProveedor.guardado) || savedProveedores.some(p => p.nombre === selectedDetailProveedor.nombre) : false}
      />

      {/* Skills & Configuration Modal */}
      <ProveedorSkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        firecrawlApiKey={firecrawlApiKey}
        geminiApiKey={geminiApiKey}
        onSaveFirecrawlApiKey={handleSaveFirecrawlKey}
        onSaveGeminiApiKey={handleSaveGeminiKey}
      />

      {/* Draft RFP Email Modal */}
      <ProveedorDraftEmailModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        selectedProveedores={draftTargetProveedores}
      />

      {/* AI Chat Copilot Modal */}
      <ProveedorAiChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setChatInitialQuery("");
        }}
        currentProveedores={baseList}
        rubro={currentRubro || lastQuery.split(" en ")[0] || ""}
        zona={currentZona || lastQuery.split(" en ")[1] || ""}
        geminiApiKey={geminiApiKey}
        initialQuery={chatInitialQuery}
        onAddNewProveedores={handleAddNewProveedores}
      />

      {/* AI Provider Enrichment Modal */}
      <ProveedorEnrichModal
        isOpen={isEnrichModalOpen}
        onClose={() => setIsEnrichModalOpen(false)}
        selectedProveedores={enrichTargetProveedores}
        geminiApiKey={geminiApiKey}
        onApplyEnriched={handleApplyEnriched}
        onSavedToDb={handleSavedToDb}
      />
    </AppLayout>
  );
}
