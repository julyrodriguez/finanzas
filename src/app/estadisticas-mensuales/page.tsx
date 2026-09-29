"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  AlertCircle,
  Activity,
  Layers
} from "lucide-react";
import Link from "next/link";

const CACHE_KEY = "finanzas_estadisticas_cache_v1";
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

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

    // Sincronización incremental no bloqueante: solo descarga los últimos cambios (delta)
    syncOrdersIncremental(initialOrders);
  }, []);

  // 2. Sincronización incremental ultrarrápida (solo los 100 cambios más recientes de MongoDB)
  const syncOrdersIncremental = async (currentOrders: SerializableOrder[]) => {
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
      subtitle="Análisis comparativo, días pico de compras, desagregación OPEX vs CAPEX y proyecciones de umbral"
    >
      <div className="space-y-6 pb-16">
        {/* SERVIDOR OFFLINE ALERTA */}
        <AnimatePresence>
          {isServerOffline && orders.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="p-8 sm:p-12 text-center rounded-3xl bg-rose-500/10 border border-rose-500/30 max-w-2xl mx-auto space-y-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Servidor local desconectado
              </h3>
              <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                La sección de estadísticas mensuales requiere conexión directa con tu servidor local (MongoDB) para analizar toda la base de datos sin agotar la cuota de Firebase.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFullRefresh}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar conexión con el servidor</span>
              </motion.button>
            </motion.div>
          )}

          {isServerOffline && orders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs shadow-lg backdrop-blur-md"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>Servidor local desconectado:</strong> Visualizando datos cacheados en este equipo. No se consulta a Firebase para no agotar la cuota.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barra superior ejecutiva con accesos rápidos y estado de sincronización */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4.5 bg-[#0d1222]/90 border border-white/[0.08] rounded-3xl shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/25 text-white shrink-0">
              <CalendarDays className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white tracking-tight">Centro de Métricas Mensuales</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>En tiempo real</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                {orders.length > 0 ? (
                  <>
                    <span className="font-bold text-white tabular-nums font-mono">{orders.length.toLocaleString("es-AR")}</span> órdenes analizadas
                    {lastSync && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        • Sincronizado: {new Date(lastSync).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </>
                ) : (
                  "Cargando historial de órdenes..."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            <Link
              href="/estadisticas"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Estadísticas Generales</span>
            </Link>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => syncOrdersIncremental(orders)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
              title="Sincronización incremental ultrarrápida (solo cambios recientes)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Sincronizando..." : "Sincronizar"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Sección Principal de Estadísticas Mensuales */}
        <EstadisticasMensualesSection
          orders={orders}
          onRefreshData={() => syncOrdersIncremental(orders)}
          isLoading={loading}
        />
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="fixed bottom-6 right-6 z-50 pointer-events-none"
          >
            <div className="px-4 py-2.5 bg-[#0d1222]/95 border border-indigo-500/30 text-white rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
