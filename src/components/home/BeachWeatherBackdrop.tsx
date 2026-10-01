"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sun, 
  Moon, 
  CloudSun, 
  CloudMoon, 
  Cloud, 
  CloudRain, 
  CloudLightning, 
  RefreshCw,
  Sunset,
  Sunrise,
  Sparkles
} from "lucide-react";
import { WeatherData } from "@/types/weather";

interface BeachWeatherBackdropProps {
  children?: React.ReactNode;
  className?: string;
}

export function BeachWeatherBackdrop({
  children,
  className = "",
}: BeachWeatherBackdropProps) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWeather = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/weather");
      if (res.ok) {
        const json: WeatherData = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn("Error fetching weather in BeachWeatherBackdrop:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Auto-refresh every 12 minutes
    const interval = setInterval(fetchWeather, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine current atmospheric phase & cloud levels
  const phase = data?.astronomy.phase || "golden-hour";
  const isDay = data?.current.isDay ?? true;
  const cloudCover = data?.current.cloudCover ?? 60;
  const solarProgress = data?.astronomy.solarProgress ?? 0.85;

  // Calculate sun position in the sky
  // x: arcs from ~20% (sunrise) to 50% (midday) to ~72% (sunset)
  // y (from bottom): arcs from ~24% (sunset/sunrise at horizon) to ~68% (midday)
  let sunXPercent = 50;
  let sunBottomPercent = 40;

  if (solarProgress >= 0) {
    // Parabolic arc during day
    sunXPercent = 20 + solarProgress * 55;
    // Sinusoidal height: 0 at sunrise/sunset, 1 at midday (progress=0.5)
    const arcHeight = Math.sin(solarProgress * Math.PI);
    sunBottomPercent = 24 + arcHeight * 46;

    // At sunset phase, ensure the sun is descending close to or touching the ocean horizon
    if (phase === "sunset") {
      sunBottomPercent = Math.min(27, Math.max(22, 24 + (1 - solarProgress) * 20));
    } else if (phase === "golden-hour") {
      sunBottomPercent = Math.min(45, Math.max(28, 28 + (1 - solarProgress) * 45));
    }
  }

  // Sky background gradient styling based on phase
  let skyGradient = "from-[#0284c7] via-[#38bdf8] via-[#7dd3fc] to-[#fef08a]"; // Default Day
  let sunGlow = "rgba(251, 191, 36, 0.75)";
  let oceanGradient = "from-[#0369a1] via-[#0284c7] to-[#075985]";

  if (phase === "sunset") {
    // Dramatic Sunset (Ocaso): burning amber, violet, deep coral, and radiant gold
    skyGradient = "from-[#1e1b4b] via-[#581c87] via-[#b91c1c] via-[#ea580c] to-[#fbbf24]";
    sunGlow = "rgba(249, 115, 22, 0.95)";
    oceanGradient = "from-[#311042] via-[#701a75] via-[#9a3412] to-[#b45309]";
  } else if (phase === "golden-hour") {
    // Golden Hour (Atardecer previo): warm amber, soft peach, rich twilight blue
    skyGradient = "from-[#1e1b4b] via-[#4338ca] via-[#c2410c] via-[#f97316] to-[#fde047]";
    sunGlow = "rgba(245, 158, 11, 0.9)";
    oceanGradient = "from-[#1e1b4b] via-[#1e3a8a] via-[#9a3412] to-[#c2410c]";
  } else if (phase === "dawn") {
    // Dawn: pastel violet, rose, soft golden peach
    skyGradient = "from-[#1e1b4b] via-[#701a75] via-[#be185d] via-[#f43f5e] to-[#fde047]";
    sunGlow = "rgba(251, 146, 60, 0.85)";
    oceanGradient = "from-[#1e1b4b] via-[#581c87] via-[#9d174d] to-[#be123c]";
  } else if (phase === "dusk") {
    // Dusk: deep indigo and purple
    skyGradient = "from-[#030712] via-[#0f172a] via-[#312e81] to-[#4c1d95]";
    sunGlow = "rgba(168, 85, 247, 0.6)";
    oceanGradient = "from-[#020617] via-[#0f172a] to-[#1e1b4b]";
  } else if (phase === "night") {
    // Night: starry deep midnight blue
    skyGradient = "from-[#020617] via-[#0b1329] via-[#0f172a] to-[#172554]";
    sunGlow = "rgba(199, 210, 254, 0.7)";
    oceanGradient = "from-[#020617] via-[#080d1a] to-[#0f172a]";
  }

  // Atmospheric icon for pill badge
  const getWeatherIcon = () => {
    if (phase === "sunset") return <Sunset className="w-3.5 h-3.5 text-amber-300 animate-pulse" />;
    if (phase === "dawn") return <Sunrise className="w-3.5 h-3.5 text-pink-300" />;
    if (!isDay) return <Moon className="w-3.5 h-3.5 text-indigo-300" />;
    if (cloudCover > 65) return <Cloud className="w-3.5 h-3.5 text-slate-200" />;
    if (cloudCover > 25) return <CloudSun className="w-3.5 h-3.5 text-amber-300" />;
    return <Sun className="w-3.5 h-3.5 text-amber-300" />;
  };

  return (
    <div
      className={`relative rounded-[36px] sm:rounded-[42px] overflow-hidden border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.65)] select-none transition-all duration-700 w-full max-w-[350px] sm:max-w-[410px] h-[360px] sm:h-[420px] flex flex-col items-center justify-between p-4 sm:p-5 ${className}`}
    >
      {/* 1. SKY GRADIENT BACKGROUND */}
      <div 
        className={`absolute inset-0 bg-gradient-to-b ${skyGradient} transition-colors duration-1000`}
      />

      {/* 2. STARS (Only visible at Night or Dusk) */}
      {(phase === "night" || phase === "dusk") && (
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div className="absolute top-4 left-8 w-1 h-1 bg-white rounded-full animate-ping" />
          <div className="absolute top-10 left-28 w-1.5 h-1.5 bg-indigo-200 rounded-full opacity-70" />
          <div className="absolute top-6 right-16 w-1 h-1 bg-white rounded-full animate-pulse" />
          <div className="absolute top-16 right-32 w-1.5 h-1.5 bg-purple-200 rounded-full opacity-60" />
          <div className="absolute top-24 left-16 w-1 h-1 bg-amber-100 rounded-full opacity-80" />
          <div className="absolute top-14 right-8 w-1 h-1 bg-white rounded-full" />
        </div>
      )}

      {/* 3. CLOUDS - LAYER 1 (Behind Sun) */}
      {cloudCover > 20 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ x: [-20, 30, -20] }}
            transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 -left-6 opacity-35 filter blur-xs"
          >
            <svg width="180" height="70" viewBox="0 0 100 40" fill="white">
              <path d="M10,30 Q20,10 40,20 Q55,5 75,18 Q90,15 95,30 Z" opacity="0.8" />
            </svg>
          </motion.div>

          <motion.div
            animate={{ x: [15, -25, 15] }}
            transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-16 right-0 opacity-30 filter blur-xs"
          >
            <svg width="210" height="80" viewBox="0 0 100 40" fill="white">
              <path d="M15,32 Q30,12 55,22 Q70,8 88,20 Q98,18 100,32 Z" opacity="0.75" />
            </svg>
          </motion.div>
        </div>
      )}

      {/* 4. THE SUN / SUNSET OR MOON ("si ya es atardecer que este ocultandose en el fondo") */}
      {isDay || phase === "sunset" || phase === "golden-hour" || phase === "dawn" ? (
        <div
          className="absolute pointer-events-none transition-all duration-1000 ease-out"
          style={{
            left: `${sunXPercent}%`,
            bottom: `${sunBottomPercent}%`,
            transform: "translate(-50%, 50%)",
          }}
        >
          {/* Multi-layered Sun Glow */}
          <div
            className="absolute -inset-10 rounded-full blur-2xl pointer-events-none animate-pulse"
            style={{
              background: `radial-gradient(circle, ${sunGlow} 0%, rgba(254, 215, 170, 0) 70%)`,
            }}
          />

          {/* Golden Rays / Corona */}
          <div
            className="absolute -inset-6 rounded-full blur-xl pointer-events-none opacity-85"
            style={{
              background: `radial-gradient(circle, #fde047 20%, ${sunGlow} 60%, transparent 80%)`,
            }}
          />

          {/* Crisp Radiant Sun Core */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-t from-amber-400 via-yellow-200 to-white shadow-[0_0_40px_rgba(251,191,36,0.9),0_0_80px_rgba(245,158,11,0.6)] border border-yellow-100/60" />
        </div>
      ) : (
        /* Glowing Moon at Night */
        <div
          className="absolute pointer-events-none"
          style={{
            right: "26%",
            top: "18%",
          }}
        >
          <div className="absolute -inset-6 rounded-full blur-xl bg-indigo-300/40 pointer-events-none" />
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-white via-indigo-100 to-slate-300 shadow-[0_0_30px_rgba(255,255,255,0.7)] flex items-center justify-center border border-white/50">
            <div className="w-9 h-9 rounded-full bg-slate-900/10 blur-[1px]" />
          </div>
        </div>
      )}

      {/* 5. VOLUMETRIC CLOUDS IN FRONT OF SUN ("el sol entre nubes que se vea muy bien") */}
      {cloudCover > 25 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
          {/* Cloud drifting right in front/beside the sun */}
          <motion.div
            animate={{ x: [-15, 20, -15] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            className="absolute opacity-85 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
            style={{
              left: `${Math.max(5, sunXPercent - 32)}%`,
              bottom: `${Math.max(22, sunBottomPercent - 4)}%`,
            }}
          >
            <svg width="170" height="65" viewBox="0 0 160 60" fill="none">
              <path
                d="M20,48 C20,38 28,30 38,30 C40,18 52,10 65,10 C80,10 92,20 96,32 C104,30 114,35 116,44 C124,44 132,50 132,58 L20,58 Z"
                fill="url(#cloudGradFront)"
              />
              <defs>
                <linearGradient id="cloudGradFront" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#fed7aa" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.75" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>

          {/* Secondary puffy cloud overlapping from the other side */}
          <motion.div
            animate={{ x: [20, -15, 20] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
            className="absolute opacity-80 filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
            style={{
              left: `${Math.min(50, sunXPercent + 6)}%`,
              bottom: `${Math.max(24, sunBottomPercent - 2)}%`,
            }}
          >
            <svg width="190" height="75" viewBox="0 0 170 65" fill="none">
              <path
                d="M25,52 C22,40 32,32 44,32 C48,18 64,10 78,12 C92,12 104,22 108,34 C118,34 126,40 128,50 L25,52 Z"
                fill="url(#cloudGradFront2)"
              />
              <defs>
                <linearGradient id="cloudGradFront2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
                  <stop offset="60%" stopColor="#ffedd5" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.7" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </div>
      )}

      {/* 6. OCEAN WATER & SUN GLISTENING REFLECTION ("como un fondo de playa") */}
      <div className="absolute left-0 right-0 bottom-0 h-[28%] z-[3] overflow-hidden pointer-events-none">
        {/* Ocean Body Gradient */}
        <div className={`w-full h-full bg-gradient-to-b ${oceanGradient} opacity-95 relative`}>
          
          {/* Horizon Line Glow */}
          <div 
            className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
            style={{
              background: phase === "sunset" 
                ? "linear-gradient(90deg, transparent, #fbbf24 40%, #f97316 60%, transparent)"
                : "linear-gradient(90deg, transparent, #38bdf8 50%, transparent)"
            }}
          />

          {/* Glistening Sunlight Reflection Path across water */}
          {(isDay || phase === "sunset" || phase === "golden-hour") && (
            <motion.div
              animate={{ opacity: [0.75, 0.95, 0.75], scaleX: [0.95, 1.05, 0.95] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 bottom-0 w-24 sm:w-32 filter blur-[2px]"
              style={{
                left: `${sunXPercent}%`,
                transform: "translateX(-50%)",
                background: phase === "sunset"
                  ? "linear-gradient(180deg, rgba(254, 240, 138, 0.9) 0%, rgba(249, 115, 22, 0.6) 60%, rgba(217, 119, 6, 0.2) 100%)"
                  : "linear-gradient(180deg, rgba(254, 240, 138, 0.7) 0%, rgba(56, 189, 248, 0.4) 60%, transparent 100%)",
                clipPath: "polygon(40% 0%, 60% 0%, 90% 100%, 10% 100%)",
              }}
            />
          )}

          {/* Animated Wave Ripples on Sea */}
          <motion.div
            animate={{ x: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-2 left-0 right-0 h-4 opacity-50"
          >
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 12">
              <path
                d="M0,6 Q50,0 100,6 T200,6 T300,6 T400,6"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.2"
              />
            </svg>
          </motion.div>

          <motion.div
            animate={{ x: [10, -10, 10] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-5 left-0 right-0 h-4 opacity-40"
          >
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 12">
              <path
                d="M0,6 Q50,12 100,6 T200,6 T300,6 T400,6"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.2"
              />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* 7. BEACH SHORELINE & SAND FOREGROUND */}
      <div className="absolute left-0 right-0 bottom-0 h-[14%] sm:h-[15%] z-[4] pointer-events-none">
        {/* Soft Sand Dune Curve */}
        <svg
          className="w-full h-full drop-shadow-[0_-3px_8px_rgba(0,0,0,0.35)]"
          preserveAspectRatio="none"
          viewBox="0 0 400 60"
        >
          {/* Foaming Surf Shoreline */}
          <path
            d="M0,22 Q100,10 200,18 Q300,26 400,14 L400,60 L0,60 Z"
            fill="rgba(255, 255, 255, 0.45)"
          />
          {/* Warm Sand Body */}
          <path
            d="M0,26 Q100,15 200,22 Q300,30 400,18 L400,60 L0,60 Z"
            fill="url(#sandGradient)"
          />
          <defs>
            <linearGradient id="sandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="40%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 8. TROPICAL PALM FRONDS (Silhouettes framing the beach) */}
      <div className="absolute top-0 left-0 w-28 h-28 pointer-events-none z-[5] opacity-75">
        <motion.div
          animate={{ rotate: [-1.5, 2.5, -1.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0 0" }}
        >
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-slate-900/90 dark:text-black/80">
            <path
              d="M0,0 Q35,20 70,55 C60,50 48,46 36,44 C48,40 60,34 68,26 C55,25 42,26 28,30 C38,22 50,14 62,8 C46,12 30,18 0,0 Z"
              fill="currentColor"
            />
          </svg>
        </motion.div>
      </div>

      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none z-[5] opacity-70">
        <motion.div
          animate={{ rotate: [1.5, -2, 1.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "100% 0" }}
        >
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-slate-900/85 dark:text-black/80">
            <path
              d="M100,0 Q65,22 30,58 C40,52 52,48 64,46 C52,42 40,36 32,28 C45,27 58,28 72,32 C62,24 50,16 38,10 C54,14 70,20 100,0 Z"
              fill="currentColor"
            />
          </svg>
        </motion.div>
      </div>

      {/* 9. HEADER WEATHER BADGE (Live official Buenos Aires weather pill) */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white shadow-lg text-[11px] font-semibold tracking-tight">
          {getWeatherIcon()}
          <span>{data ? `${data.current.temperature}°C` : "14°C"}</span>
          <span className="text-white/40">•</span>
          <span className="text-slate-200">
            {phase === "sunset" 
              ? "Atardecer" 
              : phase === "golden-hour" 
              ? "Ocaso" 
              : data?.current.weatherDescription || "Buenos Aires"}
          </span>
        </div>

        <button
          onClick={fetchWeather}
          disabled={refreshing}
          className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white/80 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
          title="Actualizar clima oficial de Buenos Aires"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
        </button>
      </div>

      {/* 10. CENTER SLOT: THE CARITA (Interactive Cube) */}
      <div className="relative z-10 flex items-center justify-center my-auto drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
        {children}
      </div>

      {/* 11. FOOTER CAPTION: Live Buenos Aires Location */}
      <div className="z-10 text-center pb-0.5">
        <span className="text-[10px] font-medium tracking-wide text-white/90 bg-black/35 px-2.5 py-0.5 rounded-full backdrop-blur-xs border border-white/10">
          Buenos Aires, AR • Clima en Vivo
        </span>
      </div>
    </div>
  );
}
