"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Clock } from "lucide-react";

interface CotizacionesData {
  dolarVenta: number;
  euroVenta: number;
  realVenta: number;
  horaActualizacion?: string;
  fecha?: string;
}

export function CotizacionesTicker({ isExpanded }: { isExpanded: boolean }) {
  const [data, setData] = useState<CotizacionesData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCotizaciones = async () => {
    try {
      // Primary endpoint
      let res = await fetch("https://apivacas.jariel.com.ar/api/bna/cotizaciones", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        // Fallback without /api/
        res = await fetch("https://apivacas.jariel.com.ar/bna/cotizaciones");
      }
      if (res.ok) {
        const json = await res.json();
        const dolar = json?.cotizaciones?.dolar?.venta ?? 1530;
        const euro = json?.cotizaciones?.euro?.venta ?? 1800;
        const real = json?.cotizaciones?.real?.ventaUnitaria ?? (json?.cotizaciones?.real?.venta ? json.cotizaciones.real.venta / 100 : 307);
        setData({
          dolarVenta: dolar,
          euroVenta: euro,
          realVenta: real,
          horaActualizacion: json?.horaActualizacion || json?.horaActualizacionBNA || "",
          fecha: json?.fecha || "",
        });
      }
    } catch (err) {
      console.error("Error fetching cotizaciones BNA:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCotizaciones();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchCotizaciones, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return isExpanded ? (
      <div className="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-center gap-2 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
        <span className="text-[10px] text-slate-400 font-mono">Cargando cotizaciones...</span>
      </div>
    ) : (
      <div className="flex justify-center p-2 rounded-xl bg-slate-900/40 border border-white/5">
        <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-ping" />
      </div>
    );
  }

  const items = [
    { symbol: "USD", name: "Dólar", val: data?.dolarVenta ?? 1530 },
    { symbol: "EUR", name: "Euro", val: data?.euroVenta ?? 1800 },
    { symbol: "BRL", name: "Real", val: data?.realVenta ?? 307 },
  ];

  // Repeat items 3 times for a seamless, continuous infinite ticker loop
  const tickerItems = [...items, ...items, ...items, ...items];

  const tooltipText = `Cotizaciones BNA Oficial (Venta)\nUSD: $${items[0].val.toLocaleString("es-AR")} | EUR: $${items[1].val.toLocaleString("es-AR")} | BRL: $${items[2].val.toLocaleString("es-AR")}${
    data?.horaActualizacion ? `\nActualizado: ${data.horaActualizacion}hs (${data.fecha})` : ""
  }`;

  if (!isExpanded) {
    return (
      <div
        title={tooltipText}
        className="w-full flex flex-col items-center justify-center py-1.5 px-1 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 transition-colors cursor-help group"
      >
        <span className="text-[10px] font-black text-emerald-400 font-mono leading-none">$</span>
        <span className="text-[8px] font-bold text-slate-400 leading-tight">BNA</span>
      </div>
    );
  }

  return (
    <div
      title={tooltipText}
      className="relative w-full rounded-lg bg-slate-950/70 hover:bg-slate-950/90 border border-white/10 p-1.5 overflow-hidden shadow-inner group transition-all"
    >
      {/* Mini Header / Indicator */}
      <div className="flex items-center justify-between px-1 mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-slate-300 font-semibold tracking-wider text-[9px]">BNA Venta</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono">
          <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
          <span>EN VIVO</span>
        </div>
      </div>

      {/* Marquee Ticker Track */}
      <div className="relative w-full overflow-hidden ticker-fade-mask py-0.5 cursor-grab active:cursor-grabbing">
        <div className="animate-broker-ticker flex items-center whitespace-nowrap">
          {tickerItems.map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 mx-2 font-mono text-[11px] select-none"
            >
              <span className="font-bold text-slate-400 text-[10px]">{item.symbol}</span>
              <span className="text-emerald-400 font-black tracking-tight">
                ${item.val.toLocaleString("es-AR")}
              </span>
              <span className="text-[8px] text-emerald-400 font-bold">▲</span>
              <span className="text-slate-700 text-xs ml-1">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Franja pequeña de última actualización */}
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center justify-between px-1 text-[8.5px] font-mono text-slate-400 select-none">
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="w-2.5 h-2.5 text-slate-400" />
          <span>Últ. act:</span>
        </span>
        <span className="text-slate-300 font-semibold tracking-wide">
          {data?.horaActualizacion ? `${data.horaActualizacion} hs` : "Reciente"}
        </span>
      </div>
    </div>
  );
}
