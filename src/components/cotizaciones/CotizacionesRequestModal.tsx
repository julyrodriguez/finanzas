"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Mail,
  Send,
  Sparkles,
  Clipboard,
  Check,
  Share2,
  FileText,
  Building2,
  MapPin,
  Clock,
  Loader2,
  ExternalLink,
  MessageSquare,
  Layers,
  PackageCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ItemForRequest {
  id: string;
  name: string;
  baseUnit: string;
  targetQuantity: number;
}

export interface ExtractedArticle {
  quantity: string;
  unit: string;
  description: string;
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function extractArticlesFromText(text: string): ExtractedArticle[] {
  if (!text || !text.trim()) return [];

  // Split on newlines, commas, semicolons, and coordinating conjunctions
  const segments = text
    .split(/\n|,|;|\b(?:y|e|además|ademas|también|tambien|más|mas)\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const articles: ExtractedArticle[] = [];

  const unitMap: Record<string, string> = {
    bolsa: "Bolsas",
    bolsas: "Bolsas",
    u: "Unidades",
    un: "Unidades",
    unidad: "Unidades",
    unidades: "Unidades",
    barra: "Barras",
    barras: "Barras",
    varilla: "Varillas",
    varillas: "Varillas",
    kg: "kg",
    kilo: "kg",
    kilos: "kg",
    l: "Litros",
    lt: "Litros",
    lts: "Litros",
    litro: "Litros",
    litros: "Litros",
    m: "Metros",
    mt: "Metros",
    mts: "Metros",
    metro: "Metros",
    metros: "Metros",
    m2: "m²",
    m3: "m³",
    pack: "Packs",
    packs: "Packs",
    caja: "Cajas",
    cajas: "Cajas",
    paquete: "Paquetes",
    paquetes: "Paquetes",
    palet: "Pallets",
    pallet: "Pallets",
    pallets: "Pallets",
    rollo: "Rollos",
    rollos: "Rollos",
    tira: "Tiras",
    tiras: "Tiras",
    tubo: "Tubos",
    tubos: "Tubos",
    malla: "Mallas",
    mallas: "Mallas",
    placa: "Placas",
    placas: "Placas",
    hoja: "Hojas",
    hojas: "Hojas"
  };

  for (let seg of segments) {
    // Clean introductory conversational filler
    seg = seg.replace(/^(?:hola|buenas|che|porfa|por favor|necesito|preciso|pasame|mandame|cotizame|presupuestame|precio de|precios de|valores de|valor de|tenes|tienen|queria saber si tenes|queria pedirte|pedir|comprar|conseguir|para)\s+/i, "").trim();
    // Clean trailing filler
    seg = seg.replace(/\s+(?:porfa|por favor|a la brevedad|lo antes posible|urgente|gracias|muchas gracias|saludos)$/i, "").trim();

    if (!seg || seg.length < 2) continue;

    // Pattern 1: [quantity] [unit] [de/del] [description]  (e.g., "50 bolsas de cemento loma negra", "10 barras hierro")
    const matchWithUnit = seg.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z³²°]{1,12})\s+(?:de\s+|del\s+)?(.+)$/i);
    if (matchWithUnit) {
      const qty = matchWithUnit[1];
      const candidateUnit = matchWithUnit[2].toLowerCase();
      const rest = matchWithUnit[3].trim();

      if (unitMap[candidateUnit]) {
        articles.push({
          quantity: qty,
          unit: unitMap[candidateUnit],
          description: capitalizeFirst(rest)
        });
        continue;
      }
    }

    // Pattern 2: [quantity] [description] (e.g., "10 hierros del 8", "100 ladrillos del 18")
    const matchSimpleQty = seg.match(/^(\d+(?:[.,]\d+)?)\s+(?:de\s+|del\s+)?(.+)$/i);
    if (matchSimpleQty) {
      const qty = matchSimpleQty[1];
      const desc = matchSimpleQty[2].trim();
      articles.push({
        quantity: qty,
        unit: "Unidades",
        description: capitalizeFirst(desc)
      });
      continue;
    }

    // Pattern 3: [description] [quantity] [unit] (e.g., "pintura latex blanca 20 litros")
    const matchTrailingQty = seg.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z³²°]{1,12})$/i);
    if (matchTrailingQty) {
      const desc = matchTrailingQty[1].trim();
      const qty = matchTrailingQty[2];
      const candidateUnit = matchTrailingQty[3].toLowerCase();

      articles.push({
        quantity: qty,
        unit: unitMap[candidateUnit] || candidateUnit.toUpperCase(),
        description: capitalizeFirst(desc)
      });
      continue;
    }

    // Fallback: item without explicit leading quantity
    articles.push({
      quantity: "1",
      unit: "Unidad",
      description: capitalizeFirst(seg)
    });
  }

  return articles;
}

interface CotizacionesRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteName?: string;
  existingItems?: ItemForRequest[];
  providerNames?: string[];
}

export function CotizacionesRequestModal({
  isOpen,
  onClose,
  quoteName = "",
  existingItems = [],
  providerNames = []
}: CotizacionesRequestModalProps) {
  const [activeTab, setActiveTab] = useState<"rough" | "items">("rough");
  const [roughText, setRoughText] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(existingItems.map((it) => it.id))
  );

  // Optional contextual fields
  const [destinationRef, setDestinationRef] = useState<string>(quoteName || "");
  const [targetSupplier, setTargetSupplier] = useState<string>("");
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");
  const [deliveryUrgency, setDeliveryUrgency] = useState<string>("");

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");
  const [whatsappBody, setWhatsappBody] = useState<string>("");
  const [copiedType, setCopiedType] = useState<"email" | "whatsapp" | null>(null);

  // Identified articles in real time
  const detectedArticles = useMemo(() => {
    return activeTab === "rough" ? extractArticlesFromText(roughText) : [];
  }, [roughText, activeTab]);

  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllItems = () => {
    if (selectedItemIds.size === existingItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(existingItems.map((it) => it.id)));
    }
  };

  const generateLocalFormalDraft = () => {
    const project = destinationRef.trim() || "el proyecto en curso";
    const supplier = targetSupplier.trim() || "Estimados";
    const location = deliveryLocation.trim();
    const urgency = deliveryUrgency.trim();

    let itemsListText = "";
    let waItemsText = "";

    if (activeTab === "items" && existingItems.length > 0) {
      const chosen = existingItems.filter((it) => selectedItemIds.has(it.id));
      if (chosen.length > 0) {
        itemsListText = chosen
          .map((it, idx) => `${idx + 1}. ${it.targetQuantity} ${it.baseUnit} - ${it.name}`)
          .join("\n");
        waItemsText = chosen
          .map((it) => `• *${it.targetQuantity} ${it.baseUnit}* ${it.name}`)
          .join("\n");
      }
    } else {
      const extracted = extractArticlesFromText(roughText);
      if (extracted.length > 0) {
        itemsListText = extracted
          .map((art, idx) => `${idx + 1}. ${art.quantity} ${art.unit} - ${art.description}`)
          .join("\n");
        waItemsText = extracted
          .map((art) => `• *${art.quantity} ${art.unit}* ${art.description}`)
          .join("\n");
      }
    }

    if (!itemsListText) {
      itemsListText = "1. [Especificar artículos, cantidades y unidades a cotizar]";
      waItemsText = "• [Materiales a cotizar]";
    }

    const subject = `Solicitud de Cotización de Materiales - ${project}`;

    const email = `${supplier === "Estimados" ? "Estimados," : `Estimados señores de ${supplier},`}

Por medio de la presente, nos comunicamos desde el área de Compras para solicitarles formalmente cotización de los siguientes artículos requeridos para ${project}:

DETALLE DE MATERIALES SOLICITADOS:
${itemsListText}

CONDICIONES REQUERIDAS A ESPECIFICAR EN SU PRESUPUESTO:
- Plazo y tiempo de entrega estimado${urgency ? ` (Requerido: ${urgency})` : ""}.${location ? `\n- Indicar costo de flete y entrega en: ${location}.` : "\n- Indicar si los valores incluyen flete y descarga en destino."}
- Condiciones y formas de pago disponibles.
- Validez y vigencia de la oferta económica.
- Indicar si los precios expresados son finales o más IVA.

Agradecemos nos remitan su presupuesto formal a la brevedad posible.
Quedamos a su entera disposición ante cualquier duda o consulta técnica.

Atentamente,
Área de Compras y Contrataciones`;

    const wa = `Hola${targetSupplier.trim() ? ` ${targetSupplier.trim()}` : ""}, ¿cómo estás? Te consulto presupuesto para *${project}*:

${waItemsText}

${location ? `📍 Lugar de entrega: ${location}\n` : ""}${urgency ? `⏱️ Plazo: ${urgency}\n` : ""}Por favor pasame precios unitarios, disponibilidad y condiciones de pago. ¡Muchas gracias!`;

    return { subject, email, wa };
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    // Fallback template as base
    const localDraft = generateLocalFormalDraft();

    try {
      const apiEndpoint = process.env.NEXT_PUBLIC_COTIZACIONES_API || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/chat";

      const extractedForAi = activeTab === "rough" ? extractArticlesFromText(roughText) : [];
      const extractedSummary = extractedForAi
        .map((a) => `${a.quantity} ${a.unit} de ${a.description}`)
        .join("; ");

      const promptContent = `Actúa como un Responsable de Compras y Abastecimiento senior.
Tu objetivo es redactar una Solicitud Formal de Cotización a proveedores, transformando las notas informales del usuario en un pedido formal, pulcro e impecable.

REGLA CRÍTICA Y OBLIGATORIA:
DEBES IDENTIFICAR, EXTRAER Y NORMALIZAR CADA UNO DE LOS ARTÍCULOS O MATERIALES SOLICITADOS A PARTIR DEL TEXTO INFORMAL DEL USUARIO.
- NO copies frases informales del usuario como "hola necesito", "pasame precio de", etc.
- En la sección "DETALLE DE MATERIALES SOLICITADOS", debes listar CADA ARTÍCULO COMO UN ÍTEM INDIVIDUAL numerado con:
  [Número]. [Cantidad] [Unidad de Medida] - [Descripción Clara / Especificación del Material]
  Ejemplo:
  1. 50 Bolsas (x 50kg) - Cemento Portland Loma Negra
  2. 10 Barras (x 12m) - Hierro aletado ADN 420 Ø 8 mm
  3. 2 m³ - Arena gruesa limpia

DATOS DEL PEDIDO:
- Texto informal del usuario: "${roughText.trim()}"
${extractedSummary ? `- Artículos detectados preliminarmente: ${extractedSummary}` : ""}
${
  activeTab === "items" && existingItems.length > 0
    ? `- Ítems seleccionados de la cotización: ${existingItems
        .filter((it) => selectedItemIds.has(it.id))
        .map((it) => `${it.targetQuantity} ${it.baseUnit} de ${it.name}`)
        .join(", ")}`
    : ""
}
- Obra / Proyecto de destino: "${destinationRef.trim() || "Obra / Proyecto"}"
- Proveedor destinatario: "${targetSupplier.trim() || "Proveedor"}"
- Lugar y condición de entrega: "${deliveryLocation.trim() || "A coordinar en destino"}"
- Plazo de entrega requerido: "${deliveryUrgency.trim() || "A convenir"}"

FORMATO OBLIGATORIO DE RESPUESTA:
Devuelve ÚNICAMENTE las siguientes tres secciones delimitadas por los tags exactos:

===ASUNTO===
[Asunto formal, conciso y profesional, ej: Solicitud de Cotización de Materiales - Proyecto X]
===CORREO===
[Cuerpo formal del correo:
- Saludo protocolar al proveedor
- Párrafo formal solicitando cotización para la obra/proyecto
- DETALLE DE MATERIALES SOLICITADOS (lista numerada de cada artículo individual normalizado con cantidad y unidad)
- CONDICIONES REQUERIDAS (plazo de entrega, lugar, formas de pago, vigencia de precios e indicación de IVA)
- Cierre formal y firma de Compras]
===WHATSAPP===
[Versión para WhatsApp sintética, prolija y ejecutiva:
- Saludo cordial
- Mención del proyecto
- Lista con viñetas en negrita de los materiales: • *Cantidad Unidad* Descripción
- Plazo, lugar y solicitud de precios unitarios]`;

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cotizacionId: "solicitud_temp",
          quoteName: destinationRef,
          modelName: "gemini-3.5-flash-lite",
          messages: [
            {
              role: "user",
              content: promptContent
            }
          ]
        })
      });

      if (res.ok) {
        let fullText = "";
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const dataStr = trimmed.replace(/^data:\s*/, "");
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) fullText += parsed.text;
                else if (parsed.content) fullText += parsed.content;
              } catch {
                fullText += dataStr;
              }
            }
          }
        } else {
          fullText = await res.text();
        }

        if (fullText && fullText.includes("===CORREO===")) {
          const subjectMatch = fullText.match(/===ASUNTO===([\s\S]*?)===CORREO===/);
          const emailMatch = fullText.match(/===CORREO===([\s\S]*?)===WHATSAPP===/);
          const waMatch = fullText.match(/===WHATSAPP===([\s\S]*)$/);

          const aiSubject = subjectMatch ? subjectMatch[1].trim() : localDraft.subject;
          const aiEmail = emailMatch ? emailMatch[1].trim() : localDraft.email;
          const aiWa = waMatch ? waMatch[1].trim() : localDraft.wa;

          setEmailSubject(aiSubject);
          setEmailBody(aiEmail);
          setWhatsappBody(aiWa);
          setIsGenerating(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Using local structured template:", err);
    }

    // Default to instant structured draft
    setEmailSubject(localDraft.subject);
    setEmailBody(localDraft.email);
    setWhatsappBody(localDraft.wa);
    setIsGenerating(false);
  };

  const handleCopy = async (type: "email" | "whatsapp") => {
    try {
      const textToCopy =
        type === "email"
          ? `Asunto: ${emailSubject}\n\n${emailBody}`
          : whatsappBody;

      await navigator.clipboard.writeText(textToCopy);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (e) {
      console.error("Error al copiar:", e);
    }
  };

  const handleOpenMailto = () => {
    const subjectEnc = encodeURIComponent(emailSubject);
    const bodyEnc = encodeURIComponent(emailBody);
    window.open(`mailto:?subject=${subjectEnc}&body=${bodyEnc}`, "_blank");
  };

  const handleOpenWhatsApp = () => {
    const textEnc = encodeURIComponent(whatsappBody);
    window.open(`https://wa.me/?text=${textEnc}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full h-full sm:h-[90vh] max-w-4xl bg-[#0b101b] border-0 sm:border border-white/10 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#101726]/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 text-white">
              <Mail className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Solicitud de Cotización a Proveedores</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                  Redactor Formal IA
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Escribí lo que necesitás &quot;así nomás&quot; y la IA desglosa los artículos y te arma el correo formal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Tabs: Rough Text vs Current Quote Items */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-[#080d15] border border-white/10 rounded-2xl">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("rough")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "rough"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Escribir así nomás (Texto libre)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("items")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "items"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Usar ítems de esta cotización ({existingItems.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 px-2 hidden sm:inline">
              {activeTab === "rough"
                ? "Tipeá lo que necesitás: detectará automáticamente cada artículo"
                : "Elegí qué productos de la lista querés presupuestar"}
            </span>
          </div>

          {/* Context Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#101726]/60 border border-white/10 rounded-2xl text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-400" />
                Obra / Proyecto
              </label>
              <input
                type="text"
                value={destinationRef}
                onChange={(e) => setDestinationRef(e.target.value)}
                placeholder="Ej: Obra Pilar, Mantenimiento..."
                className="w-full bg-[#080d17] border border-white/10 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-indigo-400" />
                Proveedor destinatario (opcional)
              </label>
              <input
                type="text"
                value={targetSupplier}
                onChange={(e) => setTargetSupplier(e.target.value)}
                placeholder="Ej: Distribuidora Central..."
                list="suppliersList"
                className="w-full bg-[#080d17] border border-white/10 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {providerNames.length > 0 && (
                <datalist id="suppliersList">
                  {providerNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Lugar de entrega / Flete (opcional)
              </label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="Ej: Obra Pilar Km 50..."
                className="w-full bg-[#080d17] border border-white/10 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Mode 1: Rough Textarea */}
          {activeTab === "rough" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
                <span>Escribí tu pedido de materiales:</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Identifica artículos, cantidades y unidades automáticamente
                </span>
              </label>
              <textarea
                rows={4}
                value={roughText}
                onChange={(e) => setRoughText(e.target.value)}
                placeholder="Ej: Che pasame precio de 20 bolsas de cemento loma negra, 10 varillas del 10 y 2 m3 de arena para entregar el viernes en pilar con descarga..."
                className="w-full bg-[#080d17] border border-white/10 focus:border-indigo-500 rounded-2xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none leading-relaxed resize-none"
              />

              {/* Detected Articles Live Preview */}
              {detectedArticles.length > 0 && (
                <div className="p-3 rounded-2xl bg-indigo-950/25 border border-indigo-500/25 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-emerald-400" />
                      <span>Artículos identificados para el detalle ({detectedArticles.length}):</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Se incluirán numerados y normalizados en el correo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detectedArticles.map((art, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs text-slate-200"
                      >
                        <span className="font-mono font-bold text-indigo-300">
                          {art.quantity} {art.unit}
                        </span>
                        <span className="text-white font-medium">{art.description}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Existing Items Selector */}
          {activeTab === "items" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200">
                  Seleccioná los ítems a cotizar ({selectedItemIds.size} de {existingItems.length}):
                </label>
                {existingItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllItems}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    {selectedItemIds.size === existingItems.length
                      ? "Desmarcar todos"
                      : "Seleccionar todos"}
                  </button>
                )}
              </div>

              {existingItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-[#080d17] border border-white/5 rounded-2xl">
                  No hay ítems cargados en esta cotización. Podés escribir tu pedido en la pestaña &quot;Escribir así nomás&quot;.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {existingItems.map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-indigo-950/30 border-indigo-500/40 text-white"
                            : "bg-[#080d17]/60 border-white/5 text-slate-400 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="font-semibold truncate">{item.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {item.targetQuantity} {item.baseUnit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center pt-1">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerate}
              disabled={isGenerating || (activeTab === "rough" && !roughText.trim()) || (activeTab === "items" && selectedItemIds.size === 0)}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Desglosando artículos y redactando correo formal...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Generar Correo Formal y WhatsApp</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Generated Results Area */}
          {(emailBody || whatsappBody) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pt-3 border-t border-white/10"
            >
              {/* Email Result Card */}
              <div className="p-4 rounded-2xl bg-[#080d17] border border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Mail className="w-4 h-4 text-indigo-400" />
                    <span>Versión Correo Electrónico Formal</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy("email")}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {copiedType === "email" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3.5 h-3.5" />
                          <span>Copiar Correo</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenMailto}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                      title="Abrir en cliente de correo predeterminado"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Abrir Mail</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Asunto
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full bg-[#060912] border border-white/5 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Cuerpo del Correo (con desglose formal de materiales)
                    </label>
                    <textarea
                      rows={10}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full bg-[#060912] border border-white/5 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 outline-none leading-relaxed font-mono resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Result Card */}
              <div className="p-4 rounded-2xl bg-[#080d17] border border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Versión Sintética para WhatsApp</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy("whatsapp")}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {copiedType === "whatsapp" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3.5 h-3.5" />
                          <span>Copiar WhatsApp</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-semibold transition-colors cursor-pointer"
                      title="Abrir chat de WhatsApp Web con el texto pre-cargado"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Abrir WhatsApp</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={whatsappBody}
                  onChange={(e) => setWhatsappBody(e.target.value)}
                  className="w-full bg-[#060912] border border-white/5 focus:border-emerald-500/50 rounded-xl p-3 text-xs text-slate-200 outline-none leading-relaxed font-mono resize-y"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#101726]/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
