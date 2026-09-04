"use client";

import { useEffect, useState } from "react";
import { DollarSign, RefreshCw, TrendingUp } from "lucide-react";

interface DolarData {
  venta: number;
  compra: number;
  horaActualizacionBNA?: string;
  fecha?: string;
}

export function DolarVentaBadge() {
  const [data, setData] = useState<DolarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDolar = async () => {
    try {
      let res = await fetch("https://apivacas.jariel.com.ar/api/bna/dolar", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        res = await fetch("https://apivacas.jariel.com.ar/bna/dolar");
      }
      if (res.ok) {
        const json = await res.json();
        if (json?.venta) {
          setData({
            venta: json.venta,
            compra: json.compra || 0,
            horaActualizacionBNA: json.horaActualizacionBNA || "",
            fecha: json.fecha || "",
          });
        }
      }
    } catch (err) {
      console.error("Error fetching dólar BNA:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDolar();
    const interval = setInterval(fetchDolar, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    fetchDolar();
  };

  if (loading && !data) {
    return (
      <div className="h-9 px-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center gap-2 animate-pulse">
        <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
        <span className="text-xs text-slate-400 font-mono">Cargando dólar...</span>
      </div>
    );
  }

  const ventaFormatted = (data?.venta ?? 1530).toLocaleString("es-AR");
  const tooltipText = `Dólar Banco Nación Oficial (Venta: $${ventaFormatted}${
    data?.compra ? ` | Compra: $${data.compra.toLocaleString("es-AR")}` : ""
  })${data?.horaActualizacionBNA ? `\nActualizado: ${data.horaActualizacionBNA}hs (${data.fecha})` : ""}`;

  return (
    <div
      title={tooltipText}
      className="relative px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-slate-900/90 via-[#0d1527] to-slate-900/90 border border-emerald-500/30 hover:border-emerald-400/50 shadow-sm shadow-emerald-500/10 flex items-center justify-between sm:justify-start gap-2.5 transition-all group select-none cursor-default"
    >
      {/* Live Glowing Dot */}
      <div className="flex items-center gap-2">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>

        {/* Currency Icon & Tag */}
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
            USD BNA VTA
          </span>
          <span className="text-[9px] text-emerald-500/90 font-medium leading-none mt-0.5">
            Oficial
          </span>
        </div>
      </div>

      {/* Main Value Display */}
      <div className="flex items-center gap-1.5 pl-1 border-l border-white/10">
        <span className="font-mono text-sm font-black text-emerald-400 tracking-tight">
          ${ventaFormatted}
        </span>
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
      </div>

      {/* Quick Refresh Icon */}
      <button
        onClick={handleManualRefresh}
        title="Actualizar cotización"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white cursor-pointer"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
      </button>
    </div>
  );
}
