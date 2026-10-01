"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  setDoc,
  getDoc
} from "firebase/firestore";
import {
  fetchCotizacionesFromMongo,
  syncCotizacionToMongo,
  syncCotizacionesBulkToMongo,
  deleteCotizacionFromMongo,
  fetchPendientesFromMongo,
  syncPendienteToMongo,
  syncPendienteConfigToMongo,
  getTimestampSeconds,
} from "@/lib/serverSync";
import { 
  Plus, 
  Trash2, 
  Save, 
  Calculator, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Copy, 
  HelpCircle, 
  RefreshCw, 
  FileSpreadsheet, 
  FolderOpen,
  ArrowRight,
  Info,
  Scale,
  Layers,
  Share2,
  X,
  Folder,
  Folders,
  Link2,
  ExternalLink,
  ListTodo,
  Search,
  FolderPlus,
  Unlink,
  Upload,
  Clipboard,
  Download,
  FileUp,
  Check,
  Paintbrush,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bot,
  Sparkles,
  Paperclip,
  Mail,
  FileText,
  Trophy,
  Send,
  XCircle,
  Clock,
  Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import { CotizacionesAiChatModal, QuoteAttachment } from "@/components/cotizaciones/CotizacionesAiChatModal";
import { CotizacionesImportAiModal } from "@/components/cotizaciones/CotizacionesImportAiModal";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Types definition
interface Item {
  id: string;
  name: string;
  baseUnit: string;
  targetQuantity: number;
}

interface QuoteDetail {
  currency: "ARS" | "USD";
  presentationType: "base" | "package";
  presentationName: string; // e.g. "Caja x 5", "Pack x 12"
  unitsPerPresentation: number; // multiplier, e.g. 5, 12, or 1 for base unit
  price: number; // raw price entered
  discount: number; // percentage
  specification?: string; // e.g. Philips, Generic, etc.
}

interface Provider {
  id: string;
  name: string;
  quotes: Record<string, QuoteDetail>; // key is itemId
}

interface SavedQuotation {
  id?: string;
  name: string;
  notes: string;
  exchangeRate: number;
  baseCurrency: "ARS" | "USD";
  useRealLots: boolean; // if true, computes cost by rounding up to whole packages
  items: Item[];
  providers: Provider[];
  createdAt?: { seconds: number; nanoseconds: number } | string | null;
  createdBy?: string;
  isFinalized?: boolean;
  status?: string;
  winningProviderId?: string;
  sentAt?: string;
  categoria?: string;
  pendienteId?: string;
  pendienteTitulo?: string;
  attachments?: QuoteAttachment[];
}

const DEFAULT_UNITS = [
  { value: "U", label: "Unidades (U)" },
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "L", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "m", label: "Metros (m)" },
  { value: "m2", label: "Metros Cuadrados (m²)" },
  { value: "Pack", label: "Packs (Pack)" },
  { value: "Caja", label: "Cajas (Caja)" },
  { value: "Hora", label: "Horas (h)" },
];

export default function CotizacionesPage() {
  const { user } = useAuth();
  const [dbActive, setDbActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "comparador" | "historial">("historial");

  // General State
  const [quoteName, setQuoteName] = useState("Cotización de Insumos " + new Date().toLocaleDateString("es-AR"));
  const [notes, setNotes] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1400); // 1 USD = 1400 ARS
  const [baseCurrency, setBaseCurrency] = useState<"ARS" | "USD">("ARS");
  const [useRealLots, setUseRealLots] = useState<boolean>(false);
  const [status, setStatus] = useState<"borrador" | "enviada" | "finalizada" | "cancelada">("borrador");
  const [winningProviderId, setWinningProviderId] = useState<string>("");
  const [sentAt, setSentAt] = useState<string>("");
  const [hasActiveQuote, setHasActiveQuote] = useState<boolean>(false);
  const isLocked = status !== "borrador";
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [minimizedProviders, setMinimizedProviders] = useState<Record<string, boolean>>({});
  const [isImportAiModalOpen, setIsImportAiModalOpen] = useState<boolean>(false);
  const [importAiTargetProviderId, setImportAiTargetProviderId] = useState<string | undefined>(undefined);
  const [importAiTargetProviderName, setImportAiTargetProviderName] = useState<string | undefined>(undefined);

  const toggleMinimizeProvider = (providerId: string) => {
    setMinimizedProviders((prev) => {
      const current = prev[providerId] ?? true;
      return {
        ...prev,
        [providerId]: !current
      };
    });
  };

  const toggleMinimizeAllProviders = () => {
    const allMinimized = providers.length > 0 && providers.every((p) => (minimizedProviders[p.id] ?? true));
    const newState: Record<string, boolean> = {};
    providers.forEach((p) => {
      newState[p.id] = !allMinimized;
    });
    setMinimizedProviders(newState);
  };

  // Items State
  const [items, setItems] = useState<Item[]>([
    { id: "item-1", name: "Resma de Papel A4 75g", baseUnit: "U", targetQuantity: 30 },
    { id: "item-2", name: "Café Express en Grano", baseUnit: "kg", targetQuantity: 15 },
    { id: "item-3", name: "Azúcar Común Tipo A", baseUnit: "kg", targetQuantity: 50 }
  ]);

  // Providers State
  const [providers, setProviders] = useState<Provider[]>([
    {
      id: "prov-1",
      name: "Distribuidora Alfa",
      quotes: {
        "item-1": { currency: "ARS", presentationType: "package", presentationName: "Pack x 5", unitsPerPresentation: 5, price: 6500, discount: 0 },
        "item-2": { currency: "USD", presentationType: "base", presentationName: "", unitsPerPresentation: 1, price: 18.5, discount: 5 },
        "item-3": { currency: "ARS", presentationType: "package", presentationName: "Bolsa x 10kg", unitsPerPresentation: 10, price: 11000, discount: 0 }
      }
    },
    {
      id: "prov-2",
      name: "Insumos Express",
      quotes: {
        "item-1": { currency: "ARS", presentationType: "base", presentationName: "", unitsPerPresentation: 1, price: 1400, discount: 2 },
        "item-2": { currency: "ARS", presentationType: "base", presentationName: "", unitsPerPresentation: 1, price: 25000, discount: 0 },
        "item-3": { currency: "ARS", presentationType: "base", presentationName: "", unitsPerPresentation: 1, price: 1200, discount: 3 }
      }
    }
  ]);

  // Saved Quotations list
  const [savedQuotations, setSavedQuotations] = useState<SavedQuotation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);

  // Rubro / Categoría & Linking with Pendiente state
  const [quoteCategoria, setQuoteCategoria] = useState<string>("");
  const [quotePendienteId, setQuotePendienteId] = useState<string>("");
  const [quotePendienteTitulo, setQuotePendienteTitulo] = useState<string>("");

  // Categorías & Pendientes reference data from Firestore
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [allPendientes, setAllPendientes] = useState<Array<{ id: string; titulo: string; categoria?: string; cotizacionesIds?: string[] }>>([]);

  // Filters for Historial Tab
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [searchHistory, setSearchHistory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("pendientes");
  const [filterOnlyLinked, setFilterOnlyLinked] = useState<boolean>(false);

  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryModalInput, setNewCategoryModalInput] = useState<string>("");

  // Image Export States
  const [showImgModal, setShowImgModal] = useState<boolean>(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [convertCurrencies, setConvertCurrencies] = useState<boolean>(false);
  // Highlight cheapest option in Comparative Matrix: "none" | "company" | "item" | "strongpoint"
  const [highlightMode, setHighlightMode] = useState<"none" | "company" | "item" | "strongpoint">("none");
  // Excluded items from comparison / calculations in matrix
  const [excludedItemIds, setExcludedItemIds] = useState<string[]>([]);
  // Excluded providers from comparison / calculations / copy / export
  const [excludedProviderIds, setExcludedProviderIds] = useState<string[]>([]);
  // Tracking direct file upload per provider
  const [uploadingProviderId, setUploadingProviderId] = useState<string | null>(null);

  // UI Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Excel / Grid Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [pastedText, setPastedText] = useState<string>("");
  const [importReplaceExisting, setImportReplaceExisting] = useState<boolean>(true);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importParsedPreview, setImportParsedPreview] = useState<{
    items: Item[];
    providers: Provider[];
    rawHeaders: string[];
    sampleRows: { itemName: string; prices: number[] }[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Firebase Db Activation & Sync
  useEffect(() => {
    const db = getFirebaseDb();
    setTimeout(() => {
      setDbActive(!!db);
    }, 0);
  }, []);

  // Fetch History from MongoDB first, then Firebase or LocalStorage fallback
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);

    // 1. Consultar MongoDB primero (Servidor propio)
    try {
      const quotes = await fetchCotizacionesFromMongo();
      if (quotes && Array.isArray(quotes)) {
        setSavedQuotations(quotes);
        setLoadingHistory(false);
        return;
      }
    } catch (err) {
      console.warn("MongoDB initial fetch warning in cotizaciones, trying fallback:", err);
    }

    // 2. Firebase Fallback (solo si falla MongoDB)
    const db = getFirebaseDb();
    if (db) {
      try {
        const q = query(collection(db, "cotizaciones"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list: SavedQuotation[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SavedQuotation);
        });
        if (list.length > 0) {
          setSavedQuotations(list);
          syncCotizacionesBulkToMongo(list);
          setLoadingHistory(false);
          return;
        }
      } catch (fbErr) {
        console.warn("⚠️ Error cargando cotizaciones desde Firebase fallback:", fbErr);
      }
    }

    // 3. LocalStorage Fallback
    loadLocalStorageHistory();
    setLoadingHistory(false);
  }, []);

  const loadLocalStorageHistory = () => {
    try {
      const localData = localStorage.getItem("finanzas-cotizaciones");
      if (localData) {
        setSavedQuotations(JSON.parse(localData));
      }
    } catch (e) {
      console.error("Error loading localStorage history:", e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load categories config & pendientes from MongoDB first (no onSnapshot stream)
  useEffect(() => {
    let isMounted = true;

    const loadMetadata = async () => {
      try {
        const data = await fetchPendientesFromMongo();
        if (!isMounted || !data) return;
        if (data.config?.categorias && Array.isArray(data.config.categorias) && data.config.categorias.length > 0) {
          setCustomCategories(data.config.categorias);
        }
        if (data.pendientes && Array.isArray(data.pendientes) && data.pendientes.length > 0) {
          const list = data.pendientes.map((p: any) => ({
            id: p.id || p.firebaseId,
            titulo: p.titulo || "Pendiente sin título",
            categoria: p.categoria || "",
            cotizacionesIds: Array.isArray(p.cotizacionesIds) ? p.cotizacionesIds : []
          }));
          setAllPendientes(list);
        }
      } catch (err) {
        console.warn("MongoDB metadata fetch warning in cotizaciones:", err);
      }
    };

    loadMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  // Helper to determine if a quote is a PCT or Pliego
  const isPctPliegoQuote = (q: { name?: string; categoria?: string }) => {
    const name = (q.name || "").trim().toUpperCase();
    const cat = (q.categoria || "").trim().toUpperCase();
    return (
      name.startsWith("PCT") ||
      name.includes("PLIEGO") ||
      cat === "PCT/PLIEGOS" ||
      cat === "PCT / PLIEGOS" ||
      cat.startsWith("PCT") ||
      cat.includes("PLIEGO")
    );
  };

  // Distinct categories available across customCategories, quotations, and pendientes
  const allCategories = useMemo(() => {
    const catsSet = new Set<string>();
    catsSet.add("PCT/PLIEGOS");
    customCategories.forEach((c) => {
      if (c && c.trim()) catsSet.add(c.trim());
    });
    savedQuotations.forEach((q) => {
      if (q.categoria && q.categoria.trim()) catsSet.add(q.categoria.trim());
    });
    allPendientes.forEach((p) => {
      if (p.categoria && p.categoria.trim()) catsSet.add(p.categoria.trim());
    });
    return Array.from(catsSet).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [customCategories, savedQuotations, allPendientes]);

  // Link / Unlink Pendiente
  const handleLinkPendiente = (pendId: string) => {
    if (!pendId) {
      setQuotePendienteId("");
      setQuotePendienteTitulo("");
      return;
    }
    const found = allPendientes.find((p) => p.id === pendId);
    if (found) {
      setQuotePendienteId(found.id);
      setQuotePendienteTitulo(found.titulo);
      // Auto-assign the category of the pendiente to the quotation
      if (found.categoria) {
        setQuoteCategoria(found.categoria);
      }
      showToast(`Vinculado a "${found.titulo}" (Rubro: ${found.categoria || "Sin rubro"})`, "info");
    }
  };

  // Create new category in Firestore
  // Create new category in Mongo & Firestore
  const handleCreateCategory = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    if (customCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      showToast("Esa carpeta ya existe", "error");
      return;
    }
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    setQuoteCategoria(trimmed);

    // 1. Dual Write: Mongo
    syncPendienteConfigToMongo("categorias", { list: updated });

    // 2. Dual Write: Firebase (no bloqueante)
    const db = getFirebaseDb();
    if (db) {
      const docRef = doc(db, "pendientes_config", "categorias");
      setDoc(docRef, { list: updated, updatedAt: serverTimestamp() }, { merge: true }).catch((err) => {
        console.warn("⚠️ Error saving category to Firebase:", err);
      });
    }
    showToast(`Carpeta "${trimmed}" creada`, "success");
  };

  // Filtered quotations for Historial tab
  // Helper para verificar concordancia de estado de cotización con el filtro activo
  const matchQuoteStatus = (q: SavedQuotation, filter: string): boolean => {
    if (filter === "todas" || filter === "todos") return true;
    const isFin = q.status === "finalizada" || q.isFinalized;
    const raw = (q.status || (isFin ? "finalizada" : "borrador")).toLowerCase().trim();

    if (filter === "pendientes" || filter === "borrador" || filter === "borradores") {
      return !isFin && raw !== "enviada" && raw !== "enviados" && raw !== "cancelada";
    }
    if (filter === "enviadas" || filter === "enviados" || filter === "enviada") {
      return raw === "enviada" || raw === "enviados";
    }
    if (filter === "finalizadas" || filter === "finalizados" || filter === "finalizada") {
      return isFin || raw === "finalizada" || raw === "finalizados";
    }
    return raw === filter.toLowerCase().trim();
  };

  // Status Counts for Top Filter Tabs
  const statusCounts = useMemo(() => {
    let todos = savedQuotations.length;
    let pendientes = 0;
    let enviados = 0;
    let finalizados = 0;

    savedQuotations.forEach((q) => {
      const isFin = q.status === "finalizada" || q.isFinalized;
      const raw = (q.status || (isFin ? "finalizada" : "borrador")).toLowerCase().trim();
      if (isFin || raw === "finalizada" || raw === "finalizados") {
        finalizados++;
      } else if (raw === "enviada" || raw === "enviados") {
        enviados++;
      } else if (raw !== "cancelada") {
        pendientes++;
      }
    });

    return { todos, pendientes, enviados, finalizados };
  }, [savedQuotations]);

  // Filtered quotations for Historial tab
  const filteredQuotations = useMemo(() => {
    return savedQuotations.filter((quote) => {
      // 1. Categoria filter
      if (filterCategoria !== "todas") {
        if (
          filterCategoria === "_pct_pliegos_" ||
          filterCategoria.toUpperCase() === "PCT/PLIEGOS" ||
          filterCategoria.toUpperCase() === "PCT / PLIEGOS"
        ) {
          if (!isPctPliegoQuote(quote)) return false;
        } else if (filterCategoria === "_sin_categoria_") {
          if (quote.categoria && quote.categoria.trim() !== "") return false;
        } else {
          if (quote.categoria?.toLowerCase() !== filterCategoria.toLowerCase()) return false;
        }
      }

      // 2. Status filter
      if (!matchQuoteStatus(quote, filterStatus)) {
        return false;
      }

      // 3. Only linked filter
      if (filterOnlyLinked) {
        if (!quote.pendienteId) return false;
      }

      // 4. Search term
      if (searchHistory.trim()) {
        const term = searchHistory.toLowerCase();
        const matchName = quote.name?.toLowerCase().includes(term);
        const matchNotes = quote.notes?.toLowerCase().includes(term);
        const matchPendiente = quote.pendienteTitulo?.toLowerCase().includes(term);
        const matchCategory = quote.categoria?.toLowerCase().includes(term);
        const matchItem = quote.items?.some((i) => i.name.toLowerCase().includes(term));
        const matchProv = quote.providers?.some((p) => p.name.toLowerCase().includes(term));
        if (!matchName && !matchNotes && !matchPendiente && !matchCategory && !matchItem && !matchProv) {
          return false;
        }
      }

      return true;
    });
  }, [savedQuotations, filterCategoria, filterStatus, filterOnlyLinked, searchHistory]);

  const getCategoryQuoteCount = (catName: string) => {
    return savedQuotations.filter((q) => {
      if (q.categoria?.toLowerCase() !== catName.toLowerCase()) return false;
      return matchQuoteStatus(q, filterStatus);
    }).length;
  };

  const pctPliegosQuoteCount = savedQuotations.filter((q) => {
    if (!isPctPliegoQuote(q)) return false;
    return matchQuoteStatus(q, filterStatus);
  }).length;

  const uncategorizedQuoteCount = savedQuotations.filter((q) => {
    if (q.categoria && q.categoria.trim() !== "") return false;
    return matchQuoteStatus(q, filterStatus);
  }).length;

  // Calc helper: gets true unit price in base unit and base currency
  const getCalculatedPrices = (quote: QuoteDetail, exchangeRateValue: number, baseCurr: "ARS" | "USD") => {
    if (!quote) return { trueUnitRateRaw: 0, trueUnitRateBaseCurrency: 0, discountPrice: 0 };
    
    // Apply discount if any
    const discountedRawPrice = quote.price * (1 - (quote.discount || 0) / 100);
    
    // Price per individual base unit (e.g. per box of 12 -> divide price by 12)
    const divisor = quote.unitsPerPresentation || 1;
    const unitPriceRaw = discountedRawPrice / divisor;

    // Convert currency to base currency
    let unitPriceInBaseCurrency = unitPriceRaw;
    if (quote.currency !== baseCurr) {
      if (baseCurr === "ARS") {
        // Quote in USD, comparison in ARS
        unitPriceInBaseCurrency = unitPriceRaw * exchangeRateValue;
      } else {
        // Quote in ARS, comparison in USD
        unitPriceInBaseCurrency = unitPriceRaw / exchangeRateValue;
      }
    }

    return {
      trueUnitRateRaw: unitPriceRaw,
      trueUnitRateBaseCurrency: unitPriceInBaseCurrency,
      discountPrice: discountedRawPrice
    };
  };

  // Calc helper: gets total cost for target quantity
  const calculateTotalCost = (
    quote: QuoteDetail, 
    targetQty: number, 
    exchangeRateValue: number, 
    baseCurr: "ARS" | "USD",
    lotsReal: boolean
  ) => {
    if (!quote || quote.price === undefined) return { totalBaseCurrency: 0, totalRawCurrency: 0, presentationsCount: 0 };

    const { trueUnitRateRaw, trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRateValue, baseCurr);

    if (lotsReal && quote.presentationType === "package" && quote.unitsPerPresentation > 0) {
      // Must buy in complete presentations
      const presentationsCount = Math.ceil(targetQty / quote.unitsPerPresentation);
      const totalRaw = presentationsCount * quote.price * (1 - (quote.discount || 0) / 100);
      
      let totalBase = totalRaw;
      if (quote.currency !== baseCurr) {
        totalBase = baseCurr === "ARS" ? totalRaw * exchangeRateValue : totalRaw / exchangeRateValue;
      }

      return {
        totalBaseCurrency: totalBase,
        totalRawCurrency: totalRaw,
        presentationsCount
      };
    } else {
      // Fractional buying (ideal math)
      const totalBase = targetQty * trueUnitRateBaseCurrency;
      const totalRaw = targetQty * trueUnitRateRaw;
      const presentationsCount = targetQty / (quote.unitsPerPresentation || 1);

      return {
        totalBaseCurrency: totalBase,
        totalRawCurrency: totalRaw,
        presentationsCount
      };
    }
  };

  // Add Item
  const handleAddItem = () => {
    const newId = `item-${Date.now()}`;
    const newItem: Item = {
      id: newId,
      name: "",
      baseUnit: "U",
      targetQuantity: 1
    };
    setItems([...items, newItem]);
    
    // Add empty quote structures for existing providers
    setProviders(providers.map(p => ({
      ...p,
      quotes: {
        ...p.quotes,
        [newId]: { currency: baseCurrency, presentationType: "base", presentationName: "", unitsPerPresentation: 1, price: 0, discount: 0 }
      }
    })));
  };

  // Edit Item Details
  const handleUpdateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (field === "targetQuantity") {
          return { ...item, [field]: parseFloat(value as string) || 0 };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    setProviders(providers.map(p => {
      const updatedQuotes = { ...p.quotes };
      delete updatedQuotes[id];
      return { ...p, quotes: updatedQuotes };
    }));
  };

  // Add Provider
  const handleAddProvider = () => {
    const newId = `prov-${Date.now()}`;
    const newProvider: Provider = {
      id: newId,
      name: `Proveedor ${providers.length + 1}`,
      quotes: {}
    };

    // Prepopulate with default values for each item
    items.forEach(item => {
      newProvider.quotes[item.id] = {
        currency: "ARS",
        presentationType: "base",
        presentationName: "",
        unitsPerPresentation: 1,
        price: 0,
        discount: 0
      };
    });

    setProviders([...providers, newProvider]);
  };

  // Delete Provider
  const handleDeleteProvider = (id: string) => {
    if (providers.length <= 1) {
      showToast("Debe haber al menos un proveedor", "error");
      return;
    }
    setProviders(providers.filter(p => p.id !== id));
    if (winningProviderId === id) {
      setWinningProviderId("");
    }
  };

  // Edit Provider Quote detail
  const handleUpdateQuote = (providerId: string, itemId: string, field: keyof QuoteDetail, value: string | number) => {
    setProviders(providers.map(p => {
      if (p.id === providerId) {
        const itemQuote = p.quotes[itemId] || {
          currency: "ARS",
          presentationType: "base",
          presentationName: "",
          unitsPerPresentation: 1,
          price: 0,
          discount: 0,
          specification: ""
        };

        const updatedQuote = { ...itemQuote, [field]: value };

        // Sanitizations
        if (field === "price") {
          updatedQuote.price = parseFloat(value as string) || 0;
        } else if (field === "discount") {
          updatedQuote.discount = Math.min(100, Math.max(0, parseFloat(value as string) || 0));
        } else if (field === "unitsPerPresentation") {
          const parsed = parseFloat(value as string);
          updatedQuote.unitsPerPresentation = isNaN(parsed) ? 0 : parsed;
        } else if (field === "presentationType") {
          if (value === "base") {
            updatedQuote.unitsPerPresentation = 1;
            updatedQuote.presentationName = "";
          }
        }

        return {
          ...p,
          quotes: {
            ...p.quotes,
            [itemId]: updatedQuote
          }
        };
      }
      return p;
    }));
  };

  // Save Quotation to Firebase or LocalStorage
  const handleSaveQuotation = async () => {
    if (!quoteName.trim()) {
      showToast("Ingresa un nombre para la cotización", "error");
      return;
    }

    let finalCategoria = quoteCategoria.trim();
    if (!finalCategoria && quoteName.trim().toUpperCase().startsWith("PCT")) {
      finalCategoria = "PCT/PLIEGOS";
      setQuoteCategoria("PCT/PLIEGOS");
    }

    const payload: Omit<SavedQuotation, "id"> = {
      name: quoteName,
      notes,
      exchangeRate,
      baseCurrency,
      useRealLots,
      items,
      providers,
      createdBy: user?.email || "Usuario Local",
      status,
      isFinalized: status === "finalizada",
      winningProviderId: status === "finalizada" ? winningProviderId : "",
      sentAt: status === "enviada" ? sentAt : "",
      categoria: finalCategoria,
      pendienteId: quotePendienteId.trim(),
      pendienteTitulo: quotePendienteTitulo.trim(),
      attachments: attachments || []
    };

    const db = getFirebaseDb();
    try {
      const savedId = currentQuoteId || (db ? doc(collection(db, "cotizaciones")).id : null) || `cot-${Date.now()}`;
      setCurrentQuoteId(savedId);

      const existingQuote = savedQuotations.find((q) => q.id === savedId);
      const fullQuote: SavedQuotation = {
        id: savedId,
        ...payload,
        createdAt: existingQuote?.createdAt || ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any)
      };

      // 1. Optimistic UI update
      setSavedQuotations((prev) => {
        const exists = prev.some((q) => q.id === savedId);
        return exists ? prev.map((q) => (q.id === savedId ? fullQuote : q)) : [fullQuote, ...prev];
      });

      // 2. Dual Write: Mongo (servidor propio)
      syncCotizacionToMongo(fullQuote);
      if (quotePendienteId) {
        const p = allPendientes.find((pend) => pend.id === quotePendienteId);
        if (p) {
          const currentIds = p.cotizacionesIds || [];
          if (!currentIds.includes(savedId)) {
            const updatedIds = [...currentIds, savedId];
            syncPendienteToMongo({ id: quotePendienteId, cotizacionesIds: updatedIds });
            setAllPendientes((prev) =>
              prev.map((pend) => (pend.id === quotePendienteId ? { ...pend, cotizacionesIds: updatedIds } : pend))
            );
          }
        }
      }
      const oldQuote = savedQuotations.find((q) => q.id === savedId);
      if (oldQuote?.pendienteId && oldQuote.pendienteId !== quotePendienteId) {
        const pOld = allPendientes.find((pend) => pend.id === oldQuote.pendienteId);
        if (pOld) {
          const updatedOldIds = (pOld.cotizacionesIds || []).filter((id) => id !== savedId);
          syncPendienteToMongo({ id: oldQuote.pendienteId, cotizacionesIds: updatedOldIds });
          setAllPendientes((prev) =>
            prev.map((pend) => (pend.id === oldQuote.pendienteId ? { ...pend, cotizacionesIds: updatedOldIds } : pend))
          );
        }
      }

      // 3. Dual Write: Firebase Firestore (no bloqueante, protegido)
      if (db && !savedId.startsWith("local-")) {
        setDoc(doc(db, "cotizaciones", savedId), {
          ...payload,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((err) => {
          console.warn("⚠️ Error saving cotizacion to Firebase (cuota o red):", err);
        });

        if (quotePendienteId) {
          updateDoc(doc(db, "pendientes", quotePendienteId), {
            cotizacionesIds: arrayUnion(savedId)
          }).catch(console.warn);
        }

        if (oldQuote?.pendienteId && oldQuote.pendienteId !== quotePendienteId) {
          updateDoc(doc(db, "pendientes", oldQuote.pendienteId), {
            cotizacionesIds: arrayRemove(savedId)
          }).catch(console.warn);
        }
      }

      // 4. Copia en LocalStorage
      try {
        const localData = localStorage.getItem("finanzas-cotizaciones");
        let list: SavedQuotation[] = localData ? JSON.parse(localData) : [];
        const exists = list.some((q) => q.id === savedId);
        list = exists ? list.map((q) => (q.id === savedId ? fullQuote : q)) : [fullQuote, ...list];
        localStorage.setItem("finanzas-cotizaciones", JSON.stringify(list));
      } catch (e) {}

      showToast(`Cotización "${quoteName}" guardada con éxito`);
    } catch (error) {
      console.error("Error saving quote:", error);
      showToast("Error al guardar la cotización", "error");
    }
  };

  // Clear / Start New
  const handleNewQuotation = () => {
    setQuoteName("Nueva Cotización " + new Date().toLocaleDateString("es-AR"));
    setNotes("");
    setCurrentQuoteId(null);
    setStatus("borrador");
    setWinningProviderId("");
    setSentAt("");
    setQuoteCategoria("");
    setQuotePendienteId("");
    setQuotePendienteTitulo("");
    setAttachments([]);
    setHasActiveQuote(true);
    setItems([
      { id: "item-1", name: "Insumo nuevo", baseUnit: "U", targetQuantity: 1 }
    ]);
    setProviders([
      {
        id: "prov-1",
        name: "Proveedor A",
        quotes: {
          "item-1": { currency: "ARS", presentationType: "base", presentationName: "", unitsPerPresentation: 1, price: 0, discount: 0 }
        }
      }
    ]);
    setActiveTab("editor");
    showToast("Formulario limpio para nueva cotización", "info");
  };

  // Load quote from history
  const handleSelectQuote = (quote: SavedQuotation) => {
    if (quote.id) {
      setCurrentQuoteId(quote.id);
    }
    setQuoteName(quote.name);
    setNotes(quote.notes || "");
    setExchangeRate(quote.exchangeRate || 1400);
    setBaseCurrency(quote.baseCurrency || "ARS");
    setUseRealLots(quote.useRealLots || false);
    setItems(quote.items || []);
    setProviders(quote.providers || []);
    setAttachments(quote.attachments || []);
    let loadedStatus: "borrador" | "enviada" | "finalizada" | "cancelada" = "borrador";
    if (quote.status) {
      loadedStatus = quote.status as "borrador" | "enviada" | "finalizada" | "cancelada";
    } else if (quote.isFinalized) {
      loadedStatus = "finalizada";
    }
    setStatus(loadedStatus);
    setWinningProviderId(quote.winningProviderId || "");
    setSentAt(quote.sentAt || "");
    setQuoteCategoria(quote.categoria || "");
    setQuotePendienteId(quote.pendienteId || "");
    setQuotePendienteTitulo(quote.pendienteTitulo || "");
    setHasActiveQuote(true);
    setActiveTab("editor");
    showToast(`Cotización "${quote.name}" cargada`);
  };

  // Deep-link effect: If opened with ?id=... or ?quoteId=..., load and open the quote directly in editor
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("id") || params.get("quoteId");
    if (!targetId || currentQuoteId === targetId) return;

    // 1. If already in savedQuotations, load it immediately
    const found = savedQuotations.find((q) => q.id === targetId);
    if (found) {
      setTimeout(() => {
        handleSelectQuote(found);
      }, 0);
      return;
    }

    // 2. Fetch directly from MongoDB first, then Firestore fallback
    fetchCotizacionesFromMongo()
      .then((quotes) => {
        if (Array.isArray(quotes)) {
          const match = quotes.find((q: any) => q.id === targetId || q.firebaseId === targetId);
          if (match) {
            handleSelectQuote(match);
            return;
          }
        }
        const db = getFirebaseDb();
        if (db) {
          getDoc(doc(db, "cotizaciones", targetId))
            .then((docSnap) => {
              if (docSnap.exists()) {
                const loaded = { id: docSnap.id, ...docSnap.data() } as SavedQuotation;
                handleSelectQuote(loaded);
              }
            })
            .catch((err) => {
              console.warn("Notice: could not load cotizacion from deep link via Firestore fallback:", err);
            });
        }
      })
      .catch((err) => {
        console.warn("Error checking MongoDB for deep link quote:", err);
      });
  }, [savedQuotations, dbActive, currentQuoteId]);

  // Delete saved quote from list
  const handleDeleteSavedQuote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de que querés eliminar esta cotización?")) return;

    const targetQuote = savedQuotations.find((q) => q.id === id);

    // 1. Optimistic UI update
    setSavedQuotations((prev) => prev.filter((q) => q.id !== id));
    if (currentQuoteId === id) {
      setCurrentQuoteId(null);
      setHasActiveQuote(false);
      setActiveTab("historial");
    }

    // 2. Dual Delete: Mongo
    deleteCotizacionFromMongo(id);
    if (targetQuote?.pendienteId) {
      const p = allPendientes.find((pend) => pend.id === targetQuote.pendienteId);
      if (p) {
        const updatedIds = (p.cotizacionesIds || []).filter((cid) => cid !== id);
        syncPendienteToMongo({ id: p.id, cotizacionesIds: updatedIds });
        setAllPendientes((prev) =>
          prev.map((pend) => (pend.id === p.id ? { ...pend, cotizacionesIds: updatedIds } : pend))
        );
      }
    }

    // 3. Dual Delete: Firebase (no bloqueante)
    const db = getFirebaseDb();
    if (db && !id.startsWith("local-")) {
      deleteDoc(doc(db, "cotizaciones", id)).catch((err) => {
        console.warn("⚠️ Error deleting cotizacion in Firebase (quota):", err);
      });
      if (targetQuote?.pendienteId) {
        updateDoc(doc(db, "pendientes", targetQuote.pendienteId), {
          cotizacionesIds: arrayRemove(id)
        }).catch(console.warn);
      }
    }

    // 4. Copia en LocalStorage
    try {
      const localData = localStorage.getItem("finanzas-cotizaciones");
      if (localData) {
        const list: SavedQuotation[] = JSON.parse(localData);
        localStorage.setItem("finanzas-cotizaciones", JSON.stringify(list.filter((q) => q.id !== id)));
      }
    } catch (e) {}

    showToast("Cotización eliminada");
  };

  // Duplicate quote
  const handleDuplicateQuote = (quote: SavedQuotation, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentQuoteId(null);
    setQuoteName(`${quote.name} (Copia)`);
    setNotes(quote.notes || "");
    setExchangeRate(quote.exchangeRate || 1400);
    setBaseCurrency(quote.baseCurrency || "ARS");
    setUseRealLots(quote.useRealLots || false);
    setItems(quote.items || []);
    setProviders(quote.providers || []);
    setStatus("borrador");
    setWinningProviderId("");
    setQuoteCategoria(quote.categoria || "");
    setQuotePendienteId("");
    setQuotePendienteTitulo("");
    setHasActiveQuote(true);
    setActiveTab("editor");
    showToast(`Copia creada de "${quote.name}"`);
  };

  // -----------------------------------------------------
  // ATTACHMENTS (PRESUPUESTOS Y MAILS .EML / .PDF)
  // -----------------------------------------------------

  const triggerAiSummaryUpdate = (quoteId: string, updatedAtts?: QuoteAttachment[]) => {
    if (!quoteId || quoteId.startsWith("local-") || quoteId.startsWith("temp_")) return;
    const currentAtts = updatedAtts || attachments;
    if (!currentAtts || currentAtts.length === 0) return;
    fetch("https://apivacas.jariel.com.ar/api/cotizaciones-ia/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cotizacionId: quoteId,
        quoteName: quoteName || "Cotización",
        items: items.map((it) => ({ name: it.name, targetQuantity: it.targetQuantity, baseUnit: it.baseUnit })),
        providers: providers.map((p) => ({ id: p.id, name: p.name })),
        attachments: currentAtts
      })
    }).catch((err) => console.warn("Background AI summary generation error:", err));
  };

  const handleUploadAttachment = async (file: File, providerId?: string, providerName?: string) => {
    try {
      const formData = new FormData();
      const targetQuoteId = currentQuoteId || "temp_" + Date.now();
      formData.append("cotizacionId", targetQuoteId);
      if (providerId) formData.append("providerId", providerId);
      if (providerName) formData.append("providerName", providerName);
      formData.append("file", file);

      const baseUrl = process.env.NEXT_PUBLIC_COTIZACIONES_UPLOAD || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/upload";
      const apiEndpoint = `${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}`;
      const res = await fetch(apiEndpoint, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Error en el servidor: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.attachment) {
        throw new Error(data.error || "No se pudo procesar el archivo");
      }

      const newAtt: QuoteAttachment = {
        ...data.attachment,
        providerId: providerId || data.attachment?.providerId,
        providerName: providerName || data.attachment?.providerName
      };
      const updated = [...attachments, newAtt];
      setAttachments(updated);

      // Auto-guardar si la cotización ya existe
      if (currentQuoteId) {
        // Dual Write: Mongo
        syncCotizacionToMongo({ id: currentQuoteId, attachments: updated });

        // Dual Write: Firebase
        const db = getFirebaseDb();
        if (db && !currentQuoteId.startsWith("local-")) {
          updateDoc(doc(db, "cotizaciones", currentQuoteId), {
            attachments: updated,
            updatedAt: serverTimestamp()
          }).catch(console.warn);

          // Disparar regeneración de resumen ejecutivo en segundo plano
          triggerAiSummaryUpdate(currentQuoteId, updated);
        }
      }

      showToast(
        providerName
          ? `Archivo "${file.name}" adjuntado a ${providerName}`
          : `Archivo "${file.name}" cargado exitosamente`
      );
    } catch (err: any) {
      console.error("Error subiendo archivo:", err);
      showToast(`Error al subir: ${err.message}`, "error");
    }
  };

  const handleDeleteAttachment = async (att: QuoteAttachment) => {
    try {
      const targetQuoteId = currentQuoteId || att.cotizacionId || "general";
      const apiEndpoint = `https://apivacas.jariel.com.ar/api/cotizaciones-ia/files/${targetQuoteId}/${encodeURIComponent(att.filename)}`;
      await fetch(apiEndpoint, { method: "DELETE" }).catch(console.error);

      const updated = attachments.filter((a) => a.id !== att.id);
      setAttachments(updated);

      if (currentQuoteId) {
        // Dual Write: Mongo
        syncCotizacionToMongo({ id: currentQuoteId, attachments: updated });

        // Dual Write: Firebase
        const db = getFirebaseDb();
        if (db && !currentQuoteId.startsWith("local-")) {
          updateDoc(doc(db, "cotizaciones", currentQuoteId), {
            attachments: updated,
            updatedAt: serverTimestamp()
          }).catch(console.warn);

          if (updated.length > 0) {
            triggerAiSummaryUpdate(currentQuoteId, updated);
          }
        }
      }

      showToast(`Archivo "${att.originalName}" eliminado`);
    } catch (err: any) {
      console.error("Error eliminando archivo:", err);
      showToast(`Error al eliminar: ${err.message}`, "error");
    }
  };

  // -----------------------------------------------------
  // IA PRESUPUESTOS / PDF IMPORT LOGIC
  // -----------------------------------------------------

  const handleConfirmImportAi = async (payload: {
    providerName: string;
    currency: "ARS" | "USD";
    notes?: string;
    attachment: QuoteAttachment;
    targetProviderId?: string;
    selectedItems: Array<{
      name: string;
      unit: string;
      quantity: number;
      price: number;
      discount: number;
      specification: string;
      presentationName: string;
      unitsPerPresentation: number;
      matchedItemId: string | null;
    }>;
  }) => {
    const { providerName, currency, notes: quoteNotes, attachment: newAttachment, targetProviderId, selectedItems } = payload;

    const providerId = targetProviderId || `prov-${Date.now()}`;

    const updatedAttachment: QuoteAttachment = {
      ...newAttachment,
      providerId,
      providerName
    };

    let currentItems = [...items];
    const newItemsToCreate: Item[] = [];
    const itemQuoteAssignments: Record<string, QuoteDetail> = {};

    selectedItems.forEach((si, idx) => {
      let targetItemId = si.matchedItemId;

      if (!targetItemId) {
        targetItemId = `item-${Date.now()}-${idx}`;
        const newItem: Item = {
          id: targetItemId,
          name: si.name,
          baseUnit: si.unit || "U",
          targetQuantity: si.quantity || 1
        };
        newItemsToCreate.push(newItem);
        currentItems.push(newItem);
      }

      itemQuoteAssignments[targetItemId] = {
        currency,
        presentationType: si.presentationName ? "package" : "base",
        presentationName: si.presentationName || "",
        unitsPerPresentation: si.unitsPerPresentation || 1,
        price: si.price,
        discount: si.discount || 0,
        specification: si.specification || ""
      };
    });

    if (newItemsToCreate.length > 0) {
      setItems(currentItems);
    }

    let updatedProviders = [...providers];

    if (targetProviderId) {
      updatedProviders = updatedProviders.map((p) => {
        if (p.id === targetProviderId) {
          const updatedQuotes = { ...p.quotes };
          Object.entries(itemQuoteAssignments).forEach(([itemId, quoteDetail]) => {
            updatedQuotes[itemId] = quoteDetail;
          });
          return {
            ...p,
            name: providerName || p.name,
            quotes: updatedQuotes
          };
        }
        if (newItemsToCreate.length > 0) {
          const emptyQuotes = { ...p.quotes };
          newItemsToCreate.forEach((ni) => {
            if (!emptyQuotes[ni.id]) {
              emptyQuotes[ni.id] = {
                currency: baseCurrency,
                presentationType: "base",
                presentationName: "",
                unitsPerPresentation: 1,
                price: 0,
                discount: 0
              };
            }
          });
          return { ...p, quotes: emptyQuotes };
        }
        return p;
      });
    } else {
      if (newItemsToCreate.length > 0) {
        updatedProviders = updatedProviders.map((p) => {
          const emptyQuotes = { ...p.quotes };
          newItemsToCreate.forEach((ni) => {
            if (!emptyQuotes[ni.id]) {
              emptyQuotes[ni.id] = {
                currency: baseCurrency,
                presentationType: "base",
                presentationName: "",
                unitsPerPresentation: 1,
                price: 0,
                discount: 0
              };
            }
          });
          return { ...p, quotes: emptyQuotes };
        });
      }

      const newProviderQuotes: Record<string, QuoteDetail> = {};
      currentItems.forEach((it) => {
        if (itemQuoteAssignments[it.id]) {
          newProviderQuotes[it.id] = itemQuoteAssignments[it.id];
        } else {
          newProviderQuotes[it.id] = {
            currency,
            presentationType: "base",
            presentationName: "",
            unitsPerPresentation: 1,
            price: 0,
            discount: 0
          };
        }
      });

      const newProvider: Provider = {
        id: providerId,
        name: providerName,
        quotes: newProviderQuotes
      };

      updatedProviders.push(newProvider);
    }

    setProviders(updatedProviders);

    const updatedAttachments = [...attachments, updatedAttachment];
    setAttachments(updatedAttachments);

    if (quoteNotes && !notes.trim()) {
      setNotes(quoteNotes);
    }

    if (!quoteCategoria || quoteCategoria.trim() === "") {
      const isPct = quoteName.trim().toUpperCase().startsWith("PCT") ||
        (newAttachment?.originalName && newAttachment.originalName.trim().toUpperCase().startsWith("PCT"));
      if (isPct) {
        setQuoteCategoria("PCT/PLIEGOS");
      }
    }

    if (currentQuoteId) {
      // Dual Write: Mongo
      syncCotizacionToMongo({
        id: currentQuoteId,
        items: currentItems,
        providers: updatedProviders,
        attachments: updatedAttachments
      });

      // Dual Write: Firebase
      const db = getFirebaseDb();
      if (db && !currentQuoteId.startsWith("local-")) {
        updateDoc(doc(db, "cotizaciones", currentQuoteId), {
          items: currentItems,
          providers: updatedProviders,
          attachments: updatedAttachments,
          updatedAt: serverTimestamp()
        }).catch((err) => console.warn("⚠️ Error saving imported AI quote to Firebase (quota):", err));

        triggerAiSummaryUpdate(currentQuoteId, updatedAttachments);
      }
    }

    if (selectedItems.length === 0) {
      showToast(
        targetProviderId
          ? `Archivo "${newAttachment.originalName || "presupuesto"}" adjuntado a "${providerName}" (sin modificar ítems)`
          : `Proveedor "${providerName}" creado con archivo adjunto`
      );
    } else {
      showToast(
        targetProviderId
          ? `Precios cargados con éxito para "${providerName}" (${selectedItems.length} ítems)`
          : `Proveedor "${providerName}" creado con éxito (${selectedItems.length} ítems)`
      );
    }
  };

  // -----------------------------------------------------
  // EXCEL / MATRIX IMPORT LOGIC
  // -----------------------------------------------------

  const parsePriceValue = (val: any): number => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, val);
    let str = String(val).trim().replace(/[^0-9.,-]/g, "");
    if (!str) return 0;
    const isNegative = str.startsWith("-");
    str = str.replace(/-/g, "");

    const hasComma = str.includes(",");
    const hasDot = str.includes(".");

    if (hasComma && hasDot) {
      const lastComma = str.lastIndexOf(",");
      const lastDot = str.lastIndexOf(".");

      if (lastComma > lastDot) {
        // e.g. 128.300.400,50 or 128.300,00 -> comma is decimal if < 3 digits
        const decimals = str.slice(lastComma + 1);
        const integerPart = str.slice(0, lastComma).replace(/[.,]/g, "");
        if (decimals.length < 3) {
          str = `${integerPart}.${decimals}`;
        } else {
          str = `${integerPart}${decimals}`;
        }
      } else {
        // e.g. 128,300,400.50 -> dot is decimal if < 3 digits
        const decimals = str.slice(lastDot + 1);
        const integerPart = str.slice(0, lastDot).replace(/[.,]/g, "");
        if (decimals.length < 3) {
          str = `${integerPart}.${decimals}`;
        } else {
          str = `${integerPart}${decimals}`;
        }
      }
    } else if (hasComma) {
      const commasCount = (str.match(/,/g) || []).length;
      if (commasCount > 1) {
        // Multiple commas: e.g. 128,300,400 -> all are thousands separators
        str = str.replace(/,/g, "");
      } else {
        // Exactly one comma: if < 3 digits after comma (e.g. 128,5 or 128,50), it is decimal.
        // If 3 or more (e.g. 128,300), it is thousands separator.
        const parts = str.split(",");
        const decimals = parts[1] || "";
        if (decimals.length < 3) {
          str = `${parts[0]}.${decimals}`;
        } else {
          str = parts[0] + decimals;
        }
      }
    } else if (hasDot) {
      const dotsCount = (str.match(/\./g) || []).length;
      if (dotsCount > 1) {
        // Multiple dots: e.g. 128.300.400 -> all are thousands separators
        str = str.replace(/\./g, "");
      } else {
        // Exactly one dot: if < 3 digits after dot (e.g. 128.5 or 128.50), it is decimal.
        // If 3 or more (e.g. 128.300), it is thousands separator.
        const parts = str.split(".");
        const decimals = parts[1] || "";
        if (decimals.length < 3) {
          str = `${parts[0]}.${decimals}`;
        } else {
          str = parts[0] + decimals;
        }
      }
    }

    const parsed = parseFloat(str);
    if (isNaN(parsed)) return 0;
    return isNegative ? -parsed : parsed;
  };

  const parseMatrixToQuote = (rawMatrix: any[][]) => {
    setImportError(null);
    if (!rawMatrix || rawMatrix.length === 0) {
      setImportParsedPreview(null);
      return;
    }

    // Determine header row (where provider names are)
    // Row 0 has providers in B1, C1, D1... (col 1..N).
    // If row 0 has no provider names beyond col 0, check row 1.
    let headerRowIdx = 0;
    const row0Providers = (rawMatrix[0] || []).slice(1).filter(c => String(c ?? "").trim().length > 0);
    if (row0Providers.length === 0 && rawMatrix.length > 1) {
      const row1Providers = (rawMatrix[1] || []).slice(1).filter(c => String(c ?? "").trim().length > 0);
      if (row1Providers.length > 0) {
        headerRowIdx = 1;
      }
    }

    const headerRow = rawMatrix[headerRowIdx] || [];
    const detectedProviders: { colIdx: number; name: string }[] = [];
    for (let col = 1; col < headerRow.length; col++) {
      const pName = String(headerRow[col] ?? "").trim();
      if (pName) {
        detectedProviders.push({ colIdx: col, name: pName });
      }
    }

    if (detectedProviders.length === 0) {
      setImportError("No se encontraron nombres de empresas o proveedores en las columnas de cabecera (B1, C1, D1...).");
      setImportParsedPreview(null);
      return;
    }

    const newItems: Item[] = [];
    const sampleRows: { itemName: string; prices: number[] }[] = [];
    const ts = Date.now();

    const newProviders: Provider[] = detectedProviders.map((dp, idx) => ({
      id: `prov-import-${ts}-${idx}`,
      name: dp.name,
      quotes: {}
    }));

    let itemCounter = 1;
    for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || row.length === 0) continue;

      const hasAnyContent = row.some((cell: any) => String(cell ?? "").trim().length > 0);
      if (!hasAnyContent) continue;

      const itemNameRaw = String(row[0] ?? "").trim();
      const itemName = itemNameRaw || `Ítem ${itemCounter}`;
      const itemId = `item-import-${ts}-${itemCounter}`;
      itemCounter++;

      newItems.push({
        id: itemId,
        name: itemName,
        baseUnit: "U",
        targetQuantity: 1
      });

      const rowPrices: number[] = [];
      detectedProviders.forEach((dp, pIdx) => {
        const rawCell = row[dp.colIdx];
        const price = parsePriceValue(rawCell);
        rowPrices.push(price);

        newProviders[pIdx].quotes[itemId] = {
          currency: baseCurrency,
          presentationType: "base",
          presentationName: "",
          unitsPerPresentation: 1,
          price,
          discount: 0
        };
      });

      sampleRows.push({
        itemName,
        prices: rowPrices
      });
    }

    if (newItems.length === 0) {
      setImportError("No se encontraron ítems en las filas (A2, A3, etc.). Asegurate de que la columna A contenga los nombres de los ítems.");
      setImportParsedPreview(null);
      return;
    }

    setImportParsedPreview({
      items: newItems,
      providers: newProviders,
      rawHeaders: detectedProviders.map(p => p.name),
      sampleRows
    });
  };

  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
        parseMatrixToQuote(raw);
      } catch (err) {
        console.error(err);
        setImportError("No se pudo leer el archivo. Asegurate de que sea un archivo Excel válido (.xlsx, .xls o .csv).");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePasteTextChange = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setImportParsedPreview(null);
      setImportError(null);
      return;
    }
    const lines = text.trim().split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length === 0) return;
    const firstLine = lines[0];
    let delimiter = "\t";
    if (!firstLine.includes("\t")) {
      if (firstLine.includes(";")) delimiter = ";";
      else if (firstLine.includes(",")) delimiter = ",";
    }
    const raw = lines.map(l => l.split(delimiter).map(c => c.trim()));
    parseMatrixToQuote(raw);
  };

  const handleApplyImport = () => {
    if (!importParsedPreview) return;

    if (importReplaceExisting) {
      setItems(importParsedPreview.items);
      setProviders(importParsedPreview.providers);
    } else {
      // Append mode: merge providers and items
      const mergedProviders = [...providers];
      const providerMap = new Map<string, Provider>();
      mergedProviders.forEach(p => providerMap.set(p.name.trim().toLowerCase(), p));

      importParsedPreview.providers.forEach(p => {
        const key = p.name.trim().toLowerCase();
        if (providerMap.has(key)) {
          const existing = providerMap.get(key)!;
          existing.quotes = { ...existing.quotes, ...p.quotes };
        } else {
          mergedProviders.push(p);
        }
      });

      setItems(prev => [...prev, ...importParsedPreview.items]);
      setProviders(mergedProviders);
    }

    if (importFileName && (quoteName.startsWith("Nueva Cotización") || quoteName.startsWith("Cotización de Insumos") || !quoteName.trim())) {
      const cleanName = importFileName.replace(/\.[^/.]+$/, "");
      setQuoteName(cleanName);
      if (cleanName.trim().toUpperCase().startsWith("PCT") && (!quoteCategoria || quoteCategoria.trim() === "")) {
        setQuoteCategoria("PCT/PLIEGOS");
      }
    }

    setHasActiveQuote(true);
    setActiveTab("editor");
    setIsImportModalOpen(false);
    setPastedText("");
    setImportFileName("");
    setImportParsedPreview(null);
    setImportError(null);
    showToast(`Se importaron ${importParsedPreview.items.length} ítems y ${importParsedPreview.providers.length} empresas`, "success");
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      ["", "Empresa A", "Empresa B", "Empresa C"],
      ["Resma A4 75g", 6500, 6200, 6800],
      ["Café en Grano 1kg", 25000, 24500, 26000],
      ["Azúcar 1kg", 1200, 1150, 1300],
      ["Toner Láser Negro", 45000, 43000, 48500]
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizaciones");
    XLSX.writeFile(wb, "Plantilla_Cotizaciones.xlsx");
    showToast("Plantilla descargada: Plantilla_Cotizaciones.xlsx", "info");
  };

  // -----------------------------------------------------
  // COMPARISON AND SCORING CALCULATIONS
  // -----------------------------------------------------

  // Toggle item inclusion in matrix calculations
  const toggleItemInclusion = (itemId: string) => {
    setExcludedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  // Toggle provider inclusion in matrix calculations and copying/export
  const toggleProviderInclusion = (providerId: string) => {
    setExcludedProviderIds(prev => 
      prev.includes(providerId) ? prev.filter(id => id !== providerId) : [...prev, providerId]
    );
  };

  // Totals per Provider (for full quote)
  const providerTotals = providers.map(prov => {
    let sumARS = 0;
    let sumUSD = 0;
    let itemsQuotedCount = 0;
    const activeItems = items.filter(it => !excludedItemIds.includes(it.id));
    
    activeItems.forEach(item => {
      const quote = prov.quotes[item.id];
      if (quote && quote.price > 0) {
        const { totalBaseCurrency, totalRawCurrency } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);
        if (convertCurrencies) {
          if (baseCurrency === "ARS") {
            sumARS += totalBaseCurrency;
          } else {
            sumUSD += totalBaseCurrency;
          }
        } else {
          if (quote.currency === "ARS") {
            sumARS += totalRawCurrency;
          } else {
            sumUSD += totalRawCurrency;
          }
        }
        itemsQuotedCount++;
      }
    });

    return {
      providerId: prov.id,
      providerName: prov.name,
      totalARS: sumARS,
      totalUSD: sumUSD,
      itemsQuotedCount,
      allQuoted: itemsQuotedCount === activeItems.length && activeItems.length > 0,
      isExcluded: excludedProviderIds.includes(prov.id)
    };
  });

  // Calculate cheapest provider overall (for highlightMode === "company")
  const providerCostComparisons = useMemo(() => {
    const activeItems = items.filter(it => !excludedItemIds.includes(it.id));
    const activeProviders = providers.filter(p => !excludedProviderIds.includes(p.id));
    return activeProviders.map(prov => {
      let totalBC = 0;
      let itemsQuoted = 0;
      activeItems.forEach(item => {
        const quote = prov.quotes[item.id];
        if (quote && quote.price > 0) {
          const { totalBaseCurrency } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);
          totalBC += totalBaseCurrency;
          itemsQuoted++;
        }
      });
      return {
        providerId: prov.id,
        totalBC,
        itemsQuoted
      };
    });
  }, [providers, items, excludedItemIds, excludedProviderIds, exchangeRate, baseCurrency, useRealLots]);

  const cheapestProviderId = useMemo(() => {
    const activeProviders = providers.filter(p => !excludedProviderIds.includes(p.id));
    if (activeProviders.length <= 1) return null;
    const valid = providerCostComparisons.filter(p => p.itemsQuoted > 0 && p.totalBC > 0);
    if (valid.length === 0) return null;
    const maxQuoted = Math.max(...valid.map(p => p.itemsQuoted));
    const candidates = valid.filter(p => p.itemsQuoted === maxQuoted);
    candidates.sort((a, b) => a.totalBC - b.totalBC);
    return candidates[0]?.providerId || null;
  }, [providers, excludedProviderIds, providerCostComparisons]);

  // Map of item.id -> array of providerIds that offer the lowest cost for that item
  const cheapestProvidersPerItem = useMemo(() => {
    const map: Record<string, string[]> = {};
    const activeProviders = providers.filter(p => !excludedProviderIds.includes(p.id));
    if (activeProviders.length <= 1) return map;
    const activeItems = items.filter(it => !excludedItemIds.includes(it.id));

    activeItems.forEach(item => {
      let minCost = Infinity;
      const providerCosts: { provId: string; cost: number }[] = [];

      activeProviders.forEach(prov => {
        const quote = prov.quotes[item.id];
        if (quote && quote.price > 0) {
          const { totalBaseCurrency } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);
          providerCosts.push({ provId: prov.id, cost: totalBaseCurrency });
          if (totalBaseCurrency < minCost) {
            minCost = totalBaseCurrency;
          }
        }
      });

      if (minCost < Infinity && providerCosts.length > 0) {
        map[item.id] = providerCosts
          .filter(p => Math.abs(p.cost - minCost) < 0.001)
          .map(p => p.provId);
      }
    });

    return map;
  }, [items, providers, excludedItemIds, excludedProviderIds, exchangeRate, baseCurrency, useRealLots]);

  // Map of provider.id -> array of itemIds where that provider has its lowest unit cost (Punto Fuerte)
  const strongestItemPerProvider = useMemo(() => {
    const map: Record<string, string[]> = {};
    const activeProviders = providers.filter(p => !excludedProviderIds.includes(p.id));
    const activeItems = items.filter(it => !excludedItemIds.includes(it.id));
    activeProviders.forEach(prov => {
      let minUnitCost = Infinity;
      const itemsQuoted: { itemId: string; unitCost: number }[] = [];

      activeItems.forEach(item => {
        const quote = prov.quotes[item.id];
        if (quote && quote.price > 0) {
          const { trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);
          itemsQuoted.push({ itemId: item.id, unitCost: trueUnitRateBaseCurrency });
          if (trueUnitRateBaseCurrency < minUnitCost) {
            minUnitCost = trueUnitRateBaseCurrency;
          }
        }
      });

      if (minUnitCost < Infinity && itemsQuoted.length > 0) {
        map[prov.id] = itemsQuoted
          .filter(it => Math.abs(it.unitCost - minUnitCost) < 0.001)
          .map(it => it.itemId);
      }
    });

    return map;
  }, [providers, items, excludedItemIds, excludedProviderIds, exchangeRate, baseCurrency]);



  // Move items order in comparative matrix and export
  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setItems(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Move providers order in comparative matrix and cards
  const moveProvider = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= providers.length) return;
    setProviders(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Helper formatting values
  const formatCurrencyValue = (val: number, curr: "ARS" | "USD" = baseCurrency) => {
    if (curr === "ARS") {
      return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } else {
      return "USD " + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  // Export quote comparison as a beautiful image card (Excel-style spreadsheet screenshot)
  const handleExportImage = () => {
    const activeProviders = providers.filter(p => !excludedProviderIds.includes(p.id));
    const activeItems = items.filter(it => !excludedItemIds.includes(it.id));

    if (activeProviders.length === 0) {
      showToast("No hay proveedores activos para exportar (están todos excluidos)", "error");
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dimensions
    const padding = 50;
    const itemRowHeight = 72; // Increased to allow up to 3 lines of product name
    const headerHeight = 200;
    
    // Dynamically calculate the table width based on providers count
    const colWidth = 135;
    const itemColWidth = 280;
    const qtyColWidth = 110;
    const tableWidth = itemColWidth + qtyColWidth + activeProviders.length * (colWidth * 2);
    
    const width = Math.max(1000, tableWidth + padding * 2);
    const contentHeight = 60 + (activeItems.length * itemRowHeight) + 75; // Headers + rows + totals
    
    const height = headerHeight + contentHeight + padding * 2;
    canvas.width = width;
    canvas.height = height;

    // Helper for rounded rect
    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      }
    };

    // Helper to wrap text up to maxLines
    const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number = 3) => {
      const words = text.split(" ");
      let line = "";
      let linesCount = 0;
      let currentY = y;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line.trim(), x, currentY);
          line = words[n] + " ";
          currentY += lineHeight;
          linesCount++;
          if (linesCount === maxLines - 1) {
            // For the last line, append remaining words and truncate if needed
            let remaining = words.slice(n).join(" ");
            while (ctx.measureText(remaining + "...").width > maxWidth && remaining.length > 0) {
              remaining = remaining.substring(0, remaining.length - 1);
            }
            ctx.fillText(remaining + "...", x, currentY);
            return;
          }
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), x, currentY);
    };

    // Background Color (Dark Sleek Slate)
    ctx.fillStyle = "#0b0f17";
    ctx.fillRect(0, 0, width, height);

    // Header Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("PLANILLA COMPARATIVA DE PRECIOS", padding, padding + 35);

    // Subtitle
    ctx.fillStyle = "#94a3b8";
    ctx.font = "15px sans-serif";
    ctx.fillText(quoteName || "Cotización de Insumos", padding, padding + 65);

    // Decorative separator
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(padding, padding + 85, width - padding * 2, 1.5);

    // Metadata Badges
    const dateStr = new Date().toLocaleDateString("es-AR");
    
    // Date badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    drawRoundRect(padding, padding + 105, 150, 32, 6);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Fecha: ${dateStr}`, padding + 15, padding + 125);

    // TC badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    drawRoundRect(padding + 165, padding + 105, 210, 32, 6);
    ctx.fill();
    ctx.fillText(`TC Mayorista: 1 USD = $${exchangeRate}`, padding + 180, padding + 125);

    // Currency conversion status badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    drawRoundRect(padding + 390, padding + 105, 250, 32, 6);
    ctx.fill();
    ctx.fillText(`Moneda: ${convertCurrencies ? `Base (${baseCurrency})` : "Original de carga"}`, padding + 405, padding + 125);

    const startY = headerHeight + 30;

    // Draw spreadsheet table structure
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(padding, startY, tableWidth, 60);

    // Main Headers
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("NOMBRE DEL ÍTEM", padding + 15, startY + 25);
    ctx.fillText("CANTIDAD", padding + itemColWidth + 15, startY + 25);

    // Subheaders line separator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, startY + 35);
    ctx.lineTo(padding + tableWidth, startY + 35);
    ctx.stroke();

    activeProviders.forEach((prov, pIdx) => {
      const pX = padding + itemColWidth + qtyColWidth + pIdx * (colWidth * 2);

      // Provider header name (Spans 2 columns)
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      const nameText = prov.name;
      ctx.fillText(nameText, pX + colWidth, startY + 22);
      ctx.textAlign = "left";

      // Unitary & Total subheaders
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("P. Unitario", pX + 15, startY + 48);
      ctx.fillText("P. Total", pX + colWidth + 15, startY + 48);

      // Draw grid line separating providers
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(pX, startY);
      ctx.lineTo(pX, startY + contentHeight);
      ctx.stroke();
    });

    // Draw table border outline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeRect(padding, startY, tableWidth, contentHeight);

    // Draw zebra background rows & cell content
    activeItems.forEach((item, idx) => {
      const rowY = startY + 60 + idx * itemRowHeight;

      // Draw horizontal line separator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.moveTo(padding, rowY);
      ctx.lineTo(padding + tableWidth, rowY);
      ctx.stroke();

      if (idx % 2 === 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.01)";
        ctx.fillRect(padding, rowY, tableWidth, itemRowHeight);
      }

      // Product Name (Wrapped up to 3 lines)
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 12px sans-serif";
      const displayName = item.name || "Ítem sin nombre";
      drawWrappedText(displayName, padding + 15, rowY + 24, itemColWidth - 30, 15, 3);

      // Quantity (vertically centered)
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "11px sans-serif";
      ctx.fillText(`${item.targetQuantity} ${item.baseUnit}`, padding + itemColWidth + 15, rowY + 38);

      // Provider quotes
      activeProviders.forEach((prov, pIdx) => {
        const pX = padding + itemColWidth + qtyColWidth + pIdx * (colWidth * 2);
        const quote = prov.quotes[item.id];
        const hasQuote = quote && quote.price > 0;

        if (hasQuote) {
          const { trueUnitRateRaw, trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);
          const { totalBaseCurrency, totalRawCurrency } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);

          const displayUnitCost = convertCurrencies ? trueUnitRateBaseCurrency : trueUnitRateRaw;
          const displayUnitCurrency = convertCurrencies ? baseCurrency : quote.currency;

          const displayTotalCost = convertCurrencies ? totalBaseCurrency : totalRawCurrency;
          const displayTotalCurrency = convertCurrencies ? baseCurrency : quote.currency;

          // P. Unit
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "11px sans-serif";
          ctx.fillText(formatCurrencyValue(displayUnitCost, displayUnitCurrency), pX + 15, rowY + 30);

          // P. Total
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px sans-serif";
          ctx.fillText(formatCurrencyValue(displayTotalCost, displayTotalCurrency), pX + colWidth + 15, rowY + 30);

          // Specification (Opcional)
          if (quote.specification) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "italic 9px sans-serif";
            let specText = quote.specification;
            if (ctx.measureText(specText).width > (colWidth * 2 - 30)) {
              while (ctx.measureText(specText + "...").width > (colWidth * 2 - 30) && specText.length > 0) {
                specText = specText.substring(0, specText.length - 1);
              }
              specText = specText + "...";
            }
            ctx.fillText(specText, pX + 15, rowY + 52);
          }
        } else {
          ctx.fillStyle = "#475569";
          ctx.font = "italic 11px sans-serif";
          ctx.fillText("-", pX + 15, rowY + 38);
          ctx.fillText("-", pX + colWidth + 15, rowY + 38);
        }
      });
    });

    // SUMMARY TOTAL ROW
    const totalRowY = startY + 60 + activeItems.length * itemRowHeight;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding, totalRowY);
    ctx.lineTo(padding + tableWidth, totalRowY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(padding, totalRowY, tableWidth, 75);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("TOTAL GENERAL", padding + 15, totalRowY + 35);

    activeProviders.forEach((prov, pIdx) => {
      const pX = padding + itemColWidth + qtyColWidth + pIdx * (colWidth * 2);
      const totalData = providerTotals.find(t => t.providerId === prov.id);

      ctx.fillStyle = "#475569";
      ctx.font = "11px sans-serif";
      ctx.fillText("-", pX + 15, totalRowY + 35);

      if (totalData) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";

        const hasARS = totalData.totalARS > 0;
        const hasUSD = totalData.totalUSD > 0;

        let curY = totalRowY + 28;

        if (hasARS || (!hasARS && !hasUSD && baseCurrency === "ARS")) {
          ctx.fillText(formatCurrencyValue(totalData.totalARS, "ARS"), pX + colWidth + 15, curY);
          curY += 16;
        }

        if (hasUSD || (!hasARS && !hasUSD && baseCurrency === "USD")) {
          ctx.fillStyle = "#34d399"; // light green for USD in canvas
          ctx.fillText(formatCurrencyValue(totalData.totalUSD, "USD"), pX + colWidth + 15, curY);
          curY += 16;
        }
      }
    });



    // Show modal preview
    try {
      const dataUrl = canvas.toDataURL("image/png");
      setGeneratedImgUrl(dataUrl);
      setShowImgModal(true);
    } catch (e) {
      console.error("Error creating dataURL:", e);
      showToast("Error al exportar la imagen", "error");
    }
  };

  const handleCopyExcelFormat = () => {
    try {
      const activeProviders = providers.filter(prov => !excludedProviderIds.includes(prov.id));
      if (activeProviders.length === 0) {
        showToast("No hay proveedores activos para copiar (están todos excluidos)", "error");
        return;
      }

      let tsv = "";
      let html = `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1;">`;

      // Row 1: Main Headers
      const row1 = ["Nombre del Ítem", "Cantidad"];
      activeProviders.forEach(prov => {
        row1.push(prov.name, ""); // Leave empty column for spacing (since each provider has Unitario & Total)
      });
      tsv += row1.join("\t") + "\n";

      html += `<tr style="background-color: #000000; color: #ffffff; font-weight: bold; border-bottom: 2px solid #334155;">`;
      html += `<th style="border: 1px solid #334155; padding: 10px; text-align: left; background-color: #000000; color: #ffffff;" rowspan="2">Nombre del Ítem</th>`;
      html += `<th style="border: 1px solid #334155; padding: 10px; text-align: center; background-color: #000000; color: #ffffff;" rowspan="2">Cantidad</th>`;
      activeProviders.forEach(prov => {
        html += `<th style="border: 1px solid #334155; padding: 10px; text-align: center; background-color: #000000; color: #ffffff;" colspan="2">${prov.name}</th>`;
      });
      html += `</tr>`;

      // Row 2: Sub-headers
      const row2 = ["", ""];
      activeProviders.forEach(() => {
        row2.push("Unitario", "Total");
      });
      tsv += row2.join("\t") + "\n";

      html += `<tr style="background-color: #1e293b; color: #f1f5f9; font-weight: bold;">`;
      activeProviders.forEach(() => {
        html += `<th style="border: 1px solid #334155; padding: 6px; text-align: center; font-size: 9pt; background-color: #1e293b; color: #f1f5f9;">Unitario</th>`;
        html += `<th style="border: 1px solid #334155; padding: 6px; text-align: center; font-size: 9pt; background-color: #1e293b; color: #f1f5f9;">Total</th>`;
      });
      html += `</tr>`;

      // Active Item Rows (Excluded items are completely omitted from Excel output)
      const activeItems = items.filter(item => !excludedItemIds.includes(item.id));
      activeItems.forEach((item, idx) => {
        const bgRow = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const row = [
          item.name || "Ítem sin nombre",
          `${item.targetQuantity} ${item.baseUnit}`
        ];

        html += `<tr style="background-color: ${bgRow}; border-bottom: 1px solid #e2e8f0;">`;
        html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold; color: #0f172a;">${item.name || "Ítem sin nombre"}</td>`;
        html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #475569;">${item.targetQuantity} ${item.baseUnit}</td>`;

        activeProviders.forEach(prov => {
          const quote = prov.quotes[item.id];
          const hasQuote = quote && quote.price > 0;

          if (hasQuote) {
            const { trueUnitRateRaw, trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);
            const { totalBaseCurrency, totalRawCurrency, presentationsCount } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);

            const displayUnitCost = convertCurrencies ? trueUnitRateBaseCurrency : trueUnitRateRaw;
            const displayUnitCurrency = convertCurrencies ? baseCurrency : quote.currency;

            const displayTotalCost = convertCurrencies ? totalBaseCurrency : totalRawCurrency;
            const displayTotalCurrency = convertCurrencies ? baseCurrency : quote.currency;

            // Formatted Unit for Plain Text (TSV)
            let unitTextText = formatCurrencyValue(displayUnitCost, displayUnitCurrency);
            if (convertCurrencies && quote.currency !== baseCurrency) {
              unitTextText += ` (${quote.currency === "ARS" ? "$" : "USD"} ${trueUnitRateRaw.toFixed(2)})`;
            }

            // Formatted Unit for HTML
            let unitHtmlText = formatCurrencyValue(displayUnitCost, displayUnitCurrency);
            if (convertCurrencies && quote.currency !== baseCurrency) {
              unitHtmlText += `<br/><span style="font-size: 8pt; color: #64748b;">(${quote.currency === "ARS" ? "$" : "USD"} ${trueUnitRateRaw.toFixed(2)})</span>`;
            }

            // Formatted Total for Plain Text (TSV)
            let totalTextText = formatCurrencyValue(displayTotalCost, displayTotalCurrency);
            if (quote.presentationType === "package") {
              totalTextText += ` (${quote.presentationName || `Lote x${quote.unitsPerPresentation}`})`;
            }

            // Formatted Total for HTML
            let totalHtmlText = `<span style="font-weight: bold; color: #0f172a;">${formatCurrencyValue(displayTotalCost, displayTotalCurrency)}</span>`;
            if (quote.presentationType === "package") {
              totalHtmlText += `<br/><span style="font-size: 8pt; color: #64748b;">${quote.presentationName || `Lote x${quote.unitsPerPresentation}`} (x${presentationsCount.toFixed(useRealLots ? 0 : 1)})</span>`;
            }
            if (quote.discount > 0) {
              totalHtmlText += `<br/><span style="font-size: 8pt; color: #ef4444; font-weight: bold;">-${quote.discount}%</span>`;
            }
            if (quote.specification) {
              totalHtmlText += `<br/><span style="font-size: 8pt; color: #4b5563; font-style: italic; background-color: #f3f4f6; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-top: 4px;">${quote.specification}</span>`;
            }

            const isItemWinner = highlightMode === "item" && (cheapestProvidersPerItem[item.id]?.includes(prov.id) ?? false);
            const isStrongPointWinner = highlightMode === "strongpoint" && (strongestItemPerProvider[prov.id]?.includes(item.id) ?? false);
            const isCellHighlighted = isItemWinner || isStrongPointWinner;

            const itemBg = isCellHighlighted ? "#c6efce" : "#fcfcfc";
            const itemHighlightTag = isItemWinner 
              ? `<br/><span style="font-size: 7.5pt; color: #006100; font-weight: bold; background-color: #a7f3d0; padding: 1px 4px; border-radius: 3px;">★ Mejor precio</span>` 
              : isStrongPointWinner 
                ? `<br/><span style="font-size: 7.5pt; color: #006100; font-weight: bold; background-color: #a7f3d0; padding: 1px 4px; border-radius: 3px;">★ Punto Fuerte</span>`
                : "";

            row.push(unitTextText, totalTextText);
            html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: middle; color: #334155;">${unitHtmlText}</td>`;
            html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: middle; background-color: ${itemBg};">${totalHtmlText}${itemHighlightTag}</td>`;
          } else {
            row.push("-", "-");
            html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #94a3b8; vertical-align: middle;">-</td>`;
            html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #94a3b8; vertical-align: middle; background-color: #fcfcfc;">-</td>`;
          }
        });

        tsv += row.join("\t") + "\n";
        html += `</tr>`;
      });

      // Row 4: Summary Totals
      const totalRow = ["TOTAL GENERAL", "-"];
      html += `<tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1; border-bottom: 2px double #cbd5e1;">`;
      html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: left; font-weight: 800; color: #0f172a;">TOTAL GENERAL</td>`;
      html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; font-size: 8pt; color: #475569;">-</td>`;

      activeProviders.forEach(prov => {
        const totalData = providerTotals.find(t => t.providerId === prov.id);
        if (totalData) {
          const hasARS = totalData.totalARS > 0;
          const hasUSD = totalData.totalUSD > 0;
          
          let totalText = "";
          let cellHtml = "";
          if (hasARS || (!hasARS && !hasUSD && baseCurrency === "ARS")) {
            totalText += formatCurrencyValue(totalData.totalARS, "ARS");
            cellHtml += `<div style="font-weight: bold; color: #0f172a; margin-bottom: 2px;">${formatCurrencyValue(totalData.totalARS, "ARS")}</div>`;
          }
          if (hasUSD || (!hasARS && !hasUSD && baseCurrency === "USD")) {
            if (totalText) totalText += " / ";
            totalText += formatCurrencyValue(totalData.totalUSD, "USD");
            cellHtml += `<div style="font-weight: bold; color: #15803d;">${formatCurrencyValue(totalData.totalUSD, "USD")}</div>`;
          }

          const isCompanyWinner = highlightMode === "company" && prov.id === cheapestProviderId;
          const totalCellBg = isCompanyWinner ? "#c6efce" : "#e2e8f0";
          const companyBadge = isCompanyWinner ? `<div style="font-size: 8pt; color: #006100; font-weight: 800; margin-top: 3px;">★ Más Conveniente</div>` : "";

          totalRow.push("-", totalText);
          html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; color: #64748b; vertical-align: middle;">-</td>`;
          html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; vertical-align: middle; background-color: ${totalCellBg};">${cellHtml}${companyBadge}</td>`;
        } else {
          totalRow.push("-", "-");
          html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; color: #94a3b8; vertical-align: middle;">-</td>`;
          html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; color: #94a3b8; vertical-align: middle; background-color: #e2e8f0;">-</td>`;
        }
      });
      tsv += totalRow.join("\t") + "\n";
      html += `</tr>`;
      html += `</table>`;

      // Write both Plain Text and Styled HTML to Clipboard
      const tsvBlob = new Blob([tsv], { type: "text/plain" });
      const htmlBlob = new Blob([html], { type: "text/html" });
      const clipboardItem = new ClipboardItem({
        "text/plain": tsvBlob,
        "text/html": htmlBlob
      });

      navigator.clipboard.write([clipboardItem]).then(() => {
        showToast("¡Tabla copiada con bordes y formatos! Pegala en Excel o Sheets", "success");
      });
    } catch (e) {
      console.error("Failed to copy table:", e);
      showToast("Error al copiar la tabla", "error");
    }
  };

  return (
    <AppLayout title="Cotizaciones" subtitle="Comparativa inteligente de proveedores, unidades y monedas integradas">
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.message}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="pointer-events-auto flex items-center gap-2.5 px-4.5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md text-xs font-semibold text-white bg-[#0d121f]/95 border-white/10"
            >
              {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toast.type === "info" && <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar / Navigation Dock */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 p-2.5 rounded-3xl bg-[#0d1222]/80 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
        {/* Navigation Tabs with Motion layoutId */}
        <div className="inline-flex p-1 bg-[#090d18] border border-white/[0.06] rounded-2xl overflow-x-auto max-w-full whitespace-nowrap shrink-0">
          <button
            onClick={() => {
              setActiveTab("historial");
              setCurrentQuoteId(null);
              setHasActiveQuote(false);
            }}
            className={`relative flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors duration-150 ${
              activeTab === "historial" ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {activeTab === "historial" && (
              <motion.div
                layoutId="activeCotizacionesTab"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/30"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Mis Cotizaciones</span>
              {savedQuotations.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums bg-white/20 text-white">
                  {savedQuotations.length}
                </span>
              )}
            </span>
          </button>

          <button
            disabled={!hasActiveQuote}
            onClick={() => hasActiveQuote && setActiveTab("editor")}
            className={`relative flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 ${
              !hasActiveQuote
                ? "text-slate-600 cursor-not-allowed opacity-40"
                : activeTab === "editor"
                ? "text-white cursor-pointer"
                : "text-slate-400 hover:text-slate-200 cursor-pointer"
            }`}
            title={!hasActiveQuote ? "Abrí o creá una cotización para editar" : ""}
          >
            {hasActiveQuote && activeTab === "editor" && (
              <motion.div
                layoutId="activeCotizacionesTab"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/30"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              <span>Editor de Precios</span>
            </span>
          </button>

          <button
            disabled={!hasActiveQuote}
            onClick={() => hasActiveQuote && setActiveTab("comparador")}
            className={`relative flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 ${
              !hasActiveQuote
                ? "text-slate-600 cursor-not-allowed opacity-40"
                : activeTab === "comparador"
                ? "text-white cursor-pointer"
                : "text-slate-400 hover:text-slate-200 cursor-pointer"
            }`}
            title={!hasActiveQuote ? "Abrí o creá una cotización para ver la matriz" : ""}
          >
            {hasActiveQuote && activeTab === "comparador" && (
              <motion.div
                layoutId="activeCotizacionesTab"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                className="absolute inset-0 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/30"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              <span>Matriz Comparativa</span>
              {hasActiveQuote && providers.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums bg-white/20 text-white">
                  {providers.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNewQuotation}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-shadow"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nueva Cotización</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (!hasActiveQuote) handleNewQuotation();
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.09] text-slate-200 hover:text-white border border-white/[0.08] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            title="Importar matriz desde archivo Excel o celdas copiadas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
            <span>Importar Excel</span>
          </motion.button>

          {hasActiveQuote && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveQuotation}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </motion.button>
          )}

          {hasActiveQuote && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsAiChatOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              title="Abrir chat con IA para analizar y comparar presupuestos"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span>Chat IA</span>
              {attachments.length > 0 && (
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {attachments.length}
                </span>
              )}
            </motion.button>
          )}

          {/* Sync indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${dbActive ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            <span>{dbActive ? "Sincronizado" : "Local"}</span>
          </div>
        </div>
      </div>

      {/* Active Quote Meta Information Card */}
      {hasActiveQuote && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="rounded-3xl p-6 mb-6 bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Title */}
            <div className="lg:col-span-5 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Nombre del Presupuesto / Proyecto
              </label>
              <input
                type="text"
                value={quoteName}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuoteName(val);
                  if (val.trim().toUpperCase().startsWith("PCT") && (!quoteCategoria || quoteCategoria.trim() === "")) {
                    setQuoteCategoria("PCT/PLIEGOS");
                  }
                }}
                placeholder="Ej. PCT 059 Palermo / Insumos Planta Munro Q3"
                disabled={isLocked}
                className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-600 outline-none transition-colors disabled:opacity-50"
              />
            </div>

            {/* Quick Metrics Grid */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* TC Mayorista */}
              <div className="space-y-1 bg-[#080b15] p-2.5 rounded-xl border border-white/[0.06]">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                  TC Mayorista (ARS)
                </label>
                <div className="relative flex items-center">
                  <span className="text-slate-500 text-xs font-bold mr-1">$</span>
                  <input
                    type="number"
                    value={exchangeRate || ""}
                    onChange={(e) => setExchangeRate(Math.max(1, parseFloat(e.target.value) || 0))}
                    placeholder="1400"
                    disabled={isLocked}
                    className="w-full bg-transparent text-xs font-mono font-bold text-white outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Base Currency */}
              <div className="space-y-1 bg-[#080b15] p-2.5 rounded-xl border border-white/[0.06]">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                  Moneda Base
                </label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value as "ARS" | "USD")}
                  disabled={isLocked}
                  className="w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="ARS" className="bg-[#0b0f19]">Pesos (ARS)</option>
                  <option value="USD" className="bg-[#0b0f19]">Dólares (USD)</option>
                </select>
              </div>

              {/* Lotes Enteros */}
              <div className="space-y-1 bg-[#080b15] p-2.5 rounded-xl border border-white/[0.06]">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span>Cálculo</span>
                  <span title="Activar para calcular precios finales en base a cajas/packs enteros en vez de fracciones." className="cursor-help">
                    <HelpCircle className="w-2.5 h-2.5 text-slate-500" />
                  </span>
                </label>
                <select
                  value={useRealLots ? "real" : "fraction"}
                  onChange={(e) => setUseRealLots(e.target.value === "real")}
                  disabled={isLocked}
                  className="w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="fraction" className="bg-[#0b0f19]">Fraccional</option>
                  <option value="real" className="bg-[#0b0f19]">Lotes Reales</option>
                </select>
              </div>

              {/* Items & Provs Count */}
              <div className="space-y-1 bg-[#080b15] p-2.5 rounded-xl border border-white/[0.06] flex flex-col justify-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Resumen</span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {items.length} ítems • {providers.length} provs
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas generales, plazos de entrega, condiciones de pago..."
              rows={1}
              disabled={isLocked}
              className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 placeholder-slate-600 outline-none transition-colors resize-y min-h-[36px] disabled:opacity-50"
            />
          </div>

          {/* Rubro & Pendientes & Estado */}
          <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            {/* Rubro / Categoría */}
            <div className="flex items-center gap-2 bg-[#080b15] px-3 py-1.5 rounded-xl border border-white/[0.06]">
              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={quoteCategoria}
                onChange={(e) => setQuoteCategoria(e.target.value)}
                disabled={isLocked}
                className="w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="" className="bg-[#0b0f19]">(Sin rubro / área)</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#0b0f19]">{cat}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="text-slate-400 hover:text-white p-0.5"
                title="Nueva carpeta"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pendiente Vinculado */}
            <div className="flex items-center gap-2 bg-[#080b15] px-3 py-1.5 rounded-xl border border-white/[0.06]">
              <ListTodo className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={quotePendienteId}
                onChange={(e) => handleLinkPendiente(e.target.value)}
                disabled={isLocked}
                className="w-full bg-transparent text-xs font-semibold text-white outline-none cursor-pointer disabled:opacity-50 truncate"
              >
                <option value="" className="bg-[#0b0f19]">(Sin pendiente vinculado)</option>
                {allPendientes.map((pend) => (
                  <option key={pend.id} value={pend.id} className="bg-[#0b0f19]">
                    {pend.titulo}
                  </option>
                ))}
              </select>
              {quotePendienteId && (
                <button
                  type="button"
                  onClick={() => handleLinkPendiente("")}
                  className="text-rose-400 hover:text-rose-300 p-0.5"
                  title="Desvincular"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Estado */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as any;
                  setStatus(newStatus);
                  if (newStatus !== "finalizada") setWinningProviderId("");
                  else if (providers.length > 0 && !winningProviderId) setWinningProviderId(providers[0].id);
                  if (newStatus === "enviada" && !sentAt) {
                    const today = new Date();
                    setSentAt(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
                  }
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border outline-none cursor-pointer ${
                  status === "finalizada"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : status === "enviada"
                    ? "bg-sky-500/15 border-sky-500/30 text-sky-400"
                    : status === "cancelada"
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                }`}
              >
                <option value="borrador" className="bg-[#0b0f19]">Borrador (Abierta)</option>
                <option value="enviada" className="bg-[#0b0f19]">Enviada (Cerrada)</option>
                <option value="finalizada" className="bg-[#0b0f19]">Finalizada (Adjudicada)</option>
                <option value="cancelada" className="bg-[#0b0f19]">Cancelada</option>
              </select>

              {status === "finalizada" && (
                <select
                  value={winningProviderId}
                  onChange={(e) => setWinningProviderId(e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0b0f19]">Elegir Ganador...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0b0f19]">{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================
          TAB CONTENT: EDITOR DE COTIZACIÓN
          ============================================================ */}
      {activeTab === "editor" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="space-y-6"
        >
          {/* Section 1: Target Items Configuration */}
          <div className="rounded-3xl p-6 bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">1. Ítems Requeridos</h3>
                  <p className="text-xs text-slate-400">Insumos y cantidades base solicitadas</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsImportModalOpen(true)}
                  disabled={isLocked}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.08] rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Importar Excel</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddItem}
                  disabled={isLocked}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Añadir Ítem</span>
                </motion.button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3 w-16 text-center">Orden</th>
                    <th className="py-2.5 px-3">Nombre del Ítem / Insumo</th>
                    <th className="py-2.5 px-3 w-56">Unidad Base</th>
                    <th className="py-2.5 px-3 w-48">Cantidad</th>
                    <th className="py-2.5 px-3 w-16 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, -1)}
                            disabled={isLocked || idx === 0}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Subir"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 1)}
                            disabled={isLocked || idx === items.length - 1}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Bajar"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                          placeholder="Ej. Resma A4, Café en Grano..."
                          disabled={isLocked}
                          className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition-colors disabled:opacity-50"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={item.baseUnit}
                          onChange={(e) => handleUpdateItem(item.id, "baseUnit", e.target.value)}
                          disabled={isLocked}
                          className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer disabled:opacity-50"
                        >
                          {DEFAULT_UNITS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-[#0b0f19]">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={item.targetQuantity || ""}
                            onChange={(e) => handleUpdateItem(item.id, "targetQuantity", e.target.value)}
                            placeholder="Cantidad"
                            disabled={isLocked}
                            className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl pl-3 pr-10 py-1.5 text-xs font-mono font-bold text-white outline-none disabled:opacity-50"
                          />
                          <span className="absolute right-2.5 text-[10px] font-bold text-slate-500 pointer-events-none">
                            {item.baseUnit}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isLocked || items.length === 1}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                          title="Eliminar ítem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View Cards */}
            <div className="block md:hidden space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="p-3.5 bg-[#080b15] border border-white/[0.06] rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400">Ítem #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, -1)}
                        disabled={isLocked || idx === 0}
                        className="p-1 text-slate-500 disabled:opacity-20"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, 1)}
                        disabled={isLocked || idx === items.length - 1}
                        className="p-1 text-slate-500 disabled:opacity-20"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isLocked || items.length === 1}
                      className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                    placeholder="Nombre del insumo..."
                    disabled={isLocked}
                    className="w-full bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={item.baseUnit}
                      onChange={(e) => handleUpdateItem(item.id, "baseUnit", e.target.value)}
                      disabled={isLocked}
                      className="bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      {DEFAULT_UNITS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0b0f19]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={item.targetQuantity || ""}
                      onChange={(e) => handleUpdateItem(item.id, "targetQuantity", e.target.value)}
                      placeholder="Cantidad"
                      disabled={isLocked}
                      className="bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Providers and Quotes Editing */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">2. Precios por Proveedor</h3>
                  <p className="text-xs text-slate-400">
                    Cargá valores unitarios o por lote/pack para cada empresa
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMinimizeAllProviders}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-semibold text-slate-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                >
                  {providers.length > 0 && providers.every((p) => (minimizedProviders[p.id] ?? true))
                    ? "Expandir Todos"
                    : "Colapsar Todos"}
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddProvider}
                  disabled={isLocked}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 hover:text-white border border-white/[0.08] rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Añadir Proveedor</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setImportAiTargetProviderId(undefined);
                    setImportAiTargetProviderName(undefined);
                    setIsImportAiModalOpen(true);
                  }}
                  disabled={isLocked}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-40 cursor-pointer"
                  title="Crear un nuevo proveedor automáticamente importando un presupuesto con IA"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 stroke-[2.5]" />
                  <span>Agregar Proveedor por IA</span>
                </motion.button>
              </div>
            </div>

            {/* Providers List Accordion */}
            <div className="space-y-4">
              {providers.map((prov, pIdx) => {
                const totalData = providerTotals.find((t) => t.providerId === prov.id);
                const isMinimized = minimizedProviders[prov.id] ?? true;

                return (
                  <div
                    key={prov.id}
                    className="rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-200"
                  >
                    {/* Provider Header Bar */}
                    <div className="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0a0e1a]/80 border-b border-white/[0.06]">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Provider inclusion checkbox */}
                          <label
                            className="flex items-center cursor-pointer shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors"
                            title={
                              excludedProviderIds.includes(prov.id)
                                ? "Proveedor excluido: Clic para incluir en comparativa y copiado"
                                : "Proveedor activo: Clic para excluir de comparativa y copiado"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={!excludedProviderIds.includes(prov.id)}
                              onChange={() => toggleProviderInclusion(prov.id)}
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                            />
                          </label>

                          {/* Move provider order */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveProvider(pIdx, -1)}
                              disabled={isLocked || pIdx === 0}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
                              title="Mover a la izquierda"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveProvider(pIdx, 1)}
                              disabled={isLocked || pIdx === providers.length - 1}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
                              title="Mover a la derecha"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Provider Name Input */}
                          <input
                            type="text"
                            value={prov.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProviders((prev) =>
                                prev.map((p) => (p.id === prov.id ? { ...p, name: val } : p))
                              );
                            }}
                            placeholder="Nombre del Proveedor..."
                            disabled={isLocked}
                            className="flex-1 min-w-0 md:max-w-xs lg:max-w-sm bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none transition-colors disabled:opacity-50"
                          />
                        </div>

                        {/* Computed Total Badge (su valor a la derecha) */}
                        {totalData && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-300 shrink-0 self-start sm:self-center">
                            {totalData.totalARS > 0 && (
                              <span>{formatCurrencyValue(totalData.totalARS, "ARS")}</span>
                            )}
                            {totalData.totalARS > 0 && totalData.totalUSD > 0 && (
                              <span className="text-slate-500">•</span>
                            )}
                            {totalData.totalUSD > 0 && (
                              <span className="text-emerald-400">
                                {formatCurrencyValue(totalData.totalUSD, "USD")}
                              </span>
                            )}
                            {totalData.totalARS === 0 && totalData.totalUSD === 0 && (
                              <span className="text-slate-500">Sin precios</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
                        <div className="flex items-center gap-1.5">
                          {/* Direct File Attachment button (Sin autocargar items) */}
                          <label
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                              uploadingProviderId === prov.id
                                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/[0.08]"
                            }`}
                            title="Adjuntar archivo (PDF, presupuesto, etc.) a este proveedor sin autocargar ni modificar ítems"
                          >
                            {uploadingProviderId === prov.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                <span className="hidden sm:inline">Subiendo...</span>
                              </>
                            ) : (
                              <>
                                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="hidden sm:inline">Adjuntar</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept=".pdf,.eml,message/rfc822,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx,.txt"
                              className="hidden"
                              disabled={isLocked || uploadingProviderId === prov.id}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setUploadingProviderId(prov.id);
                                  await handleUploadAttachment(file, prov.id, prov.name);
                                  setUploadingProviderId(null);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>

                          {/* AI Import shortcut */}
                          <button
                            type="button"
                            onClick={() => {
                              setImportAiTargetProviderId(prov.id);
                              setImportAiTargetProviderName(prov.name);
                              setIsImportAiModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 text-xs font-semibold transition-colors cursor-pointer"
                            title="Importar presupuesto PDF con IA"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="hidden sm:inline">Importar IA</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Minimize toggle */}
                          <button
                            type="button"
                            onClick={() => toggleMinimizeProvider(prov.id)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                            title={isMinimized ? "Expandir" : "Colapsar"}
                          >
                            {isMinimized ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete provider */}
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(prov.id)}
                            disabled={isLocked || providers.length === 1}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                            title="Eliminar proveedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Provider Attached Files Bar */}
                    {(() => {
                      const provAttachments = attachments.filter(
                        (a) => a.providerId === prov.id || (a.providerName && a.providerName.toLowerCase() === prov.name.toLowerCase())
                      );
                      if (provAttachments.length === 0) return null;

                      return (
                        <div className="px-4 sm:px-5 py-2.5 bg-[#080b15]/90 border-b border-white/[0.04] flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0">
                            <Paperclip className="w-3 h-3 text-indigo-400" />
                            <span>Archivos adjuntos ({provAttachments.length}):</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {provAttachments.map((att) => {
                              const isPdf = att.filename.endsWith(".pdf") || att.mimeType?.includes("pdf");
                              const isExcel = att.filename.endsWith(".xlsx") || att.filename.endsWith(".xls") || att.filename.endsWith(".csv") || att.mimeType?.includes("spreadsheet") || att.mimeType?.includes("excel");
                              const isEml = att.filename.endsWith(".eml") || att.mimeType?.includes("rfc822");

                              return (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-xs text-slate-200 transition-colors group"
                                >
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 hover:text-indigo-300 transition-colors"
                                    title={`Abrir archivo: ${att.originalName}`}
                                  >
                                    {isPdf ? (
                                      <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    ) : isExcel ? (
                                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    ) : isEml ? (
                                      <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    ) : (
                                      <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    )}
                                    <span className="font-semibold truncate max-w-[130px] sm:max-w-[180px]">
                                      {att.originalName}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      ({(att.size / 1024).toFixed(0)} KB)
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0" />
                                  </a>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(att)}
                                    className="p-0.5 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                    title="Eliminar archivo adjunto"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Provider Items Pricing Body */}
                    {!isMinimized && (
                      <div className="p-4 sm:p-5 space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {items.map((item) => {
                            const quote = prov.quotes[item.id] || {
                              currency: "ARS",
                              presentationType: "base",
                              presentationName: "",
                              unitsPerPresentation: 1,
                              price: 0,
                              discount: 0,
                            };
                            const calc = getCalculatedPrices(quote, exchangeRate, baseCurrency);
                            const totalCost = calculateTotalCost(
                              quote,
                              item.targetQuantity,
                              exchangeRate,
                              baseCurrency,
                              useRealLots
                            );

                            return (
                              <div
                                key={item.id}
                                className="p-3.5 rounded-2xl bg-[#080b15] border border-white/[0.06] hover:border-white/[0.12] transition-colors grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                              >
                                {/* Item label */}
                                <div className="lg:col-span-3 space-y-0.5">
                                  <h4 className="text-xs font-bold text-white truncate" title={item.name}>
                                    {item.name || "Ítem sin nombre"}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 tabular-nums">
                                    Objetivo: {item.targetQuantity} {item.baseUnit}
                                  </span>
                                </div>

                                {/* Price & Currency */}
                                <div className="lg:col-span-3 flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold pointer-events-none select-none">
                                      {quote.currency === "ARS" ? "$" : "USD"}
                                    </span>
                                    <input
                                      type="number"
                                      value={quote.price || ""}
                                      onChange={(e) =>
                                        handleUpdateQuote(
                                          prov.id,
                                          item.id,
                                          "price",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="0.00"
                                      disabled={isLocked}
                                      className={`w-full bg-[#0a0e1a] border border-white/[0.08] focus:border-indigo-500 rounded-xl ${
                                        quote.currency === "USD" ? "pl-12" : "pl-7"
                                      } pr-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none disabled:opacity-50`}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() =>
                                      handleUpdateQuote(
                                        prov.id,
                                        item.id,
                                        "currency",
                                        quote.currency === "ARS" ? "USD" : "ARS"
                                      )
                                    }
                                    className={`px-2 py-1.5 rounded-xl text-[10px] font-bold uppercase border transition-colors cursor-pointer shrink-0 ${
                                      quote.currency === "USD"
                                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                        : "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                                    }`}
                                  >
                                    {quote.currency}
                                  </button>
                                </div>

                                {/* Presentation (Base vs Package) */}
                                <div className="lg:col-span-3 flex items-center gap-2">
                                  <select
                                    value={quote.presentationType}
                                    onChange={(e) =>
                                      handleUpdateQuote(
                                        prov.id,
                                        item.id,
                                        "presentationType",
                                        e.target.value as any
                                      )
                                    }
                                    disabled={isLocked}
                                    className="bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer"
                                  >
                                    <option value="base" className="bg-[#0b0f19]">U. Base</option>
                                    <option value="package" className="bg-[#0b0f19]">Lote / Pack</option>
                                  </select>

                                  {quote.presentationType === "package" && (
                                    <div className="flex items-center gap-1 flex-1">
                                      <input
                                        type="number"
                                        min="1"
                                        value={quote.unitsPerPresentation || ""}
                                        onChange={(e) =>
                                          handleUpdateQuote(
                                            prov.id,
                                            item.id,
                                            "unitsPerPresentation",
                                            Math.max(1, parseFloat(e.target.value) || 1)
                                          )
                                        }
                                        placeholder="Cant"
                                        disabled={isLocked}
                                        className="w-16 bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs font-mono text-white outline-none"
                                        title="Unidades por pack"
                                      />
                                      <input
                                        type="text"
                                        value={quote.presentationName || ""}
                                        onChange={(e) =>
                                          handleUpdateQuote(
                                            prov.id,
                                            item.id,
                                            "presentationName",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Caja x5..."
                                        disabled={isLocked}
                                        className="flex-1 bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs text-white outline-none"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Discount & Calculated Total */}
                                <div className="lg:col-span-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500 font-bold">%Desc</span>
                                    <input
                                      type="number"
                                      value={quote.discount || ""}
                                      onChange={(e) =>
                                        handleUpdateQuote(
                                          prov.id,
                                          item.id,
                                          "discount",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="0"
                                      disabled={isLocked}
                                      className="w-14 bg-[#0a0e1a] border border-white/[0.08] rounded-xl px-2 py-1.5 text-xs font-mono text-white outline-none"
                                    />
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xs font-bold text-white tabular-nums">
                                      {quote.price > 0
                                        ? formatCurrencyValue(totalCost.totalBaseCurrency, baseCurrency)
                                        : "-"}
                                    </div>
                                    {quote.price > 0 && (
                                      <div className="text-[10px] text-slate-400 tabular-nums">
                                        Unit: {formatCurrencyValue(calc.trueUnitRateBaseCurrency, baseCurrency)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Item specification / description (Detalle propio del proveedor) */}
                                <div className="col-span-1 lg:col-span-12 pt-2 border-t border-white/[0.04] flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-slate-400" />
                                    <span>Detalle / Marca:</span>
                                  </span>
                                  <input
                                    type="text"
                                    value={quote.specification || ""}
                                    onChange={(e) =>
                                      handleUpdateQuote(
                                        prov.id,
                                        item.id,
                                        "specification",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Ej: Philips 9W, alternativo, código de producto o especificación..."
                                    disabled={isLocked}
                                    className="flex-1 bg-[#0a0e1a]/80 border border-white/[0.06] focus:border-indigo-500/60 rounded-xl px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-all"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================
          TAB CONTENT: MATRIZ COMPARATIVA
          ============================================================ */}
      {activeTab === "comparador" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="space-y-6"
        >
          {/* Winner Spotlight Banner */}
          {providers.length > 0 && cheapestProviderId && (
            (() => {
              const bestProv = providers.find((p) => p.id === cheapestProviderId);
              const bestCostData = providerCostComparisons.find((c) => c.providerId === cheapestProviderId);
              const secondBest = providerCostComparisons[1];
              const savings =
                secondBest && bestCostData
                  ? secondBest.totalBC - bestCostData.totalBC
                  : 0;
              const savingsPct =
                secondBest && secondBest.totalBC > 0
                  ? Math.round((savings / secondBest.totalBC) * 100)
                  : 0;

              return (
                <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 shadow-2xl backdrop-blur-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Trophy className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Opción Más Conveniente
                        </span>
                        <h3 className="text-lg font-black text-white tracking-tight">
                          {bestProv?.name || "Proveedor Destacado"}
                        </h3>
                        <p className="text-xs text-slate-300">
                          Total General:{" "}
                          <span className="font-bold font-mono text-emerald-300">
                            {formatCurrencyValue(bestCostData?.totalBC || 0, baseCurrency)}
                          </span>
                          {savings > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              (Ahorro estimado de {formatCurrencyValue(savings, baseCurrency)} • {savingsPct}%)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {status !== "finalizada" && bestProv && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setStatus("finalizada");
                          setWinningProviderId(bestProv.id);
                          showToast(`Adjudicado a ${bestProv.name}`, "success");
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/25 cursor-pointer transition-colors"
                      >
                        Adjudicar a este Proveedor
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })()
          )}

          {/* Matrix Toolbar & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
            {/* Highlight Options */}
            <div className="flex flex-wrap items-center gap-1 bg-[#080b15] p-1 rounded-2xl border border-white/[0.06]">
              <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Destacar:</span>
              {(
                [
                  { id: "none", label: "Ninguno" },
                  { id: "company", label: "Ganador Global" },
                  { id: "item", label: "Mejor por Ítem" },
                  { id: "strongpoint", label: "Punto Fuerte" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setHighlightMode(mode.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    highlightMode === mode.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Currency toggle and export buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConvertCurrencies(!convertCurrencies)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  convertCurrencies
                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                    : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white"
                }`}
              >
                {convertCurrencies ? "Convertido a Moneda Base" : "Moneda Original"}
              </button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyExcelFormat}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.08] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                title="Copiar tabla para pegar en Excel o Google Sheets"
              >
                <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                <span>Copiar Tabla</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleExportImage}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.08] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                title="Generar imagen PNG de alta resolución"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Generar Imagen</span>
              </motion.button>
            </div>
          </div>

          {/* Quick Provider Visibility Chips */}
          {providers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-[#0d1222]/70 border border-white/[0.06]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <span>Proveedores en comparativa:</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({providers.length - excludedProviderIds.length}/{providers.length} activos)
                </span>
              </span>
              {providers.map((prov) => {
                const isExcluded = excludedProviderIds.includes(prov.id);
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => toggleProviderInclusion(prov.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isExcluded
                        ? "bg-slate-900/60 border-white/[0.06] text-slate-500 line-through opacity-60 hover:opacity-100"
                        : "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20"
                    }`}
                    title={isExcluded ? "Clic para reactivar en la tabla y en el copiado" : "Clic para excluir de la tabla y del copiado"}
                  >
                    <span className={`w-2 h-2 rounded-full ${isExcluded ? "bg-slate-600" : "bg-emerald-400"}`} />
                    <span>{prov.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* The Matrix Table */}
          <div className="rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh] scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#0a0e1a] z-20 border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-300 sticky left-0 bg-[#0a0e1a] z-30 min-w-[200px]">
                      Ítem / Insumo
                    </th>
                    <th className="py-3 px-3 font-bold text-slate-400 text-center w-24">
                      Cantidad
                    </th>
                    {providers.map((prov, pIdx) => {
                      const isExcluded = excludedProviderIds.includes(prov.id);
                      const isCompanyWinner = !isExcluded && highlightMode === "company" && prov.id === cheapestProviderId;
                      const provAttachments = attachments.filter(
                        (a) => a.providerId === prov.id || (a.providerName && a.providerName.toLowerCase() === prov.name.toLowerCase())
                      );
                      return (
                        <th
                          key={prov.id}
                          colSpan={2}
                          className={`py-2.5 px-3 text-center border-l border-white/[0.06] transition-all min-w-[210px] ${
                            isExcluded
                              ? "bg-slate-900/60 text-slate-500"
                              : isCompanyWinner
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <button
                              type="button"
                              onClick={() => moveProvider(pIdx, -1)}
                              disabled={pIdx === 0}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              title="Mover columna a la izquierda"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>

                            <label className="flex items-center justify-center gap-1.5 cursor-pointer select-none group min-w-0 mx-1">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => toggleProviderInclusion(prov.id)}
                                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                title="Tilde para incluir o excluir en comparador y copiado"
                              />
                              <span
                                className={`font-bold text-xs truncate max-w-[130px] ${
                                  isExcluded ? "line-through text-slate-500" : "text-white group-hover:text-indigo-300"
                                }`}
                                title={prov.name}
                              >
                                {prov.name}
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={() => moveProvider(pIdx, 1)}
                              disabled={pIdx === providers.length - 1}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                              title="Mover columna a la derecha"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                            {isExcluded ? (
                              <span className="inline-block text-[9px] font-semibold text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                Excluido de copia y total
                              </span>
                            ) : isCompanyWinner ? (
                              <span className="inline-block text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded tracking-wider">
                                ★ Más Conveniente
                              </span>
                            ) : null}

                            {provAttachments.length > 0 && (
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {provAttachments.map((att) => (
                                  <a
                                    key={att.id}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 px-1.5 py-0.5 rounded-md transition-colors"
                                    title={`Abrir archivo adjunto: ${att.originalName}`}
                                  >
                                    <Paperclip className="w-2.5 h-2.5 text-indigo-400" />
                                    <span className="truncate max-w-[85px]">{att.originalName}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-[#080b15]">
                    <th className="py-1 px-4 sticky left-0 bg-[#080b15] z-30"></th>
                    <th className="py-1 px-3 text-center"></th>
                    {providers.map((prov) => {
                      const isExcluded = excludedProviderIds.includes(prov.id);
                      return (
                        <Fragment key={prov.id}>
                          <th className={`py-1.5 px-3 text-center border-l border-white/[0.06] ${isExcluded ? "opacity-35 text-slate-600" : ""}`}>
                            Unitario
                          </th>
                          <th className={`py-1.5 px-3 text-center ${isExcluded ? "opacity-35 text-slate-600" : ""}`}>
                            Total
                          </th>
                        </Fragment>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((item) => {
                    const isExcluded = excludedItemIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          isExcluded ? "opacity-40" : ""
                        }`}
                      >
                        <td className="py-3 px-4 sticky left-0 bg-[#0d1222] z-10 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => toggleItemInclusion(item.id)}
                            className="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                            title="Incluir / Excluir del total"
                          />
                          <span className="font-semibold text-white truncate max-w-[180px]">
                            {item.name || "Ítem sin nombre"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center tabular-nums text-slate-400 font-mono">
                          {item.targetQuantity} {item.baseUnit}
                        </td>

                        {providers.map((prov) => {
                          const isExcluded = excludedProviderIds.includes(prov.id);
                          const quote = prov.quotes[item.id];
                          const hasQuote = quote && quote.price > 0;

                          if (isExcluded) {
                            return (
                              <Fragment key={prov.id}>
                                <td className="py-3 px-3 text-center text-slate-600 border-l border-white/[0.04] opacity-30 bg-black/20 font-mono text-[11px]">-</td>
                                <td className="py-3 px-3 text-center text-slate-600 opacity-30 bg-black/20 font-mono text-[11px]">
                                  {hasQuote ? (
                                    <span className="line-through text-slate-600">
                                      {formatCurrencyValue(quote.price, quote.currency)}
                                    </span>
                                  ) : "-"}
                                </td>
                              </Fragment>
                            );
                          }

                          if (!hasQuote) {
                            return (
                              <Fragment key={prov.id}>
                                <td className="py-3 px-3 text-center text-slate-600 border-l border-white/[0.04]">-</td>
                                <td className="py-3 px-3 text-center text-slate-600">-</td>
                              </Fragment>
                            );
                          }

                          const calc = getCalculatedPrices(quote, exchangeRate, baseCurrency);
                          const total = calculateTotalCost(
                            quote,
                            item.targetQuantity,
                            exchangeRate,
                            baseCurrency,
                            useRealLots
                          );

                          const isItemWinner =
                            highlightMode === "item" &&
                            (cheapestProvidersPerItem[item.id]?.includes(prov.id) ?? false);
                          const isStrongPoint =
                            highlightMode === "strongpoint" &&
                            (strongestItemPerProvider[prov.id]?.includes(item.id) ?? false);
                          const isHighlighted = isItemWinner || isStrongPoint;

                          const displayUnit = convertCurrencies
                            ? calc.trueUnitRateBaseCurrency
                            : calc.trueUnitRateRaw;
                          const displayUnitCurr = convertCurrencies ? baseCurrency : quote.currency;

                          const displayTotal = convertCurrencies
                            ? total.totalBaseCurrency
                            : total.totalRawCurrency;
                          const displayTotalCurr = convertCurrencies ? baseCurrency : quote.currency;

                          return (
                            <Fragment key={prov.id}>
                              <td className="py-3 px-3 text-center font-mono text-slate-300 border-l border-white/[0.04]">
                                <div>{formatCurrencyValue(displayUnit, displayUnitCurr)}</div>
                                {quote.presentationType === "package" && (
                                  <div className="text-[10px] text-slate-500">
                                    {quote.presentationName || `x${quote.unitsPerPresentation}`}
                                  </div>
                                )}
                                {quote.specification && (
                                  <div
                                    className="text-[10px] text-slate-400 italic truncate max-w-[130px] mx-auto mt-0.5"
                                    title={quote.specification}
                                  >
                                    {quote.specification}
                                  </div>
                                )}
                              </td>
                              <td
                                className={`py-3 px-3 text-center font-mono font-bold tabular-nums ${
                                  isHighlighted
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "text-white"
                                }`}
                              >
                                <div>{formatCurrencyValue(displayTotal, displayTotalCurr)}</div>
                                {isItemWinner && (
                                  <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded">
                                    ★ Mejor
                                  </span>
                                )}
                                {isStrongPoint && (
                                  <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/20 px-1 py-0.2 rounded">
                                    ★ Fortaleza
                                  </span>
                                )}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer Totals Row */}
                <tfoot className="sticky bottom-0 bg-[#0a0e1a] border-t-2 border-white/[0.1] font-bold z-20">
                  <tr>
                    <td className="py-3.5 px-4 sticky left-0 bg-[#0a0e1a] z-30 text-white font-black uppercase tracking-wider">
                      TOTAL GENERAL
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-500">-</td>
                    {providers.map((prov) => {
                      const isExcluded = excludedProviderIds.includes(prov.id);
                      const totalData = providerTotals.find((t) => t.providerId === prov.id);
                      const isCompanyWinner =
                        !isExcluded && highlightMode === "company" && prov.id === cheapestProviderId;

                      if (isExcluded) {
                        return (
                          <Fragment key={prov.id}>
                            <td className="py-3.5 px-3 text-center text-slate-600 border-l border-white/[0.06] opacity-35 bg-black/20">-</td>
                            <td className="py-3.5 px-3 text-center text-slate-600 font-mono text-xs opacity-35 bg-black/20">
                              (Excluido)
                            </td>
                          </Fragment>
                        );
                      }

                      if (!totalData) {
                        return (
                          <Fragment key={prov.id}>
                            <td className="py-3.5 px-3 text-center text-slate-600 border-l border-white/[0.06]">-</td>
                            <td className="py-3.5 px-3 text-center text-slate-600">-</td>
                          </Fragment>
                        );
                      }

                      return (
                        <Fragment key={prov.id}>
                          <td className="py-3.5 px-3 text-center text-slate-500 border-l border-white/[0.06]">-</td>
                          <td
                            className={`py-3.5 px-3 text-center font-mono font-black text-sm tabular-nums ${
                              isCompanyWinner
                                ? "bg-emerald-500/20 text-emerald-300 shadow-inner"
                                : "text-white"
                            }`}
                          >
                            <div>{formatCurrencyValue(totalData.totalARS, "ARS")}</div>
                            {totalData.totalUSD > 0 && (
                              <div className="text-xs text-emerald-400">
                                {formatCurrencyValue(totalData.totalUSD, "USD")}
                              </div>
                            )}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================
          TAB CONTENT: HISTORIAL ("MIS COTIZACIONES")
          ============================================================ */}
      {activeTab === "historial" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="space-y-6"
        >
          {/* Carpetas / Rubros Filter Bar (Chips compactos y con wrap para ver todo) */}
          <div className="p-3.5 rounded-2xl bg-[#0d1222]/80 border border-white/[0.08] shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-slate-300 text-xs font-bold">
                <Folders className="w-3.5 h-3.5 text-amber-400" />
                <span>Carpetas por Área / Rubro</span>
                {filterCategoria !== "todas" && (
                  <button
                    type="button"
                    onClick={() => setFilterCategoria("todas")}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer ml-1"
                  >
                    (Ver todas)
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-[11px] font-semibold border border-white/[0.06] transition-colors cursor-pointer"
                title="Crear o administrar carpetas"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                <span>+ Nueva Carpeta</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Todas las Carpetas */}
              <button
                type="button"
                onClick={() => setFilterCategoria("todas")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 w-auto cursor-pointer transition-colors ${
                  filterCategoria === "todas"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-[#080b15] text-slate-400 hover:text-white border border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                <Folders className="w-3.5 h-3.5" />
                <span>Todas</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterCategoria === "todas"
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {savedQuotations.length}
                </span>
              </button>

              {/* Botón especial PCT / Pliegos (ÚNICO, sin duplicados) */}
              {(() => {
                const isPctActive =
                  filterCategoria === "_pct_pliegos_" ||
                  filterCategoria.toUpperCase() === "PCT/PLIEGOS" ||
                  filterCategoria.toUpperCase() === "PCT / PLIEGOS";

                return (
                  <button
                    type="button"
                    onClick={() => setFilterCategoria(isPctActive ? "todas" : "PCT/PLIEGOS")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 w-auto cursor-pointer transition-colors ${
                      isPctActive
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                        : "bg-[#080b15] text-purple-300 hover:text-white border border-purple-500/25 hover:border-purple-500/40"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-purple-400" />
                    <span>PCT / Pliegos</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                        isPctActive
                          ? "bg-white/20 text-white"
                          : "bg-purple-500/20 text-purple-300"
                      }`}
                    >
                      {pctPliegosQuoteCount}
                    </span>
                  </button>
                );
              })()}

              {/* Carpetas por cada rubro (filtrando PCT/PLIEGOS para evitar duplicación) */}
              {allCategories
                .filter((cat) => {
                  const norm = cat.trim().toUpperCase();
                  return norm !== "PCT/PLIEGOS" && norm !== "PCT / PLIEGOS";
                })
                .map((cat) => {
                  const count = getCategoryQuoteCount(cat);
                  const isSel = filterCategoria.toLowerCase() === cat.toLowerCase();
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCategoria(isSel ? "todas" : cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 w-auto cursor-pointer transition-colors ${
                        isSel
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                          : "bg-[#080b15] text-slate-400 hover:text-white border border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>{cat}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                          isSel ? "bg-black/20 text-slate-950" : "bg-white/[0.06] text-slate-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

              {/* Sin Carpeta */}
              {(() => {
                const isSinCatActive = filterCategoria === "_sin_categoria_";
                return (
                  <button
                    type="button"
                    onClick={() => setFilterCategoria(isSinCatActive ? "todas" : "_sin_categoria_")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 w-auto cursor-pointer transition-colors ${
                      isSinCatActive
                        ? "bg-slate-700 text-white shadow-md"
                        : "bg-[#080b15] text-slate-400 hover:text-white border border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <span>Sin Carpeta</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                        isSinCatActive
                          ? "bg-white/20 text-white"
                          : "bg-white/[0.06] text-slate-400"
                      }`}
                    >
                      {uncategorizedQuoteCount}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Status pills */}
            <div className="inline-flex p-1 bg-[#090d18] border border-white/[0.06] rounded-xl self-start flex-wrap gap-0.5">
              {(
                [
                  { id: "pendientes", label: "Borradores", count: statusCounts.pendientes, activeClass: "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25", dot: "bg-amber-400" },
                  { id: "enviadas", label: "Enviadas", count: statusCounts.enviados, activeClass: "bg-sky-500 text-white font-bold shadow-md shadow-sky-500/30", dot: "bg-sky-300" },
                  { id: "finalizadas", label: "Finalizadas", count: statusCounts.finalizados, activeClass: "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30", dot: "bg-emerald-300" },
                  { id: "todas", label: "Todas", count: statusCounts.todos, activeClass: "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30", dot: "bg-indigo-300" },
                ] as const
              ).map((st) => {
                const isSel = filterStatus === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => setFilterStatus(st.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      isSel ? st.activeClass : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isSel && <span className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse`} />}
                    <span>{st.label}</span>
                    <span className="text-[10px] ml-0.5 opacity-80 tabular-nums font-mono">({st.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search input & only linked toggle */}
            <div className="flex items-center gap-2.5 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, nota o autor..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="w-full bg-[#090d18] border border-white/[0.08] focus:border-indigo-500 rounded-xl py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />
                {searchHistory && (
                  <button
                    onClick={() => setSearchHistory("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={filterOnlyLinked}
                  onChange={(e) => setFilterOnlyLinked(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500"
                />
                <span>Vinculadas</span>
              </label>
            </div>
          </div>

          {/* Quotations Grid */}
          {loadingHistory ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-400">Cargando tus cotizaciones...</p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="p-14 text-center rounded-3xl bg-[#090d18]/50 border border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500">
                <Calculator className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-200">
                  No se encontraron cotizaciones
                </h3>
                <p className="text-xs text-slate-500 max-w-xs">
                  Creá tu primera cotización para comparar insumos y proveedores con inteligencia.
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleNewQuotation}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Nueva Cotización</span>
              </motion.button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              <AnimatePresence mode="popLayout">
                {filteredQuotations.map((quote) => {
                  const quoteDate = quote.createdAt
                    ? new Date(
                        typeof quote.createdAt === "object" && "seconds" in quote.createdAt
                          ? quote.createdAt.seconds * 1000
                          : quote.createdAt
                      ).toLocaleDateString("es-AR")
                    : "-";
                  const qStatus = quote.status || (quote.isFinalized ? "finalizada" : "borrador");
                  const winningProv = quote.providers?.find((p) => p.id === quote.winningProviderId);

                  const theme = (() => {
                    if (qStatus === "finalizada") {
                      return {
                        border: "border-emerald-500/40 hover:border-emerald-400/80 shadow-emerald-950/30",
                        bg: "bg-gradient-to-b from-emerald-950/35 via-[#0d1222]/95 to-[#090d18]/95",
                        accentBar: "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500",
                        badge: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-extrabold shadow-sm shadow-emerald-500/10",
                        badgeDot: "bg-emerald-400",
                        icon: CheckCircle2,
                        label: "Finalizada",
                        titleHover: "hover:text-emerald-300",
                        openBtn: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30",
                      };
                    }
                    if (qStatus === "enviada") {
                      return {
                        border: "border-sky-500/40 hover:border-sky-400/80 shadow-sky-950/30",
                        bg: "bg-gradient-to-b from-sky-950/35 via-[#0d1222]/95 to-[#090d18]/95",
                        accentBar: "bg-gradient-to-r from-sky-400 via-blue-400 to-sky-500",
                        badge: "bg-sky-500/20 border-sky-500/40 text-sky-300 font-extrabold shadow-sm shadow-sky-500/10",
                        badgeDot: "bg-sky-400",
                        icon: Send,
                        label: "Enviada",
                        titleHover: "hover:text-sky-300",
                        openBtn: "bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30",
                      };
                    }
                    if (qStatus === "cancelada") {
                      return {
                        border: "border-rose-500/40 hover:border-rose-400/80 shadow-rose-950/30 opacity-80 hover:opacity-100",
                        bg: "bg-gradient-to-b from-rose-950/35 via-[#0d1222]/95 to-[#090d18]/95",
                        accentBar: "bg-gradient-to-r from-rose-400 via-red-500 to-rose-600",
                        badge: "bg-rose-500/20 border-rose-500/40 text-rose-300 font-extrabold shadow-sm shadow-rose-500/10",
                        badgeDot: "bg-rose-400",
                        icon: XCircle,
                        label: "Cancelada",
                        titleHover: "hover:text-rose-300",
                        openBtn: "bg-rose-600/80 hover:bg-rose-600 text-white",
                      };
                    }
                    // Borrador / Pendiente
                    return {
                      border: "border-amber-500/25 hover:border-amber-500/50 shadow-amber-950/15",
                      bg: "bg-gradient-to-b from-amber-950/20 via-[#0d1222]/95 to-[#090d18]/95",
                      accentBar: "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500",
                      badge: "bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold",
                      badgeDot: "bg-amber-400",
                      icon: Clock,
                      label: "Borrador",
                      titleHover: "hover:text-amber-300",
                      openBtn: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30",
                    };
                  })();

                  const StatusIcon = theme.icon;

                  return (
                    <motion.div
                      key={quote.id || quote.name}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.22, ease: EASE_OUT }}
                      whileHover={{ y: -3 }}
                      className={`group relative flex flex-col justify-between p-5 rounded-3xl border shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-hidden ${theme.border} ${theme.bg}`}
                    >
                      {/* Barra superior de acento coloreada */}
                      <div className={`h-1 w-full rounded-full mb-3.5 ${theme.accentBar}`} />

                      <div className="space-y-3">
                        {/* Header: Status & Category */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${theme.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${theme.badgeDot} ${qStatus === "enviada" ? "animate-pulse" : ""}`} />
                              <StatusIcon className="w-3 h-3" />
                              <span>{theme.label}</span>
                            </span>
                            {quote.categoria && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                <Folder className="w-2.5 h-2.5" />
                                {quote.categoria}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 tabular-nums">{quoteDate}</span>
                        </div>

                        {/* Title */}
                        <div className="space-y-1">
                          <h3
                            onClick={() => handleSelectQuote(quote)}
                            className={`text-sm font-bold text-white tracking-tight cursor-pointer ${theme.titleHover} transition-colors leading-snug`}
                          >
                            {quote.name}
                          </h3>
                          {quote.notes && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {quote.notes}
                            </p>
                          )}
                        </div>

                        {/* Metrics Pills */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06] tabular-nums">
                            {quote.items?.length || 0} ítems
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06] tabular-nums">
                            {quote.providers?.length || 0} proveedores
                          </span>
                          {winningProv && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                              <Trophy className="w-2.5 h-2.5" />
                              {winningProv.name}
                            </span>
                          )}
                        </div>

                        {/* Linked Pendiente Badge */}
                        {quote.pendienteId && (
                          <div className="pt-2 border-t border-white/[0.05]">
                            <a
                              href={`/pendientes?id=${quote.pendienteId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                            >
                              <ListTodo className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">
                                {quote.pendienteTitulo || "Pendiente vinculado"}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleSelectQuote(quote)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${theme.openBtn}`}
                          >
                            Abrir Editor
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => {
                              handleSelectQuote(quote);
                              setActiveTab("comparador");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[11px] font-semibold text-slate-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer"
                          >
                            Matriz
                          </motion.button>
                        </div>

                        <div className="flex items-center gap-1">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => handleDuplicateQuote(quote, e)}
                            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title="Duplicar cotización"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => quote.id && handleDeleteSavedQuote(quote.id, e)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar cotización"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}

      {/* ============================================================
          MODAL: CATEGORÍAS / CARPETAS
          ============================================================ */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="relative w-full max-w-md bg-[#0d1222] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-400" />
                  <span>Gestionar Carpetas / Rubros</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Add form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newCategoryModalInput.trim()) {
                    handleCreateCategory(newCategoryModalInput.trim());
                    setNewCategoryModalInput("");
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Nueva carpeta (Ej. Ferretería, Limpieza)..."
                  value={newCategoryModalInput}
                  onChange={(e) => setNewCategoryModalInput(e.target.value)}
                  className="flex-1 bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none"
                />
                <button
                  type="submit"
                  disabled={!newCategoryModalInput.trim()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold text-white rounded-xl cursor-pointer"
                >
                  Añadir
                </button>
              </form>

              {/* List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {allCategories.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No hay carpetas creadas</p>
                ) : (
                  allCategories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#080b15] border border-white/[0.06] text-xs text-white"
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-amber-400" />
                        <span>{cat}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {getCategoryQuoteCount(cat)} cotizaciones
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================
          MODAL: IMPORTAR EXCEL / PEGAR CELDAS
          ============================================================ */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setIsImportModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="relative w-full max-w-xl max-h-[85vh] bg-[#0d1222] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0a0e1a]/80">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Importar Matriz de Precios</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2 bg-[#080b15] p-1 rounded-xl border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setImportMode("file")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      importMode === "file" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Subir Archivo (.xlsx / .csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("paste")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      importMode === "paste" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Pegar Celdas (Ctrl+V)
                  </button>
                </div>

                {importMode === "file" ? (
                  <label className="border-2 border-dashed border-white/[0.1] hover:border-indigo-500/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-2.5 cursor-pointer bg-[#080b15] transition-colors">
                    <FileUp className="w-8 h-8 text-indigo-400" />
                    <span className="text-xs font-semibold text-white">
                      {importFileName ? importFileName : "Seleccionar o arrastrar archivo Excel"}
                    </span>
                    <span className="text-[10px] text-slate-500">Formatos: .xlsx, .xls, .csv</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileImportChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <textarea
                    value={pastedText}
                    onChange={(e) => handlePasteTextChange(e.target.value)}
                    placeholder={"[A1 vacio]\tEmpresa A\tEmpresa B\nResma A4\t6500\t6200\nCafé 1kg\t25000\t24500"}
                    rows={5}
                    className="w-full bg-[#080b15] border border-white/[0.08] focus:border-indigo-500 rounded-xl p-3 text-xs font-mono text-white outline-none"
                  />
                )}

                {importError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    {importError}
                  </div>
                )}

                {importParsedPreview && (
                  <div className="space-y-2 p-3.5 rounded-2xl bg-[#080b15] border border-emerald-500/20">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Vista previa: {importParsedPreview.items.length} ítems y{" "}
                        {importParsedPreview.providers.length} empresas detectadas
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={importReplaceExisting}
                      onChange={(e) => setImportReplaceExisting(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-indigo-500"
                    />
                    <span>Reemplazar ítems y empresas existentes</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyImport}
                      disabled={!importParsedPreview || importParsedPreview.items.length === 0}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================
          MODAL: EXPORTAR IMAGEN PREVIEW
          ============================================================ */}
      <AnimatePresence>
        {showImgModal && generatedImgUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setShowImgModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d1222] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0a0e1a]/80">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Imagen de Matriz Comparativa</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowImgModal(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-auto flex-1 flex justify-center bg-[#070a14]">
                <img
                  src={generatedImgUrl}
                  alt="Matriz de Cotizaciones"
                  className="max-w-full h-auto rounded-xl shadow-2xl border border-white/[0.08]"
                />
              </div>

              <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#0a0e1a]/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowImgModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cerrar
                </button>
                <a
                  href={generatedImgUrl}
                  download={`Cotizacion_${quoteName.replace(/\s+/g, "_")}.png`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PNG</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cotizaciones AI Chat Modal */}
      <CotizacionesAiChatModal
        key={currentQuoteId || "general"}
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        cotizacionId={currentQuoteId || "general"}
        quoteName={quoteName}
        items={items.map((it) => ({ name: it.name, targetQuantity: it.targetQuantity, baseUnit: it.baseUnit }))}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
        attachments={attachments}
        onUploadAttachment={handleUploadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        onSummaryUpdated={(newSummary) => {
          if (currentQuoteId) {
            syncCotizacionToMongo({ id: currentQuoteId, aiSummary: newSummary });
            const db = getFirebaseDb();
            if (db && !currentQuoteId.startsWith("local-")) {
              updateDoc(doc(db, "cotizaciones", currentQuoteId), {
                aiSummary: newSummary,
                updatedAt: serverTimestamp(),
              }).catch(console.warn);
            }
          }
        }}
      />

      {/* Cotizaciones AI Import Modal (PDF / EML / Presupuestos) */}
      <CotizacionesImportAiModal
        isOpen={isImportAiModalOpen}
        onClose={() => setIsImportAiModalOpen(false)}
        cotizacionId={currentQuoteId || "general"}
        existingItems={items.map((it) => ({
          id: it.id,
          name: it.name,
          baseUnit: it.baseUnit,
          targetQuantity: it.targetQuantity,
        }))}
        targetProviderId={importAiTargetProviderId}
        targetProviderName={importAiTargetProviderName}
        onConfirmImport={handleConfirmImportAi}
      />
    </AppLayout>
  );
}
