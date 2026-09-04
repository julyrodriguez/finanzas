"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  ArrowRightLeft,
  History,
  Sparkles,
  Equal,
  Delete
} from "lucide-react";

interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: string;
  date: string;
}

export default function CalculadoraPage() {
  // Calculator Display State
  const [display, setDisplay] = useState<string>("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<"+" | "-" | "*" | "/" | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState<boolean>(false);
  const [expression, setExpression] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // History State
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);

  // Dolar State
  const [dolarVenta, setDolarVenta] = useState<number>(1530);
  const [dolarCompra, setDolarCompra] = useState<number>(1480);
  const [dolarHora, setDolarHora] = useState<string>("");
  const [dolarFecha, setDolarFecha] = useState<string>("");
  const [loadingDolar, setLoadingDolar] = useState<boolean>(true);
  const [dolarType, setDolarType] = useState<"venta" | "compra" | "custom">("venta");
  const [customDolar, setCustomDolar] = useState<string>("1530");

  // Quick Converter State
  const [convertUsd, setConvertUsd] = useState<string>("100");
  const [convertArs, setConvertArs] = useState<string>("153000");

  const activeRate = dolarType === "venta" 
    ? dolarVenta 
    : dolarType === "compra" 
      ? dolarCompra 
      : (parseFloat(customDolar) || dolarVenta);

  // Fetch Dólar BNA
  const fetchDolar = async () => {
    setLoadingDolar(true);
    try {
      let res = await fetch("https://apivacas.jariel.com.ar/api/bna/dolar", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        res = await fetch("https://apivacas.jariel.com.ar/bna/dolar");
      }
      if (res.ok) {
        const json = await res.json();
        if (json?.venta) {
          setDolarVenta(json.venta);
          setDolarCompra(json.compra || 1480);
          setDolarHora(json.horaActualizacion || json.horaActualizacionBNA || "");
          setDolarFecha(json.fecha || "");
          if (dolarType === "venta") {
            setConvertArs((100 * json.venta).toString());
          }
        }
      }
    } catch (err) {
      console.error("Error fetching dólar:", err);
    } finally {
      setLoadingDolar(false);
    }
  };

  useEffect(() => {
    fetchDolar();
    // Load history from localStorage
    try {
      const saved = localStorage.getItem("finanzas_calc_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveHistory = (newHistory: CalculationHistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("finanzas_calc_history", JSON.stringify(newHistory.slice(0, 50)));
    } catch {
      // ignore
    }
  };

  const addHistoryItem = (expr: string, res: string) => {
    const item: CalculationHistoryItem = {
      id: Date.now().toString(),
      expression: expr,
      result: res,
      date: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    saveHistory([item, ...history.slice(0, 49)]);
  };

  // Helper to format float cleanly
  const cleanNumber = (num: number): string => {
    if (isNaN(num) || !isFinite(num)) return "Error";
    const rounded = Math.round(num * 1000000) / 1000000;
    return rounded.toString();
  };

  // Calculator Actions
  const handleDigit = (digit: string) => {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      if (display === "0" && digit !== ".") {
        setDisplay(digit);
      } else if (digit === "." && display.includes(".")) {
        return;
      } else {
        setDisplay(display + digit);
      }
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    setExpression("");
  };

  const handleBackspace = () => {
    if (waitingForNewValue) return;
    if (display.length <= 1 || display === "Error") {
      setDisplay("0");
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleToggleSign = () => {
    if (display === "0" || display === "Error") return;
    if (display.startsWith("-")) {
      setDisplay(display.slice(1));
    } else {
      setDisplay("-" + display);
    }
  };

  const handlePercent = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const res = val / 100;
    const resStr = cleanNumber(res);
    setDisplay(resStr);
    addHistoryItem(`${val}%`, resStr);
  };

  const executeOperation = (prev: number, current: number, op: "+" | "-" | "*" | "/"): number => {
    switch (op) {
      case "+": return prev + current;
      case "-": return prev - current;
      case "*": return prev * current;
      case "/": return current !== 0 ? prev / current : NaN;
      default: return current;
    }
  };

  const handleOperator = (op: "+" | "-" | "*" | "/") => {
    const currentValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(currentValue);
      setOperation(op);
      setExpression(`${cleanNumber(currentValue)} ${op === "*" ? "×" : op === "/" ? "÷" : op}`);
      setWaitingForNewValue(true);
    } else if (operation) {
      if (waitingForNewValue) {
        setOperation(op);
        setExpression(`${cleanNumber(previousValue)} ${op === "*" ? "×" : op === "/" ? "÷" : op}`);
      } else {
        const result = executeOperation(previousValue, currentValue, operation);
        const resultStr = cleanNumber(result);
        setDisplay(resultStr);
        setPreviousValue(result);
        setOperation(op);
        setExpression(`${resultStr} ${op === "*" ? "×" : op === "/" ? "÷" : op}`);
        setWaitingForNewValue(true);
      }
    }
  };

  const handleEquals = () => {
    if (previousValue === null || operation === null) return;
    const currentValue = parseFloat(display);
    const result = executeOperation(previousValue, currentValue, operation);
    const resultStr = cleanNumber(result);
    const opSymbol = operation === "*" ? "×" : operation === "/" ? "÷" : operation;
    const fullExpr = `${cleanNumber(previousValue)} ${opSymbol} ${cleanNumber(currentValue)} =`;

    setExpression(fullExpr);
    setDisplay(resultStr);
    addHistoryItem(fullExpr, resultStr);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  // MULTIPLICAR POR DÓLAR
  const handleMultiplyByDolar = () => {
    const currentVal = parseFloat(display);
    if (isNaN(currentVal)) return;

    const rate = activeRate;
    const result = currentVal * rate;
    const resultStr = cleanNumber(result);
    const fullExpr = `${cleanNumber(currentVal)} × USD (${rate.toLocaleString("es-AR")}) =`;

    setExpression(fullExpr);
    setDisplay(resultStr);
    addHistoryItem(fullExpr, resultStr);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  // DIVIDIR POR DÓLAR (Obtener valor en USD)
  const handleDivideByDolar = () => {
    const currentVal = parseFloat(display);
    if (isNaN(currentVal) || currentVal === 0) return;

    const rate = activeRate;
    const result = currentVal / rate;
    const resultStr = cleanNumber(result);
    const fullExpr = `${cleanNumber(currentVal)} ÷ USD (${rate.toLocaleString("es-AR")}) =`;

    setExpression(fullExpr);
    setDisplay(resultStr);
    addHistoryItem(fullExpr, resultStr);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  // Copy display value
  const handleCopyResult = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in custom inputs
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "." || e.key === ",") {
        e.preventDefault();
        handleDigit(".");
      } else if (e.key === "+") {
        e.preventDefault();
        handleOperator("+");
      } else if (e.key === "-") {
        e.preventDefault();
        handleOperator("-");
      } else if (e.key === "*") {
        e.preventDefault();
        handleOperator("*");
      } else if (e.key === "/") {
        e.preventDefault();
        handleOperator("/");
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEquals();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "%") {
        e.preventDefault();
        handlePercent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [display, previousValue, operation, waitingForNewValue]);

  // Conversor Handlers
  const handleUsdChange = (val: string) => {
    setConvertUsd(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setConvertArs(cleanNumber(num * activeRate));
    } else {
      setConvertArs("");
    }
  };

  const handleArsChange = (val: string) => {
    setConvertArs(val);
    const num = parseFloat(val);
    if (!isNaN(num) && activeRate > 0) {
      setConvertUsd(cleanNumber(num / activeRate));
    } else {
      setConvertUsd("");
    }
  };

  const sendToCalculator = (val: string) => {
    setDisplay(val);
    setWaitingForNewValue(true);
  };

  // Formatted display helper
  const formattedDisplay = () => {
    if (display === "Error") return "Error";
    if (display.includes(".")) {
      const [intPart, decPart] = display.split(".");
      const formattedInt = Number(intPart).toLocaleString("es-AR");
      return `${formattedInt},${decPart}`;
    }
    const num = Number(display);
    return isNaN(num) ? display : num.toLocaleString("es-AR");
  };

  return (
    <AppLayout
      title="Calculadora"
      subtitle="Calculadora comercial rápida y conversor integrado con el tipo de cambio oficial BNA"
    >
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* Top Currency Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Cotización Dólar Banco Nación</h3>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {dolarHora ? `Actualizado BNA: ${dolarHora}hs (${dolarFecha})` : "Obtenido desde apivacas.jariel.com.ar"}
              </p>
            </div>
          </div>

          {/* Dolar Rate Selector & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDolarType("venta")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                dolarType === "venta"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                  : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              Venta: ${dolarVenta.toLocaleString("es-AR")}
            </button>

            <button
              onClick={() => setDolarType("compra")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                dolarType === "compra"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                  : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              Compra: ${dolarCompra.toLocaleString("es-AR")}
            </button>

            <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700 rounded-xl px-2 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Manual:</span>
              <input
                type="number"
                value={customDolar}
                onChange={(e) => {
                  setCustomDolar(e.target.value);
                  setDolarType("custom");
                }}
                onFocus={() => setDolarType("custom")}
                placeholder="Valor..."
                className="w-20 bg-transparent text-xs font-mono font-bold text-white focus:outline-none text-right"
              />
            </div>

            <button
              onClick={fetchDolar}
              disabled={loadingDolar}
              title="Refrescar cotización del dólar"
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDolar ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Main Grid: Calculator & Secondary Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: Standard Calculator (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
              
              {/* Header inside Calculator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Calculator className="w-4 h-4 text-indigo-400" />
                  <span>Calculadora Comercial</span>
                </div>
                <button
                  onClick={handleCopyResult}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  title="Copiar número actual en pantalla"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Calculator Screen / Display */}
              <div className="p-4 sm:p-5 rounded-2xl bg-black/60 border border-white/5 shadow-inner flex flex-col justify-end items-end min-h-[105px] overflow-hidden">
                <div className="text-xs sm:text-sm font-mono text-slate-400 font-medium tracking-wide truncate max-w-full h-5">
                  {expression || "\u00A0"}
                </div>
                <div 
                  className={`font-mono font-black text-white tracking-tight break-all select-all transition-all ${
                    display.length > 12 ? "text-2xl sm:text-3xl" : display.length > 8 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
                  }`}
                >
                  {formattedDisplay()}
                </div>
              </div>

              {/* Special Dólar Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleMultiplyByDolar}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600/25 to-teal-600/25 hover:from-emerald-600/35 hover:to-teal-600/35 border border-emerald-500/40 text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer group"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>× USD (${activeRate.toLocaleString("es-AR")})</span>
                </button>

                <button
                  onClick={handleDivideByDolar}
                  className="px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  title="Dividir entre el dólar para obtener el monto en USD"
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>÷ USD (Monto en USD)</span>
                </button>
              </div>

              {/* Standard Keypad Grid */}
              <div className="grid grid-cols-4 gap-2.5 select-none">
                {/* Row 1 */}
                <button
                  onClick={handleClear}
                  className="py-3.5 sm:py-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-black text-sm transition-all cursor-pointer active:scale-95"
                >
                  AC
                </button>
                <button
                  onClick={handleBackspace}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 font-bold text-sm flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Borrar último dígito"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePercent}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 font-bold text-sm transition-all cursor-pointer active:scale-95"
                >
                  %
                </button>
                <button
                  onClick={() => handleOperator("/")}
                  className={`py-3.5 sm:py-4 rounded-2xl font-bold text-base transition-all cursor-pointer active:scale-95 border ${
                    operation === "/"
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                      : "bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button
                  onClick={() => handleDigit("7")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  7
                </button>
                <button
                  onClick={() => handleDigit("8")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  8
                </button>
                <button
                  onClick={() => handleDigit("9")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  9
                </button>
                <button
                  onClick={() => handleOperator("*")}
                  className={`py-3.5 sm:py-4 rounded-2xl font-bold text-base transition-all cursor-pointer active:scale-95 border ${
                    operation === "*"
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                      : "bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  ×
                </button>

                {/* Row 3 */}
                <button
                  onClick={() => handleDigit("4")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  4
                </button>
                <button
                  onClick={() => handleDigit("5")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  5
                </button>
                <button
                  onClick={() => handleDigit("6")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  6
                </button>
                <button
                  onClick={() => handleOperator("-")}
                  className={`py-3.5 sm:py-4 rounded-2xl font-bold text-base transition-all cursor-pointer active:scale-95 border ${
                    operation === "-"
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                      : "bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  −
                </button>

                {/* Row 4 */}
                <button
                  onClick={() => handleDigit("1")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  1
                </button>
                <button
                  onClick={() => handleDigit("2")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  2
                </button>
                <button
                  onClick={() => handleDigit("3")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  3
                </button>
                <button
                  onClick={() => handleOperator("+")}
                  className={`py-3.5 sm:py-4 rounded-2xl font-bold text-base transition-all cursor-pointer active:scale-95 border ${
                    operation === "+"
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                      : "bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  onClick={handleToggleSign}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 font-bold text-sm transition-all cursor-pointer active:scale-95"
                >
                  ±
                </button>
                <button
                  onClick={() => handleDigit("0")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  0
                </button>
                <button
                  onClick={() => handleDigit(".")}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/50 hover:bg-slate-700/70 text-white font-bold text-lg border border-slate-700/50 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  ,
                </button>
                <button
                  onClick={handleEquals}
                  className="py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
                >
                  =
                </button>
              </div>

              {/* Keyboard Shortcut Help */}
              <div className="pt-2 text-center">
                <span className="text-[11px] text-slate-400">
                  💡 Tip: Puedes usar el teclado físico numérico, <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Enter</kbd> para calcular y <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Esc</kbd> para limpiar.
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Quick Dolar Converter & Tape History (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">

            {/* Quick Converter Box */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                  <span>Conversor Rápido USD ↔ ARS</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  1 USD = ${activeRate.toLocaleString("es-AR")}
                </span>
              </div>

              <div className="space-y-3">
                {/* Input USD */}
                <div className="p-3 rounded-2xl bg-black/40 border border-slate-800 focus-within:border-emerald-500/50 transition-colors">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                    <span>Monto en Dólares (USD)</span>
                    <button
                      onClick={() => sendToCalculator(convertUsd)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                    >
                      Cargar en calculadora →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold font-mono text-base">USD $</span>
                    <input
                      type="number"
                      value={convertUsd}
                      onChange={(e) => handleUsdChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent text-lg font-mono font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Input ARS */}
                <div className="p-3 rounded-2xl bg-black/40 border border-slate-800 focus-within:border-emerald-500/50 transition-colors">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                    <span>Equivalente en Pesos (ARS)</span>
                    <button
                      onClick={() => sendToCalculator(convertArs)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                    >
                      Cargar en calculadora →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold font-mono text-base">ARS $</span>
                    <input
                      type="number"
                      value={convertArs}
                      onChange={(e) => handleArsChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent text-lg font-mono font-bold text-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations Tape / History */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>Historial de Cálculos</span>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => saveHistory([])}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium space-y-1">
                  <Calculator className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
                  <p>Aún no hay cálculos realizados.</p>
                  <p className="text-[10px] text-slate-400">Los resultados aparecerán aquí automáticamente.</p>
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => sendToCalculator(item.result)}
                      className="p-3 rounded-2xl bg-black/30 hover:bg-slate-800/70 border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group"
                      title="Haz clic para cargar este resultado en la calculadora"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-0.5">
                        <span className="truncate">{item.expression}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{item.date}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-mono font-black text-white group-hover:text-emerald-400 transition-colors">
                          = {Number(item.result).toLocaleString("es-AR")}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-400 font-bold transition-opacity">
                          Usar →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </AppLayout>
  );
}
