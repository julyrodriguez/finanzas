"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { EyeTrackerCube } from "@/components/home/EyeTrackerCube";
import { BeachWeatherBackdrop } from "@/components/home/BeachWeatherBackdrop";
import { HomeSearchModal } from "@/components/home/HomeSearchModal";
import { SeekSearchBar } from "@/components/home/SeekSearchBar";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { CotizacionDetailModal } from "@/components/cotizaciones/CotizacionDetailModal";
import type { OrdenCompra, Nota } from "@/types/ordenes";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { syncOrderToMongo } from "@/lib/serverSync";
import { 
  ShoppingBag, 
  Clock, 
  Scale, 
  Percent, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Search
} from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface MenuCardProps {
  href: string;
  title: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  gradientHover: string;
  ctaText: string;
}

function MenuCard({
  href,
  title,
  badge,
  badgeColor,
  icon: Icon,
  iconBg,
  iconColor,
  gradientHover,
  ctaText,
}: MenuCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={href} className="block group select-none">
      <motion.div
        whileHover={{ y: -4, scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.18, ease: EASE_OUT }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative overflow-hidden rounded-2xl p-4 sm:p-4.5 border border-white/[0.08] bg-[#0d1322]/85 backdrop-blur-xl transition-all duration-300 shadow-lg group-hover:border-white/20 group-hover:shadow-xl ${gradientHover}`}
      >
        {/* Ambient Top Glow */}
        <div 
          className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-35"
          style={{ background: iconColor }}
        />

        {/* Card Header: Icon + Badge */}
        <div className="flex items-center justify-between gap-2.5 mb-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-105 ${iconBg}`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
          </div>
          {badge && (
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider border ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>

        {/* Card Title */}
        <div className="mb-3.5">
          <h3 className="text-sm sm:text-base font-black text-white tracking-tight group-hover:text-blue-200 transition-colors">
            {title}
          </h3>
        </div>

        {/* Action Link Footer */}
        <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">
          <span>{ctaText}</span>
          <div className="w-5 h-5 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-slate-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:bg-white/10 transition-all">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState("");

  // Modals for detail view
  const [selectedOrdenForDetail, setSelectedOrdenForDetail] = useState<OrdenCompra | null>(null);
  const [selectedQuoteForDetail, setSelectedQuoteForDetail] = useState<any | null>(null);

  // Note state for OrderDetailModal
  const [newNotaText, setNewNotaText] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  // Idle / Inactivity 1-minute detection for Giant Carita Screensaver
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const IDLE_TIME = 60000; // 1 minute in milliseconds

    const handleActivity = () => {
      setIsIdle(false);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      // Only set idle timer when no modal is open
      if (!isSearchOpen && !selectedOrdenForDetail && !selectedQuoteForDetail) {
        idleTimeoutRef.current = setTimeout(() => {
          setIsIdle(true);
        }, IDLE_TIME);
      }
    };

    handleActivity();

    const activityEvents = [
      "mousemove",
      "pointermove",
      "mousedown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll"
    ];

    activityEvents.forEach((ev) => {
      window.addEventListener(ev, handleActivity, { passive: true });
    });

    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, handleActivity);
      });
    };
  }, [isSearchOpen, selectedOrdenForDetail, selectedQuoteForDetail]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalQuery("");
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotaText.trim() || !selectedOrdenForDetail || !selectedOrdenForDetail.id) return;

    setSavingNota(true);
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}`;

    const nuevaNota: Nota = {
      id: "nota-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      texto: newNotaText.trim(),
      autor: user?.displayName || user?.email?.split("@")[0] || "julian",
      fecha: formattedDate,
    };

    const updatedNotas = [...(selectedOrdenForDetail.notas || []), nuevaNota];
    const updatedOrden = { ...selectedOrdenForDetail, notas: updatedNotas };
    setSelectedOrdenForDetail(updatedOrden);

    syncOrderToMongo(updatedOrden);

    const db = getFirebaseDb();
    if (db && selectedOrdenForDetail.id) {
      try {
        const docRef = doc(db, "ordenes_compra", selectedOrdenForDetail.id);
        await updateDoc(docRef, { notas: updatedNotas });
      } catch (err) {
        console.warn("Aviso Firebase al agregar nota:", err);
      }
    }

    setNewNotaText("");
    setSavingNota(false);
  };

  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    if (selectedOrdenForDetail && selectedOrdenForDetail.id === ordenId) {
      const updated = { ...selectedOrdenForDetail, ...updatedFields };
      setSelectedOrdenForDetail(updated);
      syncOrderToMongo(updated);
    }
  };

  return (
    <AppLayout title="Portal Principal" subtitle="Cinemark & Hoyts">
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col justify-center min-h-[calc(100vh-130px)] space-y-6 sm:space-y-10">
        
        {/* Executive Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
            <Building2 className="w-3.5 h-3.5" />
            <span>Cinemark & Hoyts • Finanzas</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Centro de Control Financiero
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Seleccioná uno de los módulos operativos principales para acceder a la gestión
          </p>
        </div>

        {/* Desktop 3-Column Layout with Center Eye-Tracker Cube */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-center w-full max-w-6xl mx-auto">
          
          {/* Left Column: 2 Cards */}
          <div className="order-2 lg:order-1 lg:col-span-4 flex flex-col gap-4 sm:gap-4.5 max-w-[340px] w-full mx-auto z-10">
            <MenuCard
              href="/ordenes-de-compras"
              title="Órdenes de Compra"
              badge="Operaciones"
              badgeColor="bg-blue-500/10 text-blue-400 border-blue-500/20"
              icon={ShoppingBag}
              iconBg="bg-blue-500/15 border-blue-500/30"
              iconColor="text-blue-400"
              gradientHover="group-hover:shadow-blue-500/10"
              ctaText="Ingresar a Órdenes"
            />

            <MenuCard
              href="/proceso-de-liberacion"
              title="Proceso de Liberación"
              badge="Firmas & Pago"
              badgeColor="bg-amber-500/10 text-amber-300 border-amber-500/20"
              icon={Clock}
              iconBg="bg-amber-500/15 border-amber-500/30"
              iconColor="text-amber-400"
              gradientHover="group-hover:shadow-amber-500/10"
              ctaText="Ver Liberaciones"
            />
          </div>

          {/* Center Column: The Large Interactive Eye Tracker Cube with Beach Weather Backdrop */}
          <div className="order-1 lg:order-2 lg:col-span-4 flex flex-col items-center justify-center py-4 lg:py-0 z-0">
            <div className="relative flex flex-col items-center w-full max-w-[420px]">
              <BeachWeatherBackdrop>
                {/* Responsive Eye Tracker Cube */}
                <div className="hidden sm:block">
                  <EyeTrackerCube 
                    size={210} 
                    follow={70} 
                    bounce={32} 
                    mood={isSearchOpen ? "thinking" : "normal"} 
                  />
                </div>
                <div className="block sm:hidden">
                  <EyeTrackerCube 
                    size={165} 
                    follow={70} 
                    bounce={32} 
                    mood={isSearchOpen ? "thinking" : "normal"} 
                  />
                </div>
              </BeachWeatherBackdrop>

              {/* Seek Search Bar below the carita (bencho.dev/blocks/seek) */}
              <div className="mt-5 flex flex-col items-center w-full">
                <SeekSearchBar
                  onSearchSubmit={(val) => {
                    setSearchModalQuery(val);
                    setIsSearchOpen(true);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: 2 Cards */}
          <div className="order-3 lg:order-3 lg:col-span-4 flex flex-col gap-4 sm:gap-4.5 max-w-[340px] w-full mx-auto z-10">
            <MenuCard
              href="/cotizaciones"
              title="Cotizaciones"
              badge="Precios & IA"
              badgeColor="bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              icon={Scale}
              iconBg="bg-emerald-500/15 border-emerald-500/30"
              iconColor="text-emerald-400"
              gradientHover="group-hover:shadow-emerald-500/10"
              ctaText="Comparar Cotizaciones"
            />

            <MenuCard
              href="/distribucion"
              title="Distribución"
              badge="Complejos"
              badgeColor="bg-purple-500/10 text-purple-300 border-purple-500/20"
              icon={Percent}
              iconBg="bg-purple-500/15 border-purple-500/30"
              iconColor="text-purple-400"
              gradientHover="group-hover:shadow-purple-500/10"
              ctaText="Abrir Distribución"
            />
          </div>

        </div>

        {/* Subtle Bottom Footnote */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          Plataforma Financiera Corporativa • Cinemark & Hoyts Argentina
        </div>
      </div>

      {/* Intelligent Search Modal with Thinking/Searching Carita in Background */}
      <HomeSearchModal
        isOpen={isSearchOpen}
        initialQuery={searchModalQuery}
        isSubModalOpen={Boolean(selectedOrdenForDetail || selectedQuoteForDetail)}
        onClose={() => setIsSearchOpen(false)}
        onSelectOC={(oc) => {
          setSelectedOrdenForDetail(oc);
        }}
        onSelectCotizacion={(quote) => {
          setSelectedQuoteForDetail(quote);
        }}
      />

      {/* Order Detail Modal (direct view without page change) */}
      {selectedOrdenForDetail && (
        <OrderDetailModal
          orden={selectedOrdenForDetail}
          onClose={() => setSelectedOrdenForDetail(null)}
          isOrdenesUser={true}
          onStatusChange={handleStatusChange}
          newNotaText={newNotaText}
          setNewNotaText={setNewNotaText}
          savingNota={savingNota}
          onAddNota={handleAddNota}
        />
      )}

      {/* Cotización Detail Modal (direct view) */}
      {selectedQuoteForDetail && (
        <CotizacionDetailModal
          quote={selectedQuoteForDetail}
          onClose={() => setSelectedQuoteForDetail(null)}
        />
      )}

      {/* Full-Screen Giant Carita Screensaver on 1-min Inactivity */}
      <AnimatePresence>
        {isIdle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl select-none overflow-hidden"
          >
            {/* Ambient Deep Glow */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [1, 1.18, 1],
                opacity: [0.14, 0.28, 0.14]
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute w-[640px] h-[640px] rounded-full bg-blue-500/20 blur-3xl pointer-events-none"
            />

            {/* Giant Carita with smooth entrance/exit scaling */}
            <motion.div
              initial={{ scale: 0.35, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.35, opacity: 0, y: 20 }}
              transition={{
                duration: 0.65,
                ease: EASE_OUT,
              }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="hidden sm:block">
                <EyeTrackerCube 
                  size={480} 
                  follow={80} 
                  bounce={40} 
                  mood="thinking" 
                />
              </div>
              <div className="block sm:hidden">
                <EyeTrackerCube 
                  size={300} 
                  follow={80} 
                  bounce={40} 
                  mood="thinking" 
                />
              </div>
            </motion.div>

            {/* Subtle return hint */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.4, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="absolute bottom-10 text-center text-[11px] font-mono font-medium text-slate-400 tracking-widest pointer-events-none"
            >
              MODO REPOSO • MOVER EL MOUSE PARA REGRESAR
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
