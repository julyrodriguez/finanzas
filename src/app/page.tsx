"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { EyeTrackerCube } from "@/components/home/EyeTrackerCube";
import { BeachWeatherBackdrop } from "@/components/home/BeachWeatherBackdrop";
import { HomeSearchModal } from "@/components/home/HomeSearchModal";
import { BlackboardHub } from "@/components/home/BlackboardHub";
import { CotizacionDetailModal } from "@/components/cotizaciones/CotizacionDetailModal";

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
    <AppLayout title="Pizarrón Principal" subtitle="Cinemark & Hoyts">
      {/* Pizarrón ocupando la pestaña completa */}
      <div className="w-full h-[calc(100vh-68px)] overflow-hidden flex flex-col p-1.5 sm:p-2.5">
        <BlackboardHub onOpenSearch={() => setIsSearchOpen(true)} />
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
