"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Save, 
  Calculator, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  HelpCircle, 
  Trophy, 
  RefreshCw, 
  FileSpreadsheet, 
  FolderOpen,
  ArrowRight,
  TrendingDown,
  Info,
  Scale,
  Sparkles,
  Layers,
  Share2,
  X
} from "lucide-react";

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
}

const DEFAULT_UNITS = [
  { value: "U", label: "Unidades (U)" },
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "L", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "m", label: "Metros (m)" },
  { value: "Pack", label: "Packs (Pack)" },
  { value: "Caja", label: "Cajas (Caja)" },
  { value: "Hora", label: "Horas (h)" },
];

export default function CotizacionesPage() {
  const { user } = useAuth();
  const [dbActive, setDbActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "comparador" | "historial">("editor");

  // General State
  const [quoteName, setQuoteName] = useState("Cotización de Insumos " + new Date().toLocaleDateString("es-AR"));
  const [notes, setNotes] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1400); // 1 USD = 1400 ARS
  const [baseCurrency, setBaseCurrency] = useState<"ARS" | "USD">("ARS");
  const [useRealLots, setUseRealLots] = useState<boolean>(false);

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

  // Image Export States
  const [showImgModal, setShowImgModal] = useState<boolean>(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);

  // UI Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Firebase Db Activation & Sync
  useEffect(() => {
    const db = getFirebaseDb();
    setTimeout(() => {
      setDbActive(!!db);
    }, 0);
  }, []);

  // Fetch History from Firebase or LocalStorage
  const loadHistory = () => {
    setTimeout(() => setLoadingHistory(true), 0);
    const db = getFirebaseDb();

    if (db) {
      const q = query(collection(db, "cotizaciones"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const list: SavedQuotation[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as SavedQuotation);
          });
          setTimeout(() => {
            setSavedQuotations(list);
            setLoadingHistory(false);
          }, 0);
        },
        (error) => {
          console.error("Error loading Firestore history:", error);
          showToast("Error al cargar historial desde la nube", "error");
          setTimeout(() => {
            loadLocalStorageHistory();
            setLoadingHistory(false);
          }, 0);
        }
      );
      return unsubscribe;
    } else {
      setTimeout(() => {
        loadLocalStorageHistory();
        setLoadingHistory(false);
      }, 0);
    }
  };

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
    const unsub = loadHistory();
    return () => {
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbActive]);

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
          discount: 0
        };

        const updatedQuote = { ...itemQuote, [field]: value };

        // Sanitizations
        if (field === "price") {
          updatedQuote.price = parseFloat(value as string) || 0;
        } else if (field === "discount") {
          updatedQuote.discount = Math.min(100, Math.max(0, parseFloat(value as string) || 0));
        } else if (field === "unitsPerPresentation") {
          updatedQuote.unitsPerPresentation = Math.max(1, parseInt(value as string) || 1);
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

    const payload: Omit<SavedQuotation, "id"> = {
      name: quoteName,
      notes,
      exchangeRate,
      baseCurrency,
      useRealLots,
      items,
      providers,
      createdBy: user?.email || "Usuario Local"
    };

    const db = getFirebaseDb();
    try {
      if (db) {
        if (currentQuoteId) {
          // Update existing
          const docRef = doc(db, "cotizaciones", currentQuoteId);
          await updateDoc(docRef, {
            ...payload,
            updatedAt: serverTimestamp()
          });
          showToast(`Cotización "${quoteName}" actualizada en la nube`);
        } else {
          // Create new
          const docRef = await addDoc(collection(db, "cotizaciones"), {
            ...payload,
            createdAt: serverTimestamp()
          });
          setCurrentQuoteId(docRef.id);
          showToast(`Cotización "${quoteName}" guardada en la nube`);
        }
      } else {
        // Fallback to localStorage
        const localData = localStorage.getItem("finanzas-cotizaciones");
        let list: SavedQuotation[] = localData ? JSON.parse(localData) : [];
        
        if (currentQuoteId) {
          list = list.map(q => q.id === currentQuoteId ? { ...q, ...payload } : q);
          showToast(`Cotización "${quoteName}" actualizada localmente`);
        } else {
          const newLocalId = `local-${Date.now()}`;
          const newQuote: SavedQuotation = { id: newLocalId, ...payload, createdAt: new Date().toISOString() };
          list.unshift(newQuote);
          setCurrentQuoteId(newLocalId);
          showToast(`Cotización "${quoteName}" guardada localmente`);
        }
        localStorage.setItem("finanzas-cotizaciones", JSON.stringify(list));
        loadLocalStorageHistory();
      }
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
    setActiveTab("editor");
    showToast(`Cotización "${quote.name}" cargada`);
  };

  // Delete saved quote from list
  const handleDeleteSavedQuote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de que querés eliminar esta cotización?")) return;

    const db = getFirebaseDb();
    try {
      if (db && !id.startsWith("local-")) {
        await deleteDoc(doc(db, "cotizaciones", id));
        showToast("Cotización eliminada de la nube");
      } else {
        const localData = localStorage.getItem("finanzas-cotizaciones");
        if (localData) {
          const list: SavedQuotation[] = JSON.parse(localData);
          const updated = list.filter(q => q.id !== id);
          localStorage.setItem("finanzas-cotizaciones", JSON.stringify(updated));
          loadLocalStorageHistory();
          showToast("Cotización eliminada localmente");
        }
      }
      if (currentQuoteId === id) {
        setCurrentQuoteId(null);
      }
    } catch (error) {
      console.error("Error deleting quote:", error);
      showToast("Error al eliminar la cotización", "error");
    }
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
    setActiveTab("editor");
    showToast(`Copia creada de "${quote.name}"`);
  };

  // -----------------------------------------------------
  // COMPARISON AND SCORING CALCULATIONS
  // -----------------------------------------------------
  
  // Calculate analytics for item
  const getItemAnalysis = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return null;

    let bestProviderId = "";
    let lowestCostBaseCurrency = Infinity;
    const providerCosts: Record<string, { totalBase: number; totalRaw: number; rawCurrency: string; unitPriceBase: number }> = {};

    providers.forEach(prov => {
      const quote = prov.quotes[itemId];
      if (quote && quote.price > 0) {
        const { trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);
        const { totalBaseCurrency, totalRawCurrency } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);
        
        providerCosts[prov.id] = {
          totalBase: totalBaseCurrency,
          totalRaw: totalRawCurrency,
          rawCurrency: quote.currency,
          unitPriceBase: trueUnitRateBaseCurrency
        };

        if (totalBaseCurrency < lowestCostBaseCurrency) {
          lowestCostBaseCurrency = totalBaseCurrency;
          bestProviderId = prov.id;
        }
      }
    });

    return {
      itemId,
      bestProviderId: lowestCostBaseCurrency === Infinity ? "" : bestProviderId,
      lowestCostBaseCurrency: lowestCostBaseCurrency === Infinity ? 0 : lowestCostBaseCurrency,
      providerCosts
    };
  };

  // Analyze all items
  const itemAnalyses = items.reduce((acc, item) => {
    const analysis = getItemAnalysis(item.id);
    if (analysis) {
      acc[item.id] = analysis;
    }
    return acc;
  }, {} as Record<string, ReturnType<typeof getItemAnalysis>>);

  // Totals per Provider (for full quote)
  const providerTotals = providers.map(prov => {
    let sumBaseCurrency = 0;
    let itemsQuotedCount = 0;
    
    items.forEach(item => {
      const quote = prov.quotes[item.id];
      if (quote && quote.price > 0) {
        const { totalBaseCurrency } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);
        sumBaseCurrency += totalBaseCurrency;
        itemsQuotedCount++;
      }
    });

    return {
      providerId: prov.id,
      providerName: prov.name,
      totalBaseCurrency: sumBaseCurrency,
      itemsQuotedCount,
      allQuoted: itemsQuotedCount === items.length
    };
  });

  // Sort totals to find best overall provider (only among those who have quoted all items)
  const activeTotals = providerTotals.filter(t => t.totalBaseCurrency > 0 && t.allQuoted);
  const bestOverallProvider = activeTotals.length > 0 
    ? [...activeTotals].sort((a, b) => a.totalBaseCurrency - b.totalBaseCurrency)[0] 
    : null;

  // Split-Purchase Optimization (Compra Mixta / Compra Optimizada):
  // Buy each item from the provider that offers the cheapest rate for it.
  const optimizedPurchase = () => {
    let totalBaseCurrency = 0;
    const splitDetails: Record<string, { providerId: string; providerName: string; costBaseCurrency: number }> = {};
    let missingQuote = false;

    items.forEach(item => {
      const analysis = itemAnalyses[item.id];
      if (analysis && analysis.bestProviderId) {
        const prov = providers.find(p => p.id === analysis.bestProviderId);
        splitDetails[item.id] = {
          providerId: analysis.bestProviderId,
          providerName: prov ? prov.name : "Desconocido",
          costBaseCurrency: analysis.lowestCostBaseCurrency
        };
        totalBaseCurrency += analysis.lowestCostBaseCurrency;
      } else {
        missingQuote = true;
      }
    });

    return {
      totalBaseCurrency,
      splitDetails,
      complete: !missingQuote
    };
  };

  const optimizedResult = optimizedPurchase();

  // Helper formatting values
  const formatCurrencyValue = (val: number, curr: "ARS" | "USD" = baseCurrency) => {
    if (curr === "ARS") {
      return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
    } else {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    }
  };

  // Export quote comparison as a beautiful image card
  const handleExportImage = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dimensions
    const width = 1200;
    const padding = 50;
    const itemRowHeight = 60;
    const headerHeight = 220;
    const providerSectionHeight = 40 + (providers.length * 95);
    const optSectionHeight = 130;
    
    const contentHeight = Math.max(
      items.length * itemRowHeight + 80, 
      providerSectionHeight
    );
    
    const height = headerHeight + contentHeight + optSectionHeight + padding * 2;
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

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0b0f17");
    bgGrad.addColorStop(1, "#181335");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Ambient Glows
    ctx.fillStyle = "rgba(16, 185, 129, 0.02)";
    ctx.beginPath();
    ctx.arc(100, 100, 300, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(99, 102, 241, 0.03)";
    ctx.beginPath();
    ctx.arc(width - 150, height - 150, 400, 0, Math.PI * 2);
    ctx.fill();

    // Header Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("CUADRO COMPARATIVO DE PRECIOS", padding, padding + 40);

    // Subtitle
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px sans-serif";
    ctx.fillText(quoteName || "Cotización de Insumos", padding, padding + 72);

    // Decorative separator
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(padding, padding + 95, width - padding * 2, 2);

    // Metadata Badges
    const dateStr = new Date().toLocaleDateString("es-AR");
    
    // Badge 1: Date
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    drawRoundRect(padding, padding + 115, 160, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`Fecha: ${dateStr}`, padding + 15, padding + 138);

    // Badge 2: TC
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    drawRoundRect(padding + 175, padding + 115, 230, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`TC Mayorista: 1 USD = $${exchangeRate}`, padding + 190, padding + 138);

    // Badge 3: Base Currency
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    drawRoundRect(padding + 420, padding + 115, 170, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#c084fc";
    ctx.fillText(`Moneda: ${baseCurrency}`, padding + 435, padding + 138);

    // Content positions
    const leftWidth = 650;
    const rightX = padding + leftWidth + 50;
    const rightWidth = width - rightX - padding;
    const startY = headerHeight + 40;

    // LEFT SIDE: Items Detail Table
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Detalle de Ítems Requeridos", padding, startY);

    // Table Headers
    ctx.fillStyle = "#475569";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("ÍTEM / REQUERIMIENTO", padding, startY + 40);
    ctx.fillText("MEJOR PRECIO", padding + 380, startY + 40);
    ctx.fillText("PROVEEDOR GANADOR", padding + 510, startY + 40);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, startY + 52);
    ctx.lineTo(padding + leftWidth, startY + 52);
    ctx.stroke();

    items.forEach((item, idx) => {
      const rowY = startY + 65 + idx * itemRowHeight;

      // Draw zebra backgrounds
      if (idx % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.01)";
        ctx.fillRect(padding - 10, rowY - 12, leftWidth + 20, itemRowHeight);
      }

      // Draw Item Name
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(item.name || "Ítem sin nombre", padding, rowY + 18);

      // Draw unit and qty
      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Cantidad requerida: ${item.targetQuantity} ${item.baseUnit}`, padding, rowY + 36);

      // Draw best option
      const analysis = itemAnalyses[item.id];
      if (analysis && analysis.bestProviderId) {
        const bestProv = providers.find(p => p.id === analysis.bestProviderId);
        
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(formatCurrencyValue(analysis.lowestCostBaseCurrency, baseCurrency), padding + 380, rowY + 22);

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "13px sans-serif";
        ctx.fillText(bestProv ? bestProv.name : "-", padding + 510, rowY + 22);
      } else {
        ctx.fillStyle = "#475569";
        ctx.font = "italic 13px sans-serif";
        ctx.fillText("Sin cotizaciones", padding + 380, rowY + 22);
      }
    });

    // RIGHT SIDE: Providers Summary Card stack
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Cuadro de Proveedores", rightX, startY);

    providerTotals.forEach((total, idx) => {
      const cardY = startY + 30 + idx * 95;
      const isWinner = bestOverallProvider?.providerId === total.providerId;

      // Card Box
      ctx.fillStyle = isWinner ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)";
      drawRoundRect(rightX, cardY, rightWidth, 80, 12);
      ctx.fill();
      
      ctx.strokeStyle = isWinner ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Provider Name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(total.providerName, rightX + 16, cardY + 30);

      // Stats
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Cotizados: ${total.itemsQuotedCount}/${items.length} ítems`, rightX + 16, cardY + 54);
      if (!total.allQuoted) {
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(" (Incompleto)", rightX + 120, cardY + 54);
      }

      // Cost
      ctx.fillStyle = isWinner ? "#34d399" : "#f1f5f9";
      ctx.font = "bold 18px sans-serif";
      const totalText = formatCurrencyValue(total.totalBaseCurrency, baseCurrency);
      const textWidth = ctx.measureText(totalText).width;
      ctx.fillText(totalText, rightX + rightWidth - textWidth - 16, cardY + 36);

      // Label status
      if (isWinner) {
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 10px sans-serif";
        const badge = "RECOMENDADO ★";
        const badgeW = ctx.measureText(badge).width;
        ctx.fillText(badge, rightX + rightWidth - badgeW - 16, cardY + 56);
      } else if (total.totalBaseCurrency > 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        const diffText = bestOverallProvider && total.totalBaseCurrency > bestOverallProvider.totalBaseCurrency
          ? `+${((total.totalBaseCurrency - bestOverallProvider.totalBaseCurrency) / bestOverallProvider.totalBaseCurrency * 100).toFixed(0)}%`
          : "";
        const diffW = ctx.measureText(diffText).width;
        ctx.fillText(diffText, rightX + rightWidth - diffW - 16, cardY + 56);
      }
    });

    // FOOTER: Recommendation Card
    const footerY = height - optSectionHeight - padding;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, footerY);
    ctx.lineTo(width - padding, footerY);
    ctx.stroke();

    const optY = footerY + 25;
    ctx.fillStyle = "rgba(45, 212, 191, 0.04)";
    drawRoundRect(padding, optY, width - padding * 2, 75, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(45, 212, 191, 0.15)";
    ctx.stroke();

    ctx.fillStyle = "#2dd4bf";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("💡 ESTRATEGIA DE AHORRO: COMPRA MIXTA OPTIMIZADA", padding + 20, optY + 30);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText("Emitiendo órdenes de compra divididas según la mejor oferta de cada proveedor, el total consolidado se reduce a:", padding + 20, optY + 52);

    ctx.fillStyle = "#2dd4bf";
    ctx.font = "bold 24px sans-serif";
    const optText = formatCurrencyValue(optimizedResult.totalBaseCurrency, baseCurrency);
    const optTextW = ctx.measureText(optText).width;
    ctx.fillText(optText, width - padding - optTextW - 20, optY + 45);

    // Watermark
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText("Generado por Finanzas Gestor - Módulo de Cotizaciones", padding, height - 20);

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

  return (
    <AppLayout title="Cotizaciones" subtitle="Compará proveedores, manejá unidades de medida y monedas integradas">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
          toast.type === "success" 
            ? "bg-emerald-950/80 text-emerald-200 border-emerald-500/30" 
            : toast.type === "error" 
              ? "bg-red-950/80 text-red-200 border-red-500/30" 
              : "bg-blue-950/80 text-blue-200 border-blue-500/30"
        }`}>
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
          {toast.type === "info" && <Info className="w-5 h-5 text-blue-400" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Main Grid: Control Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-[#101725] border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "editor"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Editor de Cotización
          </button>
          <button
            onClick={() => setActiveTab("comparador")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "comparador"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            <Scale className="w-4 h-4" />
            Matriz Comparativa
            {providers.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">
                {providers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("historial")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "historial"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Historial
            {savedQuotations.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">
                {savedQuotations.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleNewQuotation}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 hover:text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Nueva Cotización
          </button>
          
          <button
            onClick={handleSaveQuotation}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-sm font-bold transition-all"
          >
            <Save className="w-4 h-4" />
            Guardar Cambios
          </button>

          {/* Database indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[11px] text-gray-400">
            <span className={`w-2 h-2 rounded-full ${dbActive ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            {dbActive ? "Sincronizado Nube" : "Almacenamiento Local"}
          </div>
        </div>
      </div>

      {/* Quote Meta Information */}
      <div className="glass-card rounded-3xl p-6 mb-8 border border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nombre del Presupuesto / Proyecto</label>
            <input
              type="text"
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="Ej. Insumos Planta Munro Q3"
              className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-2 col-span-1 lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Exchange Rate Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                TC Mayorista
                <span className="text-[10px] text-gray-500">(1 USD a ARS)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">$</span>
                <input
                  type="number"
                  value={exchangeRate || ""}
                  onChange={(e) => setExchangeRate(Math.max(1, parseFloat(e.target.value) || 0))}
                  placeholder="1400"
                  className="w-full bg-[#111827]/60 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Base Comparison Currency Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Moneda Base</label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value as "ARS" | "USD")}
                className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="ARS">Pesos Argentinos ($)</option>
                <option value="USD">Dólares (US$)</option>
              </select>
            </div>

            {/* Pricing Mode Option */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                Lotes Enteros
                <span title="Activar para calcular precios finales en base a cajas/packs enteros en vez de fracciones." className="cursor-help flex items-center">
                  <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                </span>
              </label>
              <select
                value={useRealLots ? "real" : "fraction"}
                onChange={(e) => setUseRealLots(e.target.value === "real")}
                className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="fraction">Fraccional (Exacto)</option>
                <option value="real">Lotes Completos (Compra Real)</option>
              </select>
            </div>

            {/* Total Items Info */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Resumen Ítems</label>
              <div className="bg-[#111827]/40 border border-white/5 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs text-gray-300 h-[42px]">
                <span>Ítems: <b>{items.length}</b></span>
                <span>Prov: <b>{providers.length}</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Field */}
        <div className="mt-4 space-y-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notas o Descripción</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comentarios sobre requerimientos de entrega, plazos de pago, etc."
            rows={1}
            className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-y min-h-[40px]"
          />
        </div>
      </div>

      {/* ====================================================
          TAB CONTENT: EDITOR DE COTIZACIÓN
          ==================================================== */}
      {activeTab === "editor" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Section 1: Target Items Configuration */}
          <div className="glass-card rounded-3xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">1. Ítems a presupuestar</h3>
                  <p className="text-xs text-gray-400">Configurá los insumos y la cantidad base que necesitás</p>
                </div>
              </div>
              
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir Ítem
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#101725] text-gray-400 text-xs font-semibold uppercase border-b border-white/5">
                  <tr>
                    <th className="p-4 rounded-l-xl">Nombre del Ítem / Insumo</th>
                    <th className="p-4">Unidad de Medida Base</th>
                    <th className="p-4">Cantidad Requerida</th>
                    <th className="p-4 w-16 rounded-r-xl text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                          placeholder="Ej. Resma A4, Café en Grano, Azúcar..."
                          className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </td>
                      <td className="p-4 w-60">
                        <select
                          value={item.baseUnit}
                          onChange={(e) => handleUpdateItem(item.id, "baseUnit", e.target.value)}
                          className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        >
                          {DEFAULT_UNITS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 w-52">
                        <div className="relative">
                          <input
                            type="number"
                            value={item.targetQuantity || ""}
                            onChange={(e) => handleUpdateItem(item.id, "targetQuantity", e.target.value)}
                            placeholder="Cantidad"
                            className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            {item.baseUnit}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={items.length === 1}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Eliminar ítem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Providers and Quotes Editing */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">2. Precios por Proveedor</h3>
                  <p className="text-xs text-gray-400">Cargá las cotizaciones de los proveedores para cada ítem</p>
                </div>
              </div>
              
              <button
                onClick={handleAddProvider}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir Proveedor
              </button>
            </div>

            {/* Responsive grid of Provider quote cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {providers.map((provider) => (
                <div key={provider.id} className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
                  <div>
                    {/* Provider Card Header */}
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
                      <input
                        type="text"
                        value={provider.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setProviders(providers.map(p => p.id === provider.id ? { ...p, name } : p));
                        }}
                        className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-emerald-500 focus:outline-none font-bold text-white text-base py-1 px-2 rounded -ml-2 transition-all w-2/3"
                        placeholder="Nombre del Proveedor"
                      />
                      
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/10"
                        title="Eliminar este proveedor"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </div>

                    {/* Quotation entries for each item */}
                    <div className="space-y-6">
                      {items.map((item) => {
                        const quote = provider.quotes[item.id] || {
                          currency: "ARS",
                          presentationType: "base",
                          presentationName: "",
                          unitsPerPresentation: 1,
                          price: 0,
                          discount: 0
                        };

                        // Calculamos precio unitario de referencia para mostrar
                        const { trueUnitRateRaw, trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);

                        return (
                          <div key={item.id} className="p-4 rounded-2xl bg-[#111827]/40 border border-white/5 space-y-3">
                            {/* Item name and presentation type selection */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-emerald-300 truncate max-w-[200px]">
                                {item.name || "Ítem sin nombre"}
                                <span className="text-xs text-gray-500 font-normal ml-1">
                                  (Req: {item.targetQuantity} {item.baseUnit})
                                </span>
                              </span>

                              {/* Presentation Mode Selector */}
                              <div className="flex bg-[#101725] p-0.5 rounded-lg border border-white/5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuote(provider.id, item.id, "presentationType", "base")}
                                  className={`px-2.5 py-1 rounded font-semibold ${
                                    quote.presentationType === "base"
                                      ? "bg-emerald-500 text-white"
                                      : "text-gray-400 hover:text-gray-200"
                                  }`}
                                >
                                  Por {item.baseUnit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuote(provider.id, item.id, "presentationType", "package")}
                                  className={`px-2.5 py-1 rounded font-semibold ${
                                    quote.presentationType === "package"
                                      ? "bg-emerald-500 text-white"
                                      : "text-gray-400 hover:text-gray-200"
                                  }`}
                                >
                                  Por Lote / Pack
                                </button>
                              </div>
                            </div>

                            {/* Presentation Config Details */}
                            {quote.presentationType === "package" && (
                              <div className="grid grid-cols-2 gap-3 p-3 bg-[#101725]/60 rounded-xl border border-white/5">
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-400 font-semibold uppercase">Nombre Lote</label>
                                  <input
                                    type="text"
                                    value={quote.presentationName}
                                    onChange={(e) => handleUpdateQuote(provider.id, item.id, "presentationName", e.target.value)}
                                    placeholder="Ej. Caja x12"
                                    className="w-full bg-[#111827]/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-400 font-semibold uppercase">Cantidad del Lote ({item.baseUnit})</label>
                                  <input
                                    type="number"
                                    value={quote.unitsPerPresentation || ""}
                                    onChange={(e) => handleUpdateQuote(provider.id, item.id, "unitsPerPresentation", e.target.value)}
                                    placeholder="Ej. 12"
                                    className="w-full bg-[#111827]/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Financial Inputs: Price, Currency, Discount */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Price */}
                              <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-semibold uppercase">
                                  {quote.presentationType === "package" ? "Precio de Lote" : `Precio por ${item.baseUnit}`}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                                    {quote.currency === "ARS" ? "$" : "US$"}
                                  </span>
                                  <input
                                    type="number"
                                    value={quote.price || ""}
                                    onChange={(e) => handleUpdateQuote(provider.id, item.id, "price", e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-[#111827]/60 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>

                              {/* Currency */}
                              <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-semibold uppercase">Moneda</label>
                                <select
                                  value={quote.currency}
                                  onChange={(e) => handleUpdateQuote(provider.id, item.id, "currency", e.target.value)}
                                  className="w-full bg-[#111827]/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 h-[30px]"
                                >
                                  <option value="ARS">Pesos ($)</option>
                                  <option value="USD">Dólares (USD)</option>
                                </select>
                              </div>

                              {/* Discount */}
                              <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-semibold uppercase">Descuento (%)</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={quote.discount || ""}
                                    onChange={(e) => handleUpdateQuote(provider.id, item.id, "discount", e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-[#111827]/60 border border-white/10 rounded-lg pl-2.5 pr-6 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] font-semibold">%</span>
                                </div>
                              </div>
                            </div>

                            {/* Quick Calculated Stats */}
                            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 pt-1">
                              <span>
                                Unitario neto: <b className="font-mono text-gray-200">
                                  {quote.currency === "ARS" ? "$" : "US$"}
                                  {trueUnitRateRaw.toFixed(2)}
                                </b> /{item.baseUnit}
                              </span>
                              <span>
                                Ref Moneda Base ({baseCurrency}): <b className="font-mono text-emerald-400">
                                  {formatCurrencyValue(trueUnitRateBaseCurrency, baseCurrency)}
                                </b>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary for this provider inside card */}
                  <div className="mt-6 pt-4 border-t border-white/5 bg-[#101725]/30 p-3 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-bold">TOTAL ESTIMADO:</span>
                      <span className="text-base font-black font-mono text-white">
                        {formatCurrencyValue(
                          providerTotals.find(t => t.providerId === provider.id)?.totalBaseCurrency || 0,
                          baseCurrency
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-right text-gray-500 mt-1">
                      En {baseCurrency === "ARS" ? "Pesos Argentinos" : "Dólares Estadounidenses"}{" "}
                      {useRealLots ? "(Cajas enteras)" : "(Fracción exacta)"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA to comparison matrix */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  setActiveTab("comparador");
                }}
                className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
              >
                Comparar Ofertas y ver Ganador
                <ArrowRight className="w-4 h-4 animate-pulse" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB CONTENT: MATRIZ COMPARATIVA (CUADRO DE PRECIOS)
          ==================================================== */}
      {activeTab === "comparador" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Main Scoring Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall Winner Card */}
            <div className="glass-card rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Trophy className="w-24 h-24 text-amber-400" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Proveedor Recomendado</h4>
              </div>
              
              {bestOverallProvider ? (
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white truncate">{bestOverallProvider.providerName}</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {formatCurrencyValue(bestOverallProvider.totalBaseCurrency, baseCurrency)}
                    </span>
                    <span className="text-xs text-gray-400">Total en {baseCurrency}</span>
                  </div>
                  <p className="text-xs text-gray-400 pt-1">
                    Cubre <b className="text-white">{bestOverallProvider.itemsQuotedCount} de {items.length}</b> ítems cotizados.
                  </p>
                </div>
              ) : providerTotals.some(t => t.totalBaseCurrency > 0) ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-amber-400">Cotización Incompleta</h3>
                  <p className="text-xs text-gray-400">
                    Ningún proveedor cotizó todos los ítems ({items.length}). No se puede calcular un ganador absoluto.
                  </p>
                  <p className="text-xs text-emerald-400 pt-1 font-semibold">
                    💡 Se recomienda usar la Compra Mixta Optimizada.
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-sm text-gray-400 italic">No hay cotizaciones cargadas para calcular un ganador.</p>
                </div>
              )}
            </div>

            {/* Split Optimized Purchase Card (Awesome Premium Feature!) */}
            <div className="glass-card rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Sparkles className="w-24 h-24 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Compra Mixta Optimizada</h4>
              </div>

              {optimizedResult && optimizedResult.totalBaseCurrency > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Dividir Pedido</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono text-teal-400">
                      {formatCurrencyValue(optimizedResult.totalBaseCurrency, baseCurrency)}
                    </span>
                    <span className="text-xs text-gray-400">Presupuesto Min.</span>
                  </div>
                  
                  {bestOverallProvider && bestOverallProvider.totalBaseCurrency > optimizedResult.totalBaseCurrency ? (
                    <p className="text-xs text-emerald-400 pt-1">
                      ¡Ahorrás <b className="font-mono">{formatCurrencyValue(bestOverallProvider.totalBaseCurrency - optimizedResult.totalBaseCurrency, baseCurrency)}</b> adicionales dividiendo el pedido!
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 pt-1">
                      Comprar todo al ganador es la opción óptima en este caso.
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  <p className="text-sm text-gray-400 italic">Carga precios en el editor para optimizar.</p>
                </div>
              )}
            </div>

            {/* Savings & Comparison Report Card */}
            <div className="glass-card rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-24 h-24 text-indigo-400" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-indigo-400" />
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Margen de Ahorro Máximo</h4>
              </div>

              {providers.length >= 2 && bestOverallProvider && activeTotals.length >= 2 ? (
                (() => {
                  const sortedTotals = [...activeTotals].sort((a, b) => b.totalBaseCurrency - a.totalBaseCurrency);
                  const worstProvider = sortedTotals[0]; // highest cost
                  const difference = worstProvider.totalBaseCurrency - optimizedResult.totalBaseCurrency;
                  const pct = worstProvider.totalBaseCurrency > 0 ? (difference / worstProvider.totalBaseCurrency) * 100 : 0;

                  return (
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-white">Ahorro de hasta {pct.toFixed(0)}%</h3>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-indigo-400">
                          {formatCurrencyValue(difference, baseCurrency)}
                        </span>
                        <span className="text-xs text-gray-400">Evitando sobreprecios</span>
                      </div>
                      <p className="text-xs text-gray-400 pt-1">
                        Comparación entre peor proveedor vs. Compra Mixta.
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="py-2">
                  <p className="text-sm text-gray-400 italic">Agregá más proveedores para ver reportes de ahorro.</p>
                </div>
              )}
            </div>
          </div>

          {/* Side-by-Side Detailed Matrix Table */}
          <div className="glass-card rounded-3xl p-6 border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Cuadro Comparativo de Precios</h3>
                  <p className="text-xs text-gray-400">Vista detallada por ítem e indicador visual de mejor oferta</p>
                </div>
              </div>

              {/* Matrix Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleExportImage}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#101725] hover:bg-[#101725]/80 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Exportar Imagen
                </button>
                <span className="text-gray-700 hidden sm:inline">|</span>
                <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                  <span>TC: 1 USD = ${exchangeRate} ARS</span>
                  <span>•</span>
                  <span className="uppercase">{baseCurrency}</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#101725] text-gray-400 text-xs font-semibold uppercase border-b border-white/5">
                  <tr>
                    <th className="p-4 rounded-l-xl">Ítem y Requerimiento</th>
                    {providers.map(prov => (
                      <th key={prov.id} className="p-4 text-center border-l border-white/5 min-w-[200px]">
                        {prov.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => {
                    const analysis = itemAnalyses[item.id];
                    
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.01] transition-colors align-top">
                        {/* Item column */}
                        <td className="p-4">
                          <p className="font-bold text-white text-sm">{item.name || "Ítem sin nombre"}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Cantidad: <b className="text-emerald-400 font-mono">{item.targetQuantity} {item.baseUnit}</b>
                          </p>
                        </td>

                        {/* Providers values for this item */}
                        {providers.map(prov => {
                          const quote = prov.quotes[item.id];
                          const hasQuote = quote && quote.price > 0;
                          
                          if (!hasQuote) {
                            return (
                              <td key={prov.id} className="p-4 text-center text-gray-500 italic bg-black/10 border-l border-white/5">
                                Sin cotización
                              </td>
                            );
                          }

                          // Calculations
                          const { trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);
                          const { totalBaseCurrency, totalRawCurrency, presentationsCount } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);
                          const isWinner = analysis?.bestProviderId === prov.id;

                          return (
                            <td 
                              key={prov.id} 
                              className={`p-4 border-l border-white/5 transition-all text-center relative ${
                                isWinner 
                                  ? "bg-emerald-950/20 border-emerald-500/20" 
                                  : "bg-black/5"
                              }`}
                            >
                              {/* Winner ribbon */}
                              {isWinner && (
                                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-extrabold uppercase border border-emerald-500/20 tracking-wider">
                                  Mejor precio
                                </span>
                              )}

                              {/* Price unit display */}
                              <div className="space-y-1.5">
                                {/* Raw quoted price */}
                                <div className="text-xs text-gray-400">
                                  Cotizó:{" "}
                                  <span className="font-semibold text-gray-200">
                                    {quote.currency === "ARS" ? "$" : "US$"}
                                    {quote.price.toLocaleString("es-AR")}
                                  </span>
                                  {quote.presentationType === "package" ? (
                                    <span> x {quote.presentationName || `Lote ${quote.unitsPerPresentation}`}</span>
                                  ) : (
                                    <span> por {item.baseUnit}</span>
                                  )}
                                  {quote.discount > 0 && (
                                    <span className="text-red-400 text-[10px] font-bold ml-1">(-{quote.discount}%)</span>
                                  )}
                                </div>

                                {/* True unit rate in base unit */}
                                <div className="text-[11px] text-gray-400">
                                  Unitario: <span className="font-mono text-gray-300 font-semibold">{formatCurrencyValue(trueUnitRateBaseCurrency, baseCurrency)}</span> /{item.baseUnit}
                                </div>

                                {/* Purchase requirements details */}
                                {quote.presentationType === "package" && (
                                  <div className="text-[10px] text-gray-500">
                                    Compra: {presentationsCount.toFixed(useRealLots ? 0 : 2)} Lote(s)
                                    {useRealLots && ` (${Math.ceil(presentationsCount) * quote.unitsPerPresentation} ${item.baseUnit})`}
                                  </div>
                                )}

                                {/* Total Price for this item */}
                                <div className="pt-2 border-t border-white/5">
                                  <p className="text-xs text-gray-500 uppercase tracking-wider text-[9px] font-bold">Total Item</p>
                                  <p className={`text-sm font-black font-mono ${isWinner ? "text-emerald-400" : "text-white"}`}>
                                    {formatCurrencyValue(totalBaseCurrency, baseCurrency)}
                                  </p>
                                  {quote.currency !== baseCurrency && (
                                    <p className="text-[10px] text-gray-500 font-mono">
                                      ({quote.currency === "ARS" ? "$" : "US$"}
                                      {totalRawCurrency.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* SUMMARY TOTAL ROW */}
                  <tr className="bg-[#101725]/60 font-bold border-t-2 border-white/10">
                    <td className="p-4 rounded-bl-xl">
                      <p className="text-sm font-black text-white uppercase tracking-wider">TOTAL GENERAL</p>
                      <p className="text-[10px] text-gray-400 font-normal">
                        ({useRealLots ? "Lotes completos" : "Fraccional exacto"})
                      </p>
                    </td>

                    {providers.map(prov => {
                      const totalData = providerTotals.find(t => t.providerId === prov.id);
                      const isOverallWinner = bestOverallProvider?.providerId === prov.id;
                      
                      return (
                        <td 
                          key={prov.id} 
                          className={`p-4 text-center border-l border-white/5 ${
                            isOverallWinner 
                              ? "bg-emerald-950/30 border-emerald-500/30" 
                              : "bg-black/10"
                          }`}
                        >
                          <p className={`text-base font-black font-mono ${isOverallWinner ? "text-emerald-400 text-lg" : "text-white"}`}>
                            {formatCurrencyValue(totalData?.totalBaseCurrency || 0, baseCurrency)}
                            {totalData && !totalData.allQuoted && (
                              <span className="text-amber-400 text-[10px] font-bold block mt-0.5">
                                (Total Parcial)
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400 font-normal mt-1">
                            Cotizados: {totalData?.itemsQuotedCount} de {items.length} ítems
                          </p>
                          {isOverallWinner && (
                            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20">
                              <Trophy className="w-3.5 h-3.5" />
                              Ganador
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Split Optimized Purchase Plan details */}
          <div className="glass-card rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <div>
                <h3 className="font-bold text-white text-base">Plan de Compra Mixto Optimizado</h3>
                <p className="text-xs text-gray-400">Estrategia recomendada comprando a cada proveedor según el mejor precio de cada ítem</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Detailed Breakdown */}
              <div className="lg:col-span-2 space-y-3">
                {items.map(item => {
                  const split = optimizedResult.splitDetails[item.id];
                  if (!split) return null;

                  return (
                    <div key={item.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#111827]/40 border border-white/5">
                      <div className="space-y-0.5">
                        <span className="text-sm font-semibold text-white">{item.name}</span>
                        <div className="text-xs text-gray-400 flex items-center gap-2">
                          <span>Requerido: <b>{item.targetQuantity} {item.baseUnit}</b></span>
                          <span className="text-gray-700">•</span>
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            Comprar a: <b>{split.providerName}</b>
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold text-teal-400">
                        {formatCurrencyValue(split.costBaseCurrency, baseCurrency)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Overview block */}
              <div className="p-6 rounded-2xl bg-[#101725]/60 border border-white/5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Costo Consolidado Mixto</h4>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500">MÍNIMO POSIBLE</p>
                    <p className="text-3xl font-black font-mono text-teal-400">
                      {formatCurrencyValue(optimizedResult.totalBaseCurrency, baseCurrency)}
                    </p>
                    <p className="text-xs text-gray-400">Moneda de comparación: {baseCurrency}</p>
                  </div>

                  {bestOverallProvider && bestOverallProvider.totalBaseCurrency > optimizedResult.totalBaseCurrency && (
                    <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/10 text-xs text-teal-300 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Ahorro Adicional Detectado
                      </p>
                      <p>
                        Dividiendo la orden de compra ahorrás un {" "}
                        <b>
                          {((bestOverallProvider.totalBaseCurrency - optimizedResult.totalBaseCurrency) / bestOverallProvider.totalBaseCurrency * 100).toFixed(1)}%
                        </b>{" "}
                        respecto a comprarle todo a {bestOverallProvider.providerName}.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 text-[10px] text-gray-500">
                  <p>✓ Permite emitir solicitudes diferenciadas para maximizar el presupuesto corporativo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB CONTENT: HISTORIAL DE COTIZACIONES
          ==================================================== */}
      {activeTab === "historial" && (
        <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-6 animate-fadeIn">
          <div>
            <h3 className="font-bold text-white text-base">Historial de Cotizaciones</h3>
            <p className="text-xs text-gray-400">Recuperá cotizaciones cargadas anteriormente</p>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : savedQuotations.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-300">No se encontraron cotizaciones guardadas</p>
              <p className="text-xs text-gray-500 mt-1">Guardá tu trabajo actual usando el botón superior &quot;Guardar Cambios&quot;</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedQuotations.map((quote) => {
                const date = (quote.createdAt && typeof quote.createdAt === "object" && "seconds" in quote.createdAt)
                  ? new Date((quote.createdAt as { seconds: number }).seconds * 1000).toLocaleString("es-AR")
                  : (quote.createdAt && typeof quote.createdAt === "string"
                      ? new Date(quote.createdAt).toLocaleString("es-AR")
                      : "Fecha desconocida");

                const isCurrent = currentQuoteId === quote.id;

                return (
                  <div
                    key={quote.id}
                    onClick={() => handleSelectQuote(quote)}
                    className={`p-5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-4 group ${
                      isCurrent 
                        ? "bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/60" 
                        : "bg-[#111827]/40 border-white/5 hover:border-white/15 hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors truncate pr-4">
                          {quote.name}
                        </h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20 whitespace-nowrap">
                            Cargada
                          </span>
                        )}
                      </div>
                      
                      {quote.notes && (
                        <p className="text-xs text-gray-400 line-clamp-2 italic">
                          &quot;{quote.notes}&quot;
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 pt-2 border-t border-white/5">
                        <div>
                          Moneda: <span className="text-gray-300 font-semibold">{quote.baseCurrency}</span>
                        </div>
                        <div>
                          Tipo Cambio: <span className="text-gray-300 font-semibold font-mono">${quote.exchangeRate}</span>
                        </div>
                        <div>
                          Ítems: <span className="text-gray-300 font-semibold">{quote.items?.length || 0}</span>
                        </div>
                        <div>
                          Provs: <span className="text-gray-300 font-semibold">{quote.providers?.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[10px] text-gray-500 border-t border-white/5">
                      <span>{date}</span>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleDuplicateQuote(quote, e)}
                          className="p-1.5 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Duplicar cotización"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            if (quote.id) handleDeleteSavedQuote(quote.id, e);
                          }}
                          className="p-1.5 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Eliminar de historial"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Modal Vista Previa Imagen Exportable */}
      {showImgModal && generatedImgUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-card rounded-3xl p-6 max-w-4xl w-full border border-white/10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">Reporte Comparativo de Precios</h3>
                <p className="text-xs text-gray-400">Descargá o copiá la imagen generada para enviarla por WhatsApp o Slack</p>
              </div>
              <button
                onClick={() => setShowImgModal(false)}
                className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Generated Image Preview Container */}
            <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImgUrl}
                alt="Reporte Comparativo"
                className="max-w-full h-auto rounded-lg shadow-2xl max-h-[55vh] object-contain"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.download = `Comparativa-${quoteName.replace(/\s+/g, "-")}.png`;
                  link.href = generatedImgUrl;
                  link.click();
                  showToast("Imagen descargada con éxito");
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Descargar PNG
              </button>

              <button
                onClick={async () => {
                  try {
                    const response = await fetch(generatedImgUrl);
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                      new ClipboardItem({
                        [blob.type]: blob
                      })
                    ]);
                    showToast("¡Imagen copiada al portapapeles! Ya podés pegarla.");
                  } catch (err) {
                    console.error("Error copying to clipboard:", err);
                    showToast("No se pudo copiar automáticamente. Descargá el archivo.", "error");
                  }
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-bold transition-colors cursor-pointer"
              >
                Copiar al Portapapeles
              </button>

              <button
                onClick={() => setShowImgModal(false)}
                className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
