"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { fetchOrdersFromMongo } from "@/lib/serverSync";
import { EstadisticasMensualesSection } from "@/components/estadisticas/EstadisticasMensualesSection";
import { SerializableOrder } from "@/app/estadisticas/page";
import { extractProvidersFromOrders } from "@/lib/providersRegistry";
import { 
  CalendarDays, 
  RefreshCw, 
  Sparkles, 
  ArrowLeft,
  Database
} from "lucide-react";
import Link from "next/link";

const CACHE_KEY = "finanzas_estadisticas_cache_v1";

const parseMonto = (raw: any): number => {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  let str = String(raw).trim();
  str = str.replace(/[^\d.,-]/g, "");
  if (str.includes(".") && str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function EstadisticasMensualesPage() {
  const [orders, setOrders] = useState<SerializableOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Cargar caché instantánea de localStorage y consultar siempre la base completa a MongoDB
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
          setOrders(parsed.orders);
          setLastSync(parsed.lastSync || null);
        }
      }
    } catch (e) {
      console.warn("Error leyendo caché de órdenes:", e);
    }

    // Siempre consultar y sincronizar la base completa desde el servidor local MongoDB
    handleRefresh();
  }, []);

  // 2. Fetch de datos completos desde MongoDB
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetchOrdersFromMongo({ limit: 0 });
      if (!res || !res.success || !Array.isArray(res.ordenes)) {
        throw new Error("Respuesta inválida del servidor");
      }

      const loadedOrders: SerializableOrder[] = res.ordenes.map((docItem: any) => {
        const rawMonto = parseMonto(docItem.monto);
        const rawRazon = (docItem.razonSocial || "Sin Proveedor").toString().trim();

        let timestamp = 0;
        let year: number | null = docItem.anio ? Number(docItem.anio) : null;
        let month: number | null = docItem.mes !== undefined && docItem.mes !== null ? Number(docItem.mes) : null;
        let dateStr = "-";

        const rawDate = docItem.fechaOC || docItem.createdAtFirebase || docItem.createdAt;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            timestamp = d.getTime();
            if (!year) year = d.getFullYear();
            if (month === null) month = d.getMonth();
            dateStr = d.toLocaleDateString("es-AR");
          }
        }

        return {
          id: docItem.firebaseId || docItem._id,
          empresa: docItem.empresa === "Hoyts" ? "Hoyts" : "CMK",
          numSolicitud: docItem.numSolicitud ? String(docItem.numSolicitud) : "",
          numOC: docItem.numOC ? String(docItem.numOC) : "",
          razonSocial: rawRazon,
          monto: rawMonto,
          motivo: docItem.motivo ? String(docItem.motivo) : "",
          formaPago: docItem.formaPago ? String(docItem.formaPago) : "30DFF",
          liberada: Boolean(docItem.liberada),
          mandada: Boolean(docItem.mandada),
          entregada: Boolean(docItem.entregada),
          cancelada: Boolean(docItem.cancelada),
          timestamp,
          year,
          month,
          dateStr,
          creadoPor: docItem.creadoPor ? String(docItem.creadoPor) : "",
        };
      });

      const nowIso = new Date().toISOString();
      const payload = {
        version: 1,
        lastSync: nowIso,
        orders: loadedOrders,
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        const providers = extractProvidersFromOrders(loadedOrders);
        localStorage.setItem("finanzas_proveedores_registry_v1", JSON.stringify(providers));
      } catch (storageErr) {
        console.warn("No se pudo guardar en localStorage:", storageErr);
      }

      setOrders(loadedOrders);
      setLastSync(nowIso);
      showToast(`✅ ¡Base de datos sincronizada! Se cargaron ${loadedOrders.length.toLocaleString("es-AR")} órdenes.`);
    } catch (err: any) {
      console.error("Error al actualizar órdenes:", err);
      showToast("❌ Hubo un error al consultar el servidor local.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      title="Estadísticas Mensuales"
      subtitle="Análisis mensual comparativo, días pico, desagregación OPEX vs CAPEX y proyecciones de umbrales"
    >
      <div className="space-y-6 pb-12">
        {/* Barra superior con accesos rápidos y estado de sincronización */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Centro de Métricas Mensuales</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  En tiempo real
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {orders.length > 0 ? (
                  <>
                    <span className="font-semibold text-slate-200">{orders.length.toLocaleString("es-AR")}</span> órdenes analizadas en base de datos
                    {lastSync && ` • Sincronizado: ${new Date(lastSync).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
                  </>
                ) : (
                  "Cargando historial de órdenes..."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link
              href="/estadisticas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Estadísticas Generales</span>
            </Link>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Sincronizando..." : "Recargar BD"}</span>
            </button>
          </div>
        </div>

        {/* Sección Principal de Estadísticas Mensuales */}
        <EstadisticasMensualesSection
          orders={orders}
          onRefreshData={handleRefresh}
          isLoading={loading}
        />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="px-4 py-2.5 bg-slate-900/95 border border-slate-700/80 text-white rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
