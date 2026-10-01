"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SeekSearchBarProps {
  onSearchSubmit: (query: string) => void;
  className?: string;
}

export function SeekSearchBar({ onSearchSubmit, className = "" }: SeekSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPressing, setIsPressing] = useState(false);
  const [pullOffset, setPullOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Magnetic attraction when closed (from bencho.dev/blocks/seek)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isOpen) return;

    let animId = 0;
    let target = { x: 0, y: 0 };

    const updateSpring = () => {
      animId = 0;
      setPullOffset(target);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > 110) {
        if (target.x || target.y) {
          target = { x: 0, y: 0 };
          animId = animId || requestAnimationFrame(updateSpring);
        }
        return;
      }

      const pull = Math.pow(Math.max(0, 1 - dist / 110), 1.4) * 4.5;
      target = {
        x: (dx / (dist || 1)) * pull,
        y: (dy / (dist || 1)) * pull,
      };
      animId = animId || requestAnimationFrame(updateSpring);
    };

    const handlePointerLeave = () => {
      target = { x: 0, y: 0 };
      animId = animId || requestAnimationFrame(updateSpring);
    };

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (isOpen) return;
    setIsPressing(true);
    if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
    pressTimeoutRef.current = setTimeout(() => {
      setIsPressing(false);
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 60);
    }, 90);
  };

  const handleClose = () => {
    if (!query.trim()) {
      setIsOpen(false);
      setQuery("");
    }
  };

  const handleChange = (val: string) => {
    setQuery(val);
    // When user types 3 characters or more, open the comprehensive search modal
    if (val.trim().length >= 3) {
      onSearchSubmit(val.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } else if (e.key === "Enter" && query.trim()) {
      onSearchSubmit(query.trim());
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        transform: !isOpen ? `translate3d(${pullOffset.x}px, ${pullOffset.y}px, 0)` : "none",
        transition: !isOpen ? "transform 0.15s ease-out" : "none",
      }}
    >
      <div
        className={`relative flex items-center h-11 rounded-full border transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-xl ${
          isOpen
            ? "w-[310px] sm:w-[360px] bg-[#0c1220]/95 border-blue-500/50 shadow-blue-500/10"
            : "w-11 bg-white/[0.08] hover:bg-white/[0.14] border-white/15 hover:border-white/25 cursor-pointer backdrop-blur-md"
        } ${isPressing ? "scale-90" : "scale-100"}`}
        onClick={!isOpen ? handleOpen : undefined}
      >
        {/* Search Lens Icon */}
        <div className="absolute left-[13px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
          <svg
            className={`w-[18px] h-[18px] transition-colors duration-200 ${
              isOpen ? "text-blue-400 stroke-[2]" : "text-slate-200 stroke-[1.6]"
            }`}
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="7.6" cy="7.6" r="5.4" />
            <path d="M11.6 11.6L15.4 15.4" />
          </svg>
        </div>

        {/* Search Field Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleClose}
          onKeyDown={handleKeyDown}
          placeholder="Buscar órdenes o cotizaciones..."
          tabIndex={isOpen ? 0 : -1}
          className={`w-full h-full bg-transparent pl-11 pr-9 text-xs sm:text-sm font-semibold text-white placeholder-slate-400 outline-none transition-opacity duration-200 ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Clear Button when Open */}
        {isOpen && query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Keyboard shortcut indicator when open and empty */}
        {isOpen && !query && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 pointer-events-none select-none">
            ESC
          </span>
        )}
      </div>
    </div>
  );
}
