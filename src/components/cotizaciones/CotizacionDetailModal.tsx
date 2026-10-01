"use client";

import React from "react";
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
  Edit3
} from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface CotizacionDetailModalProps {
  quote: any | null;
  onClose: () => void;
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

      const qty = Number(item.targetQuantity || 1);
      const discount = Number(q.discount || 0);
      const discountedPrice = rawPrice * (1 - discount / 100);

      let cost = 0;
      if (q.presentationType === "package" && q.unitsPerPresentation > 0) {
        const pkgs = Math.ceil(qty / q.unitsPerPresentation);
        cost = pkgs * discountedPrice;
      } else if (q.presentationType === "package" && q.unitsPerPresentation) {
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

export function CotizacionDetailModal({ quote, onClose }: CotizacionDetailModalProps) {
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

  if (!quote) return null;

  const items = Array.isArray(quote.items) ? quote.items : [];
  const providers = Array.isArray(quote.providers) ? quote.providers : [];
  const attachments = Array.isArray(quote.attachments) ? quote.attachments : [];
  const isFinalizada = quote.status === "finalizada";
  const winningId = quote.winningProviderId;
  const winningProv = providers.find((p: any) => p.id === winningId);
  const quoteId = quote.id || quote.firebaseId || quote._id;
  const editUrl = quoteId ? `/cotizaciones?id=${quoteId}` : "/cotizaciones";

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

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="relative w-full max-w-4xl max-h-[88vh] bg-[#0c111e]/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#090d18]/80">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-mono text-[10px] font-bold uppercase">
                    Cotización
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    quote.status === "finalizada"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : quote.status === "enviada"
                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  }`}>
                    {quote.status || "Borrador"}
                  </span>
                  {quote.categoria && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      • {quote.categoria}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate mt-0.5">
                  {quote.name || "Cotización sin título"}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={editUrl}
                onClick={onClose}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white text-xs font-bold transition-all shadow-sm group"
                title="Ir al editor de esta cotización"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                <span>Ir a edición</span>
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-h-[65vh] scrollbar-thin">
            {/* Notes if any */}
            {quote.notes && (
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Notas:</span>
                {quote.notes}
              </div>
            )}

            {/* Winner banner if finalized */}
            {isFinalizada && winningProv && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">
                    Proveedor Ganador / Adjudicado
                  </span>
                  <h4 className="text-sm font-bold text-white">{winningProv.name}</h4>
                </div>
              </div>
            )}

            {/* Providers Summary Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Proveedores Presupuestados ({providers.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {providers.map((prov: any) => {
                  const isWinner = isFinalizada && prov.id === winningId;
                  const totals = getProviderTotals(prov, items);

                  return (
                    <div
                      key={prov.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isWinner
                          ? "bg-emerald-500/10 border-emerald-500/30 shadow-sm shadow-emerald-950/20"
                          : "bg-[#090d18] border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-white truncate" title={prov.name}>
                          {prov.name}
                        </span>
                        {isWinner && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            Ganador
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
                            <span className="font-mono text-[11px] text-slate-500">
                              S/C
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{totals.count || Object.keys(prov.quotes || {}).length} cotizados</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ítems / Insumos Solicitados ({items.length})</span>
              </h4>

              <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#080d1a]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Ítem / Insumo</th>
                      <th className="py-2.5 px-3 text-center">Unidad</th>
                      <th className="py-2.5 px-3 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {items.map((it: any, idx: number) => (
                      <tr key={it.id || idx} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-semibold text-white">{it.name}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{it.baseUnit || "U"}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                          {it.targetQuantity || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
            <span className="text-[11px] text-slate-500">
              Visualización directa de cotización
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={editUrl}
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 group"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ir a edición</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
