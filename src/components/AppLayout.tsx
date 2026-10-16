"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { toast } from "@/context/ToastContext";
import { CotizacionesTicker } from "@/components/CotizacionesTicker";
import { HomeSearchModal } from "@/components/home/HomeSearchModal";
import { CotizacionDetailModal } from "@/components/cotizaciones/CotizacionDetailModal";
import { markFirestoreDisabled } from "@/lib/firebase";
import {
  TrendingUp,
  ShieldCheck,
  Building2,
  Menu,
  X,
  LogOut,
  Loader2,
  Percent,
  Calendar,
  Calculator,
  ClipboardList,
  Scale,
  FileUp,
  Moon,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Home,
  Briefcase,
  Search,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  ArrowRight,
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
  const { theme, setTheme, toggleTheme } = useTheme();

  // Global Command Palette (⌘K)
  const [commandOpen, setCommandOpen] = useState(false);
  const [openedByShortcut, setOpenedByShortcut] = useState(false);
  const [selectedQuoteFromSearch, setSelectedQuoteFromSearch] = useState<any | null>(null);

  // Universal Dropzone state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [uploadingTemporal, setUploadingTemporal] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenedByShortcut(true);
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Global Drag & Drop detection for Universal Inbox
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types || []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDraggingFile(true);
      }
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDraggingFile(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Avoid intercepting if dropped directly on an explicit input[type=file] or inside a page modal with its own drop handler
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-local-dropzone='true']")) {
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
        return;
      }
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        setDroppedFile(file);
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const handleUploadToTemporal = async (file: File) => {
    setUploadingTemporal(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("https://apivacas.jariel.com.ar/api/temporal/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Error al subir archivo");
      toast.success("Archivo subido a Temporal", `${file.name} ya está disponible para compartir`);
      setDroppedFile(null);
      router.push("/temporal");
    } catch {
      toast.error("No se pudo subir directo", "Redirigiendo a Temporal...");
      setDroppedFile(null);
      router.push("/temporal");
    } finally {
      setUploadingTemporal(false);
    }
  };

  // Escudo global a nivel de layout para prevenir que errores de cuota de Firestore rompan la pantalla
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg = String(reason?.message || reason || "").toLowerCase();
      const code = String(reason?.code || "").toLowerCase();
      if (
        code.includes("resource-exhausted") ||
        msg.includes("quota exceeded") ||
        msg.includes("quota") ||
        (msg.includes("firestore") && (msg.includes("exhausted") || msg.includes("quota")))
      ) {
        try {
          event.preventDefault();
          event.stopImmediatePropagation?.();
        } catch {}
        markFirestoreDisabled(reason);
        console.warn("🛡️ [AppLayout Guard] Interceptado error de cuota de Firestore en navegación. La aplicación continúa estable.");
      }
    };

    const handleError = (event: ErrorEvent) => {
      const msg = String(event?.message || "").toLowerCase();
      const errorMsg = String(event?.error?.message || "").toLowerCase();
      const code = String(event?.error?.code || "").toLowerCase();
      if (
        code.includes("resource-exhausted") ||
        msg.includes("quota exceeded") ||
        errorMsg.includes("quota exceeded") ||
        msg.includes("quota") ||
        (msg.includes("firestore") && (msg.includes("exhausted") || msg.includes("quota")))
      ) {
        try {
          event.preventDefault();
          event.stopImmediatePropagation?.();
        } catch {}
        markFirestoreDisabled(event.error);
        console.warn("🛡️ [AppLayout Guard] Prevenido error global de cuota de Firestore.");
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
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
          name: "Inicio",
          href: "/",
          icon: Home,
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
          name: "Calendario",
          href: "/calendario",
          icon: Calendar,
          exact: true,
          hideForOrders: true,
        },
      ],
    },
    {
      title: "Compras & Control",
      items: [
        {
          name: "Cotizaciones",
          href: "/cotizaciones",
          icon: Scale,
          exact: false,
          hideForOrders: true,
        },
        {
          name: "Proveedores",
          href: "/proveedores",
          icon: Briefcase,
          exact: false,
          hideForOrders: true,
          badge: "IA",
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
      return pathname === "/" || pathname === "/inicio";
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

  const isForbiddenForOrdenes =
    !loading && Boolean(user) && Boolean(isOrdenesUser) && pathname !== "/seguimiento-de-ordenes";
  const isForbiddenForOtherUsers = false;

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
          <button
            onClick={togglePin}
            className="h-10 w-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:text-white hover:bg-blue-600/30 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm group"
            title={
              expanded
                ? isPinned
                  ? "Desfijar menú (se contrae al retirar el mouse)"
                  : "Fijar menú siempre abierto"
                : "Abrir y fijar menú lateral"
            }
            aria-label="Abrir o fijar menú"
          >
            {expanded && isPinned ? (
              <PanelLeftClose className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
          </button>

          <div
            className={`ml-3 min-w-0 transition-all duration-300 ease-in-out ${
              expanded ? "opacity-100 max-w-[140px] translate-x-0" : "opacity-0 max-w-0 -translate-x-2 pointer-events-none"
            }`}
          >
            <h1 className="font-bold text-sm text-white tracking-wider uppercase truncate whitespace-nowrap">
              Compras
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate whitespace-nowrap">
              Cinemark & Hoyts
            </p>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white shrink-0"
          aria-label="Cerrar menú"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Command & Dropzone Bar */}
      {!isOrdenesUser && (
        <div className="px-2 pt-2.5 pb-1 space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setOpenedByShortcut(false);
              setCommandOpen(true);
              setSidebarOpen(false);
            }}
            title="Buscador Universal y Cuentas Solomon (⌘K)"
            className="w-full h-9 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <div className="w-6 h-6 shrink-0 flex items-center justify-center">
              <Search className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div
              className={`flex items-center justify-between flex-1 min-w-0 ml-2.5 transition-all duration-200 ${
                expanded ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <span className="text-xs font-medium truncate">Buscar / Solomon...</span>
              <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-slate-400">
                ⌘K
              </kbd>
            </div>
          </button>
        </div>
      )}

      {/* Main Navigation List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-2 px-2 space-y-3">
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
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expanded ? "max-h-6 opacity-100 mb-1" : "max-h-0 opacity-0 mb-0 pointer-events-none"
                }`}
              >
                <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate whitespace-nowrap">
                  {section.title}
                </div>
              </div>

              {!expanded && sIdx > 0 && <div className="my-1.5 border-t border-white/10 mx-1" />}

              <nav aria-label={section.title} className="space-y-1">
                {visibleItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      title={!expanded ? item.name : undefined}
                      className={`group flex items-center h-10 px-2 rounded-xl text-xs font-medium transition-colors relative overflow-hidden ${
                        active
                          ? "text-white font-semibold"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-transparent"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebar-active-pill"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-blue-600 border border-blue-500 shadow-sm -z-0"
                        />
                      )}

                      <div className="w-6 h-6 shrink-0 flex items-center justify-center relative z-10">
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                      </div>

                      <div
                        className={`flex items-center justify-between flex-1 min-w-0 ml-3 relative z-10 transition-all duration-300 ease-in-out ${
                          expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3 pointer-events-none"
                        }`}
                      >
                        <span className="truncate whitespace-nowrap">{item.name}</span>
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 ml-1.5">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {!expanded && item.badge && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-[#0a0e17] z-10" />
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
        {/* 3-Theme Switcher */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-24 opacity-100" : "max-h-10 opacity-100"
          }`}
        >
          {expanded ? (
            <div className="space-y-1">
              <div className="px-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Tema Visual
              </div>
              <div className="p-1 rounded-lg bg-black/50 border border-white/10 grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Moon className="w-3 h-3 text-blue-400" />
                  <span>Oscuro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("pink")}
                  className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    theme === "pink"
                      ? "bg-pink-600 text-white shadow-sm border border-pink-500"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>🌸</span>
                  <span>Rosa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("gold")}
                  className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    theme === "gold"
                      ? "bg-amber-600 text-white shadow-sm border border-amber-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>🎬</span>
                  <span>Gold</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleTheme}
              title="Cambiar tema visual (Oscuro / Rosa / Gold)"
              className="h-10 w-10 mx-auto rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-blue-400" />
              ) : theme === "pink" ? (
                <span className="text-sm">🌸</span>
              ) : (
                <span className="text-sm">🎬</span>
              )}
            </button>
          )}
        </div>

        {/* Cotizaciones Ticker */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-20 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <CotizacionesTicker isExpanded={true} />
        </div>

        {/* User Profile Card */}
        <div className="flex items-center h-10 px-1 rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
          <div className="h-7 w-7 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 text-xs shrink-0 ml-0.5">
            {isOrdenesUser ? "OR" : user ? getCleanUsername()[0]?.toUpperCase() : "P"}
          </div>

          <div
            className={`flex items-center justify-between flex-1 min-w-0 ml-2.5 transition-all duration-300 ease-in-out ${
              expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
            }`}
          >
            <div className="min-w-0 pr-1">
              <p className="text-xs font-semibold text-slate-200 truncate whitespace-nowrap leading-tight">
                {isOrdenesUser ? "Usuario Órdenes" : user ? getCleanUsername() : "Público"}
              </p>
              <p className="text-[10px] text-slate-400 truncate whitespace-nowrap flex items-center gap-1 leading-tight mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /> Activo
              </p>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
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

  const themeClass = theme === "pink" ? "pink-theme" : theme === "gold" ? "gold-theme" : "";

  return (
    <div className={`min-h-screen bg-transparent text-gray-100 antialiased ${themeClass}`}>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-[45] bg-black/70 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Desktop Column / Collapsible Sidebar */}
      <aside
        aria-label="Barra lateral de navegación"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden lg:flex fixed inset-y-0 left-0 z-[45] flex-col bg-[#0a0e17] border-r border-white/10 shadow-2xl transition-[width] duration-300 ease-in-out overflow-hidden ${
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
      <div
        className={`flex flex-col min-h-screen min-w-0 transition-[padding] duration-300 ease-in-out ${
          isPinned ? "lg:pl-64" : "lg:pl-16"
        }`}
      >
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
            <span className="font-bold text-sm text-white">Compras</span>
          </div>
          <button
            onClick={() => {
              setOpenedByShortcut(false);
              setCommandOpen(true);
            }}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4" />
          </button>
        </header>

        {/* Page Main Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1800px] mx-auto">
          {children}
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <HomeSearchModal
        isOpen={commandOpen}
        openedByShortcut={openedByShortcut}
        isSubModalOpen={Boolean(selectedQuoteFromSearch)}
        onClose={() => setCommandOpen(false)}
        onSelectCotizacion={(quote) => {
          setSelectedQuoteFromSearch(quote);
        }}
      />

      {selectedQuoteFromSearch && (
        <CotizacionDetailModal
          quote={selectedQuoteFromSearch}
          onClose={() => setSelectedQuoteFromSearch(null)}
        />
      )}

      {/* Global Drag Overlay */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] bg-blue-950/70 backdrop-blur-md border-4 border-dashed border-blue-400/70 m-3 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="p-6 rounded-3xl bg-[#0b1222]/90 border border-blue-400/30 shadow-2xl flex flex-col items-center text-center max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 mb-3">
                <UploadCloud className="w-7 h-7 animate-bounce" />
              </div>
              <h3 className="text-base font-bold text-white">Bandeja de Entrada Inteligente</h3>
              <p className="text-xs text-slate-300 mt-1">
                Soltá tu archivo (PDF, Excel o presupuesto) para elegir a qué módulo enviarlo en 1 clic.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Universal Dropped File Router Modal */}
      <AnimatePresence>
        {droppedFile && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-lg rounded-2xl bg-[#0e1424] border border-white/15 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#0a0f1c]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    {droppedFile.name.match(/\.(xlsx|xls|csv)$/i) ? (
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate max-w-[280px]">
                      {droppedFile.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {(droppedFile.size / 1024).toFixed(1)} KB • Bandeja Inteligente
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDroppedFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-2.5">
                <p className="text-xs text-slate-300 mb-3">
                  ¿Qué querés hacer con este archivo?
                </p>

                <button
                  onClick={() => {
                    const f = droppedFile;
                    setDroppedFile(null);
                    toast.info("Abriendo Cotizaciones", `Usá el botón Importar con IA para procesar ${f.name}`);
                    router.push("/cotizaciones");
                  }}
                  className="w-full p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white">Procesar como Cotización (IA / Excel)</p>
                      <p className="text-[11px] text-slate-400">
                        Extraer ítems, precios y proveedor automáticamente en el comparador
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  disabled={uploadingTemporal}
                  onClick={() => handleUploadToTemporal(droppedFile)}
                  className="w-full p-3.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 flex items-center justify-between text-left transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    {uploadingTemporal ? (
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                    ) : (
                      <FileUp className="w-5 h-5 text-blue-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-white">Subir directo a Temporal</p>
                      <p className="text-[11px] text-slate-400">
                        Alojar el archivo en el servidor para descarga inmediata
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => {
                    setDroppedFile(null);
                    router.push("/proveedores");
                  }}
                  className="w-full p-3.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white">Analizar en Proveedores IA</p>
                      <p className="text-[11px] text-slate-400">
                        Abrir el directorio y Copiloto IA de proveedores
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
