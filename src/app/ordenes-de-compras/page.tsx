import { AppLayout } from "@/components/AppLayout";
import { Clock, ShoppingBag, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OrdenesDeComprasPage() {
  return (
    <AppLayout 
      title="Órdenes de Compra" 
      subtitle="Gestión de adquisiciones y pedidos"
    >
      <div className="flex flex-col items-center justify-center min-h-[65vh] py-8 text-center">
        {/* Main Glass Box for Próximamente */}
        <div className="w-full max-w-2xl p-6 sm:p-10 rounded-3xl glass-card border border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 via-[#0d131f] to-[#090d16] shadow-2xl relative overflow-hidden space-y-6">
          {/* Background Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner">
            <ShoppingBag className="w-10 h-10" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>Próximamente</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Órdenes de Compra
            </h2>

            <p className="text-gray-300 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Esta pestaña se encuentra en desarrollo. Muy pronto podrás emitir y gestionar tus órdenes de compra desde aquí.
            </p>
          </div>

          {/* Quick link back to Inicio */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Inicio</span>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
