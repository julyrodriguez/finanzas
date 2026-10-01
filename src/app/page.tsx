"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AppLayout } from "@/components/AppLayout";
import { EyeTrackerCube } from "@/components/home/EyeTrackerCube";
import { 
  ShoppingBag, 
  Clock, 
  Scale, 
  Percent, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  FileSpreadsheet,
  Layers,
  ChevronRight
} from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface MenuCardProps {
  href: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  gradientHover: string;
  tags: string[];
  ctaText: string;
}

function MenuCard({
  href,
  title,
  badge,
  badgeColor,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  gradientHover,
  tags,
  ctaText,
}: MenuCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={href} className="block group select-none">
      <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-white/[0.08] bg-[#0d1322]/85 backdrop-blur-xl transition-all duration-300 shadow-xl group-hover:border-white/20 group-hover:shadow-2xl ${gradientHover}`}
      >
        {/* Ambient Top Glow */}
        <div 
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-40"
          style={{ background: iconColor }}
        />

        {/* Card Header: Icon + Badge */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-110 ${iconBg}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border ${badgeColor}`}>
            {badge}
          </span>
        </div>

        {/* Card Title & Description */}
        <div className="space-y-1.5 mb-5">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-blue-200 transition-colors">
              {title}
            </h3>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-400 font-medium leading-relaxed line-clamp-2 sm:line-clamp-3">
            {description}
          </p>
        </div>

        {/* Tags / Features */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-slate-300 font-semibold"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Action Link Footer */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
          <span>{ctaText}</span>
          <div className="w-7 h-7 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-slate-400 group-hover:text-white group-hover:translate-x-1 group-hover:bg-white/10 transition-all">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <AppLayout title="Portal Principal" subtitle="Cinemark & Hoyts">
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col justify-center min-h-[calc(100vh-130px)] space-y-6 sm:space-y-10">
        
        {/* Executive Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide">
            <Building2 className="w-3.5 h-3.5" />
            <span>Cinemark & Hoyts • Finanzas</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Centro de Control Financiero
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Seleccioná uno de los módulos operativos principales para acceder a la gestión
          </p>
        </div>

        {/* Desktop 3-Column Layout with Center Eye-Tracker Cube */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center w-full">
          
          {/* Left Column: 2 Cards */}
          <div className="order-2 lg:order-1 lg:col-span-4 flex flex-col gap-5 sm:gap-6 z-10">
            <MenuCard
              href="/ordenes-de-compras"
              title="Órdenes de Compra"
              badge="Operaciones"
              badgeColor="bg-blue-500/10 text-blue-400 border-blue-500/20"
              description="Gestión integral, estados, carga de notas internas y seguimiento presupuestario de Cinemark & Hoyts."
              icon={ShoppingBag}
              iconBg="bg-blue-500/15 border-blue-500/30"
              iconColor="text-blue-400"
              gradientHover="group-hover:shadow-blue-500/10"
              tags={["Hoyts / CMK", "Control de Estados", "Buscador"]}
              ctaText="Ingresar a Órdenes"
            />

            <MenuCard
              href="/proceso-de-liberacion"
              title="Proceso de Liberación"
              badge="Firmas & Pago"
              badgeColor="bg-amber-500/10 text-amber-300 border-amber-500/20"
              description="Control de firmas escalonadas por tramos de importe y habilitación definitiva de pagos a proveedores."
              icon={Clock}
              iconBg="bg-amber-500/15 border-amber-500/30"
              iconColor="text-amber-400"
              gradientHover="group-hover:shadow-amber-500/10"
              tags={["Tramos de Monto", "Validación", "Liberación"]}
              ctaText="Ver Liberaciones"
            />
          </div>

          {/* Center Column: The Large Interactive Eye Tracker Cube */}
          <div className="order-1 lg:order-2 lg:col-span-4 flex flex-col items-center justify-center py-4 lg:py-0 z-0">
            <div className="relative flex flex-col items-center">
              {/* Responsive Eye Tracker Cube */}
              <div className="hidden sm:block">
                <EyeTrackerCube size={240} follow={70} bounce={32} />
              </div>
              <div className="block sm:hidden">
                <EyeTrackerCube size={180} follow={70} bounce={32} />
              </div>

              {/* Status indicator below the cube */}
              <div className="mt-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono font-medium text-slate-300 tracking-tight select-none">
                  Siguiendo tu cursor
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: 2 Cards */}
          <div className="order-3 lg:order-3 lg:col-span-4 flex flex-col gap-5 sm:gap-6 z-10">
            <MenuCard
              href="/cotizaciones"
              title="Cotizaciones"
              badge="Precios & IA"
              badgeColor="bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              description="Matriz comparativa de presupuestos, desglose de costos e importación automática de presupuestos con IA."
              icon={Scale}
              iconBg="bg-emerald-500/15 border-emerald-500/30"
              iconColor="text-emerald-400"
              gradientHover="group-hover:shadow-emerald-500/10"
              tags={["Comparativa Multi-Proveedor", "IA Integrada", "Excel"]}
              ctaText="Comparar Cotizaciones"
            />

            <MenuCard
              href="/distribucion"
              title="Distribución"
              badge="Complejos"
              badgeColor="bg-purple-500/10 text-purple-300 border-purple-500/20"
              description="Distribución de gastos entre complejos de cine, asignación de cuentas Solomon y órdenes Flix."
              icon={Percent}
              iconBg="bg-purple-500/15 border-purple-500/30"
              iconColor="text-purple-400"
              gradientHover="group-hover:shadow-purple-500/10"
              tags={["Por Complejo", "Flix Orders", "Solomon"]}
              ctaText="Abrir Distribución"
            />
          </div>

        </div>

        {/* Subtle Bottom Footnote */}
        <div className="text-center text-[11px] text-slate-500 font-medium">
          Plataforma Financiera Corporativa • Cinemark & Hoyts Argentina
        </div>
      </div>
    </AppLayout>
  );
}
