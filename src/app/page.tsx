"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { EyeTrackerCube } from "@/components/home/EyeTrackerCube";
import { BeachWeatherBackdrop } from "@/components/home/BeachWeatherBackdrop";
import { HomeSearchModal } from "@/components/home/HomeSearchModal";
import { BlackboardHub } from "@/components/home/BlackboardHub";
import { HomeAgendaPendientes } from "@/components/home/HomeAgendaPendientes";
import { CotizacionDetailModal } from "@/components/cotizaciones/CotizacionDetailModal";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function HomePage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState("");

  // Pizarrón mode: "compact" (chiquito por defecto), "expanded", or "minimized"
  const [boardMode, setBoardMode] = useState<"compact" | "expanded" | "minimized">("compact");

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

  return (
    <AppLayout title="Inicio" subtitle="Pizarrón & Agenda Operativa">
      <div className="w-full min-h-[calc(100vh-68px)] flex flex-col p-2 sm:p-4 gap-4 overflow-y-auto">
        {/* 1. Pizarrón de Control: Chiquito/Compacto por defecto, expandible o minimizable */}
        <div
          className={`w-full transition-all duration-300 ${
            boardMode === "compact"
              ? "h-[360px] sm:h-[400px] flex-shrink-0"
              : boardMode === "minimized"
              ? "h-auto flex-shrink-0"
              : "h-auto"
          }`}
        >
          <BlackboardHub
            onOpenSearch={() => setIsSearchOpen(true)}
            initialMode="compact"
            viewMode={boardMode}
            onViewModeChange={setBoardMode}
          />
        </div>

        {/* 2. Agenda de Pendientes conectados con el Calendario: Hoy y Mañana */}
        {boardMode !== "expanded" && (
          <div className="w-full pb-8">
            <HomeAgendaPendientes />
          </div>
        )}
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
