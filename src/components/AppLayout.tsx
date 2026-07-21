"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  Home, 
  ShoppingBag, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  Building2,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  User as UserIcon
} from "lucide-react";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const { user, logout } = useAuth();

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

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const getCleanUsername = () => {
    if (!user) return "Modo Invitado";
    if (user.displayName) return user.displayName;
    if (user.email) {
      const parts = user.email.split("@");
      return parts[0];
    }
    return "Usuario";
  };

  return (
    <div className="flex min-h-screen bg-[#090d16] text-gray-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-md transition-opacity duration-300"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#0d131f] border-r border-white/10 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top Header / Branding */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
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

            {/* Mobile Close Button inside Sidebar */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
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
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                        active
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[#0d131f] text-gray-400 group-hover:text-white group-hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
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
                Estado Sistema
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-gray-300 font-medium truncate">
              {getCleanUsername()}
            </p>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-full rounded-full" />
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-white text-xs shadow-md flex-shrink-0">
                {getCleanUsername()[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">
                  {getCleanUsername()}
                </p>
                <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Activo
                </p>
              </div>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href="/login"
                title="Iniciar Sesión"
                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
              >
                <UserIcon className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Sticky Header with Mobile Hamburger Menu */}
        <header className="sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white focus:outline-none flex-shrink-0"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-gray-400 truncate mt-0.5 hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {user ? (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Ingresar</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
