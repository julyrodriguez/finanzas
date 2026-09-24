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
            horaActualizacionBNA: json.horaActualizacion || json.horaActualizacionBNA || "",
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
      <div className="h-9 px-3 rounded-lg bg-slate-800/40 border border-slate-700/60 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
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
      className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/70 hover:border-slate-600 flex items-center justify-between sm:justify-start gap-2.5 transition-all select-none cursor-default shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
            USD BNA VTA
          </span>
          <span className="text-[9px] text-emerald-400 font-medium leading-none mt-0.5">
            Oficial
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
        <span className="font-mono text-xs font-bold text-emerald-400 tracking-tight">
          ${ventaFormatted}
        </span>
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
      </div>

      <button
        onClick={handleManualRefresh}
        title="Actualizar cotización"
        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
      </button>
    </div>
  );
}
