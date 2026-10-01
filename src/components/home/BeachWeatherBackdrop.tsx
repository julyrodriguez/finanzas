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

// 48 static raindrops with staggered positions and timings
const RAINDROPS = Array.from({ length: 54 }, (_, i) => ({
  id: i,
  left: `${(i * 1.9) % 100}%`,
  top: `${-25 - ((i * 19) % 65)}px`,
  delay: `${((i * 0.09) % 1.5).toFixed(2)}s`,
  duration: `${(0.7 + ((i * 0.04) % 0.4)).toFixed(2)}s`,
  height: `${(20 + (i % 18))}px`,
  opacity: 0.4 + ((i % 5) * 0.12),
}));

// Water surface ripples where drops hit the sea
const RIPPLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${10 + (i * 8) % 80}%`,
  bottom: `${7 + (i * 2.8) % 19}%`,
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

    // Cuando el usuario regresa a la pestaña abierta, actualizar inmediatamente
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

  // Determinar fase y parámetros climáticos
  const phase = data?.astronomy.phase || "day";
  const isDay = data?.current.isDay ?? true;
  const cloudCover = data?.current.cloudCover ?? 60;
  const solarProgress = data?.astronomy.solarProgress ?? 0.85;

  const isCloudy = (data?.current.weatherCode === 3) || (cloudCover >= 65);

  const isActualRaining = Boolean(
    data && (
      RAIN_CODES.includes(data.current.weatherCode) ||
      (data.current.precipitation ?? 0) > 0 ||
      (data.current.weatherDescription || "").toLowerCase().includes("lluv") ||
      (data.current.weatherDescription || "").toLowerCase().includes("chubasc")
    )
  );

  const isRaining = isActualRaining;
  const isStorm = Boolean(data && [95, 96, 99].includes(data.current.weatherCode));

  // Posición del sol
  let sunXPercent = 50;
  let sunBottomPercent = 40;

  if (solarProgress >= 0) {
    sunXPercent = 20 + solarProgress * 55;
    const arcHeight = Math.sin(solarProgress * Math.PI);
    sunBottomPercent = 24 + arcHeight * 46;

    if (phase === "sunset") {
      sunBottomPercent = Math.min(27, Math.max(22, 24 + (1 - solarProgress) * 20));
    } else if (phase === "golden-hour") {
      sunBottomPercent = Math.min(45, Math.max(28, 28 + (1 - solarProgress) * 45));
    }
  }

  // Gradiente de cielo y mar
  let skyGradient = "from-[#0284c7] via-[#38bdf8] via-[#7dd3fc] to-[#fef08a]"; // Día despejado por defecto
  let sunGlow = "rgba(251, 191, 36, 0.75)";
  let oceanGradient = "from-[#0369a1] via-[#0284c7] to-[#075985]";

  if (isDay) {
    // === HORARIO DIURNO (NUNCA parecer de noche mientras sea de día) ===
    if (isRaining) {
      // Día con lluvia: cielo gris azulado luminoso con bruma diurna
      skyGradient = "from-[#475569] via-[#64748b] via-[#94a3b8] to-[#cbd5e1]";
      sunGlow = "rgba(226, 232, 240, 0.4)";
      oceanGradient = "from-[#334155] via-[#475569] to-[#0284c7]";
    } else if (isCloudy) {
      // Día nublado: cielo iluminado plateado/celeste suave, 100% diurno
      skyGradient = "from-[#475569] via-[#64748b] via-[#94a3b8] via-[#cbd5e1] to-[#e2e8f0]";
      sunGlow = "rgba(255, 255, 255, 0.75)";
      oceanGradient = "from-[#1e293b] via-[#334155] via-[#0284c7] to-[#38bdf8]";
    } else if (phase === "sunset") {
      // Atardecer con sol cayendo sobre el mar
      skyGradient = "from-[#2563eb] via-[#7c3aed] via-[#db2777] via-[#ea580c] to-[#fde047]";
      sunGlow = "rgba(249, 115, 22, 0.95)";
      oceanGradient = "from-[#1e3a8a] via-[#3b82f6] via-[#ea580c] to-[#f59e0b]";
    } else if (phase === "golden-hour") {
      // Atardecer previo / sol de tarde cálido
      skyGradient = "from-[#0284c7] via-[#38bdf8] via-[#fb923c] to-[#fde047]";
      sunGlow = "rgba(245, 158, 11, 0.9)";
      oceanGradient = "from-[#0369a1] via-[#0284c7] via-[#f59e0b] to-[#fbbf24]";
    } else if (phase === "dawn") {
      // Amanecer
      skyGradient = "from-[#0284c7] via-[#ec4899] via-[#f43f5e] to-[#fde047]";
      sunGlow = "rgba(251, 146, 60, 0.85)";
      oceanGradient = "from-[#1e3a8a] via-[#be123c] to-[#f59e0b]";
    }
  } else {
    // === NOCHE / OSCURIDAD (Solo cuando el sol ya se ocultó) ===
    skyGradient = "from-[#020617] via-[#0b1329] via-[#0f172a] to-[#172554]";
    sunGlow = "rgba(199, 210, 254, 0.7)";
    oceanGradient = "from-[#020617] via-[#080d1a] to-[#0f172a]";
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
      `}</style>

      {/* 1. GRADIENTE DEL CIELO */}
      <div 
        className={`absolute inset-0 bg-gradient-to-b ${skyGradient} transition-colors duration-1000`}
      />

      {/* 2. ESTRELLAS (Solo de noche cuando no es de día) */}
      {!isDay && (
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div className="absolute top-4 left-8 w-1 h-1 bg-white rounded-full animate-ping" />
          <div className="absolute top-10 left-28 w-1.5 h-1.5 bg-indigo-200 rounded-full opacity-70" />
          <div className="absolute top-6 right-16 w-1 h-1 bg-white rounded-full animate-pulse" />
          <div className="absolute top-16 right-32 w-1.5 h-1.5 bg-purple-200 rounded-full opacity-60" />
          <div className="absolute top-24 left-16 w-1 h-1 bg-amber-100 rounded-full opacity-80" />
          <div className="absolute top-14 right-8 w-1 h-1 bg-white rounded-full" />
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

      {/* 4. SOL (Siempre presente de día, visible entre nubes) */}
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
            right: "26%",
            top: "18%",
          }}
        >
          <div className={`absolute ${fullscreen ? "-inset-12" : "-inset-6"} rounded-full blur-xl bg-indigo-300/40 pointer-events-none`} />
          <div className={`relative ${fullscreen ? "w-20 h-20" : "w-12 h-12"} rounded-full bg-gradient-to-br from-white via-indigo-100 to-slate-300 shadow-[0_0_35px_rgba(255,255,255,0.7)] flex items-center justify-center border border-white/50`}>
            <div className={`rounded-full bg-slate-900/10 blur-[1px] ${fullscreen ? "w-15 h-15" : "w-9 h-9"}`} />
          </div>
        </div>
      )}

      {/* 5. NUBES VOLUMÉTRICAS DELANTERAS (El sol asomándose entre nubes de día) */}
      {(cloudCover > 20 || isRaining || isCloudy) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
          {/* Nube izquierda */}
          <motion.div
            animate={{ x: [-20, 30, -20] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute opacity-90 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${fullscreen ? "scale-140" : ""}`}
            style={{
              left: `${Math.max(5, sunXPercent - 32)}%`,
              bottom: `${Math.max(22, sunBottomPercent - 4)}%`,
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

          {/* Nube derecha */}
          <motion.div
            animate={{ x: [25, -20, 25] }}
            transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute opacity-88 filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.18)] ${fullscreen ? "scale-140" : ""}`}
            style={{
              left: `${Math.min(50, sunXPercent + 6)}%`,
              bottom: `${Math.max(24, sunBottomPercent - 2)}%`,
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

      {/* 6. OCÉANO Y REFLEJO */}
      <div className={`absolute left-0 right-0 bottom-0 ${fullscreen ? "h-[32%]" : "h-[28%]"} z-[3] overflow-hidden pointer-events-none`}>
        <div className={`w-full h-full bg-gradient-to-b ${oceanGradient} opacity-95 relative`}>
          
          {/* Línea de horizonte */}
          <div 
            className="absolute top-0 left-0 right-0 h-[2px] opacity-75"
            style={{
              background: isDay 
                ? (isCloudy 
                    ? "linear-gradient(90deg, transparent, #e2e8f0 50%, transparent)" 
                    : phase === "sunset" 
                    ? "linear-gradient(90deg, transparent, #fbbf24 40%, #f97316 60%, transparent)" 
                    : "linear-gradient(90deg, transparent, #bae6fd 50%, transparent)")
                : "linear-gradient(90deg, transparent, #38bdf8 50%, transparent)"
            }}
          />

          {/* Reflejo de luz solar en el agua */}
          {isDay && (
            <motion.div
              animate={{ opacity: [0.75, 0.95, 0.75], scaleX: [0.95, 1.05, 0.95] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute top-0 bottom-0 ${fullscreen ? "w-36 sm:w-52" : "w-24 sm:w-32"} filter blur-[2px]`}
              style={{
                left: `${sunXPercent}%`,
                transform: "translateX(-50%)",
                background: phase === "sunset"
                  ? "linear-gradient(180deg, rgba(254, 240, 138, 0.9) 0%, rgba(249, 115, 22, 0.6) 60%, rgba(217, 119, 6, 0.2) 100%)"
                  : isCloudy
                  ? "linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(186, 230, 253, 0.4) 60%, transparent 100%)"
                  : "linear-gradient(180deg, rgba(254, 240, 138, 0.7) 0%, rgba(56, 189, 248, 0.4) 60%, transparent 100%)",
                clipPath: "polygon(40% 0%, 60% 0%, 90% 100%, 10% 100%)",
              }}
            />
          )}

          {/* Olas animadas */}
          <motion.div
            animate={{ x: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-2 left-0 right-0 h-4 opacity-50"
          >
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 12">
              <path
                d="M0,6 Q50,0 100,6 T200,6 T300,6 T400,6"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
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
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.2"
              />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* 7. ORILLA Y ARENA */}
      <div className={`absolute left-0 right-0 bottom-0 ${fullscreen ? "h-[16%]" : "h-[14%] sm:h-[15%]"} z-[4] pointer-events-none`}>
        <svg
          className="w-full h-full drop-shadow-[0_-3px_8px_rgba(0,0,0,0.35)]"
          preserveAspectRatio="none"
          viewBox="0 0 400 60"
        >
          {/* Espuma marina */}
          <path
            d="M0,22 Q100,10 200,18 Q300,26 400,14 L400,60 L0,60 Z"
            fill="rgba(255, 255, 255, 0.55)"
          />
          {/* Arena cálida */}
          <path
            d="M0,26 Q100,15 200,22 Q300,30 400,18 L400,60 L0,60 Z"
            fill="url(#sandGradient)"
          />
          <defs>
            <linearGradient id="sandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isRaining ? "#b45309" : "#f59e0b"} />
              <stop offset="40%" stopColor={isRaining ? "#92400e" : "#d97706"} />
              <stop offset="100%" stopColor={isRaining ? "#451a03" : "#78350f"} />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 8. PALMERAS EN LAS ESQUINAS */}
      <div className={`absolute top-0 left-0 ${fullscreen ? "w-44 h-44 sm:w-64 sm:h-64" : "w-28 h-28"} pointer-events-none z-[5] opacity-75`}>
        <motion.div
          animate={{ rotate: isRaining ? [-3, 4, -3] : [-1.5, 2.5, -1.5] }}
          transition={{ duration: isRaining ? 4 : 7, repeat: Infinity, ease: "easeInOut" }}
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

      <div className={`absolute top-0 right-0 ${fullscreen ? "w-48 h-48 sm:w-72 sm:h-72" : "w-32 h-32"} pointer-events-none z-[5] opacity-70`}>
        <motion.div
          animate={{ rotate: isRaining ? [3, -4, 3] : [1.5, -2, 1.5] }}
          transition={{ duration: isRaining ? 4.5 : 8, repeat: Infinity, ease: "easeInOut" }}
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

      {/* 9. EFECTO DE LLUVIA */}
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
                width: fullscreen ? "26px" : "20px",
                height: fullscreen ? "11px" : "9px",
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

      {/* 10. BADGE SUPERIOR DE CLIMA */}
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

      {/* 11. CENTRO: LA CARITA */}
      <div className="relative z-10 flex items-center justify-center my-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.65)]">
        {children}
      </div>

      {/* 12. PIE */}
      <div className="z-10 text-center pb-1">
        {fullscreen ? (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[11px] font-mono text-slate-300 tracking-widest shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>MODO REPOSO • MOVER EL MOUSE PARA REGRESAR</span>
          </div>
        ) : (
          <span className="text-[10px] font-medium tracking-wide text-white/90 bg-black/35 px-2.5 py-0.5 rounded-full backdrop-blur-xs border border-white/10">
            {isRaining ? "Buenos Aires, AR • Lluvia en Vivo" : "Buenos Aires, AR • Clima en Vivo"}
          </span>
        )}
      </div>
    </div>
  );
}
