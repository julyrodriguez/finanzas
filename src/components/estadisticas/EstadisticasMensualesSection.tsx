"use client";

import React, { useState, useMemo } from "react";
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
  Filter
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

const DIAS_SEMANA = [
  { id: 1, label: "Lunes", short: "Lun" },
  { id: 2, label: "Martes", short: "Mar" },
  { id: 3, label: "Miércoles", short: "Mié" },
  { id: 4, label: "Jueves", short: "Jue" },
  { id: 5, label: "Viernes", short: "Vie" },
  { id: 6, label: "Sábado", short: "Sáb" },
  { id: 0, label: "Domingo", short: "Dom" },
];

export function isCapexOrder(order: SerializableOrder): boolean {
  if (!order) return false;
  if (!order.motivo) return false;
  const m = order.motivo.toLowerCase();
  return /\b(capex|pct)\b/i.test(m) || m.includes("capex") || /\bpct[-0-9 ]/i.test(m);
}

export function EstadisticasMensualesSection({
  orders,
  onRefreshData,
  isLoading = false
}: EstadisticasMensualesSectionProps) {
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
    const currY = new Date().getFullYear();
    return currY;
  });

  // Default to the latest month that has orders in that year, or current month
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const currM = new Date().getMonth();
    return currM;
  });

  // Filter only valid, non-cancelled orders
  const validOrders = useMemo(() => {
    return orders.filter((o) => !o.cancelada);
  }, [orders]);

  // ==============================================================
  // 1. ANÁLISIS DE NOVEDAD OPEX ($1.5M -> $2.4M) & PROYECCIÓN ANUAL
  // ==============================================================
  const opexNovedadAnalysis = useMemo(() => {
    const yearOrders = validOrders.filter((o) => o.year === selectedYear);
    const opexYearOrders = yearOrders.filter((o) => !isCapexOrder(o));
    const capexYearOrders = yearOrders.filter((o) => isCapexOrder(o));

    // Órdenes en la "zona de reducción" (entre $1.500.000 y $2.400.000)
    const opexInReductionZone = opexYearOrders.filter(
      (o) => o.monto >= 1500000 && o.monto < 2400000
    );

    // Meses con órdenes registradas este año
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
    // Current (M0)
    const m0 = { year: selectedYear, month: selectedMonth };

    // Previous 1 (M-1)
    let m1Year = selectedYear;
    let m1Month = selectedMonth - 1;
    if (m1Month < 0) {
      m1Year -= 1;
      m1Month = 11;
    }

    // Previous 2 (M-2)
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

      // Daily breakdown
      const dailyCounts: Record<number, { total: number; opex: number; capex: number; monto: number }> = {};
      // Day of week breakdown
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

        // Parse date for days
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

    // Variations vs M-1 and M-2
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
  // 3. ESTADÍSTICAS POR DÍA DEL MES SELECCIONADO
  // ==============================================================
  const dailyStats = useMemo(() => {
    const current = comparisonMonths.current;
    const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();

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

    for (let d = 1; d <= daysInMonth; d++) {
      const data = current.dailyCounts[d] || { total: 0, opex: 0, capex: 0, monto: 0 };
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
    }

    // Top días con más órdenes
    const topDays = [...daysArray]
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Ranking de días de la semana
    const dowRanking = DIAS_SEMANA.map((dow) => {
      const info = current.dowCounts[dow.id] || { total: 0, opex: 0, capex: 0 };
      return {
        ...dow,
        total: info.total,
        opex: info.opex,
        capex: info.capex,
      };
    }).sort((a, b) => b.total - a.total);

    const busiestDow = dowRanking[0];

    return {
      daysInMonth,
      daysArray,
      maxDayCount: Math.max(1, maxDayCount),
      peakDay,
      peakCount,
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

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ============================================================== */}
      {/* 📢 CARTEL DE NOVEDADES OPERATIVAS: REGLA $1.5M -> $2.4M         */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c162d] via-[#101b38] to-[#091124] border-2 border-indigo-500/40 p-5 sm:p-6 shadow-2xl shadow-indigo-950/40">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-md shadow-amber-500/10 shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Novedad Operativa & Nueva Política de Compras
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Período {selectedYear}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                  Actualización de Umbral OPEX: Nuevo piso de emisión a partir de $2.400.000
                </h2>
              </div>
            </div>

            {/* Selector de Año del Análisis */}
            <div className="flex items-center gap-2 self-start md:self-auto bg-black/40 p-1.5 rounded-2xl border border-white/10">
              <span className="text-[11px] font-semibold text-slate-400 pl-2">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                Anteriormente, las órdenes de compra operativas (<strong className="text-white">OPEX</strong>) se emitían formalmente a partir de <strong className="text-amber-300 font-mono">$1.500.000</strong>.
                Bajo la nueva directriz, el nuevo piso de corte para compras operativas pasa a ser a partir de <strong className="text-emerald-400 font-mono font-bold">$2.400.000</strong> (+60% de incremento en el umbral).
              </p>
              <div className="flex items-center gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-white">Importante:</strong> Las inversiones y proyectos de infraestructura (<strong className="text-purple-300 font-mono">CAPEX / PCT</strong>) <strong>no se modifican</strong> y continúan emitiéndose con el piso anterior de <strong>$1.500.000</strong>.
                </span>
              </div>
            </div>

            {/* Visual Threshold Comparison Badge */}
            <div className="lg:col-span-5 bg-black/50 border border-white/10 rounded-2xl p-3.5 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Comparativa de Reglas de Corte</span>
                <span className="text-emerald-400 font-mono">+60% en OPEX</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">Antes (OPEX)</span>
                  <span className="text-sm font-mono font-bold text-slate-300">$ 1.500.000</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Umbral histórico</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 block font-bold">Nuevo Piso (OPEX)</span>
                  <span className="text-sm font-mono font-extrabold text-emerald-300">$ 2.400.000</span>
                  <span className="text-[10px] text-emerald-400/80 block mt-0.5">Vigente</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistical Impact & Projection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* Card 1: Órdenes en la zona de reducción */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-500/40 transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                Zona de Reducción ($1.5M - $2.4M)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-black text-amber-300">
                  {opexNovedadAnalysis.opexInReductionZoneCount}
                </span>
                <span className="text-xs text-slate-400">órdenes en {selectedYear}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Representan el <strong className="text-amber-300 font-mono">{opexNovedadAnalysis.percentOfOpexOrders}%</strong> de todo el volumen OPEX anual emitido.
              </p>
            </div>

            {/* Card 2: Promedio Mensual Histórico en Franja */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-blue-500/40 transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Promedio Mensual en Franja
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-black text-blue-300">
                  ~{opexNovedadAnalysis.avgMonthlyReductionCount}
                </span>
                <span className="text-xs text-slate-400">OCs / mes</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Basado en {opexNovedadAnalysis.monthsCount} meses analizados con compras operativas.
              </p>
            </div>

            {/* Card 3: Proyección Reducción Próximo Mes */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-lg shadow-emerald-950/20">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" />
                Reducción Proyectada Próx. Mes
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-black text-emerald-300">
                  -{opexNovedadAnalysis.estimatedNextMonthReductionMin} a -{opexNovedadAnalysis.estimatedNextMonthReductionMax}
                </span>
                <span className="text-xs font-bold text-emerald-400">OCs</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Se proyecta un ahorro administrativo de <strong className="text-emerald-300">~{opexNovedadAnalysis.percentOfOpexOrders}%</strong> menos de órdenes a autorizar.
              </p>
            </div>

            {/* Card 4: Monto Anual que pasa a Gestión Directa */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                Monto Descentralizado Anual
              </span>
              <div className="mt-2 flex items-baseline gap-2 truncate">
                <span className="text-lg sm:text-xl font-mono font-black text-purple-300 truncate">
                  $ {(opexNovedadAnalysis.totalReductionMonto / 1e6).toFixed(1)}M
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                Promedio: $ {(opexNovedadAnalysis.avgMonthlyReductionMonto / 1e6).toFixed(1)}M / mes que irá a compra directa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SELECTOR DE MES & COMPARATIVA DE 3 MESES                     */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-[#090e1a] border border-white/10 shadow-xl">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Comparativa Mensual de Órdenes</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
                {comparisonMonths.current.name}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Analizando cantidades del mes actual contra los 2 meses inmediatamente anteriores
            </p>
          </div>
        </div>

        {/* Mes selector con flechas */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Mes Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-xl border border-white/10 focus:outline-none cursor-pointer"
          >
            {NOMBRES_MESES.map((name, idx) => (
              <option key={idx} value={idx}>
                {name} {selectedYear}
              </option>
            ))}
          </select>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Mes Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {onRefreshData && (
            <button
              onClick={onRefreshData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-500/30 transition-all cursor-pointer ml-2"
              title="Recargar todas las órdenes desde el servidor local"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Recargar BD</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Month Comparative Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mes M-2 (Hace 2 meses) */}
        <div className="p-5 rounded-3xl bg-[#090e1a] border border-white/10 space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Hace 2 Meses (M-2)</span>
            <span className="font-mono text-slate-300 font-bold">{comparisonMonths.m2.shortName}</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-white">
              {comparisonMonths.m2.totalCount}
            </span>
            <span className="text-xs text-slate-400">órdenes totales</span>
          </div>

          <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">OPEX</span>
              <span className="font-mono font-bold text-blue-400">{comparisonMonths.m2.opexCount} OCs</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CAPEX</span>
              <span className="font-mono font-bold text-purple-400">{comparisonMonths.m2.capexCount} OCs</span>
            </div>
          </div>
        </div>

        {/* Mes M-1 (Mes Anterior) */}
        <div className="p-5 rounded-3xl bg-[#090e1a] border border-white/10 space-y-3 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Mes Anterior (M-1)</span>
            <span className="font-mono text-slate-300 font-bold">{comparisonMonths.m1.shortName}</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-white">
              {comparisonMonths.m1.totalCount}
            </span>
            <span className="text-xs text-slate-400">órdenes totales</span>
          </div>

          <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">OPEX</span>
              <span className="font-mono font-bold text-blue-400">{comparisonMonths.m1.opexCount} OCs</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CAPEX</span>
              <span className="font-mono font-bold text-purple-400">{comparisonMonths.m1.capexCount} OCs</span>
            </div>
          </div>
        </div>

        {/* Mes Actual (M0) - Destacado */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#101b38] to-[#0a1020] border-2 border-indigo-500/50 space-y-3 relative overflow-hidden shadow-xl shadow-indigo-950/30">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Mes Seleccionado
            </span>
            <span className="font-mono font-extrabold text-white bg-indigo-500/30 border border-indigo-500/40 px-2 py-0.5 rounded-lg text-[11px]">
              {comparisonMonths.current.shortName}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-white">
              {comparisonMonths.current.totalCount}
            </span>
            <div className="text-right">
              {/* Variación vs M-1 */}
              <div className={`flex items-center gap-1 font-mono font-bold text-xs ${
                comparisonMonths.varVsM1 >= 0 ? "text-emerald-400" : "text-amber-400"
              }`}>
                {comparisonMonths.varVsM1 >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{comparisonMonths.varVsM1 > 0 ? `+${comparisonMonths.varVsM1}%` : `${comparisonMonths.varVsM1}%`} vs M-1</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {comparisonMonths.varVsM2 > 0 ? `+${comparisonMonths.varVsM2}%` : `${comparisonMonths.varVsM2}%`} vs M-2
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">OPEX</span>
              <span className="font-mono font-bold text-blue-300">{comparisonMonths.current.opexCount} OCs</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CAPEX</span>
              <span className="font-mono font-bold text-purple-300">{comparisonMonths.current.capexCount} OCs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Chart: 3-Month Bar Comparison */}
      <div className="p-5 rounded-3xl bg-[#090e1a] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>Volumen de Órdenes: Trimestre Comparativo</span>
            </h4>
            <p className="text-xs text-slate-400">
              Desglose apilado de cantidad de órdenes OPEX (azul) vs CAPEX (violeta)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-3 h-3 rounded bg-blue-500" /> OPEX
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-3 h-3 rounded bg-purple-500" /> CAPEX
            </span>
          </div>
        </div>

        {/* 3 Bars Container */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-2">
          {[comparisonMonths.m2, comparisonMonths.m1, comparisonMonths.current].map((mStats, idx) => {
            const isCur = idx === 2;
            const maxVal = Math.max(
              1,
              comparisonMonths.m2.totalCount,
              comparisonMonths.m1.totalCount,
              comparisonMonths.current.totalCount
            );
            const heightPercent = Math.max(12, Math.round((mStats.totalCount / maxVal) * 100));
            const opexShare = mStats.totalCount > 0 ? (mStats.opexCount / mStats.totalCount) * 100 : 0;
            const capexShare = 100 - opexShare;

            return (
              <div key={idx} className="flex flex-col items-center space-y-2">
                <span className="text-xs font-mono font-bold text-white">
                  {mStats.totalCount} OCs
                </span>

                {/* Stacked bar container */}
                <div className={`w-full max-w-[120px] h-40 bg-white/5 rounded-2xl p-1 flex flex-col justify-end border transition-all ${
                  isCur ? "border-indigo-500/60 shadow-lg shadow-indigo-950/40 bg-indigo-950/20" : "border-white/5"
                }`}>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full rounded-xl flex flex-col overflow-hidden transition-all duration-500 shadow-sm"
                  >
                    {/* CAPEX bar part */}
                    <div
                      style={{ height: `${capexShare}%` }}
                      className="w-full bg-gradient-to-t from-purple-600 to-purple-500"
                      title={`CAPEX: ${mStats.capexCount} OCs`}
                    />
                    {/* OPEX bar part */}
                    <div
                      style={{ height: `${opexShare}%` }}
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-500 border-t border-black/20"
                      title={`OPEX: ${mStats.opexCount} OCs`}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <span className={`text-xs font-bold block ${isCur ? "text-indigo-300 font-extrabold" : "text-slate-400"}`}>
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

      {/* ============================================================== */}
      {/* 3. ESTADÍSTICAS POR DÍAS (¿QUÉ DÍAS HUBO MÁS?)                  */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col (8 cols): Gráfico Diario del 1 al 31 */}
        <div className="lg:col-span-8 p-5 rounded-3xl bg-[#090e1a] border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Distribución Diaria de Órdenes ({comparisonMonths.current.name})</span>
              </h4>
              <p className="text-xs text-slate-400">
                Cantidad de compras generadas cada día del mes
              </p>
            </div>

            {/* Peak day badge */}
            <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl text-emerald-300 self-start sm:self-auto font-medium">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Día pico: <strong>Día {dailyStats.peakDay}</strong> ({dailyStats.peakCount} OCs)</span>
            </div>
          </div>

          {/* Daily Bar Chart (1 to 31) */}
          <div className="pt-2">
            <div className="flex items-end gap-1 sm:gap-1.5 h-44 w-full overflow-x-auto pb-2 pt-6">
              {dailyStats.daysArray.map((d) => {
                const heightPct = Math.max(8, Math.round((d.total / dailyStats.maxDayCount) * 100));
                const isPeak = d.total === dailyStats.peakCount && d.total > 0;
                const hasOrders = d.total > 0;

                return (
                  <div
                    key={d.day}
                    className="flex-1 min-w-[20px] sm:min-w-[24px] flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    {hasOrders && (
                      <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 border border-slate-700 text-white text-[10px] py-1 px-2 rounded-lg shadow-xl pointer-events-none whitespace-nowrap">
                        <span className="font-bold">Día {d.day}: {d.total} OCs</span>
                        <span className="text-slate-400 text-[9px] font-mono">
                          {d.opex} OPEX / {d.capex} CAPEX
                        </span>
                        <span className="text-emerald-400 text-[9px] font-mono">
                          $ {d.monto.toLocaleString("es-AR")}
                        </span>
                      </div>
                    )}

                    {/* Bar Label (Count) */}
                    {hasOrders && (
                      <span className={`text-[9px] font-mono font-bold mb-1 ${
                        isPeak ? "text-emerald-400" : "text-slate-400"
                      }`}>
                        {d.total}
                      </span>
                    )}

                    {/* The Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isPeak
                          ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md shadow-emerald-500/30"
                          : hasOrders
                          ? "bg-gradient-to-t from-indigo-700 to-indigo-500 group-hover:from-indigo-600 group-hover:to-indigo-400"
                          : "bg-white/[0.04]"
                      }`}
                    />

                    {/* Day number */}
                    <span className={`text-[10px] mt-1 font-mono ${
                      isPeak ? "text-emerald-400 font-black" : hasOrders ? "text-slate-300 font-semibold" : "text-slate-600"
                    }`}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col (4 cols): Ranking Días de la Semana & Top Días */}
        <div className="lg:col-span-4 space-y-4">
          {/* Top Días Récord del Mes */}
          <div className="p-5 rounded-3xl bg-[#090e1a] border border-white/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Top Días con Más Órdenes</span>
            </h4>

            <div className="space-y-2">
              {dailyStats.topDays.map((td, idx) => (
                <div
                  key={td.day}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      idx === 0
                        ? "bg-amber-500 text-black font-black"
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
                      {td.total} OCs
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      $ {(td.monto / 1e6).toFixed(1)}M
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Días de la Semana con Mayor Emisión */}
          <div className="p-5 rounded-3xl bg-[#090e1a] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <span>Por Día de la Semana</span>
              </h4>
              {dailyStats.busiestDow && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                  {dailyStats.busiestDow.label} Lidera
                </span>
              )}
            </div>

            <div className="space-y-2">
              {dailyStats.dowRanking
                .filter((d) => d.total > 0 || d.id >= 1 && d.id <= 5)
                .map((dow) => {
                  const maxDow = Math.max(1, dailyStats.busiestDow?.total || 1);
                  const pct = Math.round((dow.total / maxDow) * 100);

                  return (
                    <div key={dow.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{dow.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({dow.opex} OP / {dow.capex} CP)
                          </span>
                          <span className="font-mono font-bold text-white">{dow.total} OCs</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. COMPARATIVA OPEX VS CAPEX (MONTOS Y CANTIDADES)             */}
      {/* ============================================================== */}
      <div className="p-6 rounded-3xl bg-[#090e1a] border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
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
              $ {comparisonMonths.current.totalMonto.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Comparative 2-Column Cards (OPEX vs CAPEX) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card OPEX */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0b152d] to-[#080d1a] border-2 border-blue-500/30 space-y-4">
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
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Cantidad de Órdenes</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black font-mono text-blue-300">
                    {comparisonMonths.current.opexCount}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({comparisonMonths.current.totalCount > 0
                      ? Math.round((comparisonMonths.current.opexCount / comparisonMonths.current.totalCount) * 100)
                      : 0}%)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Ticket Promedio</span>
                <span className="text-lg font-black font-mono text-emerald-400 mt-1 block truncate">
                  $ {(comparisonMonths.current.ticketPromedioOpex / 1e6).toFixed(2)}M
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Monto Total Facturado OPEX</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400 block mt-0.5">
                $ {comparisonMonths.current.opexMonto.toLocaleString("es-AR")}
              </span>
              <div className="w-full h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div
                  style={{
                    width: `${comparisonMonths.current.totalMonto > 0
                      ? (comparisonMonths.current.opexMonto / comparisonMonths.current.totalMonto) * 100
                      : 0}%`
                  }}
                  className="h-full rounded-full bg-blue-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 block text-right mt-1 font-mono">
                {comparisonMonths.current.totalMonto > 0
                  ? Math.round((comparisonMonths.current.opexMonto / comparisonMonths.current.totalMonto) * 100)
                  : 0}% del presupuesto total
              </span>
            </div>
          </div>

          {/* Card CAPEX */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1c112d] to-[#0f091a] border-2 border-purple-500/30 space-y-4">
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
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Cantidad de Órdenes</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black font-mono text-purple-300">
                    {comparisonMonths.current.capexCount}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({comparisonMonths.current.totalCount > 0
                      ? Math.round((comparisonMonths.current.capexCount / comparisonMonths.current.totalCount) * 100)
                      : 0}%)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Ticket Promedio</span>
                <span className="text-lg font-black font-mono text-emerald-400 mt-1 block truncate">
                  $ {(comparisonMonths.current.ticketPromedioCapex / 1e6).toFixed(2)}M
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Monto Total Facturado CAPEX</span>
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-400 block mt-0.5">
                $ {comparisonMonths.current.capexMonto.toLocaleString("es-AR")}
              </span>
              <div className="w-full h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div
                  style={{
                    width: `${comparisonMonths.current.totalMonto > 0
                      ? (comparisonMonths.current.capexMonto / comparisonMonths.current.totalMonto) * 100
                      : 0}%`
                  }}
                  className="h-full rounded-full bg-purple-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 block text-right mt-1 font-mono">
                {comparisonMonths.current.totalMonto > 0
                  ? Math.round((comparisonMonths.current.capexMonto / comparisonMonths.current.totalMonto) * 100)
                  : 0}% del presupuesto total
              </span>
            </div>
          </div>
        </div>

        {/* Top 5 Orders Tables for both OPEX & CAPEX in Month */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Top 5 OPEX */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Top 5 Mayores Compras OPEX del Mes</span>
            </h5>
            <div className="space-y-2">
              {topMonthOrders.topOpex.length > 0 ? (
                topMonthOrders.topOpex.map((o) => (
                  <div
                    key={o.id}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">OC {o.numOC}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
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
                      $ {o.monto.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-500">
                  Sin compras OPEX en este período
                </div>
              )}
            </div>
          </div>

          {/* Top 5 CAPEX */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5" />
              <span>Top 5 Mayores Inversiones CAPEX del Mes</span>
            </h5>
            <div className="space-y-2">
              {topMonthOrders.topCapex.length > 0 ? (
                topMonthOrders.topCapex.map((o) => (
                  <div
                    key={o.id}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">OC {o.numOC}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
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
                      $ {o.monto.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-500">
                  Sin inversiones CAPEX en este período
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
