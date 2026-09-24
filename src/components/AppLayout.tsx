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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
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

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0a0e17] border-r border-white/10 text-slate-300">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-white tracking-wider uppercase truncate">
                Finanzas
              </h1>
              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                Cinemark & Hoyts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Button */}
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Ocultar menú lateral"
              aria-label="Ocultar menú lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-3 space-y-4">
        {navigationSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (isOrdenesUser) return !item.hideForOrders;
            if (item.onlyForOrders) return false;
            if (item.href === "/interbanking") return isJulian;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </div>
              <nav aria-label={section.title} className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? "bg-blue-600 text-white font-semibold shadow-sm border border-blue-500"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                      }`} />
                      <span className="truncate flex-1">{item.name}</span>
                      {item.badge && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {item.badge}
                        </span>
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
      <div className="p-3 border-t border-white/10 space-y-2.5 shrink-0 bg-[#080c14]">
        {/* Theme Switcher Segmented Control */}
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

        {/* BNA Broker Ticker Tape */}
        <CotizacionesTicker isExpanded={true} />

        {/* User Profile & Logout */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 text-xs shrink-0">
              {isOrdenesUser ? "OR" : (user ? getCleanUsername()[0]?.toUpperCase() : "P")}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
                {isOrdenesUser ? "Usuario Órdenes" : (user ? getCleanUsername() : "Público")}
              </p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 leading-tight mt-0.5">
                {isOrdenesUser ? (
                  <>
                    <ShieldCheck className="w-2.5 h-2.5 text-amber-400" /> Consulta
                  </>
                ) : user ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Activo
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Consulta
                  </>
                )}
              </p>
            </div>
          </div>

          {user ? (
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-1.5 rounded-md hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Link
              href="/login"
              title="Iniciar Sesión"
              className="p-1.5 rounded-md hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5" />
            </Link>
          )}
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

      {/* Desktop Fixed Sidebar */}
      <aside
        aria-label="Barra lateral de navegación"
        className={`hidden lg:flex fixed inset-y-0 left-0 w-64 z-30 flex-col shadow-xl transition-transform duration-200 ease-in-out ${
          sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {renderSidebarContent()}
      </aside>

      {/* Floating button to open sidebar when collapsed on desktop */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebarCollapse}
          className="hidden lg:flex fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-[#0a0e17]/95 border border-white/15 hover:border-blue-500/50 text-slate-300 hover:text-white shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 group items-center gap-2"
          title="Mostrar menú lateral"
          aria-label="Mostrar menú lateral"
        >
          <PanelLeft className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
          <span className="text-xs font-semibold text-slate-200 pr-1">Menú</span>
        </button>
      )}

      {/* Mobile Sliding Drawer */}
      <aside
        aria-label="Barra lateral móvil"
        className={`lg:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 transform transition-transform duration-200 ease-in-out shadow-2xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent()}
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-col min-h-screen min-w-0 transition-[padding] duration-200 ease-in-out ${
        sidebarCollapsed ? "lg:pl-0" : "lg:pl-64"
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
