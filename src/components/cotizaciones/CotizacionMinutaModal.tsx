"use client";

import React, { useState } from "react";
import { X, Printer, Copy, Check, Trophy, Building2, FileText, Calendar, DollarSign, ShieldCheck } from "lucide-react";

interface MinutaItem {
  id: string;
  name: string;
  baseUnit: string;
  targetQuantity: number;
}

interface MinutaProvider {
  id: string;
  name: string;
  totalBC: number;
  itemsQuoted: number;
  deliveryTime?: string;
  paymentTerms?: string;
  validityPeriod?: string;
}

interface CotizacionMinutaModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteName: string;
  categoria?: string;
  notes?: string;
  exchangeRate: number;
  baseCurrency: "ARS" | "USD";
  items: MinutaItem[];
  providers: MinutaProvider[];
  winningProviderId?: string;
  cheapestProviderId?: string | null;
  aiSummary?: string;
}

export function CotizacionMinutaModal({
  isOpen,
  onClose,
  quoteName,
  categoria,
  notes,
  exchangeRate,
  baseCurrency,
  items,
  providers,
  winningProviderId,
  cheapestProviderId,
  aiSummary,
}: CotizacionMinutaModalProps) {
  const [copied, setCopied] = useState(false);
  const [justificacion, setJustificacion] = useState(
    "Se recomienda la adjudicación a la oferta seleccionada por presentar la mejor relación técnico-económica, cumplimiento de plazos requeridos y condiciones comerciales alineadas con los estándares de Cinemark Hoyts."
  );

  if (!isOpen) return null;

  const sortedProviders = [...providers]
    .filter((p) => p.totalBC > 0)
    .sort((a, b) => a.totalBC - b.totalBC);

  const selectedWinnerId = winningProviderId || cheapestProviderId || sortedProviders[0]?.id;
  const winner = providers.find((p) => p.id === selectedWinnerId) || sortedProviders[0];
  const secondBest = sortedProviders.find((p) => p.id !== winner?.id);
  const avgTotal =
    sortedProviders.length > 0
      ? sortedProviders.reduce((acc, p) => acc + p.totalBC, 0) / sortedProviders.length
      : 0;

  const savingsVsSecond = secondBest && winner ? Math.max(0, secondBest.totalBC - winner.totalBC) : 0;
  const savingsVsAvg = avgTotal > 0 && winner ? Math.max(0, avgTotal - winner.totalBC) : 0;
  const savingsVsAvgPct = avgTotal > 0 && winner ? Math.round((savingsVsAvg / avgTotal) * 100) : 0;

  const formatMoney = (val: number) => {
    if (baseCurrency === "ARS") {
      return "$" + val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return "USD " + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCopyMinuta = () => {
    const lines = [
      `ACTA / MINUTA DE ADJUDICACIÓN DE COMPRA - CINEMARK HOYTS`,
      `========================================================`,
      `Fecha: ${new Date().toLocaleDateString("es-AR")}`,
      `Referencia / Pliego: ${quoteName}`,
      `Rubro / Área: ${categoria || "General"}`,
      `Moneda de Comparación: ${baseCurrency} (TC BNA: $${exchangeRate.toLocaleString("es-AR")})`,
      ``,
      `1. PROVEEDOR ADJUDICADO / RECOMENDADO:`,
      `   Empresa: ${winner ? winner.name : "Sin definir"}`,
      `   Monto Total Adjudicado: ${winner ? formatMoney(winner.totalBC) : "-"}`,
      `   Plazo de Entrega: ${winner?.deliveryTime || "Según pliego"}`,
      `   Condición de Pago: ${winner?.paymentTerms || "Cuenta corriente corporativa"}`,
      `   Ahorro vs Promedio de Mercado: ${formatMoney(savingsVsAvg)} (${savingsVsAvgPct}%)`,
      savingsVsSecond > 0 ? `   Ahorro vs 2da Oferta (${secondBest?.name}): ${formatMoney(savingsVsSecond)}` : ``,
      ``,
      `2. CUADRO DE OFERTAS EVALUADAS:`,
      ...sortedProviders.map(
        (p, idx) =>
          `   #${idx + 1} ${p.name}: ${formatMoney(p.totalBC)} (${p.itemsQuoted} ítems) ${
            p.id === winner?.id ? "[ADJUDICADO]" : ""
          }`
      ),
      ``,
      `3. ÍTEMS COMPRENDIDOS (${items.length}):`,
      ...items.map((it) => `   - ${it.name || "Ítem"}: ${it.targetQuantity} ${it.baseUnit}`),
      ``,
      `4. JUSTIFICACIÓN TÉCNICA Y ECONÓMICA:`,
      `   ${justificacion}`,
      notes ? `\n   Notas adicionales: ${notes}` : ``,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0b101e] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#080c17] border-b border-white/10 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Minuta Ejecutiva de Adjudicación</h3>
              <p className="text-[11px] text-slate-400">Documento formal de respaldo para Gerencia y Auditoría</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMinuta}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copiado" : "Copiar Texto"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-200 flex-1">
          {/* Corporate Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#11192e] to-[#0d1324] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                <Building2 className="w-3.5 h-3.5" />
                <span>Cinemark Hoyts Argentina • Compras & Finanzas</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">{quoteName}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Fecha: {new Date().toLocaleDateString("es-AR")}
                </span>
                <span>•</span>
                <span>Rubro: <strong className="text-slate-200">{categoria || "General"}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  TC Ref: ${exchangeRate.toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Dictamen Técnico
              </span>
              <span className="text-xs font-black text-white flex items-center gap-1 justify-end">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Adjudicación Directa
              </span>
            </div>
          </div>

          {/* Winner Highlight Box */}
          {winner && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0e192d] to-[#0b1220] border border-emerald-500/35 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Proveedor Adjudicado
                    </span>
                    <h4 className="text-base font-black text-white">{winner.name}</h4>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Monto Total Final</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {formatMoney(winner.totalBC)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10 text-xs">
                <div className="p-2.5 rounded-xl bg-black/25 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Plazo de Entrega</span>
                  <span className="font-bold text-white">{winner.deliveryTime || "Inmediato / s/pliego"}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/25 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Condición de Pago</span>
                  <span className="font-bold text-white">{winner.paymentTerms || "Cta. Cte. Corporativa"}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/25 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Ahorro vs Promedio</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {savingsVsAvg > 0 ? `${formatMoney(savingsVsAvg)} (${savingsVsAvgPct}%)` : "Precio Base"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/25 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Ahorro vs 2° Oferta</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {savingsVsSecond > 0 ? formatMoney(savingsVsSecond) : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ranking Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Cuadro Comparativo de Ofertas Evaluadas
            </h4>
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#080c17]">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Pos.</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Entrega / Pago</th>
                    <th className="py-2.5 px-3 text-right">Monto Total ({baseCurrency})</th>
                    <th className="py-2.5 px-3 text-right">Dif. vs Ganador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedProviders.map((p, idx) => {
                    const isWin = p.id === winner?.id;
                    const diff = winner && winner.totalBC > 0 ? ((p.totalBC - winner.totalBC) / winner.totalBC) * 100 : 0;
                    return (
                      <tr key={p.id} className={isWin ? "bg-emerald-500/10 font-semibold text-white" : "text-slate-300"}>
                        <td className="py-2.5 px-3 font-mono">#{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <span>{p.name}</span>
                          {isWin && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase">
                              Adjudicado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">
                          {[p.deliveryTime, p.paymentTerms].filter(Boolean).join(" • ") || "Estándar"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatMoney(p.totalBC)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                          {isWin ? (
                            <span className="text-emerald-400 font-bold">Base (0%)</span>
                          ) : (
                            <span className="text-rose-300">+{diff.toFixed(1)}%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Justification editable text */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Justificación de Adjudicación / Observaciones de Auditoría
            </label>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl bg-[#080c17] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 leading-relaxed"
            />
            {aiSummary && (
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/25 text-[11px] text-indigo-200 space-y-1">
                <span className="font-bold text-indigo-300 block uppercase text-[10px]">Dictamen IA Adjunto:</span>
                <p className="line-clamp-4 whitespace-pre-line">{aiSummary.replace(/```markdown|```|#+\s*/g, "").trim()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
