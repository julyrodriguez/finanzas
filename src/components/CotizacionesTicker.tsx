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
      let res = await fetch("https://apivacas.jariel.com.ar/api/bna/cotizaciones", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
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
    const interval = setInterval(fetchCotizaciones, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        <span className="text-[10px] text-slate-400 font-mono">Cargando cotizaciones...</span>
      </div>
    );
  }

  const items = [
    { symbol: "USD", name: "Dólar", val: data?.dolarVenta ?? 1530 },
    { symbol: "EUR", name: "Euro", val: data?.euroVenta ?? 1800 },
    { symbol: "BRL", name: "Real", val: data?.realVenta ?? 307 },
  ];

  const tickerItems = [...items, ...items, ...items, ...items];

  const tooltipText = `Cotizaciones BNA Oficial (Venta)\nUSD: $${items[0].val.toLocaleString("es-AR")} | EUR: $${items[1].val.toLocaleString("es-AR")} | BRL: $${items[2].val.toLocaleString("es-AR")}${
    data?.horaActualizacion ? `\nActualizado: ${data.horaActualizacion}hs (${data.fecha})` : ""
  }`;

  return (
    <div
      title={tooltipText}
      className="relative w-full rounded-lg bg-black/40 border border-white/10 p-2 overflow-hidden select-none"
    >
      {/* Header institucional */}
      <div className="flex items-center justify-between mb-1.5 text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-slate-300 font-semibold">BNA Venta Oficial</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
          <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
          <span>OFICIAL</span>
        </div>
      </div>

      {/* Marquee Ticker Track */}
      <div className="relative w-full overflow-hidden ticker-fade-mask py-0.5">
        <div className="animate-broker-ticker flex items-center whitespace-nowrap">
          {tickerItems.map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 mx-2 font-mono text-[11px]"
            >
              <span className="font-semibold text-slate-400 text-[10px]">{item.symbol}</span>
              <span className="text-emerald-400 font-bold">
                ${item.val.toLocaleString("es-AR")}
              </span>
              <span className="text-slate-700 text-xs ml-1">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-1 pt-1 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          <span>Actualización:</span>
        </span>
        <span className="text-slate-300 font-medium">
          {data?.horaActualizacion ? `${data.horaActualizacion} hs` : "Reciente"}
        </span>
      </div>
    </div>
  );
}
