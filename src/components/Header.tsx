"use client";

import { Search, Bell, Sparkles, SlidersHorizontal } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#090d16]/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Quick Actions & Search */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar transacciones, órdenes..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
          />
        </div>

        {/* Filter button */}
        <button
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Filtros"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Notification Icon */}
        <button
          className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Notificaciones"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        {/* Upgrade / Pro Tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Finanzas AI</span>
        </div>
      </div>
    </header>
  );
}
