"use client";

import React from "react";
import { motion } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { ShieldAlert, Building2, HelpCircle, Mail, AlertTriangle } from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function SeguimientoDeOrdenesPage() {
  return (
    <AppLayout title="Seguimiento de Órdenes" subtitle="Cinemark & Hoyts">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16 flex flex-col justify-center min-h-[calc(100vh-140px)]">
        
        {/* Cartel de Seguridad: Módulo Desactivado */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="relative overflow-hidden rounded-3xl border border-red-500/25 bg-[#0e1220]/95 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl space-y-6 text-center"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="relative z-10 mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-lg shadow-red-950/40">
            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          {/* Header Texts */}
          <div className="relative z-10 space-y-2.5 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-wide">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Aviso de Seguridad</span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              Módulo desactivado por seguridad
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
              El acceso a la visualización y consulta de órdenes de compra ha sido desactivado temporalmente por motivos de seguridad.
            </p>
          </div>

          {/* Card de Contacto con el Área */}
          <div className="relative z-10 p-5 rounded-2xl bg-[#090d18] border border-white/10 text-left space-y-3 max-w-lg mx-auto shadow-inner">
            <div className="flex items-center gap-2.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Comunicación con el área</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Si tenés alguna duda con alguna orden de compra, necesitás consultar su estado de gestión o requerís información sobre un trámite, por favor comunicate directamente con el <span className="text-white font-semibold">área correspondiente</span> o con el equipo de <span className="text-white font-semibold">Compras & Finanzas</span>.
            </p>

            <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Área de Compras • Cinemark & Hoyts Argentina</span>
            </div>
          </div>

          {/* Footer note */}
          <p className="relative z-10 text-[11px] text-slate-500 font-medium">
            Plataforma Corporativa Finanzas • Todos los derechos reservados
          </p>
        </motion.div>

      </div>
    </AppLayout>
  );
}
