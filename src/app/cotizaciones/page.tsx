"use client";

import { useState, useEffect, Fragment } from "react";
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
  const [convertCurrencies, setConvertCurrencies] = useState<boolean>(false);

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
      sentAt: status === "enviada" ? sentAt : ""
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
    setStatus("borrador");
    setWinningProviderId("");
    setSentAt("");
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
    let loadedStatus: "borrador" | "enviada" | "finalizada" | "cancelada" = "borrador";
    if (quote.status) {
      loadedStatus = quote.status as "borrador" | "enviada" | "finalizada" | "cancelada";
    } else if (quote.isFinalized) {
      loadedStatus = "finalizada";
    }
    setStatus(loadedStatus);
    setWinningProviderId(quote.winningProviderId || "");
    setSentAt(quote.sentAt || "");
    setHasActiveQuote(true);
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
        setHasActiveQuote(false);
        setActiveTab("historial");
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
    setStatus("borrador");
    setWinningProviderId("");
    setHasActiveQuote(true);
    setActiveTab("editor");
    showToast(`Copia creada de "${quote.name}"`);
  };

  // -----------------------------------------------------
  // COMPARISON AND SCORING CALCULATIONS
  // -----------------------------------------------------

  // Totals per Provider (for full quote)
  const providerTotals = providers.map(prov => {
    let sumARS = 0;
    let sumUSD = 0;
    let itemsQuotedCount = 0;
    
    items.forEach(item => {
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
      allQuoted: itemsQuotedCount === items.length
    };
  });







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
    const tableWidth = itemColWidth + qtyColWidth + providers.length * (colWidth * 2);
    
    const width = Math.max(1000, tableWidth + padding * 2);
    const contentHeight = 60 + (items.length * itemRowHeight) + 75; // Headers + rows + totals (increased height to 75)
    
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

    providers.forEach((prov, pIdx) => {
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
    items.forEach((item, idx) => {
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
      providers.forEach((prov, pIdx) => {
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
    const totalRowY = startY + 60 + items.length * itemRowHeight;
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



    providers.forEach((prov, pIdx) => {
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
      let tsv = "";
      let html = `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1;">`;

      // Row 1: Main Headers
      const row1 = ["Nombre del Ítem", "Cantidad"];
      providers.forEach(prov => {
        row1.push(prov.name, ""); // Leave empty column for spacing (since each provider has Unitario & Total)
      });
      tsv += row1.join("\t") + "\n";

      html += `<tr style="background-color: #000000; color: #ffffff; font-weight: bold; border-bottom: 2px solid #334155;">`;
      html += `<th style="border: 1px solid #334155; padding: 10px; text-align: left; background-color: #000000; color: #ffffff;" rowspan="2">Nombre del Ítem</th>`;
      html += `<th style="border: 1px solid #334155; padding: 10px; text-align: center; background-color: #000000; color: #ffffff;" rowspan="2">Cantidad</th>`;
      providers.forEach(prov => {
        html += `<th style="border: 1px solid #334155; padding: 10px; text-align: center; background-color: #000000; color: #ffffff;" colspan="2">${prov.name}</th>`;
      });
      html += `</tr>`;

      // Row 2: Sub-headers
      const row2 = ["", ""];
      providers.forEach(() => {
        row2.push("Unitario", "Total");
      });
      tsv += row2.join("\t") + "\n";

      html += `<tr style="background-color: #1e293b; color: #f1f5f9; font-weight: bold;">`;
      providers.forEach(() => {
        html += `<th style="border: 1px solid #334155; padding: 6px; text-align: center; font-size: 9pt; background-color: #1e293b; color: #f1f5f9;">Unitario</th>`;
        html += `<th style="border: 1px solid #334155; padding: 6px; text-align: center; font-size: 9pt; background-color: #1e293b; color: #f1f5f9;">Total</th>`;
      });
      html += `</tr>`;

      // Item Rows
      items.forEach((item, idx) => {
        const bgRow = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const row = [
          item.name || "Ítem sin nombre",
          `${item.targetQuantity} ${item.baseUnit}`
        ];

        html += `<tr style="background-color: ${bgRow}; border-bottom: 1px solid #e2e8f0;">`;
        html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold; color: #0f172a;">${item.name || "Ítem sin nombre"}</td>`;
        html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #475569;">${item.targetQuantity} ${item.baseUnit}</td>`;

        providers.forEach(prov => {
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

            row.push(unitTextText, totalTextText);
            html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: middle;">${unitHtmlText}</td>`;
            html += `<td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: middle; background-color: #fcfcfc;">${totalHtmlText}</td>`;
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

      providers.forEach(prov => {
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


          totalRow.push("-", totalText);
          html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; color: #64748b; vertical-align: middle;">-</td>`;
          html += `<td style="border: 1px solid #cbd5e1; padding: 12px 10px; text-align: center; vertical-align: middle; background-color: #e2e8f0;">${cellHtml}</td>`;
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
        <div className="flex p-1 bg-[#101725] border border-white/5 rounded-2xl overflow-x-auto max-w-full whitespace-nowrap shrink-0">
          <button
            onClick={() => {
              setActiveTab("historial");
              setCurrentQuoteId(null);
              setHasActiveQuote(false);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeTab === "historial"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Mis Cotizaciones
            {savedQuotations.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">
                {savedQuotations.length}
              </span>
            )}
          </button>
          <button
            disabled={!hasActiveQuote}
            onClick={() => hasActiveQuote && setActiveTab("editor")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              !hasActiveQuote 
                ? "text-gray-600 cursor-not-allowed opacity-50"
                : activeTab === "editor"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
            title={!hasActiveQuote ? "Abrí o creá una cotización para editar" : ""}
          >
            <Calculator className="w-4 h-4" />
            Editor
          </button>
          <button
            disabled={!hasActiveQuote}
            onClick={() => hasActiveQuote && setActiveTab("comparador")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              !hasActiveQuote 
                ? "text-gray-600 cursor-not-allowed opacity-50"
                : activeTab === "comparador"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
            title={!hasActiveQuote ? "Abrí o creá una cotización para ver la matriz" : ""}
          >
            <Scale className="w-4 h-4" />
            Matriz Comparativa
            {hasActiveQuote && providers.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">
                {providers.length}
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
          
          {hasActiveQuote && (
            <button
              onClick={handleSaveQuotation}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-sm font-bold transition-all animate-fadeIn"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          )}

          {/* Database indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[11px] text-gray-400">
            <span className={`w-2 h-2 rounded-full ${dbActive ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            {dbActive ? "Sincronizado Nube" : "Almacenamiento Local"}
          </div>
        </div>
      </div>

      {/* Quote Meta Information */}
      {hasActiveQuote && (
        <div className="glass-card rounded-3xl p-6 mb-8 border border-white/5 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nombre del Presupuesto / Proyecto</label>
              <input
                type="text"
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
                placeholder="Ej. Insumos Planta Munro Q3"
                disabled={isLocked}
                className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="col-span-1 lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    disabled={isLocked}
                    className="w-full bg-[#111827]/60 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Base Comparison Currency Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Moneda Base</label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value as "ARS" | "USD")}
                  disabled={isLocked}
                  className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="ARS">Pesos Argentinos ($)</option>
                  <option value="USD">Dólares (USD)</option>
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
                  disabled={isLocked}
                  className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={isLocked}
              className="w-full bg-[#111827]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-y min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Estado de la Cotización y Proveedor Ganador */}
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Estado de la Cotización:
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as "borrador" | "enviada" | "finalizada" | "cancelada";
                  setStatus(newStatus);
                  if (newStatus !== "finalizada") {
                    setWinningProviderId("");
                  } else if (providers.length > 0 && !winningProviderId) {
                    setWinningProviderId(providers[0].id);
                  }
                  if (newStatus === "enviada" && !sentAt) {
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    setSentAt(`${yyyy}-${mm}-${dd}`);
                  }
                }}
                className="bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="borrador">Borrador (Abierta)</option>
                <option value="enviada">Enviada (Cerrada para edición)</option>
                <option value="finalizada">Finalizada (Cerrada y adjudicada)</option>
                <option value="cancelada">Cancelada (Cerrada)</option>
              </select>
            </div>

            {status === "finalizada" && (
              <div className="flex items-center gap-3 animate-fadeIn w-full sm:w-auto">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Proveedor Ganador:
                </label>
                <select
                  value={winningProviderId}
                  onChange={(e) => setWinningProviderId(e.target.value)}
                  className="w-full sm:w-auto bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Seleccionar Ganador...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {status === "enviada" && (
              <div className="flex items-center gap-3 animate-fadeIn w-full sm:w-auto">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Fecha de Envío:
                </label>
                <input
                  type="date"
                  value={sentAt}
                  onChange={(e) => setSentAt(e.target.value)}
                  className="w-full sm:w-auto bg-[#111827]/60 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      )}

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
                disabled={isLocked}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir Ítem
              </button>
            </div>

            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
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
                          disabled={isLocked}
                          className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-4 w-60">
                        <select
                          value={item.baseUnit}
                          onChange={(e) => handleUpdateItem(item.id, "baseUnit", e.target.value)}
                          disabled={isLocked}
                          className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            disabled={isLocked}
                            className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            {item.baseUnit}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isLocked || items.length === 1}
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

            {/* Mobile View Cards */}
            <div className="block md:hidden space-y-4">
              {items.map((item) => (
                <div key={item.id} className="p-4 bg-[#111827]/40 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Configuración de Ítem</span>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isLocked || items.length === 1}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Eliminar ítem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-semibold uppercase">Nombre del Insumo</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                      placeholder="Ej. Resma A4, Café en Grano..."
                      disabled={isLocked}
                      className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-semibold uppercase">U. Medida</label>
                      <select
                        value={item.baseUnit}
                        onChange={(e) => handleUpdateItem(item.id, "baseUnit", e.target.value)}
                        disabled={isLocked}
                        className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                      >
                        {DEFAULT_UNITS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 font-semibold uppercase">Cantidad</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={item.targetQuantity || ""}
                          onChange={(e) => handleUpdateItem(item.id, "targetQuantity", e.target.value)}
                          placeholder="Cantidad"
                          disabled={isLocked}
                          className="w-full bg-[#111827]/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono disabled:opacity-50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-500">
                          {item.baseUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                disabled={isLocked}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                        disabled={isLocked}
                        className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-emerald-500 focus:outline-none font-bold text-white text-base py-1 px-2 rounded -ml-2 transition-all w-2/3 disabled:opacity-50"
                        placeholder="Nombre del Proveedor"
                      />
                      
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        disabled={isLocked}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
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
                                  disabled={isLocked}
                                  className={`px-2.5 py-1 rounded font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    quote.presentationType === "base"
                                      ? "bg-emerald-500 text-white font-bold"
                                      : "text-gray-400 hover:text-gray-200"
                                  }`}
                                >
                                  Por {item.baseUnit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuote(provider.id, item.id, "presentationType", "package")}
                                  disabled={isLocked}
                                  className={`px-2.5 py-1 rounded font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    quote.presentationType === "package"
                                      ? "bg-emerald-500 text-white font-bold"
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
                                    disabled={isLocked}
                                    className="w-full bg-[#111827]/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-400 font-semibold uppercase">Cantidad del Lote ({item.baseUnit})</label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={quote.unitsPerPresentation || ""}
                                    onChange={(e) => handleUpdateQuote(provider.id, item.id, "unitsPerPresentation", e.target.value)}
                                    placeholder="Ej. 12"
                                    disabled={isLocked}
                                    className="w-full bg-[#111827]/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50"
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
                                    {quote.currency === "ARS" ? "$" : "USD"}
                                  </span>
                                  <input
                                    type="number"
                                    value={quote.price || ""}
                                    onChange={(e) => handleUpdateQuote(provider.id, item.id, "price", e.target.value)}
                                    placeholder="0.00"
                                    disabled={isLocked}
                                    className="w-full bg-[#111827]/60 border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>
                              </div>

                              {/* Currency */}
                              <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-semibold uppercase">Moneda</label>
                                <select
                                  value={quote.currency}
                                  onChange={(e) => handleUpdateQuote(provider.id, item.id, "currency", e.target.value)}
                                  disabled={isLocked}
                                  className="w-full bg-[#111827]/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 h-[30px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    disabled={isLocked}
                                    className="w-full bg-[#111827]/60 border border-white/10 rounded-lg pl-2.5 pr-6 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] font-semibold">%</span>
                                </div>
                              </div>
                            </div>

                            {/* Specification / Model Field */}
                            <div className="mt-3 space-y-1">
                              <label className="text-[10px] text-gray-400 font-semibold uppercase block">
                                Especificación / Modelo / Marca (Opcional)
                              </label>
                              <input
                                type="text"
                                value={quote.specification || ""}
                                onChange={(e) => handleUpdateQuote(provider.id, item.id, "specification", e.target.value)}
                                placeholder="ej. Marca Philips, 12V, Color Calido, etc."
                                disabled={isLocked}
                                className="w-full bg-[#111827]/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
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
                      <div className="text-right space-y-0.5">
                        {(() => {
                          const totalData = providerTotals.find(t => t.providerId === provider.id);
                          if (!totalData) return <span className="text-base font-black font-mono text-white">$0</span>;

                          const hasARS = totalData.totalARS > 0;
                          const hasUSD = totalData.totalUSD > 0;

                          return (
                            <>
                              {(hasARS || (!hasARS && !hasUSD && baseCurrency === "ARS")) && (
                                <p className="text-base font-black font-mono text-white">
                                  {formatCurrencyValue(totalData.totalARS, "ARS")}
                                </p>
                              )}
                              {(hasUSD || (!hasARS && !hasUSD && baseCurrency === "USD")) && (
                                <p className="text-base font-black font-mono text-emerald-400">
                                  {formatCurrencyValue(totalData.totalUSD, "USD")}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <p className="text-[10px] text-right text-gray-500 mt-1">
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
          {/* Side-by-Side Detailed Matrix Table */}
          <div className="glass-card rounded-3xl p-6 border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Cuadro Comparativo de Precios</h3>
                  <p className="text-xs text-gray-400">Diseño simple tipo planilla Excel para análisis detallado</p>
                </div>
              </div>

              {/* Matrix Actions */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap sm:gap-3">
                  <button
                    onClick={handleExportImage}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#101725] hover:bg-[#101725]/80 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Exportar Imagen
                  </button>
                  <button
                    onClick={handleCopyExcelFormat}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#101725] hover:bg-[#101725]/80 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Copiar Excel
                  </button>
                  <button
                    onClick={() => setConvertCurrencies(!convertCurrencies)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                      convertCurrencies
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    Divisas: {convertCurrencies ? "Conversión" : "Original"}
                  </button>
                  <button
                    onClick={() => setUseRealLots(!useRealLots)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                      useRealLots
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    Lotes: {useRealLots ? "Enteros" : "Fracción"}
                  </button>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-gray-400 font-medium py-1 sm:py-0">
                  <span>TC: 1 USD = ${exchangeRate} ARS</span>
                  {convertCurrencies && (
                    <>
                      <span>•</span>
                      <span className="uppercase">{baseCurrency}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

             <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300 border-collapse">
                <thead className="bg-[#101725] text-gray-400 text-xs font-semibold uppercase border-b border-white/10">
                  <tr>
                    <th className="p-4 rounded-tl-xl text-left min-w-[200px] left-0 sticky bg-[#101725] z-20 border-r border-white/10" rowSpan={2}>Nombre del Ítem</th>
                    <th className="p-4 text-center min-w-[100px]" rowSpan={2}>Cantidad</th>
                    {providers.map(prov => (
                      <th key={prov.id} className="p-3 text-center border-l border-white/10" colSpan={2}>
                        {prov.name}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-[#101725]/60 text-[10px] text-gray-400 font-bold border-b border-white/5">
                    {providers.map(prov => (
                      <Fragment key={prov.id}>
                        <th className="p-2.5 text-center border-l border-white/10 font-bold">Unitario</th>
                        <th className="p-2.5 text-center border-l border-white/5 font-bold">Total</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => (
                    <tr key={item.id} className="group hover:bg-white/[0.01] transition-colors align-middle border-b border-white/5">
                      {/* Item column (truncated if very long, hover title) */}
                      <td className="p-4 max-w-[250px] truncate left-0 sticky bg-[#0c121e] group-hover:bg-[#141b2a] transition-colors z-10 border-r border-white/10" title={item.name}>
                        <span className="font-bold text-white text-sm">{item.name || "Ítem sin nombre"}</span>
                      </td>
                      {/* Quantity column */}
                      <td className="p-4 text-center font-mono text-xs text-gray-300 whitespace-nowrap">
                        {item.targetQuantity} {item.baseUnit}
                      </td>

                      {/* Providers values for this item */}
                      {providers.map(prov => {
                        const quote = prov.quotes[item.id];
                        const hasQuote = quote && quote.price > 0;
                        
                        if (!hasQuote) {
                          return (
                            <Fragment key={prov.id}>
                              <td className="p-4 text-center text-gray-500 font-mono border-l border-white/10">-</td>
                              <td className="p-4 text-center text-gray-500 font-mono border-l border-white/5 bg-black/5">-</td>
                            </Fragment>
                          );
                        }

                        // Calculations
                        const { trueUnitRateRaw, trueUnitRateBaseCurrency } = getCalculatedPrices(quote, exchangeRate, baseCurrency);
                        const { totalBaseCurrency, totalRawCurrency, presentationsCount } = calculateTotalCost(quote, item.targetQuantity, exchangeRate, baseCurrency, useRealLots);

                        const displayUnitCost = convertCurrencies ? trueUnitRateBaseCurrency : trueUnitRateRaw;
                        const displayUnitCurrency = convertCurrencies ? baseCurrency : quote.currency;

                        const displayTotalCost = convertCurrencies ? totalBaseCurrency : totalRawCurrency;
                        const displayTotalCurrency = convertCurrencies ? baseCurrency : quote.currency;

                        return (
                          <Fragment key={prov.id}>
                            {/* Price Unit */}
                            <td className="p-4 border-l border-white/10 text-center align-middle font-mono text-xs text-gray-200">
                              <div className="space-y-0.5">
                                <span>{formatCurrencyValue(displayUnitCost, displayUnitCurrency)}</span>
                                {convertCurrencies && quote.currency !== baseCurrency && (
                                  <span className="text-[9px] text-gray-400 block">
                                    ({quote.currency === "ARS" ? "$" : "USD"}
                                    {trueUnitRateRaw.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Price Total */}
                            <td className="p-4 border-l border-white/5 text-center align-middle font-mono text-xs text-gray-200 bg-white/[0.01]">
                              <div className="space-y-0.5">
                                <span className="font-bold text-white">{formatCurrencyValue(displayTotalCost, displayTotalCurrency)}</span>
                                {quote.presentationType === "package" && (
                                  <span className="text-[9px] text-gray-400 block font-normal leading-tight">
                                    {quote.presentationName || `Lote x${quote.unitsPerPresentation}`} (x{presentationsCount.toFixed(useRealLots ? 0 : 1)})
                                  </span>
                                )}
                                {quote.discount > 0 && (
                                  <span className="text-red-400 text-[9px] font-bold block">
                                    -{quote.discount}%
                                  </span>
                                )}
                                {quote.specification && (
                                  <span className="text-[9px] text-gray-400 block font-semibold italic bg-white/5 px-1.5 py-0.5 rounded mt-1 border border-white/5 max-w-[130px] mx-auto truncate" title={quote.specification}>
                                    {quote.specification}
                                  </span>
                                )}
                              </div>
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}

                  {/* SUMMARY TOTAL ROW */}
                  <tr className="bg-[#101725]/60 font-bold border-t-2 border-white/10">
                    <td className="p-4 rounded-bl-xl text-left font-black text-white text-xs uppercase tracking-wider left-0 sticky bg-[#101725] z-10 border-r border-white/10">
                      TOTAL GENERAL
                    </td>
                    <td className="p-4 text-center text-[10px] text-gray-400 font-normal">
                      -
                    </td>

                    {providers.map(prov => {
                      const totalData = providerTotals.find(t => t.providerId === prov.id);
                      if (!totalData) return null;

                      const hasARS = totalData.totalARS > 0;
                      const hasUSD = totalData.totalUSD > 0;

                      return (
                        <Fragment key={prov.id}>
                          {/* Unit price total (empty column) */}
                          <td className="p-4 text-center border-l border-white/10 text-gray-500 font-normal">-</td>
                          {/* Total price sum */}
                          <td className="p-4 text-center border-l border-white/5 bg-[#101725]/80 text-white font-mono text-xs font-semibold">
                            <div className="space-y-1">
                              {(hasARS || (!hasARS && !hasUSD && baseCurrency === "ARS")) && (
                                <p className="font-bold text-white whitespace-nowrap">
                                  {formatCurrencyValue(totalData.totalARS, "ARS")}
                                </p>
                              )}
                              {(hasUSD || (!hasARS && !hasUSD && baseCurrency === "USD")) && (
                                <p className="font-bold text-emerald-400 whitespace-nowrap">
                                  {formatCurrencyValue(totalData.totalUSD, "USD")}
                                </p>
                              )}

                            </div>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Card de Crear Nueva Cotización */}
              <div
                onClick={handleNewQuotation}
                className="p-5 rounded-2xl border border-dashed border-white/10 hover:border-emerald-500/40 bg-[#111827]/10 hover:bg-emerald-950/5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group min-h-[160px]"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors text-sm">
                    Nueva Cotización
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Crea un presupuesto comparativo en blanco
                  </p>
                </div>
              </div>

              {savedQuotations.length > 0 && savedQuotations.map((quote) => {
                const date = (quote.createdAt && typeof quote.createdAt === "object" && "seconds" in quote.createdAt)
                  ? new Date((quote.createdAt as { seconds: number }).seconds * 1000).toLocaleString("es-AR")
                  : (quote.createdAt && typeof quote.createdAt === "string"
                      ? new Date(quote.createdAt).toLocaleString("es-AR")
                      : "Fecha desconocida");

                const isCurrent = currentQuoteId === quote.id;

                const winningProvider = quote.providers?.find(p => p.id === quote.winningProviderId);

                return (
                  <div
                    key={quote.id}
                    onClick={() => handleSelectQuote(quote)}
                    className={`p-5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-4 group ${
                      isCurrent 
                        ? "bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/60" 
                        : quote.status === "finalizada" || quote.isFinalized
                          ? "bg-blue-950/20 border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-950/30"
                          : quote.status === "enviada"
                            ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-950/30"
                            : quote.status === "cancelada"
                              ? "bg-red-950/20 border-red-500/30 hover:border-red-500/50 hover:bg-red-950/30"
                              : "bg-[#111827]/40 border-white/5 hover:border-white/15 hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors truncate pr-4">
                          {quote.name}
                        </h4>
                        <div className="flex flex-col gap-1 items-end shrink-0 select-none">
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20 whitespace-nowrap">
                              Cargada
                            </span>
                          )}
                          {quote.status === "enviada" && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-extrabold uppercase border border-amber-500/20 whitespace-nowrap">
                              Enviada
                            </span>
                          )}
                          {(quote.status === "finalizada" || quote.isFinalized) && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-extrabold uppercase border border-blue-500/20 whitespace-nowrap">
                              Finalizada
                            </span>
                          )}
                          {quote.status === "cancelada" && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-extrabold uppercase border border-red-500/20 whitespace-nowrap">
                              Cancelada
                            </span>
                          )}
                        </div>
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

                      {(quote.status === "finalizada" || quote.isFinalized) && (
                        <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-xs text-blue-400">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="truncate">
                            Ganador: <strong className="text-white">{winningProvider ? winningProvider.name : "No seleccionado"}</strong>
                          </span>
                        </div>
                      )}

                      {quote.status === "enviada" && quote.sentAt && (
                        <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-xs text-amber-400">
                          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="truncate">
                            Enviada el: <strong className="text-white">{quote.sentAt.includes("-") ? quote.sentAt.split("-").reverse().join("/") : quote.sentAt}</strong>
                          </span>
                        </div>
                      )}
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
