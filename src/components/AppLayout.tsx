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
  Scale,
  BarChart3,
  FileUp,
  Moon,
  Sparkles,
  Layers,
  ArrowRight,
  PanelLeftClose,
  PanelLeft
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
  const [isPinned, setIsPinned] = useState(false);
  const isExpanded = isPinned || isHovered;
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_pinned");
      if (saved !== null) {
        setIsPinned(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_pinned", String(next));
      } catch {}
      return next;
    });
  };

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

  useEffect(() => {
    if (!loading && !user && !publicRoute) {
      router.push("/login");
      return;
    }
    if (!loading && user && isOrdenesUser && pathname !== "/seguimiento-de-ordenes") {
      router.push("/seguimiento-de-ordenes");
    }
    if (!loading && user && !isOrdenesUser && pathname === "/seguimiento-de-ordenes") {
      router.push("/");
    }
  }, [user, loading, router, publicRoute, isOrdenesUser, pathname]);

  const navigationSections: {
    title: string;
    items: {
      name: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
      exact: boolean;
      badge?: string;
      hideForOrders?: boolean;
      onlyForOrders?: boolean;
    }[];
  }[] = [
    {
      title: "Operaciones",
      items: [
        {
          name: "Órdenes de Compra",
          href: "/",
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
          name: "Calendario",
          href: "/calendario",
          icon: Calendar,
          exact: true,
          hideForOrders: true,
        },
      ],
    },
    {
      title: "Finanzas & Control",
      items: [
        {
          name: "Cotizaciones",
          href: "/cotizaciones",
          icon: Scale,
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
          name: "Calculadora",
          href: "/calculadora",
          icon: Calculator,
          exact: false,
          hideForOrders: true,
        },
      ],
    },
    {
      title: "Análisis & Sistemas",
      items: [
        {
          name: "Estadísticas",
          href: "/estadisticas",
          icon: BarChart3,
          exact: false,
          hideForOrders: true,
        },
        {
          name: "Temporal",
          href: "/temporal",
          icon: FileUp,
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
      ],
    },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (href === "/calendario") {
      return pathname === "/calendario";
    }
    if (href === "/") {
      return pathname === "/" || pathname === "/ordenes-de-compras" || pathname === "/inicio";
    }
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isForbiddenForOrdenes = !loading && Boolean(user) && Boolean(isOrdenesUser) && pathname !== "/seguimiento-de-ordenes";
  const isForbiddenForOtherUsers = !loading && Boolean(user) && !isOrdenesUser && pathname === "/seguimiento-de-ordenes";

  if (loading || (!user && !publicRoute) || isForbiddenForOrdenes || isForbiddenForOtherUsers) {
    return (
      <div className="min-h-screen bg-[#070a12] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 p-8 rounded-xl glass-card border border-white/10 text-center max-w-sm w-full">
          <div className="h-10 w-10 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-semibold text-sm">Cargando...</h3>
            <p className="text-xs text-slate-400">Preparando tu sesión...</p>
          </div>
        </div>
      </div>
    );
  }

  const renderSidebarContent = (expanded: boolean) => (
    <div className="flex flex-col h-full bg-[#0a0e17] border-r border-white/10 text-slate-300 overflow-hidden select-none">
      {/* Brand Header */}
      <div className="h-16 px-2.5 border-b border-white/10 shrink-0 flex items-center justify-between overflow-hidden">
        <div className="flex items-center min-w-0">
          {/* Top Open / Toggle Button - Fixed position at left */}
          <button
            onClick={togglePin}
            className="h-10 w-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:text-white hover:bg-blue-600/30 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm group"
            title={expanded ? (isPinned ? "Desfijar menú (se contrae al retirar el mouse)" : "Fijar menú siempre abierto") : "Abrir y fijar menú lateral"}
            aria-label="Abrir o fijar menú"
          >
            {expanded && isPinned ? (
              <PanelLeftClose className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
          </button>

          {/* Brand Title: Smoothly fades and expands without shifting the button */}
          <div className={`ml-3 min-w-0 transition-all duration-300 ease-in-out ${
            expanded ? "opacity-100 max-w-[140px] translate-x-0" : "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
          }`}>
            <h1 className="font-bold text-sm text-white tracking-wider uppercase truncate whitespace-nowrap">
              Finanzas
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate whitespace-nowrap">
              Cinemark & Hoyts
            </p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white shrink-0"
          aria-label="Cerrar menú"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Navigation List - Unified DOM where icons never shift pixel position */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-3 px-2 space-y-3">
        {navigationSections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => {
            if (isOrdenesUser) return !item.hideForOrders;
            if (item.onlyForOrders) return false;
            if (item.href === "/interbanking") return isJulian;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              {/* Collapsible Section Title */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expanded ? "max-h-6 opacity-100 mb-1" : "max-h-0 opacity-0 mb-0 pointer-events-none"
              }`}>
                <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate whitespace-nowrap">
                  {section.title}
                </div>
              </div>

              {/* Thin divider line when collapsed */}
              {!expanded && sIdx > 0 && <div className="my-1.5 border-t border-white/10 mx-1" />}

              {/* Items List */}
              <nav aria-label={section.title} className="space-y-1">
                {visibleItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      title={!expanded ? item.name : undefined}
                      className={`group flex items-center h-10 px-2 rounded-xl text-xs font-medium transition-colors relative overflow-hidden ${
                        active
                          ? "bg-blue-600 text-white font-semibold shadow-sm border border-blue-500"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-transparent"
                      }`}
                    >
                      {/* Fixed 24px icon container - mathematically centered in 44px link area */}
                      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                        <Icon className={`w-4 h-4 transition-colors ${active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
                      </div>

                      {/* Text label & badge - smoothly fades and slides */}
                      <div className={`flex items-center justify-between flex-1 min-w-0 ml-3 transition-all duration-300 ease-in-out ${
                        expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3 pointer-events-none"
                      }`}>
                        <span className="truncate whitespace-nowrap">{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 ml-1.5">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {/* Small badge dot when collapsed */}
                      {!expanded && item.badge && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-[#0a0e17]" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Footer Controls: Theme, Ticker, User */}
      <div className="p-2 border-t border-white/10 space-y-2 shrink-0 bg-[#080c14] overflow-hidden">
        {/* Theme Switcher */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-24 opacity-100" : "max-h-10 opacity-100"
        }`}>
          {expanded ? (
            <div className="space-y-1">
              <div className="px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Tema Visual
              </div>
              <div className="p-1 rounded-lg bg-black/50 border border-white/10 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Oscuro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("pink")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    theme === "pink"
                      ? "bg-pink-600 text-white shadow-sm border border-pink-500"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>🌸</span>
                  <span>Rosa</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "pink" : "dark")}
              title={theme === "dark" ? "Modo Oscuro (clic para Rosa)" : "Modo Rosa (clic para Oscuro)"}
              className="h-10 w-10 mx-auto rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {theme === "dark" ? <Moon className="w-4 h-4 text-blue-400" /> : <span className="text-sm">🌸</span>}
            </button>
          )}
        </div>

        {/* Cotizaciones Ticker (fades in when expanded) */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-20 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}>
          <CotizacionesTicker isExpanded={true} />
        </div>

        {/* User Profile Card */}
        <div className="flex items-center h-10 px-1 rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
          <div className="h-7 w-7 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 text-xs shrink-0 ml-0.5">
            {isOrdenesUser ? "OR" : (user ? getCleanUsername()[0]?.toUpperCase() : "P")}
          </div>

          <div className={`flex items-center justify-between flex-1 min-w-0 ml-2.5 transition-all duration-300 ease-in-out ${
            expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
          }`}>
            <div className="min-w-0 pr-1">
              <p className="text-xs font-semibold text-slate-200 truncate whitespace-nowrap leading-tight">
                {isOrdenesUser ? "Usuario Órdenes" : (user ? getCleanUsername() : "Público")}
              </p>
              <p className="text-[10px] text-slate-400 truncate whitespace-nowrap flex items-center gap-1 leading-tight mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /> Activo
              </p>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-1.5 rounded-md hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-transparent text-gray-100 antialiased ${theme === "pink" ? "pink-theme" : ""}`}>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Desktop Column / Collapsible Sidebar */}
      <aside
        aria-label="Barra lateral de navegación"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-[#0a0e17] border-r border-white/10 shadow-2xl transition-[width] duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "w-64" : "w-16"
        }`}
      >
        {renderSidebarContent(isExpanded)}
      </aside>

      {/* Mobile Sliding Drawer */}
      <aside
        aria-label="Barra lateral móvil"
        className={`lg:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 transform transition-transform duration-200 ease-in-out shadow-2xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-col min-h-screen min-w-0 transition-[padding] duration-300 ease-in-out ${
        isPinned ? "lg:pl-64" : "lg:pl-16"
      }`}>
        {/* Mobile Header Bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#0a0d14]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm text-white">Finanzas</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page Main Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1800px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
