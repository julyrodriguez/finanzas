"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Scale, 
  Building2, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  FileText, 
  Paperclip, 
  ExternalLink,
  Award,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Mail,
  Edit3,
  User,
  Folder,
  Check,
  Clipboard,
  Trophy,
  Clock,
  CreditCard,
  Lock,
  Sparkles
} from "lucide-react";
import { formatCreatorName, DEFAULT_TEAM_MEMBERS } from "@/lib/cotizacionesUtils";
import { syncCotizacionToMongo } from "@/lib/serverSync";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface CotizacionDetailModalProps {
  quote: any | null;
  onClose: () => void;
  readOnly?: boolean;
}

function calculateItemQuote(q: any, qty: number, defaultCurrency = "ARS") {
  if (!q) return { hasQuote: false, unitPrice: 0, totalPrice: 0, currency: defaultCurrency, rawPrice: 0 };
  const rawPrice = typeof q === "number" ? q : Number(q.price ?? q.cost ?? q.precio ?? 0);
  if (rawPrice <= 0) return { hasQuote: false, unitPrice: 0, totalPrice: 0, currency: defaultCurrency, rawPrice: 0 };

  const discount = Number(q.discount || 0);
  const discountedPrice = discount > 0 ? rawPrice * (1 - discount / 100) : rawPrice;
  const currency = String(q.currency || defaultCurrency).toUpperCase();

  let total = 0;
  if (q.presentationType === "package" && Number(q.unitsPerPresentation) > 0) {
    total = (qty / Number(q.unitsPerPresentation)) * discountedPrice;
  } else {
    total = qty * discountedPrice;
  }

  return {
    hasQuote: true,
    unitPrice: discountedPrice,
    rawPrice,
    totalPrice: total,
    currency,
    discount,
    presentationType: q.presentationType,
    presentationName: q.presentationName,
    unitsPerPresentation: q.unitsPerPresentation,
    specification: q.specification,
  };
}

function getProviderTotals(prov: any, items: any[]): { ars: number; usd: number; count: number } {
  let sumARS = Number(prov?.totalARS || prov?.total_ars || 0);
  let sumUSD = Number(prov?.totalUSD || prov?.total_usd || 0);
  let count = 0;

  if (prov?.quotes && typeof prov.quotes === "object") {
    let calcARS = 0;
    let calcUSD = 0;
    let calcCount = 0;

    items.forEach((item) => {
      const q = prov.quotes[item.id];
      if (!q) return;

      const rawPrice = typeof q === "number" ? q : Number(q.price ?? q.cost ?? q.precio ?? 0);
      if (rawPrice <= 0) return;

      const discount = Number(q.discount || 0);
      const discountedPrice = discount > 0 ? rawPrice * (1 - discount / 100) : rawPrice;
      const qty = Number(item.targetQuantity ?? 1);

      let cost = 0;
      if (q.presentationType === "package" && Number(q.unitsPerPresentation) > 0) {
        cost = (qty / q.unitsPerPresentation) * discountedPrice;
      } else {
        cost = qty * discountedPrice;
      }

      const curr = String(q.currency || "ARS").toUpperCase();
      if (curr === "USD") {
        calcUSD += cost;
      } else {
        calcARS += cost;
      }
      calcCount++;
    });

    if (calcCount > 0) {
      sumARS = calcARS;
      sumUSD = calcUSD;
      count = calcCount;
    }
  }

  // Fallback if prov.total exists
  if (sumARS === 0 && sumUSD === 0 && prov?.total) {
    sumARS = Number(prov.total);
  }

  return { ars: sumARS, usd: sumUSD, count };
}

export function CotizacionDetailModal({ quote, onClose, readOnly = false }: CotizacionDetailModalProps) {
  React.useEffect(() => {
    if (!quote) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quote, onClose]);

  const [currentCreator, setCurrentCreator] = useState(quote?.createdBy || "");
  const [isEditingCreator, setIsEditingCreator] = useState(false);
  const [creatorInput, setCreatorInput] = useState(quote?.createdBy || "");
  const [copiedTable, setCopiedTable] = useState(false);

  React.useEffect(() => {
    setCurrentCreator(quote?.createdBy || "");
    setCreatorInput(quote?.createdBy || "");
  }, [quote]);

  if (!quote) return null;

  const items = Array.isArray(quote.items) ? quote.items : [];
  const providers = Array.isArray(quote.providers) ? quote.providers : [];
  const attachments = Array.isArray(quote.attachments) ? quote.attachments : [];
  const isFinalizada = quote.status === "finalizada" || Boolean(quote.isFinalized);
  const winningId = quote.winningProviderId;
  const winningProv = providers.find((p: any) => p.id === winningId);
  const quoteId = quote.id || quote.firebaseId || quote._id;
  const editUrl = quoteId ? `/cotizaciones?id=${quoteId}` : "/cotizaciones";

  // Identificar el proveedor más barato por cada ítem
  const cheapestProvPerItem = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((item: any) => {
      let minCost = Infinity;
      let minProvId = "";
      providers.forEach((prov: any) => {
        const calc = calculateItemQuote(prov.quotes?.[item.id], Number(item.targetQuantity || 1));
        if (calc.hasQuote && calc.totalPrice > 0 && calc.totalPrice < minCost) {
          minCost = calc.totalPrice;
          minProvId = prov.id;
        }
      });
      if (minProvId) {
        map[item.id] = minProvId;
      }
    });
    return map;
  }, [items, providers]);

  // Guardar creador de cotización (si no es solo lectura)
  const handleSaveCreatorModal = async (newVal: string) => {
    const clean = newVal.trim();
    setCurrentCreator(clean);
    setIsEditingCreator(false);
    if (quote) {
      quote.createdBy = clean;
    }
    const qId = quote?.id || quote?.firebaseId || quote?._id;
    if (qId) {
      try {
        await syncCotizacionToMongo({ id: qId, createdBy: clean });
        const db = getFirebaseDb();
        if (db && !String(qId).startsWith("local-")) {
          await setDoc(
            doc(db, "cotizaciones", qId),
            { createdBy: clean, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn("Error guardando creador:", err);
      }
    }
  };

  // Copiar Matriz Comparativa (TSV para Excel/Sheets y HTML formateado)
  const handleCopyTable = () => {
    try {
      if (providers.length === 0 || items.length === 0) return;

      let tsv = "";
      let html = `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1;">`;

      // Row 1: Headers
      const row1 = ["Ítem / Insumo", "Cantidad"];
      providers.forEach((prov: any) => {
        row1.push(prov.name, "");
      });
      tsv += row1.join("\t") + "\n";

      html += `<tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">`;
      html += `<th style="border: 1px solid #334155; padding: 10px; text-align: left; background-color: #0f172a; color: #ffffff;" rowspan="2">Ítem / Insumo</th>`;
      html += `<th style="border: 1px solid #334155; padding: 10px; text-align: center; background-color: #0f172a; color: #ffffff;" rowspan="2">Cantidad</th>`;
      providers.forEach((prov: any) => {
        html += `<th style="border: 1px solid #334155; padding: 10px; text-align: center; background-color: #0f172a; color: #ffffff;" colspan="2">${prov.name}</th>`;
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
      items.forEach((item: any, idx: number) => {
        const qty = Number(item.targetQuantity || 1);
        const unit = item.baseUnit || "U";
        const bgRow = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const row = [item.name || "Ítem sin nombre", `${qty} ${unit}`];

        html += `<tr style="background-color: ${bgRow};">`;
        html += `<td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #0f172a;">${item.name || "Ítem sin nombre"}</td>`;
        html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #475569;">${qty} ${unit}</td>`;

        providers.forEach((prov: any) => {
          const calc = calculateItemQuote(prov.quotes?.[item.id], qty);
          if (calc.hasQuote) {
            const currSymbol = calc.currency === "USD" ? "USD " : "$ ";
            const unitFormatted = `${currSymbol}${calc.unitPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const totalFormatted = `${currSymbol}${calc.totalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            row.push(unitFormatted, totalFormatted);

            const isBest = cheapestProvPerItem[item.id] === prov.id;
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #334155;">${unitFormatted}</td>`;
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${isBest ? "#059669" : "#0f172a"}; background-color: ${isBest ? "#ecfdf5" : "transparent"};">${totalFormatted}</td>`;
          } else {
            row.push("-", "-");
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #94a3b8;">-</td>`;
            html += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #94a3b8;">-</td>`;
          }
        });

        tsv += row.join("\t") + "\n";
        html += `</tr>`;
      });

      // Totals row
      const totalRow = ["TOTAL GENERAL", ""];
      html += `<tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; border-top: 2px solid #334155;">`;
      html += `<td style="border: 1px solid #334155; padding: 10px; font-weight: 900; background-color: #0f172a; color: #ffffff;" colspan="2">TOTAL GENERAL</td>`;

      providers.forEach((prov: any) => {
        const totals = getProviderTotals(prov, items);
        let textTot = "";
        if (totals.ars > 0) textTot += `$ ${totals.ars.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
        if (totals.usd > 0) textTot += `${textTot ? " / " : ""}USD ${totals.usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
        if (!textTot) textTot = "S/C";

        totalRow.push("", textTot);
        html += `<td style="border: 1px solid #334155; padding: 10px; text-align: center; font-weight: bold; color: #10b981; background-color: #0f172a;" colspan="2">${textTot}</td>`;
      });

      tsv += totalRow.join("\t") + "\n";
      html += `</tr></table>`;

      if (navigator.clipboard) {
        const blobHtml = new Blob([html], { type: "text/html" });
        const blobText = new Blob([tsv], { type: "text/plain" });
        const item = new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        });
        navigator.clipboard.write([item]).then(() => {
          setCopiedTable(true);
          setTimeout(() => setCopiedTable(false), 3000);
        }).catch(() => {
          navigator.clipboard.writeText(tsv).then(() => {
            setCopiedTable(true);
            setTimeout(() => setCopiedTable(false), 3000);
          });
        });
      }
    } catch (err) {
      console.error("Error al copiar tabla:", err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Window: más ancho (max-w-6xl) para albergar la Matriz Comparativa */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="relative w-full max-w-6xl max-h-[92vh] bg-[#0c111e]/98 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#090d18]/90">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                    Matriz Comparativa
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      isFinalizada
                        ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                        : quote.status === "enviada"
                        ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {quote.status || "Borrador"}
                  </span>
                  {quote.categoria ? (
                    <span className="text-[11px] font-semibold text-amber-300 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                      <Folder className="w-3 h-3 text-amber-400" />
                      {quote.categoria}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">• Sin área</span>
                  )}

                  {/* Creador */}
                  {readOnly ? (
                    <div className="text-[11px] text-slate-300 flex items-center gap-1 font-medium bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                      <User className="w-3 h-3 text-indigo-400" />
                      <span>
                        Por: <strong className="text-white">{formatCreatorName(currentCreator) || "Sin asignar"}</strong>
                      </span>
                    </div>
                  ) : isEditingCreator ? (
                    <div className="flex items-center gap-1.5 bg-[#080b15] px-2 py-0.5 rounded-lg border border-indigo-500/40 shadow-lg">
                      <User className="w-3 h-3 text-indigo-400 shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={creatorInput}
                        onChange={(e) => setCreatorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveCreatorModal(creatorInput);
                          } else if (e.key === "Escape") {
                            setIsEditingCreator(false);
                          }
                        }}
                        placeholder="Nombre de creador..."
                        className="bg-transparent text-[11px] font-semibold text-white outline-none w-28 sm:w-36"
                      />
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setCreatorInput(e.target.value);
                            handleSaveCreatorModal(e.target.value);
                          }
                        }}
                        className="bg-transparent text-slate-400 hover:text-white outline-none cursor-pointer text-xs w-4"
                        title="Elegir creador del equipo"
                      >
                        <option value="" disabled className="bg-[#0b0f19]">Elegir...</option>
                        {DEFAULT_TEAM_MEMBERS.map((m) => (
                          <option key={m} value={m} className="bg-[#0b0f19]">{m}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveCreatorModal(creatorInput)}
                        className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Guardar creador"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingCreator(false)}
                        className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCreatorInput(currentCreator);
                        setIsEditingCreator(true);
                      }}
                      className="text-[11px] text-slate-300 hover:text-indigo-300 flex items-center gap-1 font-medium bg-white/[0.04] hover:bg-white/[0.08] px-2 py-0.5 rounded-md border border-white/[0.06] hover:border-indigo-500/30 transition-colors cursor-pointer group/cread"
                      title="Clic para modificar el creador de esta cotización"
                    >
                      <User className="w-3 h-3 text-indigo-400" />
                      <span>
                        Por: <strong className="text-white group-hover/cread:text-indigo-200">{formatCreatorName(currentCreator) || "Asignar"}</strong>
                      </span>
                      <Edit3 className="w-2.5 h-2.5 opacity-40 group-hover/cread:opacity-100 transition-opacity ml-0.5" />
                    </button>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate mt-0.5">
                  {quote.name || "Cotización sin título"}
                </h3>
              </div>
            </div>

            {/* Acciones principales de cabecera */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Botón Copiar Tabla (para Excel / Google Sheets) */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyTable}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/40 cursor-pointer"
                title="Copiar matriz comparativa completa para pegar directamente en Excel o Sheets"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{copiedTable ? "¡Copiada!" : "Copiar Tabla"}</span>
              </motion.button>

              {!readOnly && (
                <Link
                  href={editUrl}
                  onClick={onClose}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition-all shadow-sm group"
                  title="Ir al editor de esta cotización"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                  <span>Ir a edición</span>
                </Link>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feedback temporal de copiado */}
          <AnimatePresence>
            {copiedTable && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-emerald-600/90 text-white text-xs font-bold px-4 py-2 flex items-center justify-between border-b border-emerald-400/30"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡Matriz comparativa copiada al portapapeles! Pegala en Excel, Google Sheets o WhatsApp.</span>
                </span>
                <span className="text-[10px] uppercase font-mono opacity-80">Formato TSV + HTML</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-h-[72vh] scrollbar-thin">
            {/* Winner spotlight banner if finalized */}
            {isFinalizada && winningProv && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/15 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-emerald-400 text-slate-950 flex items-center justify-center shadow-md">
                    <Trophy className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">
                      Proveedor Ganador / Adjudicado
                    </span>
                    <h4 className="text-base font-black text-white">{winningProv.name}</h4>
                  </div>
                </div>

                {(winningProv.deliveryTime || winningProv.paymentTerms) && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
                    {winningProv.deliveryTime && (
                      <span className="flex items-center gap-1 bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>Entrega: {winningProv.deliveryTime}</span>
                      </span>
                    )}
                    {winningProv.paymentTerms && (
                      <span className="flex items-center gap-1 bg-white/[0.05] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                        <CreditCard className="w-3 h-3 text-indigo-400" />
                        <span>Pago: {winningProv.paymentTerms}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Providers Summary Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Resumen de Proveedores ({providers.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCopyTable}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Copiar tabla</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {providers.map((prov: any) => {
                  const isWinner = isFinalizada && prov.id === winningId;
                  const totals = getProviderTotals(prov, items);

                  return (
                    <div
                      key={prov.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isWinner
                          ? "bg-emerald-500/10 border-emerald-500/30 shadow-md shadow-emerald-950/20"
                          : "bg-[#090d18] border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-white truncate" title={prov.name}>
                          {prov.name}
                        </span>
                        {isWinner && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Ganador</span>
                          </span>
                        )}
                      </div>

                      {/* Total Price of each Provider */}
                      <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-baseline justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total:</span>
                        <div className="text-right flex items-center gap-1.5 flex-wrap justify-end">
                          {totals.ars > 0 && (
                            <span className="font-mono font-black text-xs text-emerald-400">
                              $ {totals.ars.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                          {totals.usd > 0 && (
                            <span className="font-mono font-black text-xs text-sky-400">
                              USD {totals.usd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                          {totals.ars === 0 && totals.usd === 0 && (
                            <span className="font-mono text-[11px] text-slate-500">S/C</span>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{totals.count || Object.keys(prov.quotes || {}).length} cotizados</span>
                        {prov.deliveryTime && (
                          <span className="truncate max-w-[90px]">{prov.deliveryTime}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================
                LA TABLA DE MATRIZ COMPARATIVA (Requisito del usuario)
                ============================================================ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>Matriz Comparativa Ítem por Ítem ({items.length} ítems)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCopyTable}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-indigo-300 hover:text-white border border-white/[0.08] text-xs font-bold transition-colors cursor-pointer"
                  title="Copiar tabla completa al portapapeles"
                >
                  <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Copiar Tabla</span>
                </button>
              </div>

              {items.length === 0 || providers.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400">
                  No hay ítems o proveedores presupuestados en esta cotización.
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#080d1a] shadow-xl">
                  <div className="overflow-x-auto max-h-[50vh] scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse">
                      {/* Cabecera pegajosa */}
                      <thead className="sticky top-0 bg-[#090e1c] z-20 border-b border-white/[0.08]">
                        <tr>
                          <th className="py-3 px-4 font-bold text-slate-200 sticky left-0 bg-[#090e1c] z-30 min-w-[220px] max-w-[340px]">
                            Ítem / Insumo
                          </th>
                          <th className="py-3 px-3 font-bold text-slate-400 text-center w-24">
                            Cantidad
                          </th>
                          {providers.map((prov: any) => {
                            const isWinner = isFinalizada && prov.id === winningId;
                            return (
                              <th
                                key={prov.id}
                                colSpan={2}
                                className={`py-2.5 px-3 text-center border-l border-white/[0.06] min-w-[190px] ${
                                  isWinner
                                    ? "bg-emerald-500/10 text-emerald-300"
                                    : "text-white"
                                }`}
                              >
                                <div className="font-bold text-xs truncate max-w-[170px] mx-auto">
                                  {prov.name}
                                </div>
                                {isWinner && (
                                  <span className="inline-block text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded mt-0.5">
                                    ★ Ganador
                                  </span>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-[#060a14]">
                          <th className="py-1 px-4 sticky left-0 bg-[#060a14] z-30 min-w-[220px] max-w-[340px]"></th>
                          <th className="py-1 px-3 text-center"></th>
                          {providers.map((prov: any) => (
                            <React.Fragment key={prov.id}>
                              <th className="py-1.5 px-2.5 text-center border-l border-white/[0.06]">
                                Unitario
                              </th>
                              <th className="py-1.5 px-2.5 text-center">
                                Total
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>

                      {/* Cuerpo de la tabla con precios */}
                      <tbody className="divide-y divide-white/[0.04]">
                        {items.map((item: any, idx: number) => {
                          const qty = Number(item.targetQuantity || 1);
                          const unit = item.baseUnit || "U";

                          return (
                            <tr key={item.id || idx} className="hover:bg-white/[0.02] transition-colors">
                              {/* Nombre de ítem */}
                              <td className="py-3 px-4 sticky left-0 bg-[#0c111e] z-10 min-w-[220px] max-w-[340px]">
                                <div className="font-semibold text-white text-xs leading-snug break-words">
                                  {item.name || "Ítem sin nombre"}
                                </div>
                                {item.description && (
                                  <div className="text-[10px] text-slate-400 italic line-clamp-2 mt-0.5">
                                    {item.description}
                                  </div>
                                )}
                              </td>

                              {/* Cantidad solicitada */}
                              <td className="py-3 px-3 text-center tabular-nums text-slate-400 font-mono">
                                {qty} {unit}
                              </td>

                              {/* Columnas por proveedor */}
                              {providers.map((prov: any) => {
                                const calc = calculateItemQuote(prov.quotes?.[item.id], qty);
                                const isBest = cheapestProvPerItem[item.id] === prov.id;

                                if (!calc.hasQuote) {
                                  return (
                                    <React.Fragment key={prov.id}>
                                      <td className="py-3 px-2.5 text-center text-slate-600 border-l border-white/[0.04] font-mono text-[11px]">
                                        -
                                      </td>
                                      <td className="py-3 px-2.5 text-center text-slate-600 font-mono text-[11px]">
                                        -
                                      </td>
                                    </React.Fragment>
                                  );
                                }

                                const currSymbol = calc.currency === "USD" ? "USD " : "$ ";

                                return (
                                  <React.Fragment key={prov.id}>
                                    {/* Precio unitario */}
                                    <td className="py-3 px-2.5 text-center font-mono text-slate-300 border-l border-white/[0.04]">
                                      <div>
                                        {currSymbol}
                                        {calc.unitPrice.toLocaleString("es-AR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </div>
                                      {calc.presentationType === "package" && (
                                        <div className="text-[9px] text-slate-500">
                                          {calc.presentationName || `x${calc.unitsPerPresentation}`}
                                        </div>
                                      )}
                                      {Number(calc.discount || 0) > 0 && (
                                        <div className="text-[9px] text-rose-400 font-bold">
                                          -{calc.discount}%
                                        </div>
                                      )}
                                    </td>

                                    {/* Precio total ítem */}
                                    <td
                                      className={`py-3 px-2.5 text-center font-mono font-bold tabular-nums ${
                                        isBest
                                          ? "bg-emerald-500/15 text-emerald-300"
                                          : "text-white"
                                      }`}
                                    >
                                      <div>
                                        {currSymbol}
                                        {calc.totalPrice.toLocaleString("es-AR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </div>
                                      {isBest && (
                                        <span className="inline-block text-[8px] font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded mt-0.5">
                                          ★ Mejor
                                        </span>
                                      )}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Pie pegajoso con totales */}
                      <tfoot className="sticky bottom-0 bg-[#090e1c] border-t-2 border-white/[0.1] font-bold z-20">
                        <tr>
                          <td className="py-3.5 px-4 sticky left-0 bg-[#090e1c] z-30 text-white font-black uppercase tracking-wider text-xs">
                            TOTAL GENERAL
                          </td>
                          <td className="py-3.5 px-3 text-center text-slate-500 font-mono text-xs">-</td>
                          {providers.map((prov: any) => {
                            const totals = getProviderTotals(prov, items);
                            const isWinner = isFinalizada && prov.id === winningId;

                            return (
                              <td
                                key={prov.id}
                                colSpan={2}
                                className={`py-3.5 px-3 text-center font-mono font-black text-xs border-l border-white/[0.06] ${
                                  isWinner ? "bg-emerald-500/20 text-emerald-300" : "text-white"
                                }`}
                              >
                                {totals.ars > 0 && (
                                  <div>
                                    $ {totals.ars.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                                {totals.usd > 0 && (
                                  <div className="text-sky-300">
                                    USD {totals.usd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                                {totals.ars === 0 && totals.usd === 0 && (
                                  <span className="text-slate-500 font-normal">S/C</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Notes if any */}
            {quote.notes && (
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Notas:</span>
                {quote.notes}
              </div>
            )}

            {/* Attachments if any */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-sky-400" />
                  <span>Archivos Adjuntos ({attachments.length})</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att: any, idx: number) => (
                    <a
                      key={att.id || idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-200 hover:text-white transition-colors group"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="truncate max-w-[180px]">{att.originalName || att.filename || "Archivo"}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/[0.08] bg-[#090d18] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleCopyTable}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold transition-colors cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{copiedTable ? "¡Copiada para Excel!" : "Copiar Matriz a Excel"}</span>
              </button>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                {readOnly ? "Modo de consulta (solo lectura)" : "Visualización y análisis"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!readOnly && (
                <Link
                  href={editUrl}
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 group"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ir a edición</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
