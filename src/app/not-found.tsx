import Link from "next/link";
import { 
  FileQuestion, 
  Home, 
  ShoppingBag, 
  BarChart3, 
  Calendar, 
  ClipboardList, 
  ArrowLeft,
  TrendingUp,
  Sparkles
} from "lucide-react";

export const metadata = {
  title: "404 - Página no encontrada",
  description: "La página solicitada no existe o ha sido movida dentro de la plataforma Finanzas.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  const quickLinks = [
    { name: "Órdenes de Compra", href: "/", icon: ShoppingBag, desc: "Gestión principal y carga" },
    { name: "Dashboard de Inicio", href: "/inicio", icon: Home, desc: "Resumen ejecutivo" },
    { name: "Estadísticas y KPIs", href: "/estadisticas", icon: BarChart3, desc: "Métricas y evolución" },
    { name: "Calendario de Pagos", href: "/calendario", icon: Calendar, desc: "Fechas de vencimiento" },
    { name: "Pendientes", href: "/pendientes", icon: ClipboardList, desc: "Órdenes por liberar" },
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial gradients */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-40" 
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.15), transparent 45%),
            radial-gradient(circle at 85% 75%, rgba(16, 185, 129, 0.1), transparent 40%)
          `
        }} 
        aria-hidden="true" 
      />

      {/* Semantic Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="h-full w-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-tight">Finanzas</span>
            <span className="text-[11px] text-slate-400 block -mt-0.5">Plataforma Corporativa</span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Inicio</span>
        </Link>
      </header>

      {/* Semantic Main Content */}
      <main role="main" className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-3xl mx-auto text-center">
        {/* Neon 404 badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Error 404 · Recurso Inexistente</span>
        </div>

        {/* Large 404 illustration text */}
        <div className="relative mb-4 select-none" aria-hidden="true">
          <span className="text-8xl sm:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white/90 via-slate-300 to-slate-700">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-500/30 text-indigo-400 shadow-2xl shadow-indigo-500/30">
              <FileQuestion className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
          Página no encontrada
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-lg mb-8 leading-relaxed">
          La ruta que intentas consultar no existe o ha sido reubicada. Utiliza los accesos directos a continuación para continuar navegando en la plataforma.
        </p>

        {/* Semantic Navigation with Quick Links */}
        <nav aria-label="Enlaces rápidos a secciones principales" className="w-full">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 hover:border-indigo-500/40 transition-all duration-200 group"
                  >
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                        {item.name}
                      </h2>
                      <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Return Button */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Ir a Órdenes de Compra</span>
          </Link>
        </div>
      </main>

      {/* Semantic Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-slate-500 border-t border-white/5">
        <p>© {new Date().getFullYear()} Finanzas · Cinemark & Hoyts. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
