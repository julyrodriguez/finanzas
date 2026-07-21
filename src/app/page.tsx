import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { 
  TrendingUp, 
  ArrowUpRight, 
  Wallet, 
  PieChart, 
  Clock, 
  Sparkles,
  Layers,
  ShieldAlert,
  CheckCircle2
} from "lucide-react";

export default function InicioPage() {
  return (
    <div className="flex min-h-screen bg-[#090d16]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header 
          title="Inicio - Dashboard General" 
          subtitle="Resumen general de métricas financieras y accesos rápidos" 
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Hero Banner: Próximamente */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-[#0d1526] to-[#090d16] p-8 md:p-10 shadow-2xl">
            {/* Glowing decorative background elements */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Módulo en Desarrollo</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Panel de Inicio & Analytics
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                    ¡Próximamente disponible!
                  </span>
                </h2>

                <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                  Estamos construyendo un panel interactivo inteligente para visualización de ingresos, flujos de caja y proyecciones presupuestarias en tiempo real.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Gráficos Interactivos Chart.js
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Resumen de Flujo de Caja
                  </div>
                </div>
              </div>

              {/* Status Badge & CTA Box */}
              <div className="lg:w-80 p-6 rounded-2xl glass-card border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Versión 1.0 (BETA)
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Avance global</span>
                    <span className="text-emerald-400 font-semibold">65%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full w-2/3 rounded-full" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 italic">
                  Próxima actualización estimada: Próximos días.
                </p>
              </div>
            </div>
          </div>

          {/* Preview Skeleton Metrics Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Vista Previa de Indicadores
              </h3>
              <span className="text-xs text-gray-400">Datos de muestra</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Metric Card 1 */}
              <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    +12.4% <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-400">Balance Total Estimado</p>
                <h4 className="text-2xl font-bold text-white mt-1">$ 48,250,000 COP</h4>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                  <span>Módulo principal</span>
                  <span className="text-amber-400 font-medium">Próximamente</span>
                </div>
              </div>

              {/* Metric Card 2 */}
              <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    +8.1% <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-400">Ingresos Mensuales</p>
                <h4 className="text-2xl font-bold text-white mt-1">$ 14,800,000 COP</h4>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                  <span>Módulo principal</span>
                  <span className="text-amber-400 font-medium">Próximamente</span>
                </div>
              </div>

              {/* Metric Card 3 */}
              <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all sm:col-span-2 lg:col-span-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <PieChart className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold">
                    En progreso
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-400">Órdenes Ejecutadas</p>
                <h4 className="text-2xl font-bold text-white mt-1">142 Solicitudes</h4>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                  <span>Ver Órdenes de Compras</span>
                  <span className="text-amber-400 font-medium">Próximamente</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
