"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { exportFinalExcel } from "@/lib/exportFinalExcel";
import { exportAlternativeExcel } from "@/lib/exportAlternativeExcel";
import { fetchOrdersFromMongo, parseMongoDocToOrdenCompra, getTimestampSeconds } from "@/lib/serverSync";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { OrdenCompra } from "@/types/ordenes";
import { 
  FileSpreadsheet, 
  Sparkles, 
  Loader2, 
  Download, 
  ShieldCheck, 
  CheckCircle2,
  AlertCircle,
  FileCheck
} from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function OrdenesDeComprasPage() {
  const [isExportingFinalExcel, setIsExportingFinalExcel] = useState(false);
  const [isExportingAlternativeExcel, setIsExportingAlternativeExcel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 4000);
  };

  const fetchAllOrdersForExport = async (): Promise<OrdenCompra[]> => {
    try {
      const res = await fetchOrdersFromMongo({ limit: 0, sort: "numOC" });
      if (res && res.success && Array.isArray(res.ordenes) && res.ordenes.length > 0) {
        return res.ordenes.map(parseMongoDocToOrdenCompra);
      }
    } catch (err) {
      console.warn("Aviso al consultar servidor local, probando Firebase:", err);
    }

    // Fallback a Firebase
    const db = getFirebaseDb();
    if (db) {
      try {
        const snap = await getDocs(collection(db, "ordenes_compra"));
        return snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return parseMongoDocToOrdenCompra({
            ...data,
            id: docSnap.id,
            firebaseId: docSnap.id,
          });
        });
      } catch (fbErr) {
        console.warn("Error en fallback Firebase:", fbErr);
      }
    }

    return [];
  };

  // Descargar Excel Final maestro con fórmulas, firmantes, batch y macros
  const handleDownloadFinalExcel = async () => {
    if (isExportingFinalExcel) return;
    setIsExportingFinalExcel(true);
    showToast("⏳ Preparando y generando el Excel Final...");

    try {
      const ordersToExport = await fetchAllOrdersForExport();

      if (ordersToExport.length === 0) {
        showToast("⚠️ No se encontraron órdenes para exportar");
        setIsExportingFinalExcel(false);
        return;
      }

      // Ordenar por N° OC descendente
      const sortedOrders = [...ordersToExport].sort((a, b) => {
        const numA = parseInt(a.numOC, 10) || 0;
        const numB = parseInt(b.numOC, 10) || 0;
        if (numB !== numA) return numB - numA;
        const timeA = getTimestampSeconds(a.createdAt);
        const timeB = getTimestampSeconds(b.createdAt);
        return timeB - timeA;
      });

      exportFinalExcel(sortedOrders);
      showToast(`📊 ¡Excel Final descargado con ${sortedOrders.length} órdenes!`);
    } catch (err) {
      console.error("Error al exportar Excel Final:", err);
      showToast("❌ Error al generar el Excel Final");
    } finally {
      setIsExportingFinalExcel(false);
    }
  };

  // Descargar Edición Alternativa moderna con buscador interactivo y botones de filtros por estado
  const handleDownloadAlternativeExcel = async () => {
    if (isExportingAlternativeExcel) return;
    setIsExportingAlternativeExcel(true);
    showToast("⏳ Preparando y generando la Edición Alternativa...");

    try {
      const ordersToExport = await fetchAllOrdersForExport();

      if (ordersToExport.length === 0) {
        showToast("⚠️ No se encontraron órdenes para exportar");
        setIsExportingAlternativeExcel(false);
        return;
      }

      // Ordenar por N° OC descendente
      const sortedOrders = [...ordersToExport].sort((a, b) => {
        const numA = parseInt(a.numOC, 10) || 0;
        const numB = parseInt(b.numOC, 10) || 0;
        if (numB !== numA) return numB - numA;
        const timeA = getTimestampSeconds(a.createdAt);
        const timeB = getTimestampSeconds(b.createdAt);
        return timeB - timeA;
      });

      await exportAlternativeExcel(sortedOrders);
      showToast(`✨ ¡Excel Alternativo descargado con ${sortedOrders.length} órdenes!`);
    } catch (err) {
      console.error("Error al exportar Excel Alternativo:", err);
      showToast("❌ Error al generar el Excel Alternativo");
    } finally {
      setIsExportingAlternativeExcel(false);
    }
  };

  return (
    <AppLayout title="Órdenes de Compra" subtitle="Cinemark & Hoyts">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 space-y-8 flex flex-col justify-center min-h-[calc(100vh-140px)]">
        
        {/* Cartel Principal de Descarga de Excels */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c1222]/90 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl space-y-8"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          {/* Header Banner */}
          <div className="relative z-10 text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Centro de Exportación Oficial</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Descarga de Planillas en Excel
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              La visualización activa de órdenes de compra se encuentra desactivada en esta sección. Podés generar y descargar ambas planillas maestras en Excel con todos los registros históricos, matrices de firmantes y fórmulas consolidadas a continuación:
            </p>
          </div>

          {/* Tarjetas de Descarga de Ambos Excels */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-2">
            
            {/* Opción 1: Excel Final Maestro */}
            <div className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-[#090e1c] border border-emerald-500/25 hover:border-emerald-500/40 transition-all shadow-xl space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                    Planilla Maestra
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Excel Final Maestro
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Libro maestro definitivo con fórmulas vivas de copia rápida, generador CMD de carpetas, resumen dinámico de firmantes y macros corporativas.
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadFinalExcel}
                disabled={isExportingFinalExcel}
                className={`w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer ${
                  isExportingFinalExcel ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                {isExportingFinalExcel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando Excel...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel Final</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Opción 2: Excel Alternativo Moderno */}
            <div className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-[#090e1c] border border-violet-500/25 hover:border-violet-500/40 transition-all shadow-xl space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                    Edición Ejecutiva
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Descargar Alternativa
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Versión moderna interactiva con buscador embebido, botones de filtrado instantáneo por estado y diseño ejecutivo para análisis rápido.
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadAlternativeExcel}
                disabled={isExportingAlternativeExcel}
                className={`w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-950/40 flex items-center justify-center gap-2 cursor-pointer ${
                  isExportingAlternativeExcel ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                {isExportingAlternativeExcel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando Alternativa...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Descargar Alternativa</span>
                  </>
                )}
              </motion.button>
            </div>

          </div>

          {/* Pie informativo de seguridad y respaldo */}
          <div className="relative z-10 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-2 text-center text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Los archivos se descargan en formato estándar .xlsx compatibles con Microsoft Excel y LibreOffice.</span>
          </div>
        </motion.div>

      </div>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900/95 border border-white/20 text-white text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
