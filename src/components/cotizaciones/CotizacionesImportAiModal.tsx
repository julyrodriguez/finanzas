"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Sparkles,
  Upload,
  FileText,
  Mail,
  Check,
  AlertCircle,
  Loader2,
  Building2,
  DollarSign,
  Package,
  Plus,
  ArrowRight,
  Info,
  FileSpreadsheet,
  Layers,
  ListOrdered,
  Paperclip,
  Clock,
  CreditCard,
  Calendar,
  CheckCircle2,
  Files,
  MessageSquare,
  Send,
  Boxes,
  Split,
  Undo2,
  RotateCcw,
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Zap,
  Cpu
} from "lucide-react";
import { QuoteAttachment } from "./CotizacionesAiChatModal";

export type ExtractionMode = "general" | "detailed";
export type ProcessingMethod = "heavy" | "light";

export interface ExtractedItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  totalPrice?: number;
  discount: number;
  specification: string;
  presentationName: string;
  unitsPerPresentation: number;
  matchedItemId: string | null;
  selected: boolean;
  isGrouped?: boolean;
  groupedChildren?: ExtractedItem[];
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  itemsSnapshotCount?: number;
}

export interface ExistingQuoteItem {
  id: string;
  name: string;
  baseUnit: string;
  targetQuantity: number;
}

export interface ImportPayload {
  providerName: string;
  currency: "ARS" | "USD";
  notes?: string;
  deliveryTime?: string;
  paymentTerms?: string;
  validityPeriod?: string;
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
}

export interface BatchFileItem {
  id: string;
  file: File;
  status: "pending" | "analyzing" | "done" | "error";
  error?: string;
  payload?: ImportPayload;
}

function parseCommercialConditions(notesText: string, extractedObj: any): { deliveryTime: string; paymentTerms: string; validityPeriod: string } {
  let deliveryTime = extractedObj?.deliveryTime || extractedObj?.plazoEntrega || extractedObj?.plazo || "";
  let paymentTerms = extractedObj?.paymentTerms || extractedObj?.formaPago || extractedObj?.condicionPago || extractedObj?.condiciones || "";
  let validityPeriod = extractedObj?.validityPeriod || extractedObj?.validez || extractedObj?.vigencia || "";

  if (!deliveryTime && notesText) {
    const match = notesText.match(/(?:plazo(?:\s+de\s+entrega)?|tiempo(?:\s+de\s+entrega)?|entrega|demora)\s*[:=-]?\s*([0-9a-zA-Z\s]{2,40})(?:[.,\n;]|$)/i);
    if (match) deliveryTime = match[1].trim();
  }
  if (!paymentTerms && notesText) {
    const match = notesText.match(/(?:forma(?:\s+de\s+pago)?|condici[oó]n(?:\s+de\s+pago)?|plazo(?:\s+de\s+pago)?|pago)\s*[:=-]?\s*([0-9a-zA-Z\s]{2,40})(?:[.,\n;]|$)/i);
    if (match) paymentTerms = match[1].trim();
  }
  if (!validityPeriod && notesText) {
    const match = notesText.match(/(?:validez(?:\s+de\s+oferta)?|vigencia(?:\s+de\s+oferta)?)\s*[:=-]?\s*([0-9a-zA-Z\s]{2,40})(?:[.,\n;]|$)/i);
    if (match) validityPeriod = match[1].trim();
  }

  return { deliveryTime, paymentTerms, validityPeriod };
}

export async function extractSingleFileToPayload(
  file: File,
  mode: ExtractionMode,
  method: ProcessingMethod = "heavy",
  cotizacionId?: string,
  targetProviderId?: string,
  targetProviderName?: string,
  existingItems: ExistingQuoteItem[] = []
): Promise<ImportPayload> {
  const targetQuoteId = cotizacionId || "temp_" + Date.now();
  const baseUrl = process.env.NEXT_PUBLIC_COTIZACIONES_EXTRACT || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/extract-items";

  const formData = new FormData();
  formData.append("cotizacionId", targetQuoteId);
  formData.append("extractionMode", mode);
  formData.append("processingMethod", method);
  if (targetProviderId) formData.append("providerId", targetProviderId);
  if (targetProviderName) formData.append("providerName", targetProviderName);
  if (existingItems.length > 0) formData.append("existingItems", JSON.stringify(existingItems));
  formData.append("file", file);

  const res = await fetch(`${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}&extractionMode=${mode}&processingMethod=${method}`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor: ${res.status}`);
  }

  const resData = await res.json();
  if (!resData.success || !resData.data) {
    throw new Error(resData.error || "No se pudo extraer la información del presupuesto");
  }

  const extracted = resData.data || {};
  const finalAttachment: QuoteAttachment = resData.attachment || {
    id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    originalName: file.name,
    filename: file.name,
    url: "",
    size: file.size,
    mimeType: file.type || "application/octet-stream"
  };

  const defaultProvider = file.name ? file.name.replace(/\.[^/.]+$/, "") : "Proveedor";
  const isGenericProviderName = !targetProviderName || /^proveedor(\s*\d+)?$/i.test(targetProviderName.trim());
  const finalProviderName = (!isGenericProviderName ? targetProviderName : extracted.providerName) || extracted.providerName || targetProviderName || defaultProvider;
  const finalCurrency: "ARS" | "USD" = extracted.currency === "USD" ? "USD" : "ARS";
  const finalNotes = extracted.notes || "";

  const conditions = parseCommercialConditions(finalNotes, extracted);

  let rawItems: any[] = [];
  if (Array.isArray(extracted.items)) {
    rawItems = extracted.items;
  } else if (extracted.items && typeof extracted.items === "object") {
    rawItems = Object.values(extracted.items);
  } else if (Array.isArray(extracted)) {
    rawItems = extracted;
  }

  const usedMatchedIds = new Set<string>();
  const selectedItems = rawItems.map((it: any, index: number) => {
    const itemObj = (it && typeof it === "object") ? it : { name: String(it) };
    const parsedPrice = typeof itemObj.price === "number"
      ? itemObj.price
      : parseFloat(String(itemObj.price || "").replace(/[^0-9.-]/g, "")) || 0;
    const parsedQty = mode === "general"
      ? 1
      : (typeof itemObj.quantity === "number" ? itemObj.quantity : parseFloat(String(itemObj.quantity || "")) || 1);
    const parsedDiscount = typeof itemObj.discount === "number"
      ? itemObj.discount
      : parseFloat(String(itemObj.discount || "")) || 0;
    const parsedUnits = typeof itemObj.unitsPerPresentation === "number"
      ? itemObj.unitsPerPresentation
      : parseFloat(String(itemObj.unitsPerPresentation || "")) || 1;

    let initialMatchedId = itemObj.matchedItemId || null;
    if (initialMatchedId) {
      if (usedMatchedIds.has(initialMatchedId)) {
        initialMatchedId = null;
      } else {
        usedMatchedIds.add(initialMatchedId);
      }
    }

    return {
      name: itemObj.name || `Ítem ${index + 1}`,
      unit: itemObj.unit || "U",
      quantity: parsedQty,
      price: parsedPrice,
      discount: parsedDiscount,
      specification: itemObj.specification || "",
      presentationName: itemObj.presentationName || "",
      unitsPerPresentation: parsedUnits,
      matchedItemId: initialMatchedId
    };
  });

  return {
    providerName: finalProviderName,
    currency: finalCurrency,
    notes: finalNotes,
    deliveryTime: conditions.deliveryTime,
    paymentTerms: conditions.paymentTerms,
    validityPeriod: conditions.validityPeriod,
    attachment: finalAttachment,
    targetProviderId,
    selectedItems
  };
}

interface CotizacionesImportAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotizacionId?: string;
  existingItems: ExistingQuoteItem[];
  targetProviderId?: string;
  targetProviderName?: string;
  onConfirmImport: (payload: ImportPayload) => Promise<void> | void;
  onConfirmBatchImport?: (payloads: ImportPayload[]) => Promise<void> | void;
}

export function CotizacionesImportAiModal({
  isOpen,
  onClose,
  cotizacionId,
  existingItems,
  targetProviderId,
  targetProviderName,
  onConfirmImport,
  onConfirmBatchImport
}: CotizacionesImportAiModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("general");
  const [processingMethod, setProcessingMethod] = useState<ProcessingMethod>("heavy");
  const [cachedResults, setCachedResults] = useState<Record<string, {
    items: ExtractedItem[];
    providerName: string;
    currency: "ARS" | "USD";
    notes: string;
    deliveryTime?: string;
    paymentTerms?: string;
    validityPeriod?: string;
    attachment?: QuoteAttachment;
  }>>({});
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted data state
  const [attachment, setAttachment] = useState<QuoteAttachment | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [notes, setNotes] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("");
  const [validityPeriod, setValidityPeriod] = useState<string>("");
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Batch mode state
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [batchQueue, setBatchQueue] = useState<BatchFileItem[]>([]);

  // Chat & AI prompt refinement state
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isRefiningAi, setIsRefiningAi] = useState<boolean>(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [itemsHistory, setItemsHistory] = useState<Array<{ items: ExtractedItem[]; label: string; timestamp: string }>>([]);
  const [initialItems, setInitialItems] = useState<ExtractedItem[]>([]);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Manual Item Grouping state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [groupSelectedIds, setGroupSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState<string>("");
  const [groupQuantity, setGroupQuantity] = useState<number>(1);
  const [groupUnit, setGroupUnit] = useState<string>("GL");
  const [groupPrice, setGroupPrice] = useState<number>(0);
  const [groupSpecification, setGroupSpecification] = useState<string>("");
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat al recibir nuevos mensajes
  useEffect(() => {
    if (isAiChatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isAiChatOpen]);

  const handleReset = () => {
    setFile(null);
    setIsAnalyzing(false);
    setError(null);
    setAttachment(null);
    setProviderName("");
    setCurrency("ARS");
    setNotes("");
    setDeliveryTime("");
    setPaymentTerms("");
    setValidityPeriod("");
    setItems([]);
    setIsSubmitting(false);
    setCachedResults({});
    setIsBatchMode(false);
    setBatchQueue([]);
    setIsAiChatOpen(false);
    setChatMessages([]);
    setChatInput("");
    setIsRefiningAi(false);
    setRefineError(null);
    setItemsHistory([]);
    setInitialItems([]);
    setIsGroupModalOpen(false);
    setGroupSelectedIds(new Set());
    setExpandedGroupIds(new Set());
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const fileArray = Array.from(fileList);
    if (fileArray.length === 0) return;

    if (fileArray.length === 1) {
      setIsBatchMode(false);
      await processFileWithMode(fileArray[0], extractionMode, undefined, processingMethod);
    } else {
      setIsBatchMode(true);
      setError(null);
      const queue: BatchFileItem[] = fileArray.map((f, i) => ({
        id: `batch-${Date.now()}-${i}`,
        file: f,
        status: "pending"
      }));
      setBatchQueue(queue);
      processBatchQueue(queue, extractionMode, processingMethod);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFilesSelected(e.target.files);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const processBatchQueue = async (
    queue: BatchFileItem[],
    mode: ExtractionMode,
    method: ProcessingMethod = processingMethod
  ) => {
    setIsAnalyzing(true);
    let updatedQueue = [...queue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const current = updatedQueue[i];
      updatedQueue = updatedQueue.map((item, idx) =>
        idx === i ? { ...item, status: "analyzing" } : item
      );
      setBatchQueue(updatedQueue);

      try {
        const payload = await extractSingleFileToPayload(
          current.file,
          mode,
          method,
          cotizacionId,
          undefined,
          undefined,
          existingItems
        );

        updatedQueue = updatedQueue.map((item, idx) =>
          idx === i ? { ...item, status: "done", payload } : item
        );
        setBatchQueue(updatedQueue);
      } catch (err: any) {
        console.error(`Error procesando archivo ${current.file.name}:`, err);
        updatedQueue = updatedQueue.map((item, idx) =>
          idx === i
            ? { ...item, status: "error", error: err.message || "Error al procesar con IA" }
            : item
        );
        setBatchQueue(updatedQueue);
      }
    }

    setIsAnalyzing(false);
  };

  const handleConfirmBatch = async () => {
    const readyItems = batchQueue.filter((item) => item.status === "done" && item.payload);
    if (readyItems.length === 0) {
      setError("No hay presupuestos analizados listos para importar");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads = readyItems.map((item) => item.payload!);
      if (onConfirmBatchImport) {
        const promise = onConfirmBatchImport(payloads);
        handleClose();
        Promise.resolve(promise).catch((err) => {
          console.warn("Aviso al guardar importación masiva:", err);
        });
      } else {
        for (const p of payloads) {
          await onConfirmImport(p);
        }
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || "Error al importar el lote de presupuestos");
    } finally {
      setIsSubmitting(false);
    }
  };

  const processFileWithMode = async (
    targetFile: File | null,
    mode: ExtractionMode,
    currentAttachment?: QuoteAttachment | null,
    targetMethod?: ProcessingMethod
  ) => {
    const activeMethod = targetMethod || processingMethod;
    const cacheKey = `${mode}_${activeMethod}`;

    // 1. Si ya tenemos cacheado el resultado de este modo y método, cambiamos al instante sin request de red
    if (cachedResults[cacheKey]) {
      const cached = cachedResults[cacheKey]!;
      setItems(cached.items);
      setInitialItems(cached.items);
      setItemsHistory([{ items: cached.items, label: `Modo ${mode === "general" ? "General" : "Detallado"} (${activeMethod === "light" ? "Ligero" : "Pesado"})`, timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }]);
      setProviderName(targetProviderName || cached.providerName);
      setCurrency(cached.currency);
      setNotes(cached.notes);
      setDeliveryTime(cached.deliveryTime || "");
      setPaymentTerms(cached.paymentTerms || "");
      setValidityPeriod(cached.validityPeriod || "");
      if (cached.attachment) setAttachment(cached.attachment);
      setExtractionMode(mode);
      setProcessingMethod(activeMethod);
      return;
    }

    if (targetFile) setFile(targetFile);
    setExtractionMode(mode);
    setProcessingMethod(activeMethod);
    setIsAnalyzing(true);
    setError(null);

    try {
      const targetQuoteId = cotizacionId || "temp_" + Date.now();
      const baseUrl = process.env.NEXT_PUBLIC_COTIZACIONES_EXTRACT || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/extract-items";

      let res: Response;
      if (targetFile) {
        const formData = new FormData();
        formData.append("cotizacionId", targetQuoteId);
        formData.append("extractionMode", mode);
        formData.append("processingMethod", activeMethod);
        if (targetProviderId) formData.append("providerId", targetProviderId);
        if (targetProviderName) formData.append("providerName", targetProviderName);
        if (existingItems.length > 0) formData.append("existingItems", JSON.stringify(existingItems));
        formData.append("file", targetFile);

        res = await fetch(`${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}&extractionMode=${mode}&processingMethod=${activeMethod}`, {
          method: "POST",
          body: formData
        });
      } else if (currentAttachment || attachment) {
        const att = currentAttachment || attachment!;
        res = await fetch(`${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}&extractionMode=${mode}&processingMethod=${activeMethod}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cotizacionId: targetQuoteId,
            extractionMode: mode,
            processingMethod: activeMethod,
            attachment: att,
            providerId: targetProviderId,
            providerName: targetProviderName,
            existingItems
          })
        });
      } else {
        setIsAnalyzing(false);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor: ${res.status}`);
      }

      const resData = await res.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || "No se pudo extraer la información del presupuesto");
      }

      const extracted = resData.data || {};
      const finalAttachment = resData.attachment || currentAttachment || attachment;
      if (finalAttachment) setAttachment(finalAttachment);

      const defaultProvider = targetFile?.name ? targetFile.name.replace(/\.[^/.]+$/, "") : "Proveedor";
      const isGenericProviderName = !targetProviderName || /^proveedor(\s*\d+)?$/i.test(targetProviderName.trim());
      const finalProviderName = (!isGenericProviderName ? targetProviderName : extracted.providerName) || extracted.providerName || targetProviderName || defaultProvider;
      const finalCurrency: "ARS" | "USD" = extracted.currency === "USD" ? "USD" : "ARS";
      const finalNotes = extracted.notes || "";

      const conditions = parseCommercialConditions(finalNotes, extracted);

      setProviderName(finalProviderName);
      setCurrency(finalCurrency);
      setNotes(finalNotes);
      setDeliveryTime(conditions.deliveryTime);
      setPaymentTerms(conditions.paymentTerms);
      setValidityPeriod(conditions.validityPeriod);

      // Extracción robusta de items (array o diccionario)
      let rawItems: any[] = [];
      if (Array.isArray(extracted.items)) {
        rawItems = extracted.items;
      } else if (extracted.items && typeof extracted.items === "object") {
        rawItems = Object.values(extracted.items);
      } else if (Array.isArray(extracted)) {
        rawItems = extracted;
      }

      const usedMatchedIds = new Set<string>();
      const formattedItems: ExtractedItem[] = rawItems.map((it: any, index: number) => {
        const itemObj = (it && typeof it === "object") ? it : { name: String(it) };
        const parsedPrice = typeof itemObj.price === "number"
          ? itemObj.price
          : parseFloat(String(itemObj.price || "").replace(/[^0-9.-]/g, "")) || 0;
        const parsedQty = mode === "general"
          ? 1
          : (typeof itemObj.quantity === "number" ? itemObj.quantity : parseFloat(String(itemObj.quantity || "")) || 1);
        const parsedTotal = typeof itemObj.totalPrice === "number"
          ? itemObj.totalPrice
          : (mode === "general" ? parsedPrice : (parsedPrice * parsedQty));
        const parsedDiscount = typeof itemObj.discount === "number"
          ? itemObj.discount
          : parseFloat(String(itemObj.discount || "")) || 0;
        const parsedUnits = typeof itemObj.unitsPerPresentation === "number"
          ? itemObj.unitsPerPresentation
          : parseFloat(String(itemObj.unitsPerPresentation || "")) || 1;

        let initialMatchedId = itemObj.matchedItemId || null;
        if (initialMatchedId) {
          // Si este ítem ya fue asignado a una línea previa de la extracción, no duplicarlo automáticamente
          if (usedMatchedIds.has(initialMatchedId)) {
            initialMatchedId = null;
          } else {
            usedMatchedIds.add(initialMatchedId);
          }
        }

        return {
          id: itemObj.id || `ext-${Date.now()}-${index}`,
          name: itemObj.name || `Ítem ${index + 1}`,
          quantity: parsedQty,
          unit: itemObj.unit || "U",
          price: parsedPrice,
          totalPrice: parsedTotal,
          discount: parsedDiscount,
          specification: itemObj.specification || "",
          presentationName: itemObj.presentationName || "",
          unitsPerPresentation: parsedUnits,
          matchedItemId: initialMatchedId,
          selected: true
        };
      });

      setItems(formattedItems);
      setInitialItems(formattedItems);
      setItemsHistory([{ items: formattedItems, label: `Modo ${mode === "general" ? "General" : "Detallado"}`, timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }]);

      // Guardar en caché para permitir alternar modos y métodos instantáneamente
      setCachedResults((prev) => ({
        ...prev,
        [cacheKey]: {
          items: formattedItems,
          providerName: finalProviderName,
          currency: finalCurrency,
          notes: finalNotes,
          deliveryTime: conditions.deliveryTime,
          paymentTerms: conditions.paymentTerms,
          validityPeriod: conditions.validityPeriod,
          attachment: finalAttachment
        }
      }));
    } catch (err: any) {
      console.error("Error analizando documento:", err);
      const msg = err.message || "";
      if (msg.includes("503") || msg.includes("high demand") || msg.includes("Service Unavailable")) {
        setError("Los servidores de Google Gemini están experimentando alta demanda temporal (Error 503). Por favor reintentá en unos segundos.");
      } else if (msg.includes("524") || msg.includes("timeout") || msg.includes("Timeout")) {
        setError("El procesamiento tardó más de lo habitual debido a la saturación de los servidores de IA. Por favor reintentá en unos instantes.");
      } else {
        setError(msg || "Error al leer el documento con IA");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleItemSelect = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  };

  const handleDeselectAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every((it) => it.selected);
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const handleResetAllToNewItems = () => {
    setItems((prev) => prev.map((item) => ({ ...item, matchedItemId: null })));
  };

  const duplicateMatchedCounts: Record<string, number> = {};
  items.forEach((it) => {
    if (it.selected && it.matchedItemId) {
      duplicateMatchedCounts[it.matchedItemId] = (duplicateMatchedCounts[it.matchedItemId] || 0) + 1;
    }
  });

  const hasDuplicateMatches = Object.values(duplicateMatchedCounts).some((c) => c > 1);

  const handleUpdateItemField = (index: number, field: keyof ExtractedItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "price" && extractionMode === "general") {
          updated.totalPrice = value;
          updated.quantity = 1;
        } else if (field === "price") {
          updated.totalPrice = (Number(value) || 0) * (Number(updated.quantity) || 1);
        } else if (field === "quantity" && extractionMode !== "general") {
          updated.totalPrice = (Number(updated.price) || 0) * (Number(value) || 1);
        }
        return updated;
      })
    );
  };

  const REFINEMENT_QUICK_PROMPTS = [
    { label: "📦 Agrupar por rubros", prompt: "Agrupá todos los ítems por sus rubros o capítulos generales principales, sumando los precios totales y dejando la especificación detallada con el texto completo de los ítems." },
    { label: "➕ Sumar ítem faltante", prompt: "Revisá el documento original y agregá los ítems cotizados que falten en la lista con sus precios reales." },
    { label: "🧮 Calcular con 21% IVA", prompt: "Sumale el 21% de IVA a todos los precios unitarios y totales de los ítems." },
    { label: "✂️ Separar Mano de Obra y Materiales", prompt: "Separá los ítems en renglones individuales para Mano de Obra y Materiales con sus respectivos precios." },
    { label: "🏷️ Aplicar 10% Descuento", prompt: "Aplicá un 10% de descuento a todos los precios de los ítems." }
  ];

  const handleOpenGroupModal = (selectedItemIds?: string[]) => {
    const idsToGroup = selectedItemIds || items.filter((it) => it.selected).map((it) => it.id);
    if (idsToGroup.length < 2) return;

    const selectedItemsToGroup = items.filter((it) => idsToGroup.includes(it.id));
    const newSet = new Set(idsToGroup);
    setGroupSelectedIds(newSet);

    const totalPriceSum = selectedItemsToGroup.reduce(
      (acc, it) => acc + (it.totalPrice || (it.price * it.quantity)),
      0
    );
    const autoSpec = "Incluye: " + selectedItemsToGroup.map(
      (it) => `${it.name} (${it.quantity} ${it.unit} a $${it.price.toLocaleString("es-AR")})`
    ).join("; ");
    
    // El nombre del grupo consolida el texto completo de todos los ítems agrupados unidos por ' + '
    const suggestedName = selectedItemsToGroup.map((it) => it.name.trim()).join(" + ");

    setGroupName(suggestedName);
    setGroupQuantity(1);
    setGroupUnit("GL");
    setGroupPrice(totalPriceSum);
    setGroupSpecification(autoSpec);
    setIsGroupModalOpen(true);
  };

  const handleToggleItemGroupSelection = (id: string) => {
    setGroupSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      const currentSelected = items.filter((it) => next.has(it.id));
      const newTotal = currentSelected.reduce(
        (acc, it) => acc + (it.totalPrice || (it.price * it.quantity)),
        0
      );
      setGroupPrice(newTotal);

      const newSpec = "Incluye: " + currentSelected.map(
        (it) => `${it.name} (${it.quantity} ${it.unit} a $${it.price.toLocaleString("es-AR")})`
      ).join("; ");
      setGroupSpecification(newSpec);

      const newSuggestedName = currentSelected.map((it) => it.name.trim()).join(" + ");
      setGroupName(newSuggestedName);

      return next;
    });
  };

  const handleConfirmGroup = () => {
    const itemsToGroup = items.filter((it) => groupSelectedIds.has(it.id));
    if (itemsToGroup.length < 2) return;

    const autoCombinedName = itemsToGroup.map((it) => it.name.trim()).join(" + ");
    const groupedItem: ExtractedItem = {
      id: `group-${Date.now()}`,
      name: groupName.trim() || autoCombinedName || "Ítem Agrupado",
      quantity: Number(groupQuantity) || 1,
      unit: groupUnit.trim() || "GL",
      price: Number(groupPrice) || 0,
      totalPrice: (Number(groupPrice) || 0) * (Number(groupQuantity) || 1),
      discount: 0,
      specification: groupSpecification.trim(),
      presentationName: "",
      unitsPerPresentation: 1,
      matchedItemId: null,
      selected: true,
      isGrouped: true,
      groupedChildren: itemsToGroup
    };

    const firstIndex = items.findIndex((it) => groupSelectedIds.has(it.id));
    const newItems = items.filter((it) => !groupSelectedIds.has(it.id));
    newItems.splice(firstIndex >= 0 ? firstIndex : newItems.length, 0, groupedItem);

    setItemsHistory((prev) => [...prev, { items: newItems, label: `Agrupación: "${groupedItem.name}"`, timestamp: new Date().toLocaleTimeString("es-AR") }]);
    setItems(newItems);
    setIsGroupModalOpen(false);
    setGroupSelectedIds(new Set());
  };

  const handleUngroupItem = (groupedItemId: string) => {
    const targetIndex = items.findIndex((it) => it.id === groupedItemId);
    if (targetIndex === -1) return;
    const target = items[targetIndex];
    if (!target.isGrouped || !target.groupedChildren || target.groupedChildren.length === 0) return;

    const newItems = [...items];
    newItems.splice(targetIndex, 1, ...target.groupedChildren);

    setItemsHistory((prev) => [...prev, { items: newItems, label: `Desagrupación de "${target.name}"`, timestamp: new Date().toLocaleTimeString("es-AR") }]);
    setItems(newItems);
  };

  const handleToggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSendAiPrompt = async (promptToSend?: string) => {
    const promptText = (promptToSend || chatInput).trim();
    if (!promptText || isRefiningAi) return;

    const userMessage: AiChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: promptText,
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    };

    const newHistory = [...chatMessages, userMessage];
    setChatMessages(newHistory);
    setChatInput("");
    setIsRefiningAi(true);
    setRefineError(null);
    setIsAiChatOpen(true);

    try {
      const extractUrl = process.env.NEXT_PUBLIC_COTIZACIONES_EXTRACT || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/extract-items";
      const refineUrl = process.env.NEXT_PUBLIC_COTIZACIONES_REFINE || extractUrl.replace(/extract-items$/, "refine-items");

      const payload = {
        cotizacionId: cotizacionId || "temp_" + Date.now(),
        attachment,
        currentItems: items,
        providerName,
        currency,
        notes,
        deliveryTime,
        paymentTerms,
        validityPeriod,
        prompt: promptText,
        processingMethod,
        chatHistory: newHistory.slice(-6).map((m) => ({ role: m.role, content: m.content }))
      };

      const res = await fetch(refineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || "No se pudo actualizar los ítems con IA");
      }

      if (data.data.providerName) setProviderName(data.data.providerName);
      if (data.data.currency) setCurrency(data.data.currency);
      if (data.data.deliveryTime !== undefined) setDeliveryTime(data.data.deliveryTime);
      if (data.data.paymentTerms !== undefined) setPaymentTerms(data.data.paymentTerms);
      if (data.data.validityPeriod !== undefined) setValidityPeriod(data.data.validityPeriod);
      if (data.data.notes !== undefined) setNotes(data.data.notes);

      const rawUpdatedItems = Array.isArray(data.data.items) ? data.data.items : [];
      const formattedUpdated: ExtractedItem[] = rawUpdatedItems.map((it: any, idx: number) => {
        const p = parseFloat(it.price) || 0;
        const q = parseFloat(it.quantity) || 1;
        const t = parseFloat(it.totalPrice) || (p * q);
        return {
          id: it.id || `ref-${Date.now()}-${idx}`,
          name: (it.name || `Ítem ${idx + 1}`).trim(),
          quantity: q,
          unit: it.unit || "U",
          price: p,
          totalPrice: t,
          discount: parseFloat(it.discount) || 0,
          specification: it.specification || "",
          presentationName: it.presentationName || "",
          unitsPerPresentation: parseFloat(it.unitsPerPresentation) || 1,
          matchedItemId: it.matchedItemId || null,
          selected: true
        };
      });

      setItemsHistory((prev) => [
        ...prev,
        { items: formattedUpdated, label: promptText, timestamp: new Date().toLocaleTimeString("es-AR") }
      ]);
      setItems(formattedUpdated);

      const aiMessage: AiChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: data.reply || "He actualizado los ítems y precios según tu indicación.",
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        itemsSnapshotCount: formattedUpdated.length
      };
      setChatMessages([...newHistory, aiMessage]);

    } catch (err: any) {
      console.error("Error refinando con IA:", err);
      setRefineError(err.message || "Error al comunicarse con la IA");
      const errMessage: AiChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: `⚠️ Hubo un error al procesar tu instrucción: ${err.message || "Error desconocido"}. Podés reintentar o escribirlo de otra forma.`,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      };
      setChatMessages([...newHistory, errMessage]);
    } finally {
      setIsRefiningAi(false);
    }
  };

  const handleUndoLastHistory = () => {
    if (itemsHistory.length <= 1) return;
    const newHistory = [...itemsHistory];
    newHistory.pop();
    const previous = newHistory[newHistory.length - 1];
    setItemsHistory(newHistory);
    setItems(previous.items);
  };

  const handleRestoreInitialItems = () => {
    if (initialItems.length === 0) return;
    setItems(initialItems);
    setItemsHistory((prev) => [...prev, { items: initialItems, label: "Restaurado al original", timestamp: new Date().toLocaleTimeString("es-AR") }]);
  };

  const handleAttachOnly = async () => {
    if (!attachment) return;
    setIsSubmitting(true);
    try {
      const importPromise = onConfirmImport({
        providerName: providerName.trim() || targetProviderName || "Proveedor",
        currency,
        notes,
        deliveryTime: deliveryTime.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        validityPeriod: validityPeriod.trim() || undefined,
        attachment,
        targetProviderId,
        selectedItems: []
      });
      handleClose();
      Promise.resolve(importPromise).catch((err) => {
        console.warn("Aviso al guardar archivo adjunto:", err);
      });
    } catch (err: any) {
      setError(err.message || "Error al adjuntar el archivo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!attachment) return;
    const selectedItems = items.filter((it) => it.selected);
    if (selectedItems.length === 0) {
      setError("Debes seleccionar al menos un ítem para importar");
      return;
    }

    setIsSubmitting(true);
    try {
      // Llamamos a la importación
      const importPromise = onConfirmImport({
        providerName: providerName.trim() || "Proveedor Importado",
        currency,
        notes,
        deliveryTime: deliveryTime.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        validityPeriod: validityPeriod.trim() || undefined,
        attachment,
        targetProviderId,
        selectedItems: selectedItems.map((it) => ({
          name: it.name,
          unit: it.unit,
          quantity: it.quantity,
          price: it.price,
          discount: it.discount,
          specification: it.specification,
          presentationName: it.presentationName,
          unitsPerPresentation: it.unitsPerPresentation,
          matchedItemId: it.matchedItemId
        }))
      });
      // Cerramos el modal de inmediato para no dejar al usuario trabado en 'Importando...'
      handleClose();
      Promise.resolve(importPromise).catch((err) => {
        console.warn("Aviso al guardar datos importados:", err);
      });
    } catch (err: any) {
      setError(err.message || "Error al guardar los datos importados");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderGroupModal = () => {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-lg bg-[#0e1626] border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Agrupar Ítems Seleccionados</h3>
                <p className="text-[11px] text-gray-400">Consolidar varios renglones en un único ítem con precio total</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {/* Lista de ítems a incluir */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Ítems incluidos en el grupo ({groupSelectedIds.size} seleccionados):
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto bg-[#070b12] p-2.5 rounded-xl border border-white/10">
                {items.map((it) => {
                  const isChecked = groupSelectedIds.has(it.id);
                  return (
                    <label
                      key={it.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-emerald-500/10 text-white" : "hover:bg-white/5 text-gray-400 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItemGroupSelection(it.id)}
                          className="rounded border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="truncate">{it.name}</span>
                      </div>
                      <span className="font-mono text-emerald-400 text-[11px] shrink-0 ml-2 font-medium">
                        {currency === "USD" ? "u$s" : "$"} {(it.totalPrice || it.price * it.quantity).toLocaleString("es-AR")}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Nombre del grupo */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Nombre del ítem agrupado:
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ej: Ítem 1 + Ítem 2 + Ítem 3..."
                className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            {/* Cantidad y Unidad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Cantidad:</label>
                <input
                  type="number"
                  value={groupQuantity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    setGroupQuantity(val);
                  }}
                  className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Unidad:</label>
                <input
                  type="text"
                  value={groupUnit}
                  onChange={(e) => setGroupUnit(e.target.value)}
                  placeholder="GL, U, Kit..."
                  className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Precio consolidado */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center justify-between">
                <span>Precio unitario consolidado:</span>
                <span className="text-[10px] text-gray-400 font-normal">Suma automática de precios</span>
              </label>
              <div className="flex items-center bg-[#080d17] border border-white/10 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-400 mr-2 font-mono">{currency === "USD" ? "u$s" : "$"}</span>
                <input
                  type="number"
                  value={groupPrice || ""}
                  onChange={(e) => setGroupPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-sm font-bold font-mono text-emerald-400 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Detalle o especificación */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Especificación / Detalle de componentes:
              </label>
              <textarea
                value={groupSpecification}
                onChange={(e) => setGroupSpecification(e.target.value)}
                rows={2}
                className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-gray-300 placeholder-gray-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmGroup}
              disabled={groupSelectedIds.size < 2 || !groupName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Confirmar Agrupación ({groupSelectedIds.size} ítems)</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAiChatPanel = () => {
    return (
      <div className="w-full lg:w-96 xl:w-[420px] border-t lg:border-t-0 lg:border-l border-white/10 bg-[#090e18] flex flex-col shrink-0 h-96 lg:h-auto overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f1728]/90 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-lg text-white shadow-sm shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-yellow-200" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Asistente IA de Ajustes</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 font-mono">Chat</span>
              </h3>
              <p className="text-[10px] text-gray-400 truncate">Aclarale lo que faltó o pedile cambios</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {itemsHistory.length > 1 && (
              <button
                type="button"
                onClick={handleUndoLastHistory}
                className="p-1.5 text-gray-400 hover:text-amber-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Deshacer último ajuste"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAiChatOpen(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Ocultar chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="p-2.5 border-b border-white/5 bg-[#070b13]/60 shrink-0">
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Sugerencias rápidas:</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {REFINEMENT_QUICK_PROMPTS.map((qp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendAiPrompt(qp.prompt)}
                disabled={isRefiningAi}
                className="text-[10px] px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-md transition-all cursor-pointer disabled:opacity-40 text-left"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages History */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          {chatMessages.length === 0 ? (
            <div className="p-3.5 bg-purple-500/5 border border-purple-500/15 rounded-2xl space-y-2 text-gray-300">
              <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                <Bot className="w-4 h-4 text-purple-400" />
                <span>¡Hola! ¿Qué necesitás ajustar?</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Leí el documento y cargué los ítems en el formulario. Si querés que:
              </p>
              <ul className="text-[11px] text-gray-400 space-y-1 list-disc list-inside">
                <li><strong>Agrupe</strong> ítems (ej: &quot;Agrupame los perfiles y sumá sus precios&quot;)</li>
                <li><strong>Agregue</strong> algún ítem que no vi en el PDF (ej: &quot;Faltó la mano de obra&quot;)</li>
                <li><strong>Recalcule</strong> precios con IVA o flete (ej: &quot;Sumale el 21% de IVA a los precios&quot;)</li>
                <li><strong>Separe</strong> mano de obra y materiales</li>
              </ul>
              <p className="text-[11px] text-purple-300 font-medium">
                Escribí acá tu prompt y recalcularé todos los ítems y precios automáticamente.
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] p-2.5 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-none"
                      : "bg-[#131c2e] border border-white/10 text-gray-200 rounded-bl-none shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] leading-relaxed prose prose-invert prose-xs max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.itemsSnapshotCount !== undefined && (
                        <div className="mt-1 pt-1 border-t border-white/10 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Formulario actualizado ({msg.itemsSnapshotCount} ítems)</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed">{msg.content}</p>
                  )}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 px-1">{msg.timestamp}</span>
              </div>
            ))
          )}

          {isRefiningAi && (
            <div className="p-3 bg-purple-950/20 border border-purple-500/25 rounded-2xl flex items-center gap-2.5 text-xs text-purple-300 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
              <span className="text-[11px]">Consultando documento y recalculando ítems...</span>
            </div>
          )}

          {refineError && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{refineError}</p>
              </div>
            </div>
          )}

          <div ref={chatMessagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-2.5 border-t border-white/10 bg-[#0c121e] shrink-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAiPrompt();
                }
              }}
              placeholder="Escribí una instrucción para la IA..."
              disabled={isRefiningAi}
              className="flex-1 bg-[#070b12] border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSendAiPrompt()}
              disabled={isRefiningAi || !chatInput.trim()}
              className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
              title="Enviar instrucción"
            >
              {isRefiningAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* History controls */}
          {itemsHistory.length > 1 && (
            <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
              <button
                type="button"
                onClick={handleUndoLastHistory}
                className="hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                <span>Deshacer último cambio</span>
              </button>
              <button
                type="button"
                onClick={handleRestoreInitialItems}
                className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar original</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const selectedCount = items.filter((it) => it.selected).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`flex flex-col w-full h-full sm:h-[90vh] ${attachment && isAiChatOpen ? "max-w-6xl" : "max-w-4xl"} bg-[#0b101b] border-0 sm:border border-white/10 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-200`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#101726]/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-md shadow-emerald-500/20 text-white">
              <Sparkles className="w-5 h-5 text-yellow-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {targetProviderName
                  ? `Cargar Presupuesto con IA para ${targetProviderName}`
                  : "Nuevo Proveedor desde Presupuesto (IA)"}
              </h2>
              <p className="text-xs text-gray-400">
                La IA lee el PDF, extrae los productos, precios unitarios y los ingresa a tu cotización
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Mode Selector before upload */}
          {!attachment && !isAnalyzing && !isBatchMode && (
            <div className="bg-[#101726]/80 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  ¿Cómo querés importar los ítems del pliego o presupuesto?
                </span>
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  Podés alternar entre ambos modos después de leer el archivo
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExtractionMode("general")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    extractionMode === "general"
                      ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${extractionMode === "general" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"}`}>
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold ${extractionMode === "general" ? "text-emerald-300" : "text-white"}`}>
                        Solo Rubros Generales
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Consolida por capítulos de pliego (ej: Planta Baja, 1° Piso, Baños) con <strong>Cantidad = 1</strong> y el <strong>Total acumulado</strong> para que quede conciso.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExtractionMode("detailed")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    extractionMode === "detailed"
                      ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${extractionMode === "detailed" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"}`}>
                        <ListOrdered className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold ${extractionMode === "detailed" ? "text-emerald-300" : "text-white"}`}>
                        Detallado por Subítems
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Extrae cada renglón individualmente (ej: 1.1, 1.2, 2.1) con sus unidades (M2, ML, UN) y sus precios finales de renglón.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Processing Method Selector before upload */}
          {!attachment && !isAnalyzing && !isBatchMode && (
            <div className="bg-[#101726]/80 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  ¿Qué método de lectura querés usar para los archivos?
                </span>
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  Elegí entre lectura multimodal directa o conversión a Markdown
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProcessingMethod("light")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    processingMethod === "light"
                      ? "bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/10"
                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${processingMethod === "light" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-gray-400"}`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold ${processingMethod === "light" ? "text-amber-300" : "text-white"}`}>
                        Método Ligero (Markdown)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Nuevo • Rápido
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Convierte PDFs, Office, HTML y correos a <strong>Markdown estructurado con Microsoft MarkItDown</strong>. Menor consumo de tokens y mayor velocidad.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProcessingMethod("heavy")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    processingMethod === "heavy"
                      ? "bg-blue-500/10 border-blue-500/40 shadow-sm shadow-blue-500/10"
                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${processingMethod === "heavy" ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-gray-400"}`}>
                        <Cpu className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold ${processingMethod === "heavy" ? "text-blue-300" : "text-white"}`}>
                        Método Pesado (Multimodal)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Original
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Envía los documentos originales completos en <strong>Base64 / Binario directo</strong> al LLM. Máxima fidelidad visual para planos, fotos o tipografías complejas.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* File Upload Dropzone */}
          {!attachment && !isAnalyzing && !isBatchMode && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-white/[0.02] hover:bg-white/[0.04] group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.eml,message/rfc822,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Selector rápido directo dentro de la card de subida */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 p-1 bg-[#0b101b] border border-white/10 rounded-xl mb-4 text-xs"
              >
                <span className="text-[11px] text-gray-400 px-2 font-medium">Método de lectura:</span>
                <button
                  type="button"
                  onClick={() => setProcessingMethod("heavy")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                    processingMethod === "heavy"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Cpu className="w-3 h-3" />
                  <span>Método Pesado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProcessingMethod("light")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                    processingMethod === "light"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>Método Ligero (Markdown)</span>
                </button>
              </div>

              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Arrastrá uno o varios presupuestos de proveedores
              </h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto mb-4">
                Soporta <strong>PDF</strong>, planillas <strong>Excel (.xlsx, .xls)</strong>, correos <strong>.EML</strong> (incluyendo adjuntos) o documentos. Podés soltar varios archivos juntos para cargarlos en masa con IA.
              </p>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-semibold border border-emerald-500/20">
                <Files className="w-3.5 h-3.5" />
                Examinar uno o varios archivos
              </div>
            </div>
          )}

          {/* Batch Mode View (Idea 3) */}
          {isBatchMode && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#111928] border border-white/10 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <Files className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Carga Masiva de Presupuestos</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {batchQueue.filter((b) => b.status === "done").length} de {batchQueue.length} listos
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isAnalyzing
                        ? "La IA está leyendo y procesando los presupuestos uno por uno..."
                        : "Extracción finalizada. Revisá el listado y hacé clic en importar para agregarlos a la cotización."}
                    </p>
                  </div>
                </div>

                {!isAnalyzing && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold border border-white/10 transition-colors cursor-pointer self-start sm:self-center"
                  >
                    Cargar otros archivos
                  </button>
                )}
              </div>

              {/* Batch List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {batchQueue.map((item) => {
                  const isDone = item.status === "done";
                  const isErr = item.status === "error";
                  const isCurrentAnalyzing = item.status === "analyzing";
                  const payload = item.payload;

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isDone
                          ? "bg-[#0f1728] border-emerald-500/30 shadow-sm"
                          : isErr
                          ? "bg-rose-950/20 border-rose-500/30"
                          : isCurrentAnalyzing
                          ? "bg-indigo-950/20 border-indigo-500/40 animate-pulse"
                          : "bg-[#090d16]/50 border-white/5 opacity-60"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isDone
                                ? "bg-emerald-500/20 text-emerald-400"
                                : isErr
                                ? "bg-rose-500/20 text-rose-400"
                                : isCurrentAnalyzing
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-white/5 text-gray-400"
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isErr ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : isCurrentAnalyzing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate max-w-xs">
                                {isDone && payload ? payload.providerName : item.file.name}
                              </span>
                              {isDone && payload && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-slate-300 font-mono">
                                  {payload.currency}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">
                              {item.file.name} • {(item.file.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {isDone && payload && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                                {payload.selectedItems.length} ítems
                              </span>
                              {payload.deliveryTime && (
                                <span className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 border border-white/5 hidden md:inline">
                                  ⏱️ {payload.deliveryTime}
                                </span>
                              )}
                              {payload.paymentTerms && (
                                <span className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 border border-white/5 hidden md:inline">
                                  💳 {payload.paymentTerms}
                                </span>
                              )}
                            </div>
                          )}

                          {isCurrentAnalyzing && (
                            <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Analizando con IA...
                            </span>
                          )}

                          {isErr && (
                            <span className="text-xs text-rose-400 font-semibold" title={item.error}>
                              Error en lectura
                            </span>
                          )}

                          {item.status === "pending" && (
                            <span className="text-xs text-gray-500">
                              En cola
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading Animation for Single File */}
          {isAnalyzing && !isBatchMode && (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <Loader2 className="w-16 h-16 text-emerald-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Leyendo presupuesto o correo con IA...</h3>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-2 border bg-white/5 border-white/10">
                  {processingMethod === "light" ? (
                    <>
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300">Método Ligero (MarkItDown)</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-3 h-3 text-blue-400" />
                      <span className="text-blue-300">Método Pesado (Multimodal)</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mt-2">
                  Extrayendo nombre del proveedor, moneda, condiciones comerciales, ítems cotizados y precios unitarios.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !isBatchMode && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    fileInputRef.current?.click();
                  }}
                  className="mt-2 underline text-red-300 hover:text-red-200 cursor-pointer"
                >
                  Intentar con otro archivo
                </button>
              </div>
            </div>
          )}

          {/* Results: Provider Details and Items */}
          {attachment && !isAnalyzing && !isBatchMode && (
            <div className="space-y-6">
              {/* File badge & Re-upload button */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#111928] border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    {attachment.filename.endsWith(".pdf") ? (
                      <FileText className="w-4 h-4 text-red-400" />
                    ) : attachment.filename.endsWith(".eml") ? (
                      <Mail className="w-4 h-4 text-blue-400" />
                    ) : attachment.filename.endsWith(".xlsx") || attachment.filename.endsWith(".xls") || attachment.filename.endsWith(".csv") ? (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                        {attachment.originalName || attachment.filename}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        processingMethod === "light"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }`}>
                        {processingMethod === "light" ? <Zap className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                        {processingMethod === "light" ? "Método Ligero" : "Método Pesado"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {(attachment.size / 1024).toFixed(1)} KB • Procesado con IA
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-medium border border-white/10 transition-colors cursor-pointer"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* General Provider Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    Nombre del Proveedor
                  </label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="Ej: Distribuidora Central"
                    className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Moneda
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "ARS" | "USD")}
                    className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="ARS">ARS ($)</option>
                    <option value="USD">USD (u$s)</option>
                  </select>
                </div>
              </div>

              {/* Commercial Conditions (Idea 5) */}
              <div className="p-3.5 bg-[#0d1422]/90 border border-white/10 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Condiciones Comerciales Detectadas</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    (Editables - se usarán en la comparativa y el resumen)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      Plazo de Entrega
                    </label>
                    <input
                      type="text"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      placeholder="Ej: Inmediata, 7 días..."
                      className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-indigo-400" />
                      Forma de Pago
                    </label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="Ej: 30 días, Contado..."
                      className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      Validez de Oferta
                    </label>
                    <input
                      type="text"
                      value={validityPeriod}
                      onChange={(e) => setValidityPeriod(e.target.value)}
                      placeholder="Ej: 15 días, Hasta 31/10..."
                      className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Conditions / Notes */}
              {notes && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    Otras Notas detectadas en el documento
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Validez de oferta, condiciones de pago, etc."
                    className="w-full bg-[#0d1422] border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none transition-colors"
                  />
                </div>
              )}

              {/* Extracted Items Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      {extractionMode === "general" ? "Rubros Generales" : "Ítems Detallados"} ({items.length})
                    </h3>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {selectedCount} seleccionados
                    </span>
                  </div>

                  {/* Action buttons and mode switcher pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center bg-[#070b13] p-1 rounded-xl border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => processFileWithMode(file, "general", attachment, processingMethod)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          extractionMode === "general"
                            ? "bg-emerald-500 text-white shadow-sm font-semibold"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Rubros Generales
                      </button>
                      <button
                        type="button"
                        onClick={() => processFileWithMode(file, "detailed", attachment, processingMethod)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          extractionMode === "detailed"
                            ? "bg-emerald-500 text-white shadow-sm font-semibold"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        Subítems Detallados
                      </button>
                    </div>

                    {/* Method Switcher pills */}
                    <div className="inline-flex items-center bg-[#070b13] p-1 rounded-xl border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => processFileWithMode(file, extractionMode, attachment, "heavy")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          processingMethod === "heavy"
                            ? "bg-blue-500 text-white shadow-sm font-semibold"
                            : "text-gray-400 hover:text-white"
                        }`}
                        title="Método Pesado: Multimodal nativo (Base64)"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        Pesado
                      </button>
                      <button
                        type="button"
                        onClick={() => processFileWithMode(file, extractionMode, attachment, "light")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          processingMethod === "light"
                            ? "bg-amber-500 text-white shadow-sm font-semibold"
                            : "text-gray-400 hover:text-white"
                        }`}
                        title="Método Ligero: Conversión a Markdown con MarkItDown"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Ligero (MD)
                      </button>
                    </div>

                    {/* Botón Agrupar Seleccionados */}
                    {selectedCount >= 2 && (
                      <button
                        type="button"
                        onClick={() => handleOpenGroupModal()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-500/20 animate-in fade-in"
                        title={`Agrupar los ${selectedCount} ítems seleccionados en un único ítem`}
                      >
                        <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Agrupar ({selectedCount})</span>
                      </button>
                    )}

                    {/* Botón Chat con IA */}
                    <button
                      type="button"
                      onClick={() => setIsAiChatOpen(!isAiChatOpen)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        isAiChatOpen
                          ? "bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-sm shadow-purple-500/20"
                          : "bg-gradient-to-r from-purple-500/15 to-indigo-500/15 hover:from-purple-500/25 hover:to-indigo-500/25 text-purple-300 hover:text-white border-purple-500/30 hover:border-purple-500/50"
                      }`}
                      title="Abrir chat para pedirle cambios, agrupaciones o correcciones a la IA"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      <span>{isAiChatOpen ? "Ocultar Chat IA" : "Chat con IA"}</span>
                      {chatMessages.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </button>

                    {/* Botón Deshacer */}
                    {itemsHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={handleUndoLastHistory}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors cursor-pointer"
                        title="Deshacer el último cambio de la IA o agrupación"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Deshacer</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetAllToNewItems}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl transition-colors cursor-pointer"
                      title="Configura todas las líneas leídas para que se creen como ítems nuevos en lugar de asignarse a ítems existentes"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                      <span>Crear nuevas</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl transition-colors cursor-pointer"
                      title="Seleccionar todos los ítems"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Seleccionar todos</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
                      title="Deseleccionar todos los ítems"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deseleccionar todos</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Prompt Rápido para Ajustes con IA */}
                <div className="p-3 bg-gradient-to-r from-purple-950/20 via-indigo-950/20 to-[#0d1424] border border-purple-500/25 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-200 shrink-0">
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span>Ajustar con IA:</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendAiPrompt();
                        }
                      }}
                      placeholder="Pedile a la IA: 'Agrupá los caños y codos en un solo renglón', 'Faltó el flete de $50.000', 'Sumá 21% IVA'..."
                      className="flex-1 bg-[#080d17] border border-white/10 focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                      disabled={isRefiningAi}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendAiPrompt()}
                      disabled={isRefiningAi || !chatInput.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/20 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {isRefiningAi ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Enviar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAiChatOpen(!isAiChatOpen)}
                      className={`p-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                        isAiChatOpen ? "bg-purple-500/20 text-purple-200 border-purple-500/40" : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10"
                      }`}
                      title="Ver historial del chat y sugerencias de la IA"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {hasDuplicateMatches && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Atención:</strong> Hay dos o más líneas asignadas al mismo ítem existente. Si no cambiás alguna a &quot;Crear como nuevo ítem&quot;, una reemplazará a la otra.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetAllToNewItems}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-colors shrink-0"
                    >
                      Crear todas como nuevas
                    </button>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 bg-white/[0.02] border border-white/5 rounded-2xl text-xs">
                    No se detectaron renglones o productos en este documento.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {items.map((item, index) => {
                      const matchedItem = existingItems.find((ei) => ei.id === item.matchedItemId);

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            item.selected
                              ? "bg-[#0f1728] border-white/15 shadow-sm"
                              : "bg-[#090d16]/50 border-white/5 opacity-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleItemSelect(index)}
                              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0 space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                {/* Item Name */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {item.isGrouped && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                                      <Boxes className="w-3 h-3 text-emerald-400" />
                                      <span>Agrupado ({item.groupedChildren?.length || 0})</span>
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => handleUpdateItemField(index, "name", e.target.value)}
                                    className="font-semibold text-sm text-white bg-transparent border-b border-transparent hover:border-white/10 focus:border-emerald-500 focus:outline-none flex-1 truncate"
                                    placeholder="Nombre del ítem"
                                  />
                                  {item.isGrouped && (
                                    <button
                                      type="button"
                                      onClick={() => handleUngroupItem(item.id)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                                      title="Desagrupar este ítem y restaurar las líneas originales"
                                    >
                                      <Split className="w-3 h-3 text-amber-400" />
                                      <span>Desagrupar</span>
                                    </button>
                                  )}
                                </div>

                                {/* Unit Price and Presentation */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center bg-[#070b12] border border-white/10 rounded-xl px-2.5 py-1">
                                    <span className="text-xs text-gray-400 mr-1 font-mono">
                                      {currency === "USD" ? "u$s" : "$"}
                                    </span>
                                    <input
                                      type="number"
                                      value={item.price || ""}
                                      onChange={(e) =>
                                        handleUpdateItemField(index, "price", parseFloat(e.target.value) || 0)
                                      }
                                      className="w-28 bg-transparent text-sm font-bold font-mono text-emerald-400 focus:outline-none"
                                      placeholder="0"
                                    />
                                  </div>

                                  <div className="text-[11px] text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                                    {extractionMode === "general" ? (
                                      <span className="text-emerald-400 font-semibold font-mono">1 {item.unit} • Total</span>
                                    ) : (
                                      <span>{item.quantity} {item.unit}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Details: Specification / Brand & Presentation */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <input
                                    type="text"
                                    value={item.specification}
                                    onChange={(e) =>
                                      handleUpdateItemField(index, "specification", e.target.value)
                                    }
                                    placeholder="Marca, código, detalles técnicos (opcional)"
                                    className="w-full bg-[#080d17] border border-white/10 focus:border-emerald-500 rounded-lg px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none"
                                  />
                                </div>

                                {/* Matching with existing items or creating new */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />
                                    <select
                                      value={item.matchedItemId || "new"}
                                      onChange={(e) =>
                                        handleUpdateItemField(
                                          index,
                                          "matchedItemId",
                                          e.target.value === "new" ? null : e.target.value
                                        )
                                      }
                                      className={`w-full text-xs rounded-lg px-2 py-1 border focus:outline-none cursor-pointer transition-colors ${
                                        item.matchedItemId
                                          ? (duplicateMatchedCounts[item.matchedItemId] ?? 0) > 1
                                            ? "bg-amber-950/40 border-amber-500/50 text-amber-300 font-semibold"
                                            : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 font-semibold"
                                          : "bg-[#080d17] border-white/10 text-gray-300"
                                      }`}
                                    >
                                      <option value="new">➕ Crear como nuevo ítem en la cotización</option>
                                      {existingItems.map((ei) => (
                                        <option key={ei.id} value={ei.id}>
                                          Asignar a: {ei.name} ({ei.targetQuantity} {ei.baseUnit})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {item.matchedItemId && (duplicateMatchedCounts[item.matchedItemId] ?? 0) > 1 && (
                                    <p className="text-[11px] text-amber-300 flex items-center gap-1 mt-1 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span>Duplicado: Otra línea también apunta a {matchedItem?.name || item.matchedItemId}. Se sobrescribirá si no creás un ítem nuevo.</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Sub-items preview for grouped items */}
                              {item.isGrouped && item.groupedChildren && item.groupedChildren.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-white/5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleExpandGroup(item.id)}
                                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <span>{expandedGroupIds.has(item.id) ? "Ocultar" : "Ver"} los {item.groupedChildren.length} ítems agrupados en este renglón</span>
                                    {expandedGroupIds.has(item.id) ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                  {expandedGroupIds.has(item.id) && (
                                    <div className="space-y-1 mt-1.5 pl-2 border-l-2 border-emerald-500/30">
                                      {item.groupedChildren.map((child, cIdx) => (
                                        <div key={child.id || cIdx} className="text-[11px] text-gray-300 flex items-center justify-between bg-black/25 p-1.5 rounded-lg border border-white/5">
                                          <span className="truncate">• {child.name} ({child.quantity} {child.unit})</span>
                                          <span className="font-mono text-emerald-400 ml-2 shrink-0 font-medium">
                                            {currency === "USD" ? "u$s" : "$"} {(child.totalPrice || child.price * child.quantity).toLocaleString("es-AR")}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>

          {/* AI Chat Drawer / Panel on the right */}
          {attachment && !isAnalyzing && !isBatchMode && isAiChatOpen && renderAiChatPanel()}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-white/10 bg-[#101726]/90 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {/* Batch Mode Footer Actions */}
          {isBatchMode && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmBatch}
                disabled={isSubmitting || isAnalyzing || batchQueue.filter((b) => b.status === "done").length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando proveedores...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>
                      Importar los {batchQueue.filter((b) => b.status === "done").length} Proveedores a la Cotización
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Single-file Footer Actions */}
          {attachment && !isAnalyzing && !isBatchMode && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Option to only attach file without autocargando items */}
              <button
                type="button"
                onClick={handleAttachOnly}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.1] rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                title="Adjunta el archivo al proveedor sin agregar ni modificar ningún ítem"
              >
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span>Solo Adjuntar Archivo (Sin cargar ítems)</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>
                      {targetProviderId
                        ? `Cargar ${selectedCount} ítems a ${providerName}`
                        : `Crear con ${selectedCount} ítems`}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Agrupación de Ítems */}
      {isGroupModalOpen && renderGroupModal()}
    </div>
  );
}
