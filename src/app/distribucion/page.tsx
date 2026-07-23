"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { 
  Percent, 
  Calculator, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  Save, 
  X, 
  Building2, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Copy
} from "lucide-react";

interface Complejo {
  codigo: string;
  nombre: string;
  region: "CABA" | "GBA" | "Interior";
  cadena: "Cinemark" | "Hoyts";
  attendance: number;
}

const INITIAL_COMPLEJOS: Complejo[] = [
  // Cinemark complexes
  { codigo: "00730", nombre: "Puerto Madero 8 ARG", region: "CABA", cadena: "Cinemark", attendance: 315551 },
  { codigo: "00732", nombre: "Mendoza 10 ARG", region: "Interior", cadena: "Cinemark", attendance: 522051 },
  { codigo: "00733", nombre: "Beruti Bulnes 10 RDLP", region: "CABA", cadena: "Cinemark", attendance: 814624 },
  { codigo: "00734", nombre: "Caballito 6 ARG", region: "CABA", cadena: "Cinemark", attendance: 393878 },
  { codigo: "00739", nombre: "Soleil 9 ARG", region: "GBA", cadena: "Cinemark", attendance: 393545 },
  { codigo: "00749", nombre: "San Miguel 10 ARG", region: "GBA", cadena: "Cinemark", attendance: 891887 },
  { codigo: "00745", nombre: "Puerto Santa Fe Mall 6 ARG", region: "Interior", cadena: "Cinemark", attendance: 489685 },
  { codigo: "00748", nombre: "San Justo 5 ARG", region: "GBA", cadena: "Cinemark", attendance: 691997 },
  { codigo: "00756", nombre: "Tortugas Open BA Mall 7 ARG", region: "GBA", cadena: "Cinemark", attendance: 705413 },
  { codigo: "02013", nombre: "Hiper Libertad Salta ARG", region: "Interior", cadena: "Cinemark", attendance: 325506 },
  { codigo: "02014", nombre: "Alto Comahue Neuquen ARG", region: "Interior", cadena: "Cinemark", attendance: 450751 },
  { codigo: "02015", nombre: "Alto Avellaneda ARG", region: "GBA", cadena: "Cinemark", attendance: 777473 },
  { codigo: "02016", nombre: "Parque Brown ARG", region: "GBA", cadena: "Cinemark", attendance: 203000 },
  // Hoyts complexes
  { codigo: "02000", nombre: "Unicenter Shopping Martinez ARG", region: "GBA", cadena: "Hoyts", attendance: 1562399 },
  { codigo: "02001", nombre: "Plaza Oeste Moron ARG", region: "GBA", cadena: "Hoyts", attendance: 809703 },
  { codigo: "02002", nombre: "Quilmes ARG", region: "GBA", cadena: "Hoyts", attendance: 744305 },
  { codigo: "02003", nombre: "Dot Mall Buenos Aires ARG", region: "CABA", cadena: "Hoyts", attendance: 846344 },
  { codigo: "02004", nombre: "Abasto Shopping Buenos Aires ARG", region: "CABA", cadena: "Hoyts", attendance: 1372869 },
  { codigo: "02005", nombre: "Temperley ARG", region: "GBA", cadena: "Hoyts", attendance: 673657 },
  { codigo: "02006", nombre: "Shopping Nine Moreno ARG", region: "GBA", cadena: "Hoyts", attendance: 510706 },
  { codigo: "02007", nombre: "Nuevo Noa Shopping Salta ARG", region: "Interior", cadena: "Hoyts", attendance: 581342 },
  { codigo: "02008", nombre: "Nuevo Centro Cordoba ARG", region: "Interior", cadena: "Hoyts", attendance: 482515 },
  { codigo: "02009", nombre: "Patio Olmos Cordoba ARG", region: "Interior", cadena: "Hoyts", attendance: 426372 },
];

const CUSTOM_ORDER = [
  "00730",
  "00732",
  "00733",
  "00734",
  "00739",
  "00749",
  "00745",
  "00748",
  "00756",
  "02013",
  "02014",
  "02015",
  "02016",
  "02000",
  "02001",
  "02002",
  "02003",
  "02004",
  "02005",
  "02006",
  "02007",
  "02008",
  "02009",
  "02010"
];

export default function DistribucionPage() {
  const [montoTotal, setMontoTotal] = useState<string>("1000000"); // Preloaded with 1,000,000 as default
  const [cadenaFilter, setCadenaFilter] = useState<"Cinemark" | "Hoyts" | "Consolidados">("Consolidados");
  const [ambitoFilter, setAmbitoFilter] = useState<
    "todos" | "todos_oficina" | "caba" | "gba" | "amba" | "amba_oficina" | "interior"
  >("todos");

  const [complejos, setComplejos] = useState<Complejo[]>(INITIAL_COMPLEJOS);
  const [editableComplejos, setEditableComplejos] = useState<Complejo[]>(INITIAL_COMPLEJOS);
  
  // Security locks
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Success message toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load from localStorage on client render
  useEffect(() => {
    const saved = localStorage.getItem("complejos-attendance-2026");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === INITIAL_COMPLEJOS.length) {
          setComplejos(parsed);
          setEditableComplejos(parsed);
        }
      } catch (err) {
        console.error("Error parsing saved attendance:", err);
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle PIN check
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "1234") {
      setIsUnlocked(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError(null);
      setEditableComplejos(JSON.parse(JSON.stringify(complejos))); // clone current state to editable
      showToast("🔓 Edición de Attendance desbloqueada");
    } else {
      setPinError("PIN incorrecto. Reintente.");
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsUnlocked(false);
    setEditableComplejos(JSON.parse(JSON.stringify(complejos))); // rollback
    showToast("🔒 Edición cancelada, valores revertidos");
  };

  // Save edit mode
  const handleSaveAttendance = () => {
    setComplejos(editableComplejos);
    localStorage.setItem("complejos-attendance-2026", JSON.stringify(editableComplejos));
    setIsUnlocked(false);
    showToast("💾 Cambios de Attendance guardados");
  };

  // Handle individual attendance input change
  const handleAttendanceChange = (codigo: string, value: string) => {
    const numericValue = Math.max(0, parseInt(value) || 0);
    setEditableComplejos((prev) =>
      prev.map((c) => (c.codigo === codigo ? { ...c, attendance: numericValue } : c))
    );
  };

  // Calculate distributions based on rules
  const activeComplejosList = isUnlocked ? editableComplejos : complejos;

  // Filter complexes
  const filteredComplejos = activeComplejosList.filter((c) => {
    // 1. Cadena filter
    if (cadenaFilter !== "Consolidados" && c.cadena !== cadenaFilter) {
      return false;
    }

    // 2. Geographic filter
    switch (ambitoFilter) {
      case "caba":
        return c.region === "CABA";
      case "gba":
        return c.region === "GBA";
      case "amba":
      case "amba_oficina":
        return c.region === "CABA" || c.region === "GBA";
      case "interior":
        return c.region === "Interior";
      case "todos":
      case "todos_oficina":
      default:
        return true;
    }
  });

  // Sum of attendance of active/filtered complexes
  const totalAttendance = filteredComplejos.reduce((sum, c) => sum + c.attendance, 0);

  // Oficina Central fixed assignment
  let percentOficina = 0;
  if (ambitoFilter === "todos_oficina") {
    percentOficina = 8.34;
  } else if (ambitoFilter === "amba_oficina") {
    percentOficina = 10.13;
  }

  const percentCines = 100 - percentOficina;
  const numMontoTotal = Math.max(0, Number(montoTotal) || 0);

  // Generate table rows
  const tableRows = filteredComplejos.map((c) => {
    const percentage = totalAttendance > 0 ? (c.attendance / totalAttendance) * percentCines : 0;
    const montoProrrateado = numMontoTotal * (percentage / 100);
    return {
      ...c,
      percentage,
      montoProrrateado,
      isOficina: false
    };
  });

  // Sort rows: first cines sorted by custom historical sequence order
  tableRows.sort((a, b) => {
    const idxA = CUSTOM_ORDER.indexOf(a.codigo);
    const idxB = CUSTOM_ORDER.indexOf(b.codigo);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  // Add Oficina Central row at the bottom if present
  if (percentOficina > 0) {
    tableRows.push({
      codigo: "OF.CENTRAL",
      nombre: "Oficina Central (Administrativo)",
      region: "-" as any,
      cadena: "-" as any,
      attendance: 0,
      percentage: percentOficina,
      montoProrrateado: numMontoTotal * (percentOficina / 100),
      isOficina: true
    });
  }

  // Summary counts
  const complexesCount = filteredComplejos.length;
  const distributedToCines = tableRows.filter(r => !r.isOficina).reduce((sum, r) => sum + r.montoProrrateado, 0);
  const distributedToOficina = tableRows.filter(r => r.isOficina).reduce((sum, r) => sum + r.montoProrrateado, 0);
  const sumPercentage = tableRows.reduce((sum, r) => sum + r.percentage, 0);
  const sumDistributed = tableRows.reduce((sum, r) => sum + r.montoProrrateado, 0);

  // Copy prorated amounts to clipboard (one per line, formatted with comma for Spanish Excel)
  const handleCopyMontos = () => {
    const textToCopy = tableRows
      .map(r => r.montoProrrateado.toFixed(2).replace(".", ","))
      .join("\n");

    navigator.clipboard.writeText(textToCopy);
    showToast("📋 Montos copiados al portapapeles");
  };

  return (
    <AppLayout 
      title="Distribución de Gastos" 
      subtitle="Prorrateo de montos corporativos entre complejos en base a Attendance 2026"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0d131f] border border-emerald-500/30 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold text-emerald-400 flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tailwind Print Styles Injection */}
      <style jsx global>{`
        @media print {
          aside, header, button, nav, .no-print, .theme-toggle-btn {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-full {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
          }
          .print-card {
            border: 1px solid #ddd !important;
            background: transparent !important;
            box-shadow: none !important;
            color: black !important;
          }
          .print-card * {
            color: black !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 20px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: black !important;
            border: 1px solid #cbd5e1 !important;
          }
          td {
            border: 1px solid #e2e8f0 !important;
            color: black !important;
            padding: 8px !important;
          }
          .print-title {
            color: black !important;
            font-size: 24px !important;
            font-weight: bold !important;
            margin-bottom: 5px !important;
          }
        }
        /* Custom dropdown options override for Dark Mode browser visibility */
        select option {
          background-color: #0d131f !important;
          color: white !important;
        }
      `}</style>

      <div className="space-y-6 print-full">
        {/* Dynamic Header Block (Print Only Header Title) */}
        <div className="hidden print:block pb-4 border-b border-gray-200">
          <h1 className="print-title">Planilla de Distribución y Prorrateo de Gastos 2026</h1>
          <p className="text-xs text-gray-500">
            Cadena: <strong className="text-gray-800">{cadenaFilter}</strong> | 
            Ámbito: <strong className="text-gray-800">{ambitoFilter}</strong> | 
            Monto Prorrateado: <strong className="text-gray-800">${numMontoTotal.toLocaleString("es-AR")}</strong>
          </p>
        </div>

        {/* 1. Main configuration panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 no-print">
          {/* Main Input Card */}
          <div className="xl:col-span-1 p-5 rounded-3xl glass-card border border-white/10 flex flex-col justify-center space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Monto a Prorratear</h2>
            </div>
            
            <div>
              <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">
                Monto Total a Distribuir ($)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-400">$</span>
                <input
                  type="number"
                  step="any"
                  value={montoTotal}
                  onChange={(e) => setMontoTotal(e.target.value)}
                  placeholder="ej: 1000000"
                  className="w-full pl-8 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-xl font-bold focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                Ingresa el importe total que se subdividirá proporcionalmente entre los cines.
              </p>
            </div>
          </div>

          {/* Filters Selector Card */}
          <div className="xl:col-span-2 p-5 rounded-3xl glass-card border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filtros Activos</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cadena select */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Cadena / Cadena</span>
                <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl gap-1">
                  {(["Cinemark", "Hoyts", "Consolidados"] as const).map((cad) => (
                    <button
                      key={cad}
                      onClick={() => setCadenaFilter(cad)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        cadenaFilter === cad
                          ? "bg-emerald-500 text-white shadow"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {cad}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope select */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Alcance Geográfico</span>
                <select
                  value={ambitoFilter}
                  onChange={(e: any) => setAmbitoFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500/50 bg-[#0d131f]"
                >
                  <option value="todos" className="bg-[#0d131f] text-white">Todos los Cines (100% complejos)</option>
                  <option value="todos_oficina" className="bg-[#0d131f] text-white">Todos los Cines + Oficina Central (8.34% fijo)</option>
                  <option value="caba" className="bg-[#0d131f] text-white">Solo CABA</option>
                  <option value="gba" className="bg-[#0d131f] text-white">Solo GBA</option>
                  <option value="amba" className="bg-[#0d131f] text-white">CABA y GBA (AMBA)</option>
                  <option value="amba_oficina" className="bg-[#0d131f] text-white">CABA y GBA + Oficina Central (10.13% fijo)</option>
                  <option value="interior" className="bg-[#0d131f] text-white">Interior</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Top Summary KPI Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl glass-card border border-white/10 print-card space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Complejos Seleccionados</span>
            <div className="text-xl lg:text-2xl font-extrabold text-white flex items-baseline gap-1">
              <span>{complexesCount}</span>
              <span className="text-xs font-normal text-gray-500">cines</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-white/10 print-card space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Asignado a Complejos</span>
            <div className="text-xl lg:text-2xl font-extrabold text-emerald-400">
              ${distributedToCines.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-white/10 print-card space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Asignado a Oficina Central</span>
            <div className="text-xl lg:text-2xl font-extrabold text-purple-400">
              ${distributedToOficina.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-white/10 print-card space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Distribuido (100%)</span>
            <div className="text-xl lg:text-2xl font-extrabold text-white">
              ${sumDistributed.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* 3. Action bar for exports and lock toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 no-print border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            {isUnlocked ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                <Unlock className="w-3.5 h-3.5" />
                <span>Attendance Editable (Desbloqueado)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Attendance Protegido (Solo Lectura)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Edit / Lock control button */}
            {isUnlocked ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveAttendance}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Attendance</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 flex items-center gap-1.5 transition-colors"
                title="Pide PIN 1234 para desbloquear attendance"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Editar Attendance</span>
              </button>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopyMontos}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Montos</span>
            </button>
          </div>
        </div>

        {/* 4. Distribution table */}
        <div className="rounded-3xl glass-card border border-white/10 overflow-hidden shadow-2xl print-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Complejo de Cine</th>
                  <th className="px-4 py-3.5">Región</th>
                  <th className="px-4 py-3.5">Cadena</th>
                  <th className="px-4 py-3.5 text-right">Attendance 2026</th>
                  <th className="px-4 py-3.5 text-right">% Asignación</th>
                  <th className="px-4 py-3.5 text-right text-emerald-400 font-bold">Monto Prorrateado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {tableRows.map((row) => (
                  <tr 
                    key={row.codigo} 
                    className={`transition-colors duration-150 ${
                      row.isOficina 
                        ? "bg-purple-950/10 hover:bg-purple-950/20 font-semibold text-purple-200" 
                        : "hover:bg-white/[0.01]"
                    }`}
                  >
                    {/* Code */}
                    <td className="px-4 py-4 font-mono font-bold text-gray-400">
                      {row.codigo}
                    </td>
                    
                    {/* Name */}
                    <td className="px-4 py-4 font-semibold text-white">
                      {row.nombre}
                    </td>

                    {/* Region */}
                    <td className="px-4 py-4">
                      {row.isOficina ? "-" : row.region}
                    </td>

                    {/* Cadena */}
                    <td className="px-4 py-4">
                      {row.isOficina ? "-" : (
                        <span 
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            row.cadena === "Hoyts"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                              : "bg-teal-500/10 text-teal-300 border-teal-500/20"
                          }`}
                        >
                          {row.cadena}
                        </span>
                      )}
                    </td>

                    {/* Attendance (Lock protected input) */}
                    <td className="px-4 py-4 text-right">
                      {row.isOficina ? (
                        <span className="text-gray-500">-</span>
                      ) : isUnlocked ? (
                        <input
                          type="number"
                          value={row.attendance}
                          onChange={(e) => handleAttendanceChange(row.codigo, e.target.value)}
                          className="w-28 px-2 py-1 rounded bg-[#0d131f] border border-emerald-500/50 text-white font-mono text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      ) : (
                        <span className="font-mono text-gray-200">
                          {row.attendance.toLocaleString("es-AR")}
                        </span>
                      )}
                    </td>

                    {/* Asignación % */}
                    <td className="px-4 py-4 text-right font-mono font-semibold">
                      {row.percentage.toFixed(4)}%
                    </td>

                    {/* Calculated Amount */}
                    <td className="px-4 py-4 text-right font-mono font-bold text-emerald-300 text-sm">
                      ${row.montoProrrateado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer / Summary Row */}
              <tfoot className="bg-white/5 border-t-2 border-white/10 font-bold text-white">
                <tr>
                  <td className="px-4 py-4" colSpan={4}>
                    <span>Total General</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-2">
                      ({complexesCount} complejos {percentOficina > 0 ? "+ Oficina Central" : ""})
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-gray-200">
                    {totalAttendance.toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {sumPercentage.toFixed(2)}%
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-emerald-400 text-base">
                    ${sumDistributed.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Form information alert */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 no-print flex gap-3 text-xs text-gray-400">
          <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white block">Información de Distribución</span>
            <p>
              El sistema prorratea el monto total de forma directamente proporcional al Attendance 2026 de cada cine habilitado por el filtro geográfico y de empresa. 
              Si activas un filtro que incluye Oficina Central, se sustrae primero el porcentaje administrativo correspondiente (8,34% o 10,13%) y el resto se distribuye entre los cines.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Custom security lock PIN modal dialog */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl glass-card border border-white/10 shadow-2xl text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-white font-bold text-base">Seguridad de Datos</h3>
              <p className="text-xs text-gray-400">Ingresa el PIN de seguridad para modificar el Attendance 2026</p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-3">
              <input
                type="password"
                required
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="****"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-center text-lg focus:outline-none focus:border-emerald-500/50"
                autoFocus
              />

              {pinError && (
                <p className="text-[10px] text-red-400 font-semibold">{pinError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
                >
                  Confirmar PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput("");
                    setPinError(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
