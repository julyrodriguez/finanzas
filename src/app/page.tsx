"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { EyeTrackerCube } from "@/components/home/EyeTrackerCube";
import { BeachWeatherBackdrop } from "@/components/home/BeachWeatherBackdrop";
import { HomeSearchModal } from "@/components/home/HomeSearchModal";
import { BlackboardHub } from "@/components/home/BlackboardHub";
import { CotizacionDetailModal } from "@/components/cotizaciones/CotizacionDetailModal";
import { Building2 } from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function HomePage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState("");

  // Modals for detail view
  const [selectedQuoteForDetail, setSelectedQuoteForDetail] = useState<any | null>(null);

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
      if (!isSearchOpen && !selectedQuoteForDetail) {
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
  }, [isSearchOpen, selectedQuoteForDetail]);

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

  return (
    <AppLayout title="Portal Principal" subtitle="Cinemark & Hoyts">
      <div className="relative w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col justify-center min-h-[calc(100vh-130px)] space-y-5 sm:space-y-6">
        
        {/* Executive Header */}
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
            <Building2 className="w-3.5 h-3.5" />
            <span>Cinemark & Hoyts • Hub Principal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Centro de Control & Pizarrón
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Escribí ideas, dibujá con tiza, borrá con borrador y clavá notas con chinchetas
          </p>
        </div>

        {/* The Animated Blackboard Hub (Centerpiece with Carita Mascot) */}
        <div className="w-full">
          <BlackboardHub onOpenSearch={() => setIsSearchOpen(true)} />
        </div>

        {/* Subtle Bottom Footnote */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          Plataforma Corporativa de Compras • Cinemark & Hoyts Argentina
        </div>
      </div>

      {/* Intelligent Search Modal with Thinking/Searching Carita in Background */}
      <HomeSearchModal
        isOpen={isSearchOpen}
        initialQuery={searchModalQuery}
        isSubModalOpen={Boolean(selectedQuoteForDetail)}
        onClose={() => setIsSearchOpen(false)}
        onSelectCotizacion={(quote) => {
          setSelectedQuoteForDetail(quote);
        }}
      />

      {/* Cotización Detail Modal (direct view) */}
      {selectedQuoteForDetail && (
        <CotizacionDetailModal
          quote={selectedQuoteForDetail}
          onClose={() => setSelectedQuoteForDetail(null)}
        />
      )}

      {/* Full-Screen Giant Carita Screensaver on 1-min Inactivity with Giant Weather Background */}
      <AnimatePresence>
        {isIdle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="fixed inset-0 z-[100] select-none overflow-hidden"
          >
            <BeachWeatherBackdrop fullscreen>
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
                    size={460} 
                    follow={80} 
                    bounce={40} 
                    mood="thinking" 
                  />
                </div>
                <div className="block sm:hidden">
                  <EyeTrackerCube 
                    size={280} 
                    follow={80} 
                    bounce={40} 
                    mood="thinking" 
                  />
                </div>
              </motion.div>
            </BeachWeatherBackdrop>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
