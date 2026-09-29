"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SerializableOrder } from "@/app/estadisticas/page";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Layers,
  Sparkles,
  ArrowRight,
  HardHat,
  Briefcase,
  AlertTriangle,
  Info,
  CalendarDays,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  RefreshCw,
  Building2,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  LayoutGrid,
  Zap,
  ChevronDown
} from "lucide-react";

interface EstadisticasMensualesSectionProps {
  orders: SerializableOrder[];
  onRefreshData?: () => void;
  isLoading?: boolean;
}

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const NOMBRES_MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const DIAS_SEMANA = [
  { id: 1, label: "Lunes", short: "Lun" },
  { id: 2, label: "Martes", short: "Mar" },
  { id: 3, label: "Miércoles", short: "Mié" },
  { id: 4, label: "Jueves", short: "Jue" },
  { id: 5, label: "Viernes", short: "Vie" },
  { id: 6, label: "Sábado", short: "Sáb" },
  { id: 0, label: "Domingo", short: "Dom" },
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Hook de detección de viewport con IntersectionObserver.
 */
export function useInView(
  rootMargin = "0px 0px -40px 0px",
  threshold = 0.05
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return [ref, inView];
}

/**
 * Componente AnimatedNumber de ultra alto rendimiento (60-120 FPS sin re-renders en React)
 * Actualiza el DOM directamente via textContent usando requestAnimationFrame.
 */
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  triggerKey?: any;
  inView?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  triggerKey,
  inView,
}: AnimatedNumberProps) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const hasAnimatedRef = useRef(false);

  const formatNumber = (val: number) => {
    if (isNaN(val)) return `${prefix}0${suffix}`;
    const formatted =
      decimals > 0
        ? val.toLocaleString("es-AR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : Math.round(val).toLocaleString("es-AR");
    return `${prefix}${formatted}${suffix}`;
  };

  useEffect(() => {
    hasAnimatedRef.current = false;
    if (spanRef.current) {
      spanRef.current.textContent = formatNumber(0);
    }
  }, [triggerKey, value]);

  useEffect(() => {
    if (inView === false) return;
    if (hasAnimatedRef.current) return;

    const el = spanRef.current;
    if (!el) return;

    if (!value || isNaN(value)) {
      el.textContent = formatNumber(0);
      return;
    }

    const startStepping = (targetEl: HTMLSpanElement) => {
      const STEPS = [0.25, 0.5, 0.75, 1.0];
      let stepIndex = 0;

      const interval = setInterval(() => {
        if (stepIndex < STEPS.length) {
          const factor = STEPS[stepIndex];
          const current = factor === 1.0 ? value : value * factor;
          if (targetEl) targetEl.textContent = formatNumber(current);
          stepIndex++;
        } else {
          clearInterval(interval);
        }
      }, 40);

      return () => clearInterval(interval);
    };

    if (inView === undefined && typeof IntersectionObserver !== "undefined") {
      let cleanup: (() => void) | undefined;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            observer.disconnect();
            cleanup = startStepping(el);
          }
        },
        { rootMargin: "0px 0px -30px 0px", threshold: 0.1 }
      );
      observer.observe(el);
      return () => {
        observer.disconnect();
        if (cleanup) cleanup();
      };
    } else {
      hasAnimatedRef.current = true;
      return startStepping(el);
    }
  }, [inView, triggerKey, value]);

  return (
    <span ref={spanRef} className={`tabular-nums font-mono ${className}`}>
      {formatNumber(inView ? value : 0)}
    </span>
  );
}

export function isCapexOrder(order: SerializableOrder): boolean {
  if (!order) return false;
  if (!order.motivo) return false;
  const m = order.motivo.toLowerCase();
  return /\b(capex|pct)\b/i.test(m) || m.includes("capex") || /\bpct[-0-9 ]/i.test(m);
}

type ViewSection = "todas" | "trimestre" | "diario" | "opex-capex" | "politica";

export function EstadisticasMensualesSection({
  orders,
  onRefreshData,
  isLoading = false
}: EstadisticasMensualesSectionProps) {
  // Navigation View Tab
  const [activeSection, setActiveSection] = useState<ViewSection>("todas");

  // Available Years
  const availableYears = useMemo(() => {
    const setY = new Set<number>();
    orders.forEach((o) => {
      if (o.year) setY.add(o.year);
    });
    const arr = Array.from(setY).sort((a, b) => b - a);
    return arr.length > 0 ? arr : [new Date().getFullYear()];
  }, [orders]);

  // Selected Year & Month state
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return new Date().getMonth();
  });

  // Filter only valid, non-cancelled orders
  const validOrders = useMemo(() => {
    return orders.filter((o) => !o.cancelada);
  }, [orders]);

  // Refs y handler para sincronizar el scroll horizontal simultáneo de los 3 meses
  const scrollRefCurrent = useRef<HTMLDivElement | null>(null);
  const scrollRefM1 = useRef<HTMLDivElement | null>(null);
  const scrollRefM2 = useRef<HTMLDivElement | null>(null);
  const activeScrollerRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);

  const handleSyncScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (activeScrollerRef.current && activeScrollerRef.current !== target) {
      return;
    }
    activeScrollerRef.current = target;

    const scrollLeft = target.scrollLeft;
    const targets = [
      scrollRefCurrent.current,
      scrollRefM1.current,
      scrollRefM2.current,
    ].filter((el): el is HTMLDivElement => el !== null && el !== target);

    targets.forEach((el) => {
      el.scrollLeft = scrollLeft;
    });

    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    requestAnimationFrame(() => {
      activeScrollerRef.current = null;
      isSyncingScrollRef.current = false;
    });
  };

  // Section InView hooks para animar barras y números al hacer scroll de forma progresiva
  const [novedadRef, novedadInView] = useInView("0px 0px -20px 0px", 0.05);
  const [trimestralCardsRef, trimestralCardsInView] = useInView("0px 0px -40px 0px", 0.05);
  const [trimestralChartRef, trimestralChartInView] = useInView("0px 0px -40px 0px", 0.05);

  const [dailyCurRef, dailyCurInView] = useInView("0px 0px -30px 0px", 0.05);
  const [dailyM1Ref, dailyM1InView] = useInView("0px 0px -30px 0px", 0.05);
  const [dailyM2Ref, dailyM2InView] = useInView("0px 0px -30px 0px", 0.05);
  const [topDaysRef, topDaysInView] = useInView("0px 0px -30px 0px", 0.05);
  const [dowRef, dowInView] = useInView("0px 0px -30px 0px", 0.05);

  const [opexCapexRef, opexCapexInView] = useInView("0px 0px -40px 0px", 0.05);
  const [topOrdersRef, topOrdersInView] = useInView("0px 0px -40px 0px", 0.05);

  const animTriggerKey = `${selectedYear}-${selectedMonth}`;

  // ==============================================================
  // 1. ANÁLISIS DE NOVEDAD OPEX ($1.5M -> $2.4M) & PROYECCIÓN ANUAL
  // ==============================================================
  const opexNovedadAnalysis = useMemo(() => {
    const yearOrders = validOrders.filter((o) => o.year === selectedYear);
    const opexYearOrders = yearOrders.filter((o) => !isCapexOrder(o));
    const capexYearOrders = yearOrders.filter((o) => isCapexOrder(o));

    const opexInReductionZone = opexYearOrders.filter(
      (o) => o.monto >= 1500000 && o.monto < 2400000
    );

    const activeMonths = new Set<number>();
    opexYearOrders.forEach((o) => {
      if (o.month !== null && o.month !== undefined) activeMonths.add(o.month);
    });
    const monthsCount = Math.max(1, activeMonths.size);

    const totalReductionMonto = opexInReductionZone.reduce((sum, o) => sum + o.monto, 0);
    const avgMonthlyReductionCount = opexInReductionZone.length / monthsCount;
    const avgMonthlyReductionMonto = totalReductionMonto / monthsCount;

    const percentOfOpexOrders = opexYearOrders.length > 0
      ? (opexInReductionZone.length / opexYearOrders.length) * 100
      : 0;

    return {
      totalYearOrders: yearOrders.length,
      opexCount: opexYearOrders.length,
      capexCount: capexYearOrders.length,
      opexInReductionZoneCount: opexInReductionZone.length,
      totalReductionMonto,
      avgMonthlyReductionCount: Math.round(avgMonthlyReductionCount * 10) / 10,
      avgMonthlyReductionMonto,
      percentOfOpexOrders: Math.round(percentOfOpexOrders * 10) / 10,
      monthsCount,
      estimatedNextMonthReductionMin: Math.max(0, Math.floor(avgMonthlyReductionCount * 0.9)),
      estimatedNextMonthReductionMax: Math.ceil(avgMonthlyReductionCount * 1.15),
    };
  }, [validOrders, selectedYear]);

  // ==============================================================
  // 2. COMPARATIVA DE 3 MESES: MES ACTUAL VS M-1 VS M-2
  // ==============================================================
  const comparisonMonths = useMemo(() => {
    const m0 = { year: selectedYear, month: selectedMonth };

    let m1Year = selectedYear;
    let m1Month = selectedMonth - 1;
    if (m1Month < 0) {
      m1Year -= 1;
      m1Month = 11;
    }

    let m2Year = selectedYear;
    let m2Month = selectedMonth - 2;
    if (m2Month < 0) {
      m2Year -= 1;
      m2Month += 12;
    }

    const getMonthStats = (y: number, m: number) => {
      const monthOrders = validOrders.filter((o) => {
        if (o.year !== y) return false;
        if (o.month !== m) return false;
        return true;
      });

      let opexCount = 0;
      let capexCount = 0;
      let opexMonto = 0;
      let capexMonto = 0;

      const dailyCounts: Record<number, { total: number; opex: number; capex: number; monto: number }> = {};
      const dowCounts: Record<number, { total: number; opex: number; capex: number }> = {
        0: { total: 0, opex: 0, capex: 0 },
        1: { total: 0, opex: 0, capex: 0 },
        2: { total: 0, opex: 0, capex: 0 },
        3: { total: 0, opex: 0, capex: 0 },
        4: { total: 0, opex: 0, capex: 0 },
        5: { total: 0, opex: 0, capex: 0 },
        6: { total: 0, opex: 0, capex: 0 },
      };

      monthOrders.forEach((o) => {
        const capex = isCapexOrder(o);
        const monto = o.monto || 0;

        if (capex) {
          capexCount++;
          capexMonto += monto;
        } else {
          opexCount++;
          opexMonto += monto;
        }

        let dayNum = 1;
        let dow = 1;
        if (o.timestamp > 0) {
          const d = new Date(o.timestamp);
          if (!isNaN(d.getTime())) {
            dayNum = d.getDate();
            dow = d.getDay();
          }
        }

        if (!dailyCounts[dayNum]) {
          dailyCounts[dayNum] = { total: 0, opex: 0, capex: 0, monto: 0 };
        }
        dailyCounts[dayNum].total++;
        dailyCounts[dayNum].monto += monto;
        if (capex) dailyCounts[dayNum].capex++;
        else dailyCounts[dayNum].opex++;

        if (dowCounts[dow]) {
          dowCounts[dow].total++;
          if (capex) dowCounts[dow].capex++;
          else dowCounts[dow].opex++;
        }
      });

      const totalCount = monthOrders.length;
      const totalMonto = opexMonto + capexMonto;
      const ticketPromedioTotal = totalCount > 0 ? totalMonto / totalCount : 0;
      const ticketPromedioOpex = opexCount > 0 ? opexMonto / opexCount : 0;
      const ticketPromedioCapex = capexCount > 0 ? capexMonto / capexCount : 0;

      return {
        year: y,
        month: m,
        name: `${NOMBRES_MESES[m]} ${y}`,
        shortName: `${NOMBRES_MESES[m].substring(0, 3)} '${String(y).slice(2)}`,
        orders: monthOrders,
        totalCount,
        totalMonto,
        opexCount,
        capexCount,
        opexMonto,
        capexMonto,
        ticketPromedioTotal,
        ticketPromedioOpex,
        ticketPromedioCapex,
        dailyCounts,
        dowCounts,
      };
    };

    const currentStats = getMonthStats(m0.year, m0.month);
    const m1Stats = getMonthStats(m1Year, m1Month);
    const m2Stats = getMonthStats(m2Year, m2Month);

    const varVsM1 = m1Stats.totalCount > 0
      ? ((currentStats.totalCount - m1Stats.totalCount) / m1Stats.totalCount) * 100
      : 0;

    const varVsM2 = m2Stats.totalCount > 0
      ? ((currentStats.totalCount - m2Stats.totalCount) / m2Stats.totalCount) * 100
      : 0;

    const varMontoVsM1 = m1Stats.totalMonto > 0
      ? ((currentStats.totalMonto - m1Stats.totalMonto) / m1Stats.totalMonto) * 100
      : 0;

    return {
      current: currentStats,
      m1: m1Stats,
      m2: m2Stats,
      varVsM1: Math.round(varVsM1 * 10) / 10,
      varVsM2: Math.round(varVsM2 * 10) / 10,
      varMontoVsM1: Math.round(varMontoVsM1 * 10) / 10,
    };
  }, [validOrders, selectedYear, selectedMonth]);

  // ==============================================================
  // 3. ESTADÍSTICAS POR DÍA DEL MES SELECCIONADO Y 2 MESES PREVIOS
  // ==============================================================
  const dailyStats = useMemo(() => {
    const buildMonthDays = (monthData: typeof comparisonMonths.current) => {
      const daysInMonth = new Date(monthData.year, monthData.month + 1, 0).getDate();
      const daysArray: Array<{
        day: number;
        total: number;
        opex: number;
        capex: number;
        monto: number;
      }> = [];

      let maxDayCount = 0;
      let peakDay = 1;
      let peakCount = 0;

      for (let d = 1; d <= 31; d++) {
        if (d <= daysInMonth) {
          const data = monthData.dailyCounts[d] || { total: 0, opex: 0, capex: 0, monto: 0 };
          daysArray.push({
            day: d,
            total: data.total,
            opex: data.opex,
            capex: data.capex,
            monto: data.monto,
          });

          if (data.total > maxDayCount) {
            maxDayCount = data.total;
          }
          if (data.total > peakCount) {
            peakCount = data.total;
            peakDay = d;
          }
        } else {
          daysArray.push({
            day: d,
            total: 0,
            opex: 0,
            capex: 0,
            monto: 0,
          });
        }
      }

      return {
        daysInMonth,
        daysArray,
        maxDayCount: Math.max(1, maxDayCount),
        peakDay,
        peakCount,
      };
    };

    const currentStats = buildMonthDays(comparisonMonths.current);
    const m1Stats = buildMonthDays(comparisonMonths.m1);
    const m2Stats = buildMonthDays(comparisonMonths.m2);

    const globalMaxDayCount = Math.max(
      1,
      currentStats.maxDayCount,
      m1Stats.maxDayCount,
      m2Stats.maxDayCount
    );

    const topDays = [...currentStats.daysArray]
      .filter((d) => d.day <= currentStats.daysInMonth && d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const dowRanking = DIAS_SEMANA.map((dow) => {
      const info = comparisonMonths.current.dowCounts[dow.id] || { total: 0, opex: 0, capex: 0 };
      return {
        ...dow,
        total: info.total,
        opex: info.opex,
        capex: info.capex,
      };
    }).sort((a, b) => b.total - a.total);

    const busiestDow = dowRanking[0];

    return {
      current: currentStats,
      m1: m1Stats,
      m2: m2Stats,
      globalMaxDayCount,
      daysInMonth: currentStats.daysInMonth,
      daysArray: currentStats.daysArray,
      maxDayCount: currentStats.maxDayCount,
      peakDay: currentStats.peakDay,
      peakCount: currentStats.peakCount,
      topDays,
      dowRanking,
      busiestDow,
    };
  }, [comparisonMonths]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Top OCs for OPEX and CAPEX in current month
  const topMonthOrders = useMemo(() => {
    const curOrders = comparisonMonths.current.orders;
    const topCapex = curOrders
      .filter((o) => isCapexOrder(o))
      .sort((a, b) => (b.monto || 0) - (a.monto || 0))
      .slice(0, 5);

    const topOpex = curOrders
      .filter((o) => !isCapexOrder(o))
      .sort((a, b) => (b.monto || 0) - (a.monto || 0))
      .slice(0, 5);

    return { topCapex, topOpex };
  }, [comparisonMonths]);

  // Months presence indicators for current year
  const activeMonthsInYear = useMemo(() => {
    const counts: Record<number, number> = {};
    validOrders.forEach((o) => {
      if (o.year === selectedYear && o.month !== null && o.month !== undefined) {
        counts[o.month] = (counts[o.month] || 0) + 1;
      }
    });
    return counts;
  }, [validOrders, selectedYear]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 🧭 BARRA DE NAVEGACIÓN Y VISTAS RÁPIDAS (SEGMENTED TABS)       */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 bg-[#0a0e1c]/80 border border-white/[0.08] rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none p-1">
          {[
            { id: "todas", label: "Todo el Panel", icon: LayoutGrid },
            { id: "trimestre", label: "Trimestre Comparativo", icon: BarChart3 },
            { id: "diario", label: "Distribución Diaria", icon: Calendar },
            { id: "opex-capex", label: "OPEX vs CAPEX", icon: DollarSign },
            { id: "politica", label: "Nueva Política $2.4M", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as ViewSection)}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors duration-200 flex items-center gap-1.5 ${
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMonthlySectionPill"
                    transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                    className="absolute inset-0 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/30"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Selector de Año Rápido */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#060913] rounded-xl border border-white/[0.06] self-end md:self-auto shrink-0">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-bold text-slate-400">Año:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr} className="bg-[#0b0f19] text-white">
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📅 SELECTOR DE PERÍODO & MESES DEL AÑO (INTERACTIVE CAROUSEL)  */}
      {/* ============================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="p-5 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  {comparisonMonths.current.name}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono font-bold">
                  {comparisonMonths.current.totalCount} OCs
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Seleccioná el mes que querés auditar y comparar contra los meses precedentes
              </p>
            </div>
          </div>

          {/* Controles de Navegación Previo/Siguiente */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>

            <span className="text-xs font-bold text-slate-200 px-3 py-1.5 bg-[#080b15] border border-white/[0.06] rounded-xl font-mono">
              {NOMBRES_MESES[selectedMonth]} {selectedYear}
            </span>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm"
              title="Mes Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>

            {onRefreshData && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onRefreshData}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-white/[0.08] transition-colors cursor-pointer ml-1"
                title="Recargar datos desde la base"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Recargar</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* 12 Months Fast Chips Slider */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-1">
          {NOMBRES_MESES_CORTOS.map((mShort, idx) => {
            const isSelected = selectedMonth === idx;
            const count = activeMonthsInYear[idx] || 0;
            return (
              <motion.button
                key={mShort}
                whileTap={{ scale: 0.94 }}
                onClick={() => setSelectedMonth(idx)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold cursor-pointer transition-colors border ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-bold"
                    : count > 0
                    ? "bg-[#080b15] text-slate-300 hover:text-white border-white/[0.06] hover:border-white/[0.15]"
                    : "bg-[#060913]/60 text-slate-600 border-transparent hover:text-slate-400"
                }`}
              >
                <span>{mShort}</span>
                <span className={`text-[9px] font-mono tabular-nums ${isSelected ? "text-indigo-200" : "text-slate-500"}`}>
                  {count > 0 ? count : "-"}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ============================================================== */}
      {/* 📢 CARTEL DE NOVEDADES OPERATIVAS: REGLA $1.5M -> $2.4M         */}
      {/* ============================================================== */}
      {(activeSection === "todas" || activeSection === "politica") && (
        <motion.div
          ref={novedadRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b152e] via-[#0e1b3d] to-[#070d1d] border border-indigo-500/35 p-6 shadow-2xl backdrop-blur-xl"
        >
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 -mb-16 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            {/* Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-md shadow-amber-500/10 shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Política de Compras • Período {selectedYear}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Umbral de Emisión Formal
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1">
                    Actualización de Umbral OPEX: Nuevo piso de emisión a partir de $2.400.000
                  </h2>
                </div>
              </div>

              {/* Tag de estado de la política */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold self-start md:self-auto">
                <CheckCircle2 className="w-4 h-4" />
                <span>Norma Vigente</span>
              </div>
            </div>

            {/* Explanation & Threshold Visualizer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-7 space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  Anteriormente, las órdenes de compra operativas (<strong className="text-white">OPEX</strong>) se emitían formalmente a partir de <strong className="text-amber-300 font-mono font-bold">$1.500.000</strong>.
                  Bajo la nueva directriz, el nuevo piso de corte para compras operativas pasa a ser a partir de <strong className="text-emerald-400 font-mono font-extrabold">$2.400.000</strong> (+60% de incremento en el umbral).
                </p>
                <div className="flex items-center gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong className="text-white">Importante:</strong> Las inversiones y proyectos de infraestructura (<strong className="text-purple-300 font-mono">CAPEX / PCT</strong>) <strong>no se modifican</strong> y continúan emitiéndose con el piso anterior de <strong>$1.500.000</strong>.
                  </span>
                </div>
              </div>

              {/* Visual Rule Comparison Cards */}
              <div className="lg:col-span-5 bg-black/40 border border-white/[0.08] rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Comparativa de Reglas</span>
                  <span className="text-emerald-400 font-mono font-bold">+60% en OPEX</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-400 block font-semibold">Antes (OPEX)</span>
                    <span className="text-sm font-mono font-bold text-slate-300">$ 1.500.000</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Umbral histórico</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 block font-bold">Nuevo Piso (OPEX)</span>
                    <span className="text-sm font-mono font-extrabold text-emerald-300">$ 2.400.000</span>
                    <span className="text-[10px] text-emerald-400/80 block mt-0.5 font-semibold">Activo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {/* Card 1 */}
              <motion.div
                whileHover={{ y: -3 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/40 transition-colors shadow-sm"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-amber-400" />
                  Zona de Reducción ($1.5M - $2.4M)
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-black text-amber-300">
                    <AnimatedNumber
                      value={opexNovedadAnalysis.opexInReductionZoneCount}
                      inView={novedadInView}
                      triggerKey={animTriggerKey}
                    />
                  </span>
                  <span className="text-xs text-slate-400">órdenes en {selectedYear}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Representan el{" "}
                  <strong className="text-amber-300 font-mono">
                    <AnimatedNumber
                      value={opexNovedadAnalysis.percentOfOpexOrders}
                      decimals={1}
                      suffix="%"
                      inView={novedadInView}
                      triggerKey={animTriggerKey}
                    />
                  </strong>{" "}
                  del volumen OPEX anual.
                </p>
              </motion.div>

              {/* Card 2 */}
              <motion.div
                whileHover={{ y: -3 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-blue-500/40 transition-colors shadow-sm"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Promedio Mensual en Franja
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-black text-blue-300">
                    <AnimatedNumber
                      value={opexNovedadAnalysis.avgMonthlyReductionCount}
                      prefix="~"
                      inView={novedadInView}
                      triggerKey={animTriggerKey}
                    />
                  </span>
                  <span className="text-xs text-slate-400">OCs / mes</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Basado en {opexNovedadAnalysis.monthsCount} meses con compras operativas.
                </p>
              </motion.div>

              {/* Card 3 */}
              <motion.div
                whileHover={{ y: -3 }}
                className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-400 transition-colors shadow-lg shadow-emerald-950/20"
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Reducción Proyectada Próx. Mes
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-black text-emerald-300">
                    -<AnimatedNumber value={opexNovedadAnalysis.estimatedNextMonthReductionMin} inView={novedadInView} triggerKey={animTriggerKey} /> a -<AnimatedNumber value={opexNovedadAnalysis.estimatedNextMonthReductionMax} inView={novedadInView} triggerKey={animTriggerKey} />
                  </span>
                  <span className="text-xs font-bold text-emerald-400">OCs</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Ahorro administrativo de{" "}
                  <strong className="text-emerald-300 font-mono">
                    ~<AnimatedNumber value={opexNovedadAnalysis.percentOfOpexOrders} decimals={1} suffix="%" inView={novedadInView} triggerKey={animTriggerKey} />
                  </strong>{" "}
                  menos de órdenes a emitir.
                </p>
              </motion.div>

              {/* Card 4 */}
              <motion.div
                whileHover={{ y: -3 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-purple-500/40 transition-colors shadow-sm"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                  Monto Descentralizado Anual
                </span>
                <div className="mt-2 flex items-baseline gap-2 truncate">
                  <span className="text-xl font-mono font-black text-purple-300 truncate">
                    <AnimatedNumber
                      value={opexNovedadAnalysis.totalReductionMonto / 1e6}
                      decimals={1}
                      prefix="$ "
                      suffix="M"
                      inView={novedadInView}
                      triggerKey={animTriggerKey}
                    />
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  Promedio:{" "}
                  <AnimatedNumber
                    value={opexNovedadAnalysis.avgMonthlyReductionMonto / 1e6}
                    decimals={1}
                    prefix="$ "
                    suffix="M"
                    inView={novedadInView}
                    triggerKey={animTriggerKey}
                  />{" "}
                  / mes que pasa a compra directa.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================== */}
      {/* 2. COMPARATIVA DE 3 MESES (M-2, M-1, M0)                       */}
      {/* ============================================================== */}
      {(activeSection === "todas" || activeSection === "trimestre") && (
        <div className="space-y-4">
          <div ref={trimestralCardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mes M-2 (Hace 2 meses) */}
            <motion.div
              whileHover={{ y: -3 }}
              className="p-5 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] space-y-3 relative overflow-hidden backdrop-blur-xl transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider">Hace 2 Meses (M-2)</span>
                <span className="font-mono text-slate-300 font-bold px-2 py-0.5 rounded-md bg-white/[0.04]">
                  {comparisonMonths.m2.shortName}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-white">
                  <AnimatedNumber value={comparisonMonths.m2.totalCount} inView={trimestralCardsInView} triggerKey={animTriggerKey} />
                </span>
                <span className="text-xs text-slate-400">órdenes totales</span>
              </div>

              <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">OPEX</span>
                  <span className="font-mono font-bold text-blue-400">
                    <AnimatedNumber value={comparisonMonths.m2.opexCount} inView={trimestralCardsInView} suffix=" OCs" triggerKey={animTriggerKey} />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">CAPEX</span>
                  <span className="font-mono font-bold text-purple-400">
                    <AnimatedNumber value={comparisonMonths.m2.capexCount} inView={trimestralCardsInView} suffix=" OCs" triggerKey={animTriggerKey} />
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Mes M-1 (Mes Anterior) */}
            <motion.div
              whileHover={{ y: -3 }}
              className="p-5 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] space-y-3 relative overflow-hidden backdrop-blur-xl transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider">Mes Anterior (M-1)</span>
                <span className="font-mono text-slate-300 font-bold px-2 py-0.5 rounded-md bg-white/[0.04]">
                  {comparisonMonths.m1.shortName}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-white">
                  <AnimatedNumber value={comparisonMonths.m1.totalCount} inView={trimestralCardsInView} triggerKey={animTriggerKey} />
                </span>
                <span className="text-xs text-slate-400">órdenes totales</span>
              </div>

              <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">OPEX</span>
                  <span className="font-mono font-bold text-blue-400">
                    <AnimatedNumber value={comparisonMonths.m1.opexCount} inView={trimestralCardsInView} suffix=" OCs" triggerKey={animTriggerKey} />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">CAPEX</span>
                  <span className="font-mono font-bold text-purple-400">
                    <AnimatedNumber value={comparisonMonths.m1.capexCount} inView={trimestralCardsInView} suffix=" OCs" triggerKey={animTriggerKey} />
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Mes Actual (M0) - Destacado con Glow */}
            <motion.div
              whileHover={{ y: -3 }}
              className="p-5 rounded-3xl bg-gradient-to-b from-[#131d3b] to-[#0a1024] border-2 border-indigo-500/50 space-y-3 relative overflow-hidden shadow-xl shadow-indigo-950/40 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Mes Seleccionado
                </span>
                <span className="font-mono font-extrabold text-white bg-indigo-500/30 border border-indigo-500/40 px-2.5 py-0.5 rounded-lg text-xs">
                  {comparisonMonths.current.shortName}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black font-mono text-white">
                  <AnimatedNumber value={comparisonMonths.current.totalCount} inView={trimestralCardsInView} triggerKey={animTriggerKey} />
                </span>
                <div className="text-right">
                  <div className={`flex items-center gap-1 font-mono font-bold text-xs ${
                    comparisonMonths.varVsM1 >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {comparisonMonths.varVsM1 >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{comparisonMonths.varVsM1 > 0 ? `+${comparisonMonths.varVsM1}%` : `${comparisonMonths.varVsM1}%`} vs M-1</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {comparisonMonths.varVsM2 > 0 ? `+${comparisonMonths.varVsM2}%` : `${comparisonMonths.varVsM2}%`} vs M-2
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">OPEX</span>
                  <span className="font-mono font-bold text-blue-300">
                    <AnimatedNumber value={comparisonMonths.current.opexCount} inView={trimestralCardsInView} suffix=" OCs" triggerKey={animTriggerKey} />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">CAPEX</span>
                  <span className="font-mono font-bold text-purple-300">
                    <AnimatedNumber value={comparisonMonths.current.capexCount} inView={trimestralCardsInView} suffix=" OCs" triggerKey={animTriggerKey} />
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Gráfico Visual: Comparación Trimestral en Barras Apiladas */}
          <div ref={trimestralChartRef} className="p-6 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>Volumen de Órdenes: Trimestre Comparativo</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribución apilada de órdenes OPEX (azul) vs CAPEX (violeta) en los últimos 3 meses
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-3 h-3 rounded bg-blue-500 shadow-sm" /> OPEX
                </span>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-3 h-3 rounded bg-purple-500 shadow-sm" /> CAPEX
                </span>
              </div>
            </div>

            {/* 3 Columnas Comparativas */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-3">
              {[comparisonMonths.m2, comparisonMonths.m1, comparisonMonths.current].map((mStats, idx) => {
                const isCur = idx === 2;
                const maxVal = Math.max(
                  1,
                  comparisonMonths.m2.totalCount,
                  comparisonMonths.m1.totalCount,
                  comparisonMonths.current.totalCount
                );
                const heightPercent = Math.max(14, Math.round((mStats.totalCount / maxVal) * 100));
                const opexShare = mStats.totalCount > 0 ? (mStats.opexCount / mStats.totalCount) * 100 : 0;
                const capexShare = 100 - opexShare;

                return (
                  <div key={idx} className="flex flex-col items-center space-y-2.5">
                    <span className="text-xs font-mono font-bold text-white tabular-nums">
                      <AnimatedNumber value={mStats.totalCount} inView={trimestralChartInView} suffix=" OCs" triggerKey={animTriggerKey} />
                    </span>

                    {/* Stacked Bar Container */}
                    <div className={`w-full max-w-[130px] h-44 bg-[#080b15] rounded-2xl p-1.5 flex flex-col justify-end border transition-all ${
                      isCur
                        ? "border-indigo-500/60 shadow-xl shadow-indigo-950/50 bg-indigo-950/20 ring-1 ring-indigo-500/30"
                        : "border-white/[0.06]"
                    }`}>
                      <div
                        style={{
                          height: `${heightPercent}%`,
                          transform: trimestralChartInView ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "bottom",
                          transition: "transform 650ms cubic-bezier(0.23, 1, 0.32, 1)",
                          transitionDelay: `${idx * 120}ms`,
                          willChange: "transform",
                        }}
                        className="w-full rounded-xl flex flex-col overflow-hidden shadow-md"
                      >
                        {/* CAPEX part */}
                        <div
                          style={{ height: `${capexShare}%` }}
                          className="w-full bg-gradient-to-t from-purple-600 to-purple-500"
                          title={`CAPEX: ${mStats.capexCount} OCs`}
                        />
                        {/* OPEX part */}
                        <div
                          style={{ height: `${opexShare}%` }}
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-500 border-t border-black/20"
                          title={`OPEX: ${mStats.opexCount} OCs`}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <span className={`text-xs block ${isCur ? "text-indigo-300 font-extrabold" : "text-slate-400 font-semibold"}`}>
                        {mStats.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {mStats.opexCount} OP / {mStats.capexCount} CP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. ESTADÍSTICAS POR DÍAS (DISTRIBUCIÓN 1 AL 31 & DÍAS PICO)    */}
      {/* ============================================================== */}
      {(activeSection === "todas" || activeSection === "diario") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Col (8 cols): Gráficos Diarios Comparativos del 1 al 31 */}
          <div className="lg:col-span-8 p-6 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Distribución Diaria de Órdenes</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compras emitidas día por día: mes actual vs. 2 meses anteriores sincronizados
                </p>
              </div>

              {/* Leyenda de Meses */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>{comparisonMonths.current.shortName} (Actual)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>{comparisonMonths.m1.shortName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>{comparisonMonths.m2.shortName}</span>
                </span>
              </div>
            </div>

            {/* Comparativa de los 3 meses en pistas alineadas */}
            <div className="space-y-6">
              {[
                {
                  monthData: comparisonMonths.current,
                  stats: dailyStats.current,
                  scrollRef: scrollRefCurrent,
                  inViewRef: dailyCurRef,
                  inView: dailyCurInView,
                  theme: {
                    badgeBg: "bg-indigo-500/15",
                    badgeBorder: "border-indigo-500/30",
                    badgeText: "text-indigo-300",
                    peakGradient: "bg-gradient-to-t from-emerald-600 to-emerald-400",
                    peakShadow: "shadow-md shadow-emerald-500/30",
                    peakText: "text-emerald-400",
                    barGradient: "bg-gradient-to-t from-indigo-700 to-indigo-500",
                    barHover: "group-hover:from-indigo-600 group-hover:to-indigo-400",
                    barText: "text-slate-300",
                    labelSuffix: "(Actual)",
                  },
                },
                {
                  monthData: comparisonMonths.m1,
                  stats: dailyStats.m1,
                  scrollRef: scrollRefM1,
                  inViewRef: dailyM1Ref,
                  inView: dailyM1InView,
                  theme: {
                    badgeBg: "bg-amber-500/15",
                    badgeBorder: "border-amber-500/30",
                    badgeText: "text-amber-300",
                    peakGradient: "bg-gradient-to-t from-amber-500 to-amber-300",
                    peakShadow: "shadow-md shadow-amber-500/30",
                    peakText: "text-amber-300",
                    barGradient: "bg-gradient-to-t from-amber-800/80 to-amber-600/90",
                    barHover: "group-hover:from-amber-700 group-hover:to-amber-500",
                    barText: "text-amber-200/80",
                    labelSuffix: `(M-1: ${comparisonMonths.varVsM1 > 0 ? "+" : ""}${comparisonMonths.varVsM1}%)`,
                  },
                },
                {
                  monthData: comparisonMonths.m2,
                  stats: dailyStats.m2,
                  scrollRef: scrollRefM2,
                  inViewRef: dailyM2Ref,
                  inView: dailyM2InView,
                  theme: {
                    badgeBg: "bg-purple-500/15",
                    badgeBorder: "border-purple-500/30",
                    badgeText: "text-purple-300",
                    peakGradient: "bg-gradient-to-t from-purple-500 to-purple-300",
                    peakShadow: "shadow-md shadow-purple-500/30",
                    peakText: "text-purple-300",
                    barGradient: "bg-gradient-to-t from-purple-800/80 to-purple-600/90",
                    barHover: "group-hover:from-purple-700 group-hover:to-purple-500",
                    barText: "text-purple-200/80",
                    labelSuffix: `(M-2: ${comparisonMonths.varVsM2 > 0 ? "+" : ""}${comparisonMonths.varVsM2}%)`,
                  },
                },
              ].map((item, mIdx) => {
                const { monthData, stats, theme, scrollRef, inViewRef, inView } = item;
                return (
                  <div ref={inViewRef} key={monthData.name} className="space-y-2.5">
                    {/* Sub-header de mes */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}>
                          <span>{monthData.name}</span>
                          <span className="text-[10px] font-normal opacity-90">{theme.labelSuffix}</span>
                        </span>
                        <span className="font-mono text-slate-300 font-semibold">
                          <AnimatedNumber value={monthData.totalCount} inView={inView} suffix=" OCs" triggerKey={animTriggerKey} />
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="font-mono text-slate-400">
                          <AnimatedNumber value={monthData.totalMonto / 1e6} inView={inView} prefix="$ " suffix="M" decimals={1} triggerKey={animTriggerKey} />
                        </span>
                      </div>

                      {stats.peakCount > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            Día pico: <strong className={`${theme.peakText} font-bold`}>Día {stats.peakDay}</strong> (<AnimatedNumber value={stats.peakCount} inView={inView} suffix=" OCs" triggerKey={animTriggerKey} />)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline de Barras del 1 al 31 */}
                    <div className="relative">
                      <div
                        ref={scrollRef}
                        onScroll={handleSyncScroll}
                        className="flex items-end gap-1 sm:gap-1.5 h-44 sm:h-52 w-full overflow-x-auto pb-2 pt-14 px-1 custom-scrollbar"
                      >
                        {stats.daysArray.map((d) => {
                          const isOutOfMonth = d.day > stats.daysInMonth;
                          const maxForScale = Math.max(1, stats.maxDayCount);
                          const heightPct = isOutOfMonth
                            ? 0
                            : d.total > 0
                            ? Math.max(16, Math.round((d.total / maxForScale) * 96))
                            : 4;
                          const isPeak = d.total === stats.peakCount && d.total > 0 && !isOutOfMonth;
                          const hasOrders = d.total > 0 && !isOutOfMonth;

                          return (
                            <div
                              key={d.day}
                              className="flex-1 min-w-[22px] sm:min-w-[26px] flex flex-col items-center justify-end h-full group relative"
                            >
                              {/* Tooltip on hover */}
                              {hasOrders && (
                                <div
                                  className={`absolute top-0 z-40 hidden group-hover:flex flex-col items-center bg-[#090d18]/95 border border-slate-700 text-white text-[10px] py-1.5 px-3 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap backdrop-blur-xl ${
                                    d.day <= 2
                                      ? "left-0"
                                      : d.day >= 30
                                      ? "right-0"
                                      : "left-1/2 -translate-x-1/2"
                                  }`}
                                >
                                  <span className="font-bold text-white">
                                    {monthData.shortName} • Día {d.day}: {d.total} OCs
                                  </span>
                                  <span className="text-slate-400 text-[9px] font-mono">
                                    {d.opex} OPEX • {d.capex} CAPEX
                                  </span>
                                  <span className="text-emerald-400 text-[9px] font-mono font-bold">
                                    $ {d.monto.toLocaleString("es-AR")}
                                  </span>
                                  <div className="w-1.5 h-1.5 bg-[#090d18] border-r border-b border-slate-700 rotate-45 -mb-1 mt-0.5" />
                                </div>
                              )}

                              {/* Bar Label (Count) */}
                              {hasOrders && (
                                <span
                                  style={{
                                    opacity: inView ? 1 : 0,
                                    transition: "opacity 250ms ease",
                                    transitionDelay: inView && !isOutOfMonth ? `${Math.min(d.day * 12 + 80, 400)}ms` : "0ms",
                                  }}
                                  className={`text-[10px] sm:text-xs font-mono font-black mb-1 tabular-nums ${
                                    isPeak ? `${theme.peakText} font-black` : theme.barText
                                  }`}
                                >
                                  {d.total}
                                </span>
                              )}

                              {/* Bar con GPU scaleY */}
                              <div
                                style={{
                                  height: isOutOfMonth ? "0%" : `${heightPct}%`,
                                  transform: inView && !isOutOfMonth ? "scaleY(1)" : "scaleY(0)",
                                  transformOrigin: "bottom",
                                  transition: "transform 650ms cubic-bezier(0.23, 1, 0.32, 1)",
                                  transitionDelay: inView && !isOutOfMonth ? `${Math.min(d.day * 12, 350)}ms` : "0ms",
                                  willChange: "transform",
                                }}
                                className={`w-full max-w-[24px] sm:max-w-[30px] rounded-t-md shadow-sm ${
                                  isOutOfMonth
                                    ? "opacity-0 pointer-events-none"
                                    : isPeak
                                    ? `${theme.peakGradient} ${theme.peakShadow}`
                                    : hasOrders
                                    ? `${theme.barGradient} ${theme.barHover}`
                                    : "bg-white/[0.04]"
                                }`}
                              />

                              {/* Day number */}
                              <span
                                className={`text-[10px] sm:text-[11px] mt-1.5 font-mono ${
                                  isOutOfMonth
                                    ? "text-transparent"
                                    : isPeak
                                    ? `${theme.peakText} font-black`
                                    : hasOrders
                                    ? "text-slate-200 font-bold"
                                    : "text-slate-600 font-medium"
                                }`}
                              >
                                {d.day}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {mIdx < 2 && <div className="border-t border-white/[0.06] my-4" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Col (4 cols): Ranking Días de la Semana & Top Días */}
          <div className="lg:col-span-4 space-y-4">
            {/* Top Días Récord del Mes */}
            <div ref={topDaysRef} className="p-5 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Top Días con Más Órdenes</span>
              </h4>

              <div className="space-y-2">
                {dailyStats.topDays.map((td, idx) => (
                  <motion.div
                    key={td.day}
                    whileHover={{ x: 2 }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#080b15] border border-white/[0.06] text-xs hover:border-indigo-500/30 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        idx === 0
                          ? "bg-amber-500 text-black font-black shadow-sm"
                          : idx === 1
                          ? "bg-slate-300 text-black"
                          : idx === 2
                          ? "bg-amber-700 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-white block">
                          Día {td.day} de {NOMBRES_MESES[comparisonMonths.current.month]}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {td.opex} OPEX • {td.capex} CAPEX
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-emerald-400 text-xs block">
                        <AnimatedNumber value={td.total} inView={topDaysInView} suffix=" OCs" triggerKey={animTriggerKey} />
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        <AnimatedNumber value={td.monto / 1e6} inView={topDaysInView} prefix="$ " suffix="M" decimals={1} triggerKey={animTriggerKey} />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Días de la Semana con Mayor Emisión */}
            <div ref={dowRef} className="p-5 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-blue-400" />
                  <span>Por Día de la Semana</span>
                </h4>
                {dailyStats.busiestDow && (
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                    {dailyStats.busiestDow.label} Lidera
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {dailyStats.dowRanking
                  .filter((d) => d.total > 0 || (d.id >= 1 && d.id <= 5))
                  .map((dow) => {
                    const maxDow = Math.max(1, dailyStats.busiestDow?.total || 1);
                    const pct = Math.round((dow.total / maxDow) * 100);

                    return (
                      <div key={dow.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-semibold">{dow.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({dow.opex} OP / {dow.capex} CP)
                            </span>
                            <span className="font-mono font-bold text-white">
                              <AnimatedNumber value={dow.total} inView={dowInView} suffix=" OCs" triggerKey={animTriggerKey} />
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            style={{
                              width: `${pct}%`,
                              transform: dowInView ? "scaleX(1)" : "scaleX(0)",
                              transformOrigin: "left",
                              transition: "transform 600ms cubic-bezier(0.23, 1, 0.32, 1)",
                              transitionDelay: `${dow.id * 50}ms`,
                              willChange: "transform",
                            }}
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. COMPARATIVA OPEX VS CAPEX (MONTOS Y CANTIDADES)             */}
      {/* ============================================================== */}
      {(activeSection === "todas" || activeSection === "opex-capex") && (
        <div ref={opexCapexRef} className="p-6 rounded-3xl bg-[#0d1222]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Análisis Financiero Profundo
                </span>
                <span className="text-xs text-slate-400">
                  {comparisonMonths.current.name}
                </span>
              </div>
              <h3 className="text-lg font-black text-white tracking-tight mt-1 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Comparativa OPEX vs CAPEX (Montos y Cantidades)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Clasificación: CAPEX (descripcion contiene "CAPEX" o código "PCT") vs OPEX (resto de operaciones regulares)
              </p>
            </div>

            <div className="text-right self-start sm:self-auto">
              <span className="text-[10px] text-slate-400 block font-mono">Total Facturado en el Mes</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                <AnimatedNumber value={comparisonMonths.current.totalMonto} inView={opexCapexInView} prefix="$ " triggerKey={animTriggerKey} />
              </span>
            </div>
          </div>

          {/* Tarjetas Comparativas OPEX vs CAPEX */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card OPEX */}
            <motion.div
              whileHover={{ y: -3 }}
              className="p-5 rounded-3xl bg-gradient-to-br from-[#0c1836] to-[#080f24] border-2 border-blue-500/30 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white">OPEX (Operativo)</h4>
                    <span className="text-[10px] text-slate-400">Compras recurrentes y operativas</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-300 font-mono font-bold text-xs border border-blue-500/30">
                  Piso: $2.4M
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-semibold">Cantidad de Órdenes</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-mono text-blue-300">
                      <AnimatedNumber value={comparisonMonths.current.opexCount} inView={opexCapexInView} triggerKey={animTriggerKey} />
                    </span>
                    <span className="text-xs text-slate-400">
                      ({comparisonMonths.current.totalCount > 0
                        ? Math.round((comparisonMonths.current.opexCount / comparisonMonths.current.totalCount) * 100)
                        : 0}%)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-semibold">Ticket Promedio</span>
                  <span className="text-lg font-black font-mono text-emerald-400 mt-1 block truncate">
                    <AnimatedNumber value={comparisonMonths.current.ticketPromedioOpex / 1e6} inView={opexCapexInView} prefix="$ " suffix="M" decimals={2} triggerKey={animTriggerKey} />
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 block font-semibold">Monto Total Facturado OPEX</span>
                <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400 block mt-0.5">
                  <AnimatedNumber value={comparisonMonths.current.opexMonto} inView={opexCapexInView} prefix="$ " triggerKey={animTriggerKey} />
                </span>
                <div className="w-full h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                  <div
                    style={{
                      width: `${comparisonMonths.current.totalMonto > 0 ? (comparisonMonths.current.opexMonto / comparisonMonths.current.totalMonto) * 100 : 0}%`,
                      transform: opexCapexInView ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                      transition: "transform 700ms cubic-bezier(0.23, 1, 0.32, 1)",
                      willChange: "transform",
                    }}
                    className="h-full rounded-full bg-blue-500 shadow-sm"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block text-right mt-1 font-mono">
                  {comparisonMonths.current.totalMonto > 0
                    ? Math.round((comparisonMonths.current.opexMonto / comparisonMonths.current.totalMonto) * 100)
                    : 0}% del presupuesto total
                </span>
              </div>
            </motion.div>

            {/* Card CAPEX */}
            <motion.div
              whileHover={{ y: -3 }}
              className="p-5 rounded-3xl bg-gradient-to-br from-[#1e1333] to-[#100a1c] border-2 border-purple-500/30 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <HardHat className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white">CAPEX (Inversión / Proyectos)</h4>
                    <span className="text-[10px] text-slate-400">Proyectos PCT e infraestructura</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-mono font-bold text-xs border border-purple-500/30">
                  Piso: $1.5M
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-semibold">Cantidad de Órdenes</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-mono text-purple-300">
                      <AnimatedNumber value={comparisonMonths.current.capexCount} inView={opexCapexInView} triggerKey={animTriggerKey} />
                    </span>
                    <span className="text-xs text-slate-400">
                      ({comparisonMonths.current.totalCount > 0
                        ? Math.round((comparisonMonths.current.capexCount / comparisonMonths.current.totalCount) * 100)
                        : 0}%)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-semibold">Ticket Promedio</span>
                  <span className="text-lg font-black font-mono text-emerald-400 mt-1 block truncate">
                    <AnimatedNumber value={comparisonMonths.current.ticketPromedioCapex / 1e6} inView={opexCapexInView} prefix="$ " suffix="M" decimals={2} triggerKey={animTriggerKey} />
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 block font-semibold">Monto Total Facturado CAPEX</span>
                <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400 block mt-0.5">
                  <AnimatedNumber value={comparisonMonths.current.capexMonto} inView={opexCapexInView} prefix="$ " triggerKey={animTriggerKey} />
                </span>
                <div className="w-full h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                  <div
                    style={{
                      width: `${comparisonMonths.current.totalMonto > 0 ? (comparisonMonths.current.capexMonto / comparisonMonths.current.totalMonto) * 100 : 0}%`,
                      transform: opexCapexInView ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                      transition: "transform 700ms cubic-bezier(0.23, 1, 0.32, 1)",
                      transitionDelay: "120ms",
                      willChange: "transform",
                    }}
                    className="h-full rounded-full bg-purple-500 shadow-sm"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block text-right mt-1 font-mono">
                  {comparisonMonths.current.totalMonto > 0
                    ? Math.round((comparisonMonths.current.capexMonto / comparisonMonths.current.totalMonto) * 100)
                    : 0}% del presupuesto total
                </span>
              </div>
            </motion.div>
          </div>

          {/* Top 5 Órdenes de Mayor Monto (OPEX y CAPEX) */}
          <div ref={topOrdersRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Top 5 OPEX */}
            <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06] space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Top 5 Mayores Compras OPEX del Mes</span>
              </h5>
              <div className="space-y-2">
                {topMonthOrders.topOpex.length > 0 ? (
                  topMonthOrders.topOpex.map((o) => (
                    <motion.div
                      key={o.id}
                      whileHover={{ x: 2 }}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs hover:border-blue-500/30 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">OC {o.numOC}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold">
                            {o.empresa}
                          </span>
                        </div>
                        <span className="text-slate-300 truncate block text-[11px] font-medium mt-0.5">
                          {o.razonSocial}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {o.motivo}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                        <AnimatedNumber value={o.monto} inView={topOrdersInView} prefix="$ " triggerKey={animTriggerKey} />
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Sin compras OPEX en este período
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 CAPEX */}
            <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06] space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5" />
                <span>Top 5 Mayores Inversiones CAPEX del Mes</span>
              </h5>
              <div className="space-y-2">
                {topMonthOrders.topCapex.length > 0 ? (
                  topMonthOrders.topCapex.map((o) => (
                    <motion.div
                      key={o.id}
                      whileHover={{ x: 2 }}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs hover:border-purple-500/30 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">OC {o.numOC}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                            {o.empresa}
                          </span>
                        </div>
                        <span className="text-slate-300 truncate block text-[11px] font-medium mt-0.5">
                          {o.razonSocial}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {o.motivo}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-xs shrink-0">
                        <AnimatedNumber value={o.monto} inView={topOrdersInView} prefix="$ " triggerKey={animTriggerKey} />
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Sin inversiones CAPEX en este período
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
