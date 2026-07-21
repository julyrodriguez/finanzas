"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  ShoppingBag, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  Building2,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      name: "Inicio",
      href: "/",
      icon: Home,
      exact: true,
      badge: "Próximamente",
    },
    {
      name: "Órdenes de Compra",
      href: "/ordenes-de-compras",
      icon: ShoppingBag,
      exact: false,
      badge: "Próximamente",
    },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href || pathname === "/inicio";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl glass-panel text-gray-300 hover:text-white focus:outline-none"
        aria-label="Abrir menú"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#0d131f] border-r border-white/10 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top Header / Branding */}
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="h-full w-full bg-[#0d131f] rounded-[10px] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight">
                Finanzas
              </h1>
              <p className="text-xs text-gray-400">Gestión Corporativa</p>
            </div>
          </div>

          {/* Section Title */}
          <div className="px-3 mb-2 flex items-center justify-between text-xs font-semibold text-gray-400 tracking-wider uppercase">
            <span>Navegación</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`group relative flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        active
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                          active
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-200 ${
                        active
                          ? "text-emerald-400 translate-x-0.5"
                          : "text-gray-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                      }`}
                    />
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Info & Profile */}
        <div className="p-4 border-t border-white/10 space-y-4">
          {/* Status Box */}
          <div className="p-3.5 rounded-xl glass-card border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Módulo Activo
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-gray-300 font-medium truncate">
              Plataforma de Finanzas v1.0
            </p>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-3/4 rounded-full" />
            </div>
            <p className="text-[10px] text-gray-400 text-right">Fase de prototipo</p>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-white text-xs shadow-md">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200 truncate">
                Julián Demo
              </p>
              <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Admin
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
