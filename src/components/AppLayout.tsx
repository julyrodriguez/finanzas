"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { CotizacionesTicker } from "@/components/CotizacionesTicker";
import { 
  ShoppingBag, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  Building2, 
  Menu, 
  X, 
  LogOut, 
  User as UserIcon, 
  Loader2, 
  Percent, 
  Calendar, 
  Calculator, 
  ClipboardList,
  Scale
} from "lucide-react";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  publicRoute?: boolean;
}

export function AppLayout({ title, subtitle, children, publicRoute = false }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const { user, loading, logout } = useAuth();
  const isOrdenesUser = user?.email?.startsWith("ordenes");

  const getCleanUsername = () => {
    if (!user) return "Usuario";
    if (user.displayName) return user.displayName;
    if (user.email) {
      const parts = user.email.split("@");
      return parts[0];
    }
    return "Usuario";
  };

  const isJulian = user ? getCleanUsername().toLowerCase() === "julian" : false;

  // Strict Protected Route Guard: If not logged in and not public, redirect immediately to /login
  // Redirect forbidden pages for 'ordenes' user to /seguimiento-de-ordenes
  // Redirect /seguimiento-de-ordenes for other users to /ordenes-de-compras
  useEffect(() => {
    if (!loading && !user && !publicRoute) {
      router.push("/login");
      return;
    }
    if (!loading && user && isOrdenesUser && pathname !== "/seguimiento-de-ordenes") {
      router.push("/seguimiento-de-ordenes");
    }
    if (!loading && user && !isOrdenesUser && pathname === "/seguimiento-de-ordenes") {
      router.push("/ordenes-de-compras");
    }
  }, [user, loading, router, publicRoute, isOrdenesUser, pathname]);

  const menuItems: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact: boolean;
    badge?: string;
    hideForOrders?: boolean;
    onlyForOrders?: boolean;
  }[] = [
    {
      name: "Calendario",
      href: "/",
      icon: Calendar,
      exact: true,
      hideForOrders: true,
    },
    {
      name: "Pendientes",
      href: "/pendientes",
      icon: ClipboardList,
      exact: false,
      hideForOrders: true,
    },
    {
      name: "Seguimiento de Órdenes",
      href: "/seguimiento-de-ordenes",
      icon: ShieldCheck,
      exact: false,
      onlyForOrders: true,
    },
    {
      name: "Órdenes de Compra",
      href: "/ordenes-de-compras",
      icon: ShoppingBag,
      exact: false,
      hideForOrders: true,
    },
    {
      name: "Proceso de Liberación",
      href: "/proceso-de-liberacion",
      icon: Clock,
      exact: false,
      hideForOrders: true,
    },
    {
      name: "Distribución",
      href: "/distribucion",
      icon: Percent,
      exact: false,
      hideForOrders: true,
    },
    {
      name: "Cotizaciones",
      href: "/cotizaciones",
      icon: Scale,
      exact: false,
      hideForOrders: true,
    },
    {
      name: "Calculadora",
      href: "/calculadora",
      icon: Calculator,
      exact: false,
      hideForOrders: true,
    },
    {
      name: "Interbanking",
      href: "/interbanking",
      icon: Building2,
      exact: false,
      hideForOrders: true,
    },
  ].filter(item => {
    if (isOrdenesUser) {
      return !item.hideForOrders;
    }
    if (item.onlyForOrders) {
      return false;
    }
    if (item.href === "/interbanking") {
      return isJulian;
    }
    return true;
  });

  const isActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href || pathname === "/inicio" || pathname === "/calendario";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // If checking authentication, unauthenticated, or forbidden page for ordenes user / other users, block rendering and show loader
  const isForbiddenForOrdenes = !loading && Boolean(user) && Boolean(isOrdenesUser) && pathname !== "/seguimiento-de-ordenes";
  const isForbiddenForOtherUsers = !loading && Boolean(user) && !isOrdenesUser && pathname === "/seguimiento-de-ordenes";

  if (loading || (!user && !publicRoute) || isForbiddenForOrdenes || isForbiddenForOtherUsers) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl glass-card border border-white/10 text-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold text-base">Cargando...</h3>
            <p className="text-xs text-gray-400">Preparando tu sesión...</p>
          </div>
        </div>
      </div>
    );
  }

  const isExpanded = sidebarOpen || isHovered;

  return (
    <div className={`flex min-h-screen bg-transparent text-gray-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 ${theme === "pink" ? "pink-theme" : ""}`}>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        />
      )}

      {/* Desktop Fixed Gutter Rail (Keeps main content completely stable with ZERO layout shift) */}
      <div className="hidden lg:block lg:w-20 lg:flex-shrink-0" aria-hidden="true" />

      {/* Sidebar Navigation - Floating Overlay on Hover */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setSidebarOpen(false);
        }}
        className={`fixed top-0 left-0 h-screen z-50 bg-[#0b0f19] border-r border-white/10 flex flex-col justify-between transition-[width,transform] duration-200 ease-out overflow-hidden ${
          sidebarOpen
            ? "translate-x-0 w-72 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        } ${
          isHovered
            ? "lg:w-72 lg:shadow-[0_0_50px_rgba(0,0,0,0.8)] lg:border-r-slate-700/60"
            : "lg:w-20"
        }`}
      >
        {/* Top Header / Branding */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-md shadow-indigo-500/20 flex-shrink-0">
                <div className="h-full w-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div className={`min-w-0 transition-opacity duration-150 ${isExpanded ? "opacity-100" : "opacity-0 lg:hidden"}`}>
                <h1 className="font-bold text-base text-white tracking-tight truncate">
                  Finanzas
                </h1>
                <p className="text-[11px] text-gray-400 truncate">Gestión Corporativa</p>
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
          <div className={`px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-gray-400 tracking-wider uppercase transition-opacity duration-150 ${isExpanded ? "opacity-100" : "opacity-0 lg:hidden"}`}>
            <span>Navegación</span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400/80" />
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
                  onClick={() => {
                    setSidebarOpen(false);
                    setIsHovered(false);
                  }}
                  className={`group relative flex items-center rounded-xl text-xs font-semibold transition-colors duration-150 ${
                    isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
                  } ${
                    active
                      ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
                      : "text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent"
                  }`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <div
                    className={`rounded-lg transition-colors flex items-center justify-center flex-shrink-0 ${
                      isExpanded
                        ? "p-1.5 " + (active ? "bg-indigo-500/20 text-indigo-400" : "bg-[#0b0f19] text-gray-400 group-hover:text-white group-hover:bg-white/10")
                        : (active ? "text-indigo-400" : "text-gray-400 group-hover:text-white")
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>

                  <div className={`ml-3 flex-1 flex items-center justify-between min-w-0 transition-opacity duration-150 ${isExpanded ? "opacity-100" : "opacity-0 hidden"}`}>
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ml-2 ${
                          active
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Info, Theme Switcher & Profile */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Cambiar a Modo Rosa" : "Cambiar a Modo Oscuro"}
            className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 border cursor-pointer ${
              theme === "pink"
                ? "bg-pink-500/15 text-pink-300 border-pink-500/30 hover:bg-pink-500/25 shadow-sm"
                : "bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 border-white/10"
            } ${isExpanded ? "px-3 py-2.5 justify-between" : "p-2 justify-center"}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-sm shrink-0">{theme === "dark" ? "🌸" : "🌙"}</span>
              {isExpanded && (
                <span className="truncate">
                  {theme === "dark" ? "Modo Rosa" : "Modo Oscuro"}
                </span>
              )}
            </div>
            {isExpanded && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                theme === "pink" ? "bg-pink-500/25 text-pink-200" : "bg-white/10 text-slate-400"
              }`}>
                {theme === "pink" ? "Rosa" : "Oscuro"}
              </span>
            )}
          </button>

          {/* Cotizaciones BNA Broker Ticker Tape */}
          <CotizacionesTicker isExpanded={isExpanded} />

          {/* User Profile & Logout */}
          <div className={`flex items-center gap-2 p-1.5 rounded-xl bg-white/[0.02] border border-white/5 ${isExpanded ? "justify-between" : "justify-center"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-bold text-white text-xs shadow-sm flex-shrink-0">
                {isOrdenesUser ? "OR" : (user ? getCleanUsername()[0]?.toUpperCase() : "P")}
              </div>
              {isExpanded && (
                <div className="min-w-0 animate-in fade-in duration-150">
                  <p className="text-xs font-semibold text-gray-200 truncate">
                    {isOrdenesUser ? "Usuario Órdenes" : (user ? getCleanUsername() : "Público")}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                    {isOrdenesUser ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-amber-400" /> Consulta
                      </>
                    ) : user ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Activo
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Modo Consulta
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            {isExpanded && (
              user ? (
                <button
                  onClick={handleLogout}
                  title="Cerrar Sesión"
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex-shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href="/login"
                  title="Iniciar Sesión"
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <UserIcon className="w-4 h-4" />
                </Link>
              )
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area (Wide Container) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Mobile-Only Bar for Hamburger Menu */}
        <div className="lg:hidden sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white focus:outline-none cursor-pointer"
            aria-label="Abrir menú"
            title="Abrir menú lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
              <div className="h-full w-full bg-[#0b0f19] rounded-[6px] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              </div>
            </div>
            <span className="font-bold text-sm text-white">Finanzas</span>
          </div>
        </div>

        {/* Page Content - Full Width Max 1800px */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-[1800px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
