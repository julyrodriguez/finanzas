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
  Database,
  AlertCircle
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

const mapDocToSerializableOrder = (docItem: any): SerializableOrder => {
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
};

export default function EstadisticasMensualesPage() {
  const [orders, setOrders] = useState<SerializableOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Cargar caché instantánea de localStorage y luego sincronizar solo los cambios recientes
  useEffect(() => {
    if (typeof window === "undefined") return;
    let initialOrders: SerializableOrder[] = [];
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
          initialOrders = parsed.orders;
          setOrders(parsed.orders);
          setLastSync(parsed.lastSync || null);
        }
      }
    } catch (e) {
      console.warn("Error leyendo caché de órdenes:", e);
    }

    // Sincronización inteligente no bloqueante: solo descarga los últimos cambios (delta)
    syncOrdersIncremental(initialOrders);
  }, []);

  // 2. Sincronización incremental ultrarrápida (solo los 100 cambios más recientes de MongoDB)
  const syncOrdersIncremental = async (currentOrders: SerializableOrder[]) => {
    // Si la caché está vacía, hacer carga inicial completa
    if (!currentOrders || currentOrders.length === 0) {
      return handleFullRefresh();
    }

    setLoading(true);
    try {
      const res = await fetchOrdersFromMongo({ sort: "-updatedAt", limit: 100 });
      if (!res || !res.success || !Array.isArray(res.ordenes)) {
        throw new Error("Respuesta inválida del servidor");
      }

      const totalInDb = Number(res.total) || currentOrders.length;
      // Si la base creció en más de 80 órdenes desde la última vez, refrescar completo
      if (totalInDb - currentOrders.length > 80) {
        return handleFullRefresh();
      }

      const orderMap = new Map<string, SerializableOrder>();
      currentOrders.forEach((o) => orderMap.set(o.id, o));

      let hasChanges = false;
      let newCount = 0;
      let updatedCount = 0;

      for (const docItem of res.ordenes) {
        const incoming = mapDocToSerializableOrder(docItem);
        const existing = orderMap.get(incoming.id);

        if (!existing) {
          orderMap.set(incoming.id, incoming);
          hasChanges = true;
          newCount++;
        } else {
          if (
            existing.monto !== incoming.monto ||
            existing.liberada !== incoming.liberada ||
            existing.mandada !== incoming.mandada ||
            existing.entregada !== incoming.entregada ||
            existing.cancelada !== incoming.cancelada ||
            existing.motivo !== incoming.motivo ||
            existing.empresa !== incoming.empresa ||
            existing.numOC !== incoming.numOC ||
            existing.razonSocial !== incoming.razonSocial
          ) {
            orderMap.set(incoming.id, incoming);
            hasChanges = true;
            updatedCount++;
          }
        }
      }

      const nowIso = new Date().toISOString();
      setLastSync(nowIso);
      setIsServerOffline(false);

      if (hasChanges) {
        const nextOrders = Array.from(orderMap.values());
        setOrders(nextOrders);

        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              version: 1,
              lastSync: nowIso,
              orders: nextOrders,
            })
          );
          const providers = extractProvidersFromOrders(nextOrders);
          localStorage.setItem("finanzas_proveedores_registry_v1", JSON.stringify(providers));
        } catch (storageErr) {
          console.warn("No se pudo guardar en localStorage:", storageErr);
        }

        const msgParts = [];
        if (newCount > 0) msgParts.push(`${newCount} nuevas`);
        if (updatedCount > 0) msgParts.push(`${updatedCount} actualizadas`);
        showToast(`⚡ Actualización rápida: ${msgParts.join(", ")}.`);
      }
    } catch (err: any) {
      console.warn("Aviso en sincronización incremental:", err);
      setIsServerOffline(true);
    } finally {
      setLoading(false);
    }
  };

  // 3. Carga completa manual o de respaldo
  const handleFullRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetchOrdersFromMongo({ limit: 0 });
      if (!res || !res.success || !Array.isArray(res.ordenes)) {
        throw new Error("Respuesta inválida del servidor");
      }

      const loadedOrders: SerializableOrder[] = res.ordenes.map(mapDocToSerializableOrder);
      const nowIso = new Date().toISOString();

      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            version: 1,
            lastSync: nowIso,
            orders: loadedOrders,
          })
        );
        const providers = extractProvidersFromOrders(loadedOrders);
        localStorage.setItem("finanzas_proveedores_registry_v1", JSON.stringify(providers));
      } catch (storageErr) {
        console.warn("No se pudo guardar en localStorage:", storageErr);
      }

      setOrders(loadedOrders);
      setLastSync(nowIso);
      setIsServerOffline(false);
      showToast(`✅ ¡Base sincronizada! ${loadedOrders.length.toLocaleString("es-AR")} órdenes.`);
    } catch (err: any) {
      console.error("Error al actualizar órdenes:", err);
      setIsServerOffline(true);
      showToast("⚠️ Servidor local desconectado. Las estadísticas no consultan Firebase para proteger tu cuota.");
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
        {/* SERVIDOR OFFLINE ALERTA */}
        {isServerOffline && orders.length === 0 && !loading && (
          <div className="p-8 sm:p-12 text-center rounded-2xl bg-rose-500/10 border border-rose-500/30 max-w-2xl mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/30">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Servidor local desconectado
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              La sección de estadísticas mensuales requiere conexión directa con tu servidor local (MongoDB) para analizar toda la base de datos sin agotar la cuota de Firebase.
            </p>
            <button
              onClick={handleFullRefresh}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reintentar conexión con el servidor</span>
            </button>
          </div>
        )}

        {isServerOffline && orders.length > 0 && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Servidor local desconectado:</strong> Visualizando datos cacheados en este equipo. No se consulta a Firebase para no agotar la cuota.
            </span>
          </div>
        )}

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
              onClick={() => syncOrdersIncremental(orders)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              title="Sincronización incremental ultrarrápida (solo cambios recientes)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
          </div>
        </div>

        {/* Sección Principal de Estadísticas Mensuales */}
        <EstadisticasMensualesSection
          orders={orders}
          onRefreshData={() => syncOrdersIncremental(orders)}
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
