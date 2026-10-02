"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  Sun, 
  Moon, 
  CloudSun, 
  Cloud, 
  CloudRain, 
  Sunset, 
  Sunrise 
} from "lucide-react";
import { WeatherData } from "@/types/weather";

interface BeachWeatherBackdropProps {
  children?: React.ReactNode;
  className?: string;
  fullscreen?: boolean;
}

// Static raindrops for smooth performance
const RAINDROPS = Array.from({ length: 54 }, (_, i) => ({
  id: i,
  left: `${(i * 1.9) % 100}%`,
  top: `${-25 - ((i * 19) % 65)}px`,
  delay: `${((i * 0.09) % 1.5).toFixed(2)}s`,
  duration: `${(0.7 + ((i * 0.04) % 0.4)).toFixed(2)}s`,
  height: `${(20 + (i % 18))}px`,
  opacity: 0.4 + ((i % 5) * 0.12),
}));

// Rain ripples on the ground/lawn
const RIPPLES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${10 + (i * 9) % 80}%`,
  bottom: `${5 + (i * 2.5) % 16}%`,
  delay: `${(i * 0.28).toFixed(2)}s`,
  duration: `${(1.1 + (i % 3) * 0.35).toFixed(2)}s`,
}));

const RAIN_CODES = [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

export function BeachWeatherBackdrop({
  children,
  className = "",
  fullscreen = false,
}: BeachWeatherBackdropProps) {
  const [data, setData] = useState<WeatherData | null>(null);

  const fetchWeather = async () => {
    try {
      const res = await fetch("/api/weather");
      if (res.ok) {
        const json: WeatherData = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn("Error fetching weather in BeachWeatherBackdrop:", e);
    }
  };

  useEffect(() => {
    fetchWeather();

    // Actualizar automáticamente cada 5 minutos solo si la página está abierta y visible
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchWeather();
      }
    }, 5 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchWeather();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Determinar fase y parámetros climáticos de Buenos Aires
  const phase = data?.astronomy.phase || "day";
  const isDay = data?.current.isDay ?? true;
  const cloudCover = data?.current.cloudCover ?? 60;
  const solarProgress = data?.astronomy.solarProgress ?? 0.85;

  const isCloudy = (data?.current.weatherCode === 3) || (cloudCover >= 65);

  const isRaining = Boolean(
    data && (
      RAIN_CODES.includes(data.current.weatherCode) ||
      (data.current.precipitation ?? 0) > 0 ||
      (data.current.weatherDescription || "").toLowerCase().includes("lluv") ||
      (data.current.weatherDescription || "").toLowerCase().includes("chubasc")
    )
  );

  const isStorm = Boolean(data && [95, 96, 99].includes(data.current.weatherCode));

  // Posición del sol
  let sunXPercent = 50;
  let sunBottomPercent = 40;

  if (solarProgress >= 0) {
    sunXPercent = 20 + solarProgress * 55;
    const arcHeight = Math.sin(solarProgress * Math.PI);
    sunBottomPercent = 26 + arcHeight * 46;

    if (phase === "sunset") {
      sunBottomPercent = Math.min(30, Math.max(24, 25 + (1 - solarProgress) * 20));
    } else if (phase === "golden-hour") {
      sunBottomPercent = Math.min(48, Math.max(30, 30 + (1 - solarProgress) * 45));
    }
  }

  // Gradiente de cielo
  let skyGradient = "from-[#0284c7] via-[#38bdf8] via-[#7dd3fc] to-[#fef08a]"; // Día despejado por defecto
  let sunGlow = "rgba(251, 191, 36, 0.75)";

  if (isDay) {
    if (isRaining) {
      skyGradient = "from-[#475569] via-[#64748b] via-[#94a3b8] to-[#cbd5e1]";
      sunGlow = "rgba(226, 232, 240, 0.4)";
    } else if (isCloudy) {
      skyGradient = "from-[#475569] via-[#64748b] via-[#94a3b8] via-[#cbd5e1] to-[#e2e8f0]";
      sunGlow = "rgba(255, 255, 255, 0.75)";
    } else if (phase === "sunset") {
      skyGradient = "from-[#2563eb] via-[#7c3aed] via-[#db2777] via-[#ea580c] to-[#fde047]";
      sunGlow = "rgba(249, 115, 22, 0.95)";
    } else if (phase === "golden-hour") {
      skyGradient = "from-[#0284c7] via-[#38bdf8] via-[#fb923c] to-[#fde047]";
      sunGlow = "rgba(245, 158, 11, 0.9)";
    } else if (phase === "dawn") {
      skyGradient = "from-[#0284c7] via-[#ec4899] via-[#f43f5e] to-[#fde047]";
      sunGlow = "rgba(251, 146, 60, 0.85)";
    }
  } else {
    // Noche
    skyGradient = "from-[#020617] via-[#0b1329] via-[#0f172a] to-[#172554]";
    sunGlow = "rgba(199, 210, 254, 0.7)";
  }

  // Ícono de clima
  const getWeatherIcon = () => {
    if (isRaining) return <CloudRain className="w-3.5 h-3.5 text-cyan-300 animate-bounce" />;
    if (!isDay) return <Moon className="w-3.5 h-3.5 text-indigo-300" />;
    if (isCloudy) return <Cloud className="w-3.5 h-3.5 text-slate-200" />;
    if (phase === "sunset") return <Sunset className="w-3.5 h-3.5 text-amber-300 animate-pulse" />;
    if (phase === "dawn") return <Sunrise className="w-3.5 h-3.5 text-pink-300" />;
    if (cloudCover > 25) return <CloudSun className="w-3.5 h-3.5 text-amber-300" />;
    return <Sun className="w-3.5 h-3.5 text-amber-300" />;
  };

  return (
    <div
      className={
        fullscreen
          ? `fixed inset-0 z-[100] w-screen h-screen rounded-none border-none max-w-none shadow-none select-none transition-all duration-700 flex flex-col items-center justify-between p-6 sm:p-10 overflow-hidden ${className}`
          : `relative rounded-[36px] sm:rounded-[42px] overflow-hidden border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.65)] select-none transition-all duration-700 w-full max-w-[350px] sm:max-w-[410px] h-[360px] sm:h-[420px] flex flex-col items-center justify-between p-4 sm:p-5 ${className}`
      }
    >
      {/* Keyframes de Lluvia y Ondas */}
      <style jsx>{`
        @keyframes raindropFall {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 0.95;
          }
          85% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(${fullscreen ? "115vh" : "450px"}) translateX(-50px);
            opacity: 0;
          }
        }
        @keyframes rainRipple {
          0% {
            transform: scale(0.2);
            opacity: 0.85;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        @keyframes stormLightning {
          0%, 93%, 97%, 100% {
            opacity: 0;
          }
          94%, 96% {
            opacity: 0.8;
          }
          95% {
            opacity: 0.2;
          }
        }
        @keyframes cinemarkPulse {
          0%, 100% {
            text-shadow: 0 0 10px rgba(239, 68, 68, 0.9), 0 0 20px rgba(220, 38, 38, 0.7), 0 0 30px rgba(185, 28, 28, 0.5);
          }
          50% {
            text-shadow: 0 0 15px rgba(248, 113, 113, 1), 0 0 30px rgba(239, 68, 68, 0.9), 0 0 45px rgba(220, 38, 38, 0.7);
          }
        }
        @keyframes beaconPulse {
          0%, 100% {
            opacity: 0.25;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
            filter: drop-shadow(0 0 7px rgba(239, 68, 68, 1));
          }
        }
      `}</style>

      {/* 1. GRADIENTE DEL CIELO EN VIVO */}
      <div 
        className={`absolute inset-0 bg-gradient-to-b ${skyGradient} transition-colors duration-1000`}
      />

      {/* 2. ESTRELLAS (Solo de noche) */}
      {!isDay && (
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div className="absolute top-4 left-8 w-1 h-1 bg-white rounded-full animate-ping" />
          <div className="absolute top-10 left-28 w-1.5 h-1.5 bg-indigo-200 rounded-full opacity-70" />
          <div className="absolute top-6 right-16 w-1 h-1 bg-white rounded-full animate-pulse" />
          <div className="absolute top-16 right-32 w-1.5 h-1.5 bg-purple-200 rounded-full opacity-60" />
          <div className="absolute top-24 left-16 w-1 h-1 bg-amber-100 rounded-full opacity-80" />
          {fullscreen && (
            <>
              <div className="absolute top-8 left-1/3 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-indigo-100 rounded-full" />
              <div className="absolute top-20 right-1/3 w-1 h-1 bg-purple-100 rounded-full animate-ping" />
            </>
          )}
        </div>
      )}

      {/* 3. NUBES - CAPA TRASERA */}
      {(cloudCover > 20 || isRaining || isCloudy) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ x: [-30, 45, -30] }}
            transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute top-10 -left-6 ${isRaining ? "opacity-60" : "opacity-45"} filter blur-xs ${fullscreen ? "scale-150" : ""}`}
          >
            <svg width={fullscreen ? "280" : "180"} height={fullscreen ? "110" : "70"} viewBox="0 0 100 40" fill={isRaining ? "#64748b" : "#f1f5f9"}>
              <path d="M10,30 Q20,10 40,20 Q55,5 75,18 Q90,15 95,30 Z" opacity="0.85" />
            </svg>
          </motion.div>

          <motion.div
            animate={{ x: [25, -35, 25] }}
            transition={{ duration: 48, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute top-16 right-0 ${isRaining ? "opacity-55" : "opacity-40"} filter blur-xs ${fullscreen ? "scale-150" : ""}`}
          >
            <svg width={fullscreen ? "320" : "210"} height={fullscreen ? "120" : "80"} viewBox="0 0 100 40" fill={isRaining ? "#475569" : "#e2e8f0"}>
              <path d="M15,32 Q30,12 55,22 Q70,8 88,20 Q98,18 100,32 Z" opacity="0.8" />
            </svg>
          </motion.div>
        </div>
      )}

      {/* 4. SOL / LUNA */}
      {isDay ? (
        <div
          className="absolute pointer-events-none transition-all duration-1000 ease-out"
          style={{
            left: `${sunXPercent}%`,
            bottom: `${sunBottomPercent}%`,
            transform: "translate(-50%, 50%)",
          }}
        >
          {/* Resplandor exterior difuso */}
          <div
            className={`absolute ${fullscreen ? "-inset-20" : "-inset-10"} rounded-full ${fullscreen ? "blur-3xl" : "blur-2xl"} pointer-events-none animate-pulse`}
            style={{
              background: `radial-gradient(circle, ${sunGlow} 0%, rgba(254, 215, 170, 0) 70%)`,
            }}
          />

          {/* Corona solar */}
          <div
            className={`absolute ${fullscreen ? "-inset-12" : "-inset-6"} rounded-full blur-xl pointer-events-none opacity-85`}
            style={{
              background: isCloudy 
                ? "radial-gradient(circle, #ffffff 30%, rgba(254, 240, 138, 0.6) 65%, transparent 85%)"
                : `radial-gradient(circle, #fde047 20%, ${sunGlow} 60%, transparent 80%)`,
            }}
          />

          {/* Núcleo luminoso del sol */}
          <div className={`relative ${fullscreen ? "w-28 h-28 sm:w-36 sm:h-36" : "w-16 h-16 sm:w-20 sm:h-20"} rounded-full ${
            isCloudy 
              ? "bg-gradient-to-t from-amber-200 via-yellow-100 to-white shadow-[0_0_45px_rgba(255,255,255,0.9),0_0_90px_rgba(254,240,138,0.7)]" 
              : "bg-gradient-to-t from-amber-400 via-yellow-200 to-white shadow-[0_0_50px_rgba(251,191,36,0.9),0_0_100px_rgba(245,158,11,0.6)]"
          } border border-yellow-100/70`} />
        </div>
      ) : (
        /* Luna brillante de noche */
        <div
          className="absolute pointer-events-none"
          style={{
            right: "24%",
            top: "16%",
          }}
        >
          <div className={`absolute ${fullscreen ? "-inset-12" : "-inset-6"} rounded-full blur-xl bg-indigo-300/40 pointer-events-none`} />
          <div className={`relative ${fullscreen ? "w-20 h-20" : "w-12 h-12"} rounded-full bg-gradient-to-br from-white via-indigo-100 to-slate-300 shadow-[0_0_35px_rgba(255,255,255,0.7)] flex items-center justify-center border border-white/50`}>
            <div className={`rounded-full bg-slate-900/10 blur-[1px] ${fullscreen ? "w-15 h-15" : "w-9 h-9"}`} />
          </div>
        </div>
      )}

      {/* 5. NUBES VOLUMÉTRICAS DELANTERAS */}
      {(cloudCover > 20 || isRaining || isCloudy) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
          <motion.div
            animate={{ x: [-20, 30, -20] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute opacity-90 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${fullscreen ? "scale-140" : ""}`}
            style={{
              left: `${Math.max(5, sunXPercent - 32)}%`,
              bottom: `${Math.max(26, sunBottomPercent - 4)}%`,
            }}
          >
            <svg width={fullscreen ? "240" : "170"} height={fullscreen ? "90" : "65"} viewBox="0 0 160 60" fill="none">
              <path
                d="M20,48 C20,38 28,30 38,30 C40,18 52,10 65,10 C80,10 92,20 96,32 C104,30 114,35 116,44 C124,44 132,50 132,58 L20,58 Z"
                fill={isRaining ? "url(#cloudGradRain1)" : isCloudy ? "url(#cloudGradDayCloudy)" : "url(#cloudGradFront)"}
              />
              <defs>
                <linearGradient id="cloudGradDayCloudy" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                  <stop offset="60%" stopColor="#f1f5f9" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.88" />
                </linearGradient>
                <linearGradient id="cloudGradFront" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#fed7aa" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.75" />
                </linearGradient>
                <linearGradient id="cloudGradRain1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#64748b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#334155" stopOpacity="0.85" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>

          <motion.div
            animate={{ x: [25, -20, 25] }}
            transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute opacity-88 filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.18)] ${fullscreen ? "scale-140" : ""}`}
            style={{
              left: `${Math.min(50, sunXPercent + 6)}%`,
              bottom: `${Math.max(28, sunBottomPercent - 2)}%`,
            }}
          >
            <svg width={fullscreen ? "260" : "190"} height={fullscreen ? "100" : "75"} viewBox="0 0 170 65" fill="none">
              <path
                d="M25,52 C22,40 32,32 44,32 C48,18 64,10 78,12 C92,12 104,22 108,34 C118,34 126,40 128,50 L25,52 Z"
                fill={isRaining ? "url(#cloudGradRain2)" : isCloudy ? "url(#cloudGradDayCloudy2)" : "url(#cloudGradFront2)"}
              />
              <defs>
                <linearGradient id="cloudGradDayCloudy2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
                  <stop offset="55%" stopColor="#f8fafc" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.82" />
                </linearGradient>
                <linearGradient id="cloudGradFront2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
                  <stop offset="60%" stopColor="#ffedd5" stopOpacity="0.82" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="cloudGradRain2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#64748b" stopOpacity="0.88" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.8" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </div>
      )}

      {/* 6. EDIFICIOS ARQUITECTÓNICOS MODERNOS, CRISTALES Y SKYLINE */}
      <div className={`absolute left-0 right-0 bottom-[14%] ${fullscreen ? "h-[62%]" : "h-[54%]"} z-[3] pointer-events-none overflow-hidden flex items-end justify-center`}>
        
        {/* Siluetas de fondo de la ciudad / Skyline lejano con antenas y luces de baliza */}
        <div className="absolute bottom-0 left-0 right-0 h-[56%] opacity-40 flex items-end justify-between px-3 sm:px-10 pointer-events-none">
          {/* Edificio 1 lejano (izquierda): Torre con remate escalonado */}
          <div className="relative flex flex-col items-center">
            <div className="w-0.5 h-4 bg-slate-500 relative flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-red-500" style={{ animation: "beaconPulse 2.4s ease-in-out infinite" }} />
            </div>
            <div className="w-4 h-2 bg-slate-700 rounded-t-xs" />
            <div className="w-8 sm:w-14 h-28 sm:h-38 bg-gradient-to-t from-[#0a101d] via-[#121c2c] to-[#1e2a3c] rounded-t-sm border-t border-x border-slate-700/50" />
          </div>

          {/* Edificio 2 lejano: Torre con antena delgada */}
          <div className="relative flex flex-col items-center">
            <div className="w-0.5 h-6 bg-slate-400 relative flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-red-400" style={{ animation: "beaconPulse 1.8s ease-in-out infinite" }} />
            </div>
            <div className="w-7 sm:w-12 h-20 sm:h-28 bg-gradient-to-t from-[#0a101d] via-[#152030] to-[#1b2738] rounded-t-sm border-t border-x border-slate-700/40" />
          </div>

          {/* Edificio 3 lejano: Rascacielos con remate biselado (estilo Torre Macro) */}
          <div className="relative flex flex-col items-center">
            <div 
              className="w-10 sm:w-16 h-3 sm:h-5 bg-gradient-to-t from-[#1b2738] to-[#25354c] border-t border-slate-600/50"
              style={{ clipPath: "polygon(0% 100%, 35% 0%, 100% 0%, 100% 100%)" }}
            />
            <div className="w-10 sm:w-16 h-36 sm:h-48 bg-gradient-to-t from-[#0a101d] via-[#131d2d] to-[#1b2738] border-x border-slate-700/40" />
          </div>

          {/* Edificio 4 lejano: Corporativo central bajo */}
          <div className="w-12 sm:w-20 h-18 sm:h-26 bg-gradient-to-t from-[#0a101d] to-[#162234] rounded-t-xs border-t border-x border-slate-700/40" />

          {/* Edificio 5 lejano: Torre residencial con balcones sutiles */}
          <div className="relative flex flex-col items-center">
            <div className="w-0.5 h-5 bg-slate-400 relative flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-red-500" style={{ animation: "beaconPulse 2.1s ease-in-out infinite" }} />
            </div>
            <div className="w-10 sm:w-18 h-32 sm:h-44 bg-gradient-to-t from-[#0a101d] via-[#121c2d] to-[#1d2a3d] rounded-t-sm border-t border-x border-slate-700/40" />
          </div>

          {/* Edificio 6 lejano (derecha): Aguja y fachada vidriada */}
          <div className="relative flex flex-col items-center">
            <div className="w-0.5 h-7 bg-slate-500 relative flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-red-400" style={{ animation: "beaconPulse 1.9s ease-in-out infinite" }} />
            </div>
            <div className="w-8 sm:w-14 h-24 sm:h-34 bg-gradient-to-t from-[#0a101d] to-[#182436] rounded-t-sm border-t border-x border-slate-700/40" />
          </div>
        </div>

        {/* NIEBLA / ATMÓSFERA URBANA BASE */}
        <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-[#080d17]/80 via-[#0b1322]/40 to-transparent pointer-events-none" />

        {/* EDIFICIO SECUNDARIO DE RESPALDO (Izquierda-centro profundidad) */}
        <div 
          className={`relative ${
            fullscreen ? "w-[120px] sm:w-[150px] h-[72%] left-[-26%] sm:left-[-28%]" : "w-[70px] sm:w-[85px] h-[68%] left-[-24%] sm:left-[-26%]"
          } z-[3] opacity-65 flex flex-col items-center justify-end`}
        >
          <div className="w-0.5 h-5 bg-slate-500 relative flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-red-500" style={{ animation: "beaconPulse 2.6s ease-in-out infinite" }} />
          </div>
          <div className="w-[85%] h-2 bg-slate-700/80 rounded-t-xs" />
          <div className="w-full h-full bg-gradient-to-b from-[#1b263b] via-[#111927] to-[#0a0f18] border-x border-t border-slate-600/50 rounded-t-sm relative overflow-hidden p-1 flex flex-col justify-between">
            <div className="space-y-1 opacity-50">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-1.5 w-full flex gap-0.5">
                  <div className={`flex-1 rounded-[1px] ${i % 3 === 0 ? "bg-amber-200/40" : "bg-slate-700/50"}`} />
                  <div className={`flex-1 rounded-[1px] ${i % 2 === 0 ? "bg-cyan-200/40" : "bg-slate-700/50"}`} />
                  <div className={`flex-1 rounded-[1px] ${i % 4 === 1 ? "bg-amber-200/50" : "bg-slate-700/50"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* EDIFICIO PRINCIPAL DE CINEMARK (Izquierda-centro) */}
        <div 
          className={`relative ${
            fullscreen 
              ? "w-[260px] sm:w-[320px] md:w-[360px] h-[88%] left-[-14%] sm:left-[-17%] md:left-[-19%]" 
              : "w-[130px] sm:w-[150px] h-[86%] left-[-13%] sm:left-[-15%]"
          } flex flex-col items-center justify-end z-[4] transition-all duration-500`}
        >
          {/* Halo ambiental rojo proyectado hacia el cielo (solo en fullscreen) */}
          {fullscreen && (
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 sm:w-80 h-28 bg-red-600/35 blur-3xl pointer-events-none animate-pulse" />
          )}

          {/* ESTRUCTURA DEL TECHO ARQUITECTÓNICO */}
          <div className="relative z-10 w-full flex flex-col items-center mb-0.5">
            {fullscreen ? (
              /* En pantalla grande: Cartel Neón Cinemark sobre celosía metálica */
              <div className="relative flex flex-col items-center w-full">
                {/* Antena lateral izquierda con baliza aeronáutica */}
                <div className="absolute -top-7 left-4 flex flex-col items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" style={{ animation: "beaconPulse 1.7s ease-in-out infinite" }} />
                  <div className="w-0.5 h-6 bg-gradient-to-b from-slate-400 to-slate-600" />
                </div>

                {/* Estructura del cartel con marco y luces */}
                <div className="relative px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-lg bg-gradient-to-b from-[#1c0808] to-[#0c0404] border border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.75),inset_0_0_15px_rgba(220,38,38,0.45)] backdrop-blur-md flex items-center justify-center">
                  {/* Resplandor interno sutil */}
                  <div className="absolute inset-0 bg-red-500/10 rounded-lg blur-xs pointer-events-none" />
                  
                  <span 
                    className="relative text-xs sm:text-base md:text-lg font-black text-[#ff2a2a] uppercase font-sans select-none tracking-[0.22em] drop-shadow-[0_0_10px_rgba(255,40,40,0.9)]"
                    style={{
                      animation: "cinemarkPulse 3s ease-in-out infinite"
                    }}
                  >
                    CINEMARK
                  </span>
                </div>

                {/* Pilares y vigas de soporte estructural del cartel */}
                <div className="flex items-center justify-around w-3/4 h-2.5">
                  <div className="w-1 h-full bg-gradient-to-b from-slate-600 to-slate-800" />
                  <div className="w-1 h-full bg-gradient-to-b from-slate-600 to-slate-800" />
                  <div className="w-1 h-full bg-gradient-to-b from-slate-600 to-slate-800" />
                </div>
              </div>
            ) : (
              /* En versión pequeña: Remate corporativo elegante moderno sin cartel */
              <div className="relative flex flex-col items-center w-full mb-1">
                {/* Antena moderna delgada con baliza roja */}
                <div className="flex flex-col items-center -mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" style={{ animation: "beaconPulse 1.8s ease-in-out infinite" }} />
                  <div className="w-0.5 h-5 bg-gradient-to-b from-slate-400 to-slate-600" />
                </div>
                {/* Penthouse técnico con rejillas de ventilación y luz de cristal */}
                <div className="w-16 h-2.5 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-t border-x border-slate-600 rounded-t-xs flex items-center justify-center gap-1">
                  <div className="w-2.5 h-1 bg-cyan-300/40 rounded-xs" />
                  <div className="w-2.5 h-1 bg-cyan-300/40 rounded-xs" />
                  <div className="w-2.5 h-1 bg-cyan-300/40 rounded-xs" />
                </div>
              </div>
            )}

            {/* Cornisa arquitectónica superior de la torre */}
            <div className="w-[104%] h-2 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-t border-slate-500/80 shadow-md rounded-t-xs" />
          </div>

          {/* CUERPO DE LA TORRE (Fachada moderna muro cortina con cristales y reflejos) */}
          <div className="w-full h-full rounded-t-sm bg-gradient-to-b from-[#141d2f] via-[#0d1624] to-[#070b13] border-x border-t border-slate-600/80 shadow-[0_15px_45px_rgba(0,0,0,0.85)] relative overflow-hidden flex flex-col">
            
            {/* Línea LED de iluminación arquitectónica en el borde izquierdo */}
            <div className="absolute top-0 bottom-0 left-0 w-[1.5px] bg-gradient-to-b from-cyan-400/50 via-sky-500/20 to-transparent pointer-events-none" />

            {/* Reflejo diagonal de luz sobre el cristal continuo */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-80"
              style={{
                background: "linear-gradient(118deg, transparent 25%, rgba(255,255,255,0.11) 45%, rgba(255,255,255,0.02) 55%, transparent 75%)"
              }}
            />

            {/* Montantes verticales del muro cortina */}
            <div className="absolute inset-0 flex justify-between pointer-events-none px-2 opacity-25">
              <div className="w-[1px] h-full bg-cyan-300" />
              <div className="w-[1px] h-full bg-cyan-300" />
              <div className="w-[1px] h-full bg-cyan-300" />
              <div className="w-[1px] h-full bg-cyan-300" />
            </div>

            {/* Pisos y ventanales arquitectónicos */}
            <div className="flex-1 flex flex-col justify-between py-2 px-2 sm:px-3 relative z-10">
              {Array.from({ length: fullscreen ? 13 : 9 }).map((_, floorIdx) => (
                <div key={floorIdx} className="w-full border-b border-white/[0.06] pb-1 flex items-center justify-between gap-1">
                  {Array.from({ length: fullscreen ? 6 : 5 }).map((_, winIdx) => {
                    const seed = (floorIdx * 7 + winIdx * 11) % 19;
                    const isLitWarm = seed === 1 || seed === 5 || seed === 9 || seed === 14;
                    const isLitCool = seed === 3 || seed === 8 || seed === 12;
                    return (
                      <div
                        key={winIdx}
                        className={`h-2 sm:h-2.5 flex-1 rounded-[1.5px] transition-colors ${
                          isLitWarm
                            ? "bg-amber-100/75 shadow-[0_0_5px_rgba(251,191,36,0.65)]"
                            : isLitCool
                            ? "bg-sky-100/60 shadow-[0_0_4px_rgba(186,230,254,0.5)]"
                            : "bg-[#182337]/90 border border-slate-700/30"
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Lobby de doble altura / Entrada iluminada en la base */}
            <div className="w-full h-8 sm:h-10 bg-gradient-to-t from-slate-950 via-[#101726] to-transparent border-t border-slate-700/70 mt-auto flex items-center justify-center px-4 relative z-10">
              <div className="w-12 sm:w-16 h-4 sm:h-5 rounded-t-xs bg-amber-400/25 border-x border-t border-amber-300/40 flex items-center justify-center">
                <div className="w-2.5 sm:w-3 h-full bg-amber-300/40" />
              </div>
            </div>
          </div>
        </div>

        {/* EDIFICIO SECUNDARIO A LA DERECHA (Inspirado en Puerto Madero / Torre Macro con corona biselada) */}
        <div 
          className={`relative ${
            fullscreen ? "w-[200px] sm:w-[250px] h-[72%] right-[-10%] sm:right-[-12%]" : "w-[95px] sm:w-[115px] h-[64%] right-[-11%] sm:right-[-13%]"
          } flex flex-col items-center justify-end z-[4] transition-all duration-500`}
        >
          {/* Antena con baliza en la cúspide */}
          <div className="flex flex-col items-center self-end mr-6 -mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_#f87171]" style={{ animation: "beaconPulse 2.3s ease-in-out infinite" }} />
            <div className="w-0.5 h-5 bg-slate-400" />
          </div>

          {/* Corona biselada con jardín de invierno / Sky Lounge iluminado */}
          <div 
            className="w-full h-5 sm:h-7 bg-gradient-to-t from-[#16253b] to-[#243b5e] border-t border-l border-cyan-400/40 rounded-tl-lg relative overflow-hidden flex items-center justify-end pr-3"
            style={{
              clipPath: "polygon(0% 100%, 0% 40%, 40% 0%, 100% 0%, 100% 100%)"
            }}
          >
            <div className="w-12 h-3 bg-cyan-300/25 blur-xs rounded-full" />
          </div>

          {/* Fachada acristalada en tonos navy y cyan */}
          <div className="w-full h-full rounded-t-xs bg-gradient-to-b from-[#162234] via-[#0f1724] to-[#090e17] border-x border-t border-slate-700/80 shadow-2xl relative overflow-hidden flex flex-col p-2">
            
            {/* Reflejo de cristal */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{
                background: "linear-gradient(130deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)"
              }}
            />

            {/* Ventanales de la torre complementaria */}
            <div className="flex-1 flex flex-col justify-between py-1 relative z-10">
              {Array.from({ length: fullscreen ? 10 : 7 }).map((_, fIdx) => (
                <div key={fIdx} className="w-full border-b border-white/[0.05] pb-0.5 flex gap-1">
                  {Array.from({ length: 4 }).map((_, wIdx) => {
                    const isLit = (fIdx + wIdx * 3) % 4 === 0;
                    return (
                      <div
                        key={wIdx}
                        className={`h-2 flex-1 rounded-xs ${
                          isLit 
                            ? "bg-cyan-200/50 shadow-[0_0_4px_rgba(165,243,252,0.4)]" 
                            : "bg-slate-800/80 border border-slate-700/30"
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TORRE COMPLEMENTARIA EXTREMO DERECHO (Solo en fullscreen para gran escala panorámica) */}
        {fullscreen && (
          <div className="relative w-[140px] sm:w-[170px] h-[58%] right-[-18%] z-[3] opacity-75 flex flex-col items-center justify-end">
            <div className="w-0.5 h-4 bg-slate-400 relative flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-red-400" style={{ animation: "beaconPulse 2.8s ease-in-out infinite" }} />
            </div>
            <div className="w-full h-full bg-gradient-to-b from-[#1c273a] to-[#0d1420] border-x border-t border-slate-700/60 rounded-t-sm p-1.5 flex flex-col justify-between">
              <div className="space-y-1 opacity-60">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-1.5 w-full flex gap-1">
                    <div className={`flex-1 rounded-[1px] ${i % 2 === 0 ? "bg-amber-200/40" : "bg-slate-700/40"}`} />
                    <div className={`flex-1 rounded-[1px] ${i % 3 === 0 ? "bg-cyan-200/40" : "bg-slate-700/40"}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. PASTO VERDE / PARQUE EN EL FRENTE */}
      <div className={`absolute left-0 right-0 bottom-0 ${fullscreen ? "h-[20%]" : "h-[18%]"} z-[5] pointer-events-none overflow-hidden`}>
        {/* Curvas orgánicas de colinas y pasto verde */}
        <svg
          className="w-full h-full drop-shadow-[0_-5px_12px_rgba(0,0,0,0.4)]"
          preserveAspectRatio="none"
          viewBox="0 0 500 100"
        >
          {/* Capa de pasto de fondo (verde medio) */}
          <path
            d="M0,35 Q120,10 250,28 Q380,45 500,20 L500,100 L0,100 Z"
            fill="url(#grassBgGrad)"
          />
          {/* Capa de pasto frontal (verde vibrante iluminado) */}
          <path
            d="M0,45 Q150,22 300,38 Q420,15 500,32 L500,100 L0,100 Z"
            fill="url(#grassFgGrad)"
          />
          <defs>
            <linearGradient id="grassBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isRaining ? "#15803d" : "#22c55e"} />
              <stop offset="60%" stopColor={isRaining ? "#166534" : "#16a34a"} />
              <stop offset="100%" stopColor="#14532d" />
            </linearGradient>
            <linearGradient id="grassFgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isRaining ? "#16a34a" : "#4ade80"} />
              <stop offset="40%" stopColor={isRaining ? "#15803d" : "#22c55e"} />
              <stop offset="100%" stopColor="#052e16" />
            </linearGradient>
          </defs>
        </svg>

        {/* Briznas de pasto estilizadas en la orilla del césped */}
        <div className="absolute bottom-2 left-6 sm:left-12 flex gap-1 opacity-70 text-emerald-300">
          <motion.div animate={{ rotate: [-2, 3, -2] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,24 C10,16 6,10 2,4 C5,8 10,14 12,24 Z" />
              <path d="M12,24 C14,15 18,9 22,2 C19,7 15,13 12,24 Z" />
            </svg>
          </motion.div>
        </div>

        <div className="absolute bottom-3 right-8 sm:right-16 flex gap-1 opacity-65 text-emerald-300">
          <motion.div animate={{ rotate: [2, -3, 2] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,24 C11,16 8,11 3,6 C6,9 10,15 12,24 Z" />
              <path d="M12,24 C13,15 17,10 21,5 C18,8 14,14 12,24 Z" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* 8. EFECTO DE LLUVIA (Si llueve en Buenos Aires) */}
      {isRaining && (
        <div className="absolute inset-0 pointer-events-none z-[8] overflow-hidden">
          {RAINDROPS.map((drop) => (
            <div
              key={drop.id}
              className="absolute w-[1.5px] rounded-full"
              style={{
                left: drop.left,
                top: drop.top,
                height: drop.height,
                opacity: drop.opacity,
                background: "linear-gradient(180deg, transparent, rgba(186, 230, 253, 0.7) 40%, rgba(255, 255, 255, 0.95) 100%)",
                animation: `raindropFall ${drop.duration} linear ${drop.delay} infinite`,
              }}
            />
          ))}

          {RIPPLES.map((rip) => (
            <div
              key={rip.id}
              className="absolute rounded-full border border-cyan-200/50"
              style={{
                left: rip.left,
                bottom: rip.bottom,
                width: fullscreen ? "24px" : "18px",
                height: fullscreen ? "10px" : "8px",
                animation: `rainRipple ${rip.duration} ease-out ${rip.delay} infinite`,
              }}
            />
          ))}

          <div className="absolute inset-0 bg-slate-900/20 pointer-events-none" />

          {isStorm && (
            <div
              className="absolute inset-0 bg-cyan-100/35 pointer-events-none"
              style={{ animation: "stormLightning 7s ease-in-out infinite" }}
            />
          )}
        </div>
      )}

      {/* 9. BADGE SUPERIOR DE CLIMA OFICIAL */}
      <div className={`w-full flex items-center justify-between z-10 ${fullscreen ? "max-w-6xl mx-auto" : ""}`}>
        <div 
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white shadow-lg text-[11px] font-semibold tracking-tight select-none"
        >
          {getWeatherIcon()}
          <span>{data ? `${data.current.temperature}°C` : "14°C"}</span>
          <span className="text-white/40">•</span>
          <span className="text-slate-200">
            {isRaining 
              ? (isStorm ? "Tormenta" : "Lluvia") 
              : isCloudy
              ? "Nublado"
              : phase === "sunset" 
              ? "Atardecer" 
              : phase === "golden-hour" 
              ? "Atardecer" 
              : data?.current.weatherDescription || "Buenos Aires"}
          </span>
        </div>

        {/* Indicador en vivo sutil */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/15 text-[10px] text-emerald-300 font-medium tracking-tight">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>En vivo</span>
        </div>
      </div>

      {/* 10. CENTRO: LA CARITA (Interactive Cube) */}
      <div className="relative z-10 flex items-center justify-center my-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.65)]">
        {children}
      </div>

      {/* 11. PIE */}
      {fullscreen && (
        <div className="z-10 text-center pb-1">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[11px] font-mono text-slate-300 tracking-widest shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span>MODO REPOSO • MOVER EL MOUSE PARA REGRESAR</span>
          </div>
        </div>
      )}
    </div>
  );
}
