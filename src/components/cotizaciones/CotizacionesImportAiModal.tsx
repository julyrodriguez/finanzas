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
  Info
} from "lucide-react";
import { QuoteAttachment } from "./CotizacionesAiChatModal";

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

interface CotizacionesImportAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotizacionId?: string;
  existingItems: ExistingQuoteItem[];
  targetProviderId?: string;
  targetProviderName?: string;
  onConfirmImport: (payload: {
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
  }) => Promise<void> | void;
}

export function CotizacionesImportAiModal({
  isOpen,
  onClose,
  cotizacionId,
  existingItems,
  targetProviderId,
  targetProviderName,
  onConfirmImport
}: CotizacionesImportAiModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted data state
  const [attachment, setAttachment] = useState<QuoteAttachment | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setIsAnalyzing(false);
    setError(null);
    setAttachment(null);
    setProviderName("");
    setCurrency("ARS");
    setNotes("");
    setItems([]);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processSelectedFile(selectedFile);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await processSelectedFile(droppedFile);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      const targetQuoteId = cotizacionId || "temp_" + Date.now();
      formData.append("cotizacionId", targetQuoteId);
      if (targetProviderId) {
        formData.append("providerId", targetProviderId);
      }
      if (targetProviderName) {
        formData.append("providerName", targetProviderName);
      }
      if (existingItems.length > 0) {
        formData.append("existingItems", JSON.stringify(existingItems));
      }
      formData.append("file", selectedFile);

      const baseUrl = process.env.NEXT_PUBLIC_COTIZACIONES_EXTRACT || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/extract-items";
      const apiEndpoint = `${baseUrl}?cotizacionId=${encodeURIComponent(targetQuoteId)}`;
      const res = await fetch(apiEndpoint, {
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

      const extracted = resData.data;
      setAttachment(resData.attachment);
      setProviderName(targetProviderName || extracted.providerName || selectedFile.name.replace(/\.[^/.]+$/, ""));
      setCurrency(extracted.currency === "USD" ? "USD" : "ARS");
      setNotes(extracted.notes || "");

      const formattedItems: ExtractedItem[] = (extracted.items || []).map((it: any, index: number) => ({
        id: it.id || `ext-${Date.now()}-${index}`,
        name: it.name || `Ítem ${index + 1}`,
        quantity: typeof it.quantity === "number" ? it.quantity : 1,
        unit: it.unit || "U",
        price: typeof it.price === "number" ? it.price : 0,
        totalPrice: typeof it.totalPrice === "number" ? it.totalPrice : 0,
        discount: typeof it.discount === "number" ? it.discount : 0,
        specification: it.specification || "",
        presentationName: it.presentationName || "",
        unitsPerPresentation: typeof it.unitsPerPresentation === "number" ? it.unitsPerPresentation : 1,
        matchedItemId: it.matchedItemId || null,
        selected: true
      }));

      setItems(formattedItems);
    } catch (err: any) {
      console.error("Error analizando documento:", err);
      setError(err.message || "Error al leer el documento con IA");
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

  const handleUpdateItemField = (index: number, field: keyof ExtractedItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
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
      await onConfirmImport({
        providerName: providerName.trim() || "Proveedor Importado",
        currency,
        notes,
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
      handleClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar los datos importados");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = items.filter((it) => it.selected).length;

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
          {/* File Upload / Status area */}
          {!attachment && !isAnalyzing && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-white/[0.02] hover:bg-white/[0.04] group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.eml,message/rfc822,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Arrastrá o seleccioná el presupuesto del proveedor
              </h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto mb-4">
                Soporta <strong>PDF</strong>, emails comerciales <strong>.EML</strong> o imágenes de listas de precios (PNG, JPG).
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-semibold border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                Examinar archivo en tu equipo
              </div>
            </div>
          )}

          {/* Loading Animation */}
          {isAnalyzing && (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <Loader2 className="w-16 h-16 text-emerald-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Leyendo presupuesto con IA...</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                  Extrayendo nombre del proveedor, moneda, ítems cotizados, unidades, descripciones y precios.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
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
          {attachment && !isAnalyzing && (
            <div className="space-y-6">
              {/* File badge & Re-upload button */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#111928] border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    {attachment.filename.endsWith(".pdf") ? (
                      <FileText className="w-4 h-4 text-red-400" />
                    ) : attachment.filename.endsWith(".eml") ? (
                      <Mail className="w-4 h-4 text-blue-400" />
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

              {/* Conditions / Notes */}
              {notes && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    Condiciones / Notas detectadas
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Ítems Extraídos ({items.length})
                    </h3>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {selectedCount} seleccionados
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {items.every((it) => it.selected) ? "Desmarcar todos" : "Seleccionar todos"}
                  </button>
                </div>

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
                                      className="w-24 bg-transparent text-sm font-bold font-mono text-emerald-400 focus:outline-none"
                                      placeholder="0"
                                    />
                                  </div>

                                  <div className="text-[11px] text-gray-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                    {item.quantity} {item.unit}
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
                                        ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 font-semibold"
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
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#101726]/90 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {attachment && !isAnalyzing && (
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
                      ? `Aplicar a ${providerName} (${selectedCount} ítems)`
                      : `Crear Proveedor con ${selectedCount} ítems`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
