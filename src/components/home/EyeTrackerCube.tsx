"use client";

import React, { useEffect, useRef, useState, useId } from "react";

interface EyeTrackerCubeProps {
  size?: number; // Size in px (default ~220)
  className?: string;
  follow?: number; // 0 - 100
  bounce?: number; // 0 - 100
  mood?: "normal" | "thinking" | "searching";
}

const CUBE_PATH =
  "M30 6 H70 A24 24 0 0 1 94 30 V70 A24 24 0 0 1 70 94 H30 A24 24 0 0 1 6 70 V30 A24 24 0 0 1 30 6 Z";

const SLANT_EYE = { w: 9.5, h: 16, r: 4.8 };
const DW = 50; // Center offset
const KW = 0.19; // Eye separation on unit sphere
const AW = 64; // Tilt rotation multiplier

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function EyeTrackerCube({
  size = 220,
  className = "",
  follow = 65,
  bounce = 35,
  mood = "normal",
}: EyeTrackerCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const eyesGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const clipId = `eyt-clip-${useId().replace(/:/g, "")}`;
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Physics state
    const state = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
    };

    let animId = 0;
    let lastTime = 0;
    let blinkStartTime = 0;
    let nextBlinkTime = performance.now() + 2000;

    // Render frame
    const render = (time: number) => {
      // 1. Blinking calculation
      let blinkScale = 1;
      if (time > nextBlinkTime) {
        blinkStartTime = time;
        nextBlinkTime = time + 2600 + Math.random() * 3200;
      }
      const blinkElapsed = time - blinkStartTime;
      if (blinkElapsed < 160) {
        blinkScale = 1 - 0.92 * Math.sin((blinkElapsed / 160) * Math.PI);
      }

      // 2. Spherical angles
      const asinClamp = (val: number) => Math.asin(clamp(val, -0.92, 0.92));
      const yaw = asinClamp(state.x);
      const pitch = -asinClamp(state.y);

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      const isThinking = mood === "thinking";
      // Tilt angle based on looking corners + thinking slant
      const tilt = (isThinking ? AW * 1.25 : AW) * state.x * state.y + (isThinking ? -4.5 : 0);
      const eyeSep = KW * 1.05;

      // 3. Project both eyes onto 3D sphere
      [-eyeSep, eyeSep].forEach((eyePos, idx) => {
        const eyeGroup = eyesGroupRefs.current[idx];
        if (!eyeGroup) return;

        const z0 = Math.sqrt(Math.max(0, 1 - eyePos * eyePos));
        const x1 = eyePos * cosYaw + z0 * sinYaw;
        const z1 = -eyePos * sinYaw + z0 * cosYaw;

        const y2 = -z1 * sinPitch;
        const z2 = z1 * cosPitch;

        const visibleZ = clamp(z2, 0, 1);
        const foreshorten = 0.45 + 0.55 * visibleZ;
        const widthScale = foreshorten * (0.7 + 0.3 * visibleZ);

        const currentW = SLANT_EYE.w * widthScale * (isThinking && idx === 0 ? 0.9 : 1);
        const eyeSquint = isThinking ? (idx === 0 ? 0.82 : 1.1) : 1;
        const currentH = Math.max(0.6, SLANT_EYE.h * foreshorten * blinkScale * eyeSquint);
        const currentR = Math.min(SLANT_EYE.r, currentW / 2, currentH / 2);

        const rect = eyeGroup.firstElementChild as SVGRectElement | null;
        if (rect) {
          rect.setAttribute("x", (-currentW / 2).toFixed(2));
          rect.setAttribute("y", (-currentH / 2).toFixed(2));
          rect.setAttribute("width", currentW.toFixed(2));
          rect.setAttribute("height", currentH.toFixed(2));
          rect.setAttribute("rx", currentR.toFixed(2));
        }

        eyeGroup.setAttribute(
          "transform",
          `translate(${(50 + x1 * DW).toFixed(2)} ${(50 + y2 * DW).toFixed(2)}) rotate(${tilt.toFixed(2)})`
        );
        eyeGroup.style.opacity = z2 < 0.05 ? "0" : "1";
      });
    };

    // Physics tick
    const loop = (time: number) => {
      const dt = lastTime ? Math.min(2.5, (time - lastTime) / 16.67) : 1;
      lastTime = time;

      // Spring physics with inertia & bounce
      const stiffness = 0.065;
      const friction = 0.34 - (clamp(bounce, 0, 100) / 100) * 0.22;

      // If searching, animate scanning gaze across data
      if (mood === "searching") {
        const scanTime = time * 0.0035;
        const scanX = Math.sin(scanTime) * 0.65 + Math.sin(scanTime * 2.1) * 0.22;
        const scanY = Math.cos(scanTime * 1.4) * 0.3 - 0.12;
        state.tx = state.tx * 0.2 + scanX * 0.8;
        state.ty = state.ty * 0.2 + scanY * 0.8;
      }

      state.vx += ((state.tx - state.x) * stiffness - state.vx * friction) * dt;
      state.vy += ((state.ty - state.y) * stiffness - state.vy * friction) * dt;
      state.x += state.vx * dt;
      state.y += state.vy * dt;

      render(time);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // Global pointer move listener across the window
    const handlePointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy) || 1;

      // Radius of interaction influence
      const influenceRadius = Math.max(80, Math.min(window.innerWidth, window.innerHeight) * 0.45);
      const intensity = Math.min(
        0.88,
        Math.tanh(dist / influenceRadius) * (clamp(follow, 0, 100) / 100) * 1.5
      );

      const isThinking = mood === "thinking";
      state.tx = (dx / dist) * intensity + (isThinking ? 0.08 : 0);
      state.ty = (dy / dist) * intensity - (isThinking ? 0.16 : 0);
    };

    const handlePointerLeave = () => {
      state.tx = 0;
      state.ty = 0;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [follow, bounce, mood]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
      role="img"
      aria-label="Cubo interactivo que sigue el cursor con la mirada"
    >
      {/* Soft Glow behind Cube */}
      <div
        className="absolute inset-0 rounded-[48px] bg-gradient-to-tr from-white/20 via-blue-400/20 to-indigo-500/25 blur-2xl opacity-70 transition-all duration-500 pointer-events-none"
        style={{
          transform: isHovered ? "scale(1.1)" : "scale(1)",
        }}
      />

      {/* SVG Cube Body & Eyes */}
      <svg
        className="w-full h-full overflow-visible drop-shadow-[0_20px_35px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out"
        style={{
          transform: isHovered ? "scale(1.03)" : "scale(1)",
        }}
        viewBox="0 0 100 100"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={CUBE_PATH} />
          </clipPath>

          {/* Subtle gradient on Cube body for physical 3D feel */}
          <linearGradient id={`${clipId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          {/* Eye gradient: deep slate with subtle glossy contrast */}
          <linearGradient id={`${clipId}-eye-grad`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#090d16" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* Cube Body with light fill on dark background */}
        <path
          d={CUBE_PATH}
          fill={`url(#${clipId}-grad)`}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.2"
        />

        {/* Clipped Eyes Group */}
        <g clipPath={`url(#${clipId})`}>
          {[0, 1].map((idx) => (
            <g
              key={idx}
              ref={(el) => {
                eyesGroupRefs.current[idx] = el;
              }}
            >
              <rect
                fill={`url(#${clipId}-eye-grad)`}
                x={-SLANT_EYE.w / 2}
                y={-SLANT_EYE.h / 2}
                width={SLANT_EYE.w}
                height={SLANT_EYE.h}
                rx={SLANT_EYE.r}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
