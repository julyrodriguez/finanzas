import { AppLayout } from "@/components/AppLayout";
import { Clock, Sparkles, LayoutDashboard, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function InicioPage() {
  return (
    <AppLayout 
      title="Inicio" 
      subtitle="Panel principal y resumen de módulo"
    >
      <div className="flex flex-col items-center justify-center min-h-[65vh] py-8 text-center">
        {/* Main Glass Box for Próximamente */}
        <div className="w-full max-w-2xl p-6 sm:p-10 rounded-3xl glass-card border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-[#0d131f] to-[#090d16] shadow-2xl relative overflow-hidden space-y-6">
          {/* Background Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
            <LayoutDashboard className="w-10 h-10" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>Próximamente</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Sección Inicio
            </h2>


          </div>

          {/* Quick link to other tab */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/ordenes-de-compras"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <span>Ver Órdenes de Compra</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
