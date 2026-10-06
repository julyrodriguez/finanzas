"use client";

import React, { useEffect, useRef, useState, useId } from "react";

interface EyeTrackerCubeProps {
  size?: number; // Size in px (default ~220)
  className?: string;
  follow?: number; // 0 - 100
  bounce?: number; // 0 - 100
  mood?: "normal" | "thinking" | "searching";
  injured?: boolean; // defaults to true
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
  injured = true,
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
        // Slightly bruised/squinted right eye when injured
        const eyeSquint = isThinking
          ? (idx === 0 ? 0.82 : 1.1)
          : (injured && idx === 1 ? 0.88 : 1);
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
      } else if (mood === "thinking") {
        // Contemplative autonomous gaze drifting upwards and across
        const thinkTime = time * 0.0009;
        const wanderX = Math.sin(thinkTime) * 0.38 + Math.sin(thinkTime * 0.47) * 0.18;
        const wanderY = -0.32 + Math.cos(thinkTime * 0.75) * 0.16;
        state.tx = state.tx * 0.15 + wanderX * 0.85;
        state.ty = state.ty * 0.15 + wanderY * 0.85;
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
  }, [follow, bounce, mood, injured]);

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

          {/* Drop shadow for curitas (Band-Aids) */}
          <filter id={`${clipId}-curita-shadow`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0.4" dy="0.9" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.32" />
          </filter>

          {/* Soft blur for bruise and scuff blush */}
          <filter id={`${clipId}-blur`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>

          {/* Band-Aid Tan / Adhesive Gradient */}
          <linearGradient id={`${clipId}-curita-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f6c791" />
            <stop offset="45%" stopColor="#e5aa72" />
            <stop offset="100%" stopColor="#cd8b51" />
          </linearGradient>

          {/* Band-Aid Absorbent Gauze Pad Gradient */}
          <linearGradient id={`${clipId}-pad-grad`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>

          {/* Sweat Drop Gradient (comic ouch indicator) */}
          <linearGradient id={`${clipId}-sweat-grad`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* Cube Body with light fill on dark background */}
        <path
          d={CUBE_PATH}
          fill={`url(#${clipId}-grad)`}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.2"
        />

        {/* Injured Surface Details (underneath eyes & curitas) */}
        {injured && (
          <g>
            {/* Soft Bruise aura behind right eye */}
            <ellipse
              cx="61"
              cy="50"
              rx="9.5"
              ry="10.5"
              fill="#818cf8"
              opacity="0.15"
              filter={`url(#${clipId}-blur)`}
            />

            {/* Soft blush on cheeks / scuffs */}
            <ellipse
              cx="73"
              cy="34"
              rx="5"
              ry="4"
              fill="#f43f5e"
              opacity="0.18"
              filter={`url(#${clipId}-blur)`}
            />
            <ellipse
              cx="36"
              cy="74"
              rx="5.5"
              ry="3.5"
              fill="#f43f5e"
              opacity="0.14"
              filter={`url(#${clipId}-blur)`}
            />

            {/* Hairline dent/crack on top edge of robot casing */}
            <g opacity="0.6">
              <path
                d="M31 7.2 L33.5 11 L32 14.5 L34.5 18"
                stroke="#64748b"
                strokeWidth="0.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M33.5 11 L36 12.8"
                stroke="#64748b"
                strokeWidth="0.55"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* Scratches (///) near right temple */}
            <g stroke="#e11d48" strokeWidth="0.85" strokeLinecap="round" opacity="0.75">
              <line x1="69" y1="31" x2="73" y2="34" />
              <line x1="72" y1="29" x2="76" y2="32" />
              <line x1="74" y1="33" x2="78" y2="36" />
            </g>

            {/* Scratches near chin */}
            <g stroke="#e11d48" strokeWidth="0.75" strokeLinecap="round" opacity="0.7">
              <line x1="33" y1="72" x2="36" y2="75" />
              <line x1="36" y1="71" x2="39" y2="74" />
            </g>
          </g>
        )}

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

        {/* Injured Overlays (Curitas, Sweat Drop, Little Mouth) */}
        {injured && (
          <g>
            {/* Wobbly/brave little mouth */}
            <path
              d="M46 71.5 Q48.5 69 50.5 71.5 T54 71.5"
              fill="none"
              stroke="#334155"
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.65"
            />

            {/* Anime Sweat Drop on top-right temple */}
            <g filter={`url(#${clipId}-curita-shadow)`} opacity="0.9">
              <path
                d="M80.5 14 C82 16.5 83 18.5 83 20.2 C83 22.2 81.5 23.5 79.5 23.5 C77.5 23.5 76 22.2 76 20.2 C76 18.5 77 16.5 78.5 14 Z"
                fill={`url(#${clipId}-sweat-grad)`}
              />
              <ellipse
                cx="78.2"
                cy="19"
                rx="0.7"
                ry="1.3"
                fill="#ffffff"
                opacity="0.8"
                transform="rotate(-20 78.2 19)"
              />
            </g>

            {/* Curita 1: Cruz de Curitas (X) en la frente (esquina sup. izquierda) */}
            <g transform="translate(25, 22)">
              {/* Strip 1 */}
              <g transform="rotate(-35)" filter={`url(#${clipId}-curita-shadow)`}>
                <rect
                  x="-8.5"
                  y="-3"
                  width="17"
                  height="6"
                  rx="3"
                  fill={`url(#${clipId}-curita-grad)`}
                  stroke="#b4753c"
                  strokeWidth="0.35"
                />
                {/* Dots on wings */}
                <circle cx="-5.8" cy="-1.1" r="0.4" fill="#8f5323" opacity="0.45" />
                <circle cx="-5.8" cy="1.1" r="0.4" fill="#8f5323" opacity="0.45" />
                <circle cx="5.8" cy="-1.1" r="0.4" fill="#8f5323" opacity="0.45" />
                <circle cx="5.8" cy="1.1" r="0.4" fill="#8f5323" opacity="0.45" />
              </g>

              {/* Strip 2 */}
              <g transform="rotate(55)" filter={`url(#${clipId}-curita-shadow)`}>
                <rect
                  x="-8.5"
                  y="-3"
                  width="17"
                  height="6"
                  rx="3"
                  fill={`url(#${clipId}-curita-grad)`}
                  stroke="#b4753c"
                  strokeWidth="0.35"
                />
                {/* Central Gauze Pad */}
                <rect
                  x="-2.6"
                  y="-2.6"
                  width="5.2"
                  height="5.2"
                  rx="1"
                  fill={`url(#${clipId}-pad-grad)`}
                  stroke="#d4a373"
                  strokeWidth="0.3"
                />
                {/* Little red cross on gauze */}
                <path
                  d="M-1.3 0 H1.3 M0 -1.3 V1.3"
                  stroke="#ef4444"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                />
                {/* Dots on wings */}
                <circle cx="-5.8" cy="-1.1" r="0.4" fill="#8f5323" opacity="0.45" />
                <circle cx="-5.8" cy="1.1" r="0.4" fill="#8f5323" opacity="0.45" />
                <circle cx="5.8" cy="-1.1" r="0.4" fill="#8f5323" opacity="0.45" />
                <circle cx="5.8" cy="1.1" r="0.4" fill="#8f5323" opacity="0.45" />
              </g>
            </g>

            {/* Curita 2: Curita en mejilla derecha */}
            <g transform="translate(74, 67) rotate(-16)" filter={`url(#${clipId}-curita-shadow)`}>
              <rect
                x="-10.5"
                y="-3.5"
                width="21"
                height="7"
                rx="3.5"
                fill={`url(#${clipId}-curita-grad)`}
                stroke="#b4753c"
                strokeWidth="0.4"
              />
              {/* Gauze Pad */}
              <rect
                x="-3.5"
                y="-3"
                width="7"
                height="6"
                rx="1.2"
                fill={`url(#${clipId}-pad-grad)`}
                stroke="#d4a373"
                strokeWidth="0.3"
              />
              {/* Red cross on gauze */}
              <path
                d="M-1.4 0 H1.4 M0 -1.4 V1.4"
                stroke="#ef4444"
                strokeWidth="0.6"
                strokeLinecap="round"
              />
              {/* Dots on left wing */}
              <circle cx="-7.2" cy="-1.3" r="0.45" fill="#8f5323" opacity="0.45" />
              <circle cx="-7.2" cy="1.3" r="0.45" fill="#8f5323" opacity="0.45" />
              <circle cx="-5.2" cy="0" r="0.45" fill="#8f5323" opacity="0.45" />
              {/* Dots on right wing */}
              <circle cx="7.2" cy="-1.3" r="0.45" fill="#8f5323" opacity="0.45" />
              <circle cx="7.2" cy="1.3" r="0.45" fill="#8f5323" opacity="0.45" />
              <circle cx="5.2" cy="0" r="0.45" fill="#8f5323" opacity="0.45" />
            </g>

            {/* Curita 3: Curita pequeña en mejilla izquierda */}
            <g transform="translate(23, 62) rotate(18)" filter={`url(#${clipId}-curita-shadow)`}>
              <rect
                x="-7"
                y="-2.6"
                width="14"
                height="5.2"
                rx="2.6"
                fill={`url(#${clipId}-curita-grad)`}
                stroke="#b4753c"
                strokeWidth="0.35"
              />
              {/* Gauze Pad */}
              <rect
                x="-2.4"
                y="-2.2"
                width="4.8"
                height="4.4"
                rx="0.9"
                fill={`url(#${clipId}-pad-grad)`}
                stroke="#d4a373"
                strokeWidth="0.3"
              />
              {/* Dots on wings */}
              <circle cx="-4.8" cy="-0.8" r="0.35" fill="#8f5323" opacity="0.45" />
              <circle cx="-4.8" cy="0.8" r="0.35" fill="#8f5323" opacity="0.45" />
              <circle cx="4.8" cy="-0.8" r="0.35" fill="#8f5323" opacity="0.45" />
              <circle cx="4.8" cy="0.8" r="0.35" fill="#8f5323" opacity="0.45" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
