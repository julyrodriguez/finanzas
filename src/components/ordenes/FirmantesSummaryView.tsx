"use client";

import React, { useState, useMemo } from "react";
import { 
  Copy, 
  Check, 
  UserCheck, 
  AlertCircle, 
  Send, 
  Clock, 
  Eye, 
  Search, 
  X, 
  Building2, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2
} from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";
import { ApprovalConfig, parseMontoToNumber } from "@/lib/approvalConfig";

interface FirmantesSummaryViewProps {
  ordenes: OrdenCompra[];
  config: ApprovalConfig;
  onSelectOrden: (orden: OrdenCompra) => void;
  showToast: (msg: string) => void;
  onOpenBatchSend?: () => void;
}

interface SignerGroup {
  name: string;
  orders: OrdenCompra[];
  totalMonto: number;
}

interface UnsentOrderInfo {
  order: OrdenCompra;
  stage: "1ra Firma" | "2da Firma";
  neededSigner: string;
}

export function FirmantesSummaryView({
  ordenes,
  config,
  onSelectOrden,
  showToast,
  onOpenBatchSend,
}: FirmantesSummaryViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Grouping logic
  const { signerGroups, unsentItems, totalSentPendingOrders, totalSentPendingMonto, totalUnsentMonto } = useMemo(() => {
    const groupsMap = new Map<string, OrdenCompra[]>();
    const unsentList: UnsentOrderInfo[] = [];

    const limite1 = config?.limiteNivel1 || 5000000;
    const limite2 = config?.limiteNivel2 || 18000000;
    const limite3 = config?.limiteNivel3 || 150000000;

    for (const ord of ordenes) {
      if (ord.liberada || ord.entregada || ord.cancelada) continue;

      const numMonto = parseMontoToNumber(ord.monto);
      let f1Label = "Tomás";
      let f2Label = "Área";

      if (numMonto <= limite1) {
        f1Label = "Tomás";
        f2Label = "Área";
      } else if (numMonto <= limite2) {
        f1Label = "Pablo Mondelo";
        f2Label = "Darío";
      } else if (numMonto <= limite3) {
        f1Label = "Matías / Hernán";
        f2Label = "Darío";
      } else {
        f1Label = "Darío / Hernán";
        f2Label = "Martín";
      }

      const isTier1 = numMonto <= limite1;
      const isF1Signed = Boolean(ord.firmante1?.trim() || ord.liberada || (isTier1 && (ord.mandada || ord.firmado1)));
      const isF2Signed = Boolean(ord.firmante2?.trim() || ord.liberada || ord.firmado2);

      // Si ambas están firmadas, ya no espera firma
      if (isF1Signed && isF2Signed) {
        continue;
      }

      if (!isF1Signed) {
        // Falta 1ra firma
        const targetRecipient = ord.enviadoA1?.trim() || (ord.enviado ? f1Label : null);
        if (targetRecipient) {
          const current = groupsMap.get(targetRecipient) || [];
          current.push(ord);
          groupsMap.set(targetRecipient, current);
        } else {
          unsentList.push({
            order: ord,
            stage: "1ra Firma",
            neededSigner: f1Label,
          });
        }
      } else if (!isF2Signed) {
        // 1ra firmada, falta 2da firma
        const targetRecipient = ord.enviadoA2?.trim();
        if (targetRecipient) {
          const current = groupsMap.get(targetRecipient) || [];
          current.push(ord);
          groupsMap.set(targetRecipient, current);
        } else {
          unsentList.push({
            order: ord,
            stage: "2da Firma",
            neededSigner: f2Label,
          });
        }
      }
    }

    // Convert map to array sorted by order count descending
    const groups: SignerGroup[] = Array.from(groupsMap.entries()).map(([name, orders]) => {
      // Sort orders by numOC descending or date
      orders.sort((a, b) => Number(b.numOC) - Number(a.numOC));
      const totalMonto = orders.reduce((acc, o) => acc + parseMontoToNumber(o.monto), 0);
      return { name, orders, totalMonto };
    }).sort((a, b) => b.orders.length - a.orders.length);

    unsentList.sort((a, b) => Number(b.order.numOC) - Number(a.order.numOC));

    const totalSentPendingOrders = groups.reduce((acc, g) => acc + g.orders.length, 0);
    const totalSentPendingMonto = groups.reduce((acc, g) => acc + g.totalMonto, 0);
    const totalUnsentMonto = unsentList.reduce((acc, u) => acc + parseMontoToNumber(u.order.monto), 0);

    return {
      signerGroups: groups,
      unsentItems: unsentList,
      totalSentPendingOrders,
      totalSentPendingMonto,
      totalUnsentMonto,
    };
  }, [ordenes, config]);

  // Copy formatting function as requested:
  // "ejemplo Pablo: ( espacio para abajo) OC xxxxxx monto xxxxx y asi para abajo con cada uno"
  const generateSignerCopyText = (name: string, orders: OrdenCompra[]) => {
    const lines = orders.map((ord) => {
      const numMonto = parseMontoToNumber(ord.monto);
      return `OC ${ord.numOC} monto $ ${numMonto.toLocaleString("es-AR")}`;
    });
    return `${name}:\n${lines.join("\n")}`;
  };

  const handleCopySigner = (name: string, orders: OrdenCompra[]) => {
    const text = generateSignerCopyText(name, orders);
    navigator.clipboard.writeText(text);
    setCopiedKey(name);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`¡Copiado listado de ${name}!`);
  };

  const handleCopyUnsent = () => {
    const lines = unsentItems.map((item) => {
      const numMonto = parseMontoToNumber(item.order.monto);
      return `OC ${item.order.numOC} monto $ ${numMonto.toLocaleString("es-AR")}`;
    });
    const text = `Sin Enviar:\n${lines.join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedKey("sin_enviar");
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`¡Copiado listado de órdenes sin enviar!`);
  };

  const handleCopyAll = () => {
    const sections: string[] = [];

    for (const group of signerGroups) {
      sections.push(generateSignerCopyText(group.name, group.orders));
    }

    if (unsentItems.length > 0) {
      const unsentLines = unsentItems.map((item) => {
        const numMonto = parseMontoToNumber(item.order.monto);
        return `OC ${item.order.numOC} monto $ ${numMonto.toLocaleString("es-AR")}`;
      });
      sections.push(`Sin Enviar:\n${unsentLines.join("\n")}`);
    }

    const fullText = sections.join("\n\n");
    navigator.clipboard.writeText(fullText);
    setCopiedKey("all");
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`¡Copiado reporte completo al portapapeles!`);
  };

  // Filter groups and unsent items by search query if present
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return signerGroups;
    const q = searchQuery.toLowerCase().trim();

    return signerGroups
      .map((g) => {
        if (g.name.toLowerCase().includes(q)) {
          return g;
        }
        const matchingOrders = g.orders.filter(
          (o) =>
            o.numOC.toLowerCase().includes(q) ||
            o.razonSocial.toLowerCase().includes(q) ||
            o.motivo.toLowerCase().includes(q)
        );
        if (matchingOrders.length > 0) {
          return {
            ...g,
            orders: matchingOrders,
            totalMonto: matchingOrders.reduce((acc, o) => acc + parseMontoToNumber(o.monto), 0),
          };
        }
        return null;
      })
      .filter((g): g is SignerGroup => g !== null);
  }, [signerGroups, searchQuery]);

  const filteredUnsentItems = useMemo(() => {
    if (!searchQuery.trim()) return unsentItems;
    const q = searchQuery.toLowerCase().trim();

    return unsentItems.filter(
      (u) =>
        u.order.numOC.toLowerCase().includes(q) ||
        u.order.razonSocial.toLowerCase().includes(q) ||
        u.order.motivo.toLowerCase().includes(q) ||
        u.neededSigner.toLowerCase().includes(q) ||
        "sin enviar".includes(q)
    );
  }, [unsentItems, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ========================================================
          1. HEADER BANNER & SUMMARY KPI BAR
          ======================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0f1422] border border-white/10 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Seguimiento por Firmante</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                {signerGroups.length} {signerGroups.length === 1 ? "firmante activo" : "firmantes activos"}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Órdenes enviadas agrupadas por destinatario que tiene la firma pendiente, más lote de órdenes aún sin enviar.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {(signerGroups.length > 0 || unsentItems.length > 0) && (
              <button
                onClick={handleCopyAll}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-900/30 flex items-center gap-2 cursor-pointer border border-emerald-400/30"
                title="Copiar el reporte completo de todos los firmantes y órdenes sin enviar"
              >
                {copiedKey === "all" ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <Copy className="w-4 h-4 text-emerald-200" />
                )}
                <span>Copiar Todo el Reporte</span>
              </button>
            )}

            {onOpenBatchSend && (
              <button
                onClick={onOpenBatchSend}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all border border-slate-700 flex items-center gap-2 cursor-pointer"
                title="Marcar lote como enviado a firmar"
              >
                <Send className="w-3.5 h-3.5 text-blue-400" />
                <span>Despachar Lote</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Mini-Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5">
          <div className="p-3 rounded-xl bg-[#0a0e18] border border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Firmantes con Pendientes</span>
            <div className="text-lg font-black text-indigo-400 font-mono mt-0.5">{signerGroups.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0a0e18] border border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enviadas Esperando Firma</span>
            <div className="text-lg font-black text-blue-400 font-mono mt-0.5">{totalSentPendingOrders}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">$ {totalSentPendingMonto.toLocaleString("es-AR")}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0a0e18] border border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Órdenes Sin Enviar</span>
            <div className="text-lg font-black text-amber-400 font-mono mt-0.5">{unsentItems.length}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">$ {totalUnsentMonto.toLocaleString("es-AR")}</div>
          </div>
          <div className="p-3 rounded-xl bg-[#0a0e18] border border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total en Proceso</span>
            <div className="text-lg font-black text-white font-mono mt-0.5">{totalSentPendingOrders + unsentItems.length}</div>
            <div className="text-[10px] text-emerald-400 font-mono truncate">$ {(totalSentPendingMonto + totalUnsentMonto).toLocaleString("es-AR")}</div>
          </div>
        </div>

        {/* Quick Search inside sub-apartado */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nombre de firmante, OC o proveedor..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#0a0e18] border border-white/10 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          2. CARDS GRID: FIRMANTES CON ENVIADAS + CARD SIN ENVIAR
          ======================================================== */}
      {filteredGroups.length === 0 && filteredUnsentItems.length === 0 ? (
        <div className="p-16 text-center bg-[#0f1422] rounded-2xl border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 stroke-[2]" />
          </div>
          <h4 className="text-base font-bold text-white">¡No hay firmas pendientes ni órdenes sin enviar!</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Todas las órdenes han sido completadas o no coinciden con la búsqueda realizada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card: Sin Enviar (Prominently placed or in grid) */}
          {filteredUnsentItems.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-b from-[#161311] to-[#0f121b] border border-amber-500/30 shadow-xl overflow-hidden flex flex-col">
              {/* Card Header */}
              <div className="p-4 sm:p-5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-amber-300 tracking-tight">
                        Sin Enviar
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40 font-mono">
                        {filteredUnsentItems.length} {filteredUnsentItems.length === 1 ? "para enviar" : "para enviar"}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-300/80 font-medium">
                      Tiene {filteredUnsentItems.length} {filteredUnsentItems.length === 1 ? "orden pendiente de envío" : "órdenes pendientes de envío a firmar"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyUnsent}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    title="Copiar lista de órdenes sin enviar"
                  >
                    {copiedKey === "sin_enviar" ? (
                      <Check className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>{copiedKey === "sin_enviar" ? "Copiado!" : "Copiar"}</span>
                  </button>

                  <button
                    onClick={() => toggleCollapse("sin_enviar")}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={collapsedCards["sin_enviar"] ? "Expandir" : "Colapsar"}
                  >
                    {collapsedCards["sin_enviar"] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Amount Bar */}
              <div className="px-4 py-2 bg-amber-950/20 border-b border-amber-500/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Total a despachar:</span>
                <span className="font-mono font-bold text-amber-300">
                  $ {filteredUnsentItems.reduce((acc, u) => acc + parseMontoToNumber(u.order.monto), 0).toLocaleString("es-AR")}
                </span>
              </div>

              {/* Order List */}
              {!collapsedCards["sin_enviar"] && (
                <div className="p-3 space-y-2 max-h-[380px] overflow-y-auto divide-y divide-white/5 flex-1">
                  {filteredUnsentItems.map(({ order, stage, neededSigner }) => {
                    const numMonto = parseMontoToNumber(order.monto);
                    return (
                      <div
                        key={order.id || order.numOC}
                        className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02] p-2 rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                            order.empresa === "Hoyts"
                              ? "bg-purple-950/60 text-purple-300 border-purple-800/60"
                              : "bg-teal-950/60 text-teal-300 border-teal-800/60"
                          }`}>
                            {order.empresa}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">OC {order.numOC}</span>
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded font-semibold">
                                {stage}: {neededSigner}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={order.razonSocial}>
                              {order.razonSocial || "Sin proveedor"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono font-bold text-emerald-400">
                            $ {numMonto.toLocaleString("es-AR")}
                          </span>
                          <button
                            onClick={() => onSelectOrden(order)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-white/5 transition-all cursor-pointer"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Individual Cards for each Signer with sent orders */}
          {filteredGroups.map((group) => {
            const isCopied = copiedKey === group.name;
            const isCollapsed = collapsedCards[group.name];

            return (
              <div
                key={group.name}
                className="rounded-2xl bg-[#0f1422] border border-white/10 hover:border-white/20 shadow-xl overflow-hidden flex flex-col transition-all"
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-[#12192c] to-[#0f1422] border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner shrink-0 font-black text-sm uppercase">
                      {group.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-white tracking-tight">
                          {group.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono">
                          {group.orders.length} para firmar
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Tiene {group.orders.length} {group.orders.length === 1 ? "orden enviada para firmar" : "órdenes enviadas para firmar"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySigner(group.name, group.orders)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                      title={`Copiar lista de órdenes pendientes de ${group.name}`}
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span>{isCopied ? "Copiado!" : "Copiar"}</span>
                    </button>

                    <button
                      onClick={() => toggleCollapse(group.name)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={isCollapsed ? "Expandir" : "Colapsar"}
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Amount Bar */}
                <div className="px-4 py-2 bg-[#0b0f19]/60 border-b border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Total pendiente:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    $ {group.totalMonto.toLocaleString("es-AR")}
                  </span>
                </div>

                {/* Order List */}
                {!isCollapsed && (
                  <div className="p-3 space-y-2 max-h-[380px] overflow-y-auto divide-y divide-white/5 flex-1">
                    {group.orders.map((ord) => {
                      const numMonto = parseMontoToNumber(ord.monto);
                      return (
                        <div
                          key={ord.id || ord.numOC}
                          className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02] p-2 rounded-xl transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              ord.empresa === "Hoyts"
                                ? "bg-purple-950/60 text-purple-300 border-purple-800/60"
                                : "bg-teal-950/60 text-teal-300 border-teal-800/60"
                            }`}>
                              {ord.empresa}
                            </span>

                            <div>
                              <div className="font-mono font-bold text-white">OC {ord.numOC}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={ord.razonSocial}>
                                {ord.razonSocial || "Sin proveedor"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-mono font-bold text-emerald-400">
                              $ {numMonto.toLocaleString("es-AR")}
                            </span>
                            <button
                              onClick={() => onSelectOrden(ord)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-white/5 transition-all cursor-pointer"
                              title="Ver detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}
