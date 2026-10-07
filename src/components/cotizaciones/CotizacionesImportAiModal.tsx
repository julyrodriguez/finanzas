"use client";

import React, { useState, useRef } from "react";
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
  Files
} from "lucide-react";
import { QuoteAttachment } from "./CotizacionesAiChatModal";

export type ExtractionMode = "general" | "detailed";

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
  if (targetProviderId) formData.append("providerId", targetProviderId);
  if (targetProviderName) formData.append("providerName", targetProviderName);
  if (existingItems.length > 0) formData.append("existingItems", JSON.stringify(existingItems));
  formData.append("file", file);

  const res = await fetch(`${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}&extractionMode=${mode}`, {
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
  const [cachedResults, setCachedResults] = useState<{
    general?: { items: ExtractedItem[]; providerName: string; currency: "ARS" | "USD"; notes: string; deliveryTime?: string; paymentTerms?: string; validityPeriod?: string; attachment?: QuoteAttachment };
    detailed?: { items: ExtractedItem[]; providerName: string; currency: "ARS" | "USD"; notes: string; deliveryTime?: string; paymentTerms?: string; validityPeriod?: string; attachment?: QuoteAttachment };
  }>({});
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await processFileWithMode(fileArray[0], extractionMode);
    } else {
      setIsBatchMode(true);
      setError(null);
      const queue: BatchFileItem[] = fileArray.map((f, i) => ({
        id: `batch-${Date.now()}-${i}`,
        file: f,
        status: "pending"
      }));
      setBatchQueue(queue);
      processBatchQueue(queue, extractionMode);
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

  const processBatchQueue = async (queue: BatchFileItem[], mode: ExtractionMode) => {
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
    currentAttachment?: QuoteAttachment | null
  ) => {
    // 1. Si ya tenemos cacheado el resultado de este modo, cambiamos al instante sin request de red
    if (cachedResults[mode]) {
      const cached = cachedResults[mode]!;
      setItems(cached.items);
      setProviderName(targetProviderName || cached.providerName);
      setCurrency(cached.currency);
      setNotes(cached.notes);
      setDeliveryTime(cached.deliveryTime || "");
      setPaymentTerms(cached.paymentTerms || "");
      setValidityPeriod(cached.validityPeriod || "");
      if (cached.attachment) setAttachment(cached.attachment);
      setExtractionMode(mode);
      return;
    }

    if (targetFile) setFile(targetFile);
    setExtractionMode(mode);
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
        if (targetProviderId) formData.append("providerId", targetProviderId);
        if (targetProviderName) formData.append("providerName", targetProviderName);
        if (existingItems.length > 0) formData.append("existingItems", JSON.stringify(existingItems));
        formData.append("file", targetFile);

        res = await fetch(`${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}&extractionMode=${mode}`, {
          method: "POST",
          body: formData
        });
      } else if (currentAttachment || attachment) {
        const att = currentAttachment || attachment!;
        res = await fetch(`${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}&extractionMode=${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cotizacionId: targetQuoteId,
            extractionMode: mode,
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

      // Guardar en caché para permitir alternar modos instantáneamente
      setCachedResults((prev) => ({
        ...prev,
        [mode]: {
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

  const selectedCount = items.filter((it) => it.selected).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full h-full sm:h-[90vh] max-w-4xl bg-[#0b101b] border-0 sm:border border-white/10 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden">
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
                <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
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
                      <FileText className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                      {attachment.originalName}
                    </p>
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

                  {/* Mode switcher pills directly in results */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center bg-[#070b13] p-1 rounded-xl border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => processFileWithMode(file, "general", attachment)}
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
                        onClick={() => processFileWithMode(file, "detailed", attachment)}
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

                    <button
                      type="button"
                      onClick={handleResetAllToNewItems}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-lg transition-colors cursor-pointer"
                      title="Configura todas las líneas leídas para que se creen como ítems nuevos en lugar de asignarse a ítems existentes"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                      <span>Crear ítems nuevos a todas las líneas</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer ml-1"
                    >
                      {items.every((it) => it.selected) ? "Desmarcar todos" : "Seleccionar todos"}
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
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateItemField(index, "name", e.target.value)}
                                  className="font-semibold text-sm text-white bg-transparent border-b border-transparent hover:border-white/10 focus:border-emerald-500 focus:outline-none flex-1 truncate"
                                  placeholder="Nombre del ítem"
                                />

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
    </div>
  );
}
