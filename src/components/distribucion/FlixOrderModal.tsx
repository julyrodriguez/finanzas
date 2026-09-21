"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Sparkles, 
  X, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  ClipboardPaste,
  FileSpreadsheet,
  ArrowUpDown
} from "lucide-react";

interface FlixOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export interface FlixRow {
  orden: number;
  codigo: string;
  codigoCuenta: string;
  solomon: string;
  nombre: string;
  region: string;
  cadena: "Cinemark" | "Hoyts" | "Otros" | "-";
  monto: number;
  matched: boolean;
  rawMatchName?: string;
}

// Fixed order of the Distribución table (24 complexes) + Others (801)
const MASTER_FLIX_ROWS: Omit<FlixRow, "monto" | "matched" | "rawMatchName">[] = [
  { orden: 1,  codigo: "00730", codigoCuenta: "730", solomon: "730-00000000000000000", nombre: "Puerto Madero 8 ARG", region: "CABA", cadena: "Cinemark" },
  { orden: 2,  codigo: "00732", codigoCuenta: "732", solomon: "732-00000000000000000", nombre: "Mendoza 10 ARG", region: "Interior", cadena: "Cinemark" },
  { orden: 3,  codigo: "00733", codigoCuenta: "733", solomon: "733-00000000000000000", nombre: "Beruti Bulnes 10 RDLP", region: "CABA", cadena: "Cinemark" },
  { orden: 4,  codigo: "00734", codigoCuenta: "734", solomon: "734-00000000000000000", nombre: "Caballito 6 ARG", region: "CABA", cadena: "Cinemark" },
  { orden: 5,  codigo: "00739", codigoCuenta: "739", solomon: "739-00000000000000000", nombre: "Soleil 9 ARG", region: "GBA", cadena: "Cinemark" },
  { orden: 6,  codigo: "00749", codigoCuenta: "749", solomon: "749-00000000000000000", nombre: "San Miguel 10 ARG", region: "GBA", cadena: "Cinemark" },
  { orden: 7,  codigo: "00745", codigoCuenta: "745", solomon: "745-00000000000000000", nombre: "Puerto Santa Fe Mall 6 ARG", region: "Interior", cadena: "Cinemark" },
  { orden: 8,  codigo: "00748", codigoCuenta: "748", solomon: "748-00000000000000000", nombre: "San Justo 5 ARG", region: "GBA", cadena: "Cinemark" },
  { orden: 9,  codigo: "00756", codigoCuenta: "756", solomon: "756-00000000000000000", nombre: "Tortugas Open BA Mall 7 ARG", region: "GBA", cadena: "Cinemark" },
  { orden: 10, codigo: "02013", codigoCuenta: "780", solomon: "780-00000000000000000", nombre: "Hiper Libertad Salta ARG", region: "Interior", cadena: "Cinemark" },
  { orden: 11, codigo: "02014", codigoCuenta: "781", solomon: "781-00000000000000000", nombre: "Alto Comahue Neuquen ARG", region: "Interior", cadena: "Cinemark" },
  { orden: 12, codigo: "02015", codigoCuenta: "783", solomon: "783-00000000000000000", nombre: "Alto Avellaneda ARG", region: "GBA", cadena: "Cinemark" },
  { orden: 13, codigo: "02016", codigoCuenta: "784", solomon: "784-00000000000000000", nombre: "Parque Brown ARG", region: "CABA", cadena: "Cinemark" },
  { orden: 14, codigo: "02000", codigoCuenta: "702", solomon: "702-00000000000000000", nombre: "Unicenter Shopping Martinez ARG", region: "GBA", cadena: "Hoyts" },
  { orden: 15, codigo: "02001", codigoCuenta: "703", solomon: "703-00000000000000000", nombre: "Plaza Oeste Moron ARG", region: "GBA", cadena: "Hoyts" },
  { orden: 16, codigo: "02002", codigoCuenta: "701", solomon: "701-00000000000000000", nombre: "Quilmes ARG", region: "GBA", cadena: "Hoyts" },
  { orden: 17, codigo: "02003", codigoCuenta: "712", solomon: "712-00000000000000000", nombre: "Dot Mall Buenos Aires ARG", region: "CABA", cadena: "Hoyts" },
  { orden: 18, codigo: "02004", codigoCuenta: "705", solomon: "705-00000000000000000", nombre: "Abasto Shopping Buenos Aires ARG", region: "CABA", cadena: "Hoyts" },
  { orden: 19, codigo: "02005", codigoCuenta: "709", solomon: "709-00000000000000000", nombre: "Temperley ARG", region: "GBA", cadena: "Hoyts" },
  { orden: 20, codigo: "02006", codigoCuenta: "711", solomon: "711-00000000000000000", nombre: "Shopping Nine Moreno ARG", region: "GBA", cadena: "Hoyts" },
  { orden: 21, codigo: "02007", codigoCuenta: "708", solomon: "708-00000000000000000", nombre: "Nuevo Noa Shopping Salta ARG", region: "Interior", cadena: "Hoyts" },
  { orden: 22, codigo: "02008", codigoCuenta: "706", solomon: "706-00000000000000000", nombre: "Nuevo Centro Cordoba ARG", region: "Interior", cadena: "Hoyts" },
  { orden: 23, codigo: "02009", codigoCuenta: "707", solomon: "707-00000000000000000", nombre: "Patio Olmos Cordoba ARG", region: "Interior", cadena: "Hoyts" },
  { orden: 24, codigo: "02010", codigoCuenta: "714", solomon: "714-00000000000000000", nombre: "Portal Rosario Shopping ARG", region: "Interior", cadena: "Hoyts" },
  { orden: 25, codigo: "00801", codigoCuenta: "801", solomon: "801-00000000000000000", nombre: "Others", region: "-", cadena: "Otros" },
];

interface ComplexMatcher {
  id: string;
  patterns: RegExp[];
}

const COMPLEX_MATCHERS: ComplexMatcher[] = [
  { id: "730", patterns: [/madero/i] },
  { id: "732", patterns: [/mendoza/i, /\bmza\b/i, /palmares/i] },
  { id: "733", patterns: [/beruti/i, /bulnes/i, /\bpalermo\b/i] },
  { id: "734", patterns: [/caballito/i] },
  { id: "739", patterns: [/soleil/i] },
  { id: "749", patterns: [/san miguel/i, /\bmiguel\b/i] },
  { id: "745", patterns: [/santa fe/i, /sta fe/i, /pto santa fe/i] },
  { id: "748", patterns: [/san justo/i, /\bjusto\b/i] },
  { id: "756", patterns: [/tortuga/i, /\btom\b/i, /tortuguitas/i] },
  { id: "780", patterns: [/libertad/i, /salta libertad/i, /cinemark salta/i, /salta cinemark/i, /salta.*hiper/i] },
  { id: "781", patterns: [/comahue/i, /neuquen/i, /neuqu[eé]n/i, /\bnqn\b/i] },
  { id: "783", patterns: [/avellaneda/i] },
  { id: "784", patterns: [/brown/i] },
  { id: "702", patterns: [/unicenter/i, /martinez/i, /mart[ií]nez/i] },
  { id: "703", patterns: [/moron/i, /mor[oó]n/i, /plaza oeste/i, /\boeste\b/i] },
  { id: "701", patterns: [/quilmes/i] },
  { id: "712", patterns: [/\bdot\b/i] },
  { id: "705", patterns: [/abasto/i] },
  { id: "709", patterns: [/temperley/i] },
  { id: "711", patterns: [/moreno/i, /\bnine\b/i] },
  { id: "708", patterns: [/\bnoa\b/i, /salta noa/i, /hoyts salta/i, /salta hoyts/i] },
  { id: "706", patterns: [/nuevo centro/i, /nuevocentro/i, /c[oó]rdoba centro/i, /cordoba centro/i] },
  { id: "707", patterns: [/olmos/i, /patio olmos/i, /c[oó]rdoba olmos/i, /cordoba olmos/i] },
  { id: "714", patterns: [/rosario/i] },
  { id: "801", patterns: [/other/i, /otro/i] },
  { id: "643", patterns: [/oficina/i, /central/i, /administra/i] },
];

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Parses amounts smartly.
 * Prioritizes thousands with comma and decimal with period: e.g. 1,234.56
 * But also handles Argentine/European formats: 1.234,56, plain numbers, currency signs, etc.
 */
export function parseSmartAmount(str: string): number | null {
  if (!str) return null;
  let cleaned = str.trim().replace(/[$£€\s]/g, "");

  const isNegativeParen = /^\((.*)\)$/.test(cleaned);
  if (isNegativeParen) {
    cleaned = "-" + cleaned.replace(/^\(|\)$/g, "");
  }
  cleaned = cleaned.replace(/[^\d.,+-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "+") return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastDot > lastComma) {
      // 1,234,567.89 -> Comma is thousands, dot is decimal (Flix format)
      cleaned = cleaned.replace(/,/g, "");
    } else {
      // 1.234.567,89 -> Dot is thousands, comma is decimal
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length > 2) {
      cleaned = cleaned.replace(/,/g, "");
    } else if (parts.length === 2) {
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, "");
      } else {
        cleaned = cleaned.replace(",", ".");
      }
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseLine(line: string): { rawName: string; amount: number; rawAmount: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Check tab separation first (e.g. from Excel/table)
  if (trimmed.includes("\t")) {
    const parts = trimmed.split("\t").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const amountStr = parts[parts.length - 1];
      const nameStr = parts.slice(0, -1).join(" ");
      const amount = parseSmartAmount(amountStr);
      if (amount !== null) {
        return { rawName: nameStr, amount, rawAmount: amountStr };
      }
    }
  }

  // 2. Regex: Complejo name followed by whitespace and amount at end
  const match = trimmed.match(/^(.*?)[ \t]+([$€£]?\s*[-+]?\(?[\d.,]+(?:\s*(?:ARS|USD))?\)?)\s*$/i);
  if (match) {
    const nameStr = match[1].trim();
    const amountStr = match[2].trim();
    const amount = parseSmartAmount(amountStr);
    if (amount !== null) {
      return { rawName: nameStr, amount, rawAmount: amountStr };
    }
  }

  return null;
}

function matchComplexId(nameStr: string): string | null {
  const norm = normalizeText(nameStr);

  // Exact account code or complex code matching
  for (const m of COMPLEX_MATCHERS) {
    if (norm === m.id || norm === "00" + m.id || norm === "0" + m.id) {
      return m.id;
    }
  }

  // Regex aliases
  for (const m of COMPLEX_MATCHERS) {
    for (const pat of m.patterns) {
      if (pat.test(norm)) {
        return m.id;
      }
    }
  }
  return null;
}

const SAMPLE_TEXT = `Puerto Madero 105,180.50
Mendoza 174,010.20
Beruti 271,540.80
Caballito 131,290.00
Soleil 131,180.00
San Miguel 297,290.10
Santa Fe 163,220.00
San Justo 230,660.00
Tortugas 235,130.00
Salta Libertad 108,500.00
Alto Comahue 150,250.00
Alto Avellaneda 259,102.40
Parque Brown 67,660.00
Unicenter 521,040.12
Plaza Oeste 269,900.00
Quilmes 248,100.00
Dot 282,192.83
Abasto 457,820.10
Temperley 224,550.00
Shopping Nine 170,230.00
Nuevo Noa 193,780.00
Nuevo Centro 160,830.00
Patio Olmos 142,120.00
Rosario 83,320.00
Others 50,000.00`;

export function FlixOrderModal({ isOpen, onClose, showToast }: FlixOrderModalProps) {
  const [inputText, setInputText] = useState<string>("");
  const [useCommaDecimal, setUseCommaDecimal] = useState<boolean>(true);
  const [copyOnlyMatched, setCopyOnlyMatched] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Process text and generate rows
  const { rows, unparsedLines, matchedCount, totalMonto } = useMemo(() => {
    const lines = inputText.split("\n").map(l => l.trim()).filter(Boolean);
    const matchedMap = new Map<string, { amount: number; rawName: string }>();
    const unparsed: string[] = [];

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) {
        unparsed.push(line);
        continue;
      }
      const complexId = matchComplexId(parsed.rawName);
      if (complexId) {
        // If multiple matches for the same complex (e.g. repeated rows), sum them
        const existing = matchedMap.get(complexId);
        if (existing) {
          matchedMap.set(complexId, {
            amount: existing.amount + parsed.amount,
            rawName: `${existing.rawName}, ${parsed.rawName}`,
          });
        } else {
          matchedMap.set(complexId, {
            amount: parsed.amount,
            rawName: parsed.rawName,
          });
        }
      } else {
        unparsed.push(line);
      }
    }

    const calculatedRows: FlixRow[] = MASTER_FLIX_ROWS.map(master => {
      const match = matchedMap.get(master.codigoCuenta);
      return {
        ...master,
        monto: match ? match.amount : 0,
        matched: !!match,
        rawMatchName: match?.rawName,
      };
    });

    const total = calculatedRows.reduce((sum, r) => sum + r.monto, 0);
    const count = calculatedRows.filter(r => r.matched).length;

    return {
      rows: calculatedRows,
      unparsedLines: unparsed,
      matchedCount: count,
      totalMonto: total,
    };
  }, [inputText]);

  const activeRowsToExport = useMemo(() => {
    if (copyOnlyMatched) {
      return rows.filter(r => r.matched);
    }
    return rows;
  }, [rows, copyOnlyMatched]);

  const formatAmount = (val: number): string => {
    const fixed = val.toFixed(2);
    return useCommaDecimal ? fixed.replace(".", ",") : fixed;
  };

  const handleCopyMontos = () => {
    if (activeRowsToExport.length === 0) {
      showToast("⚠️ No hay filas para copiar");
      return;
    }
    const text = activeRowsToExport.map(r => formatAmount(r.monto)).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedType("montos");
    showToast(`📋 ${activeRowsToExport.length} Montos copiados al portapapeles`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopySolomon = () => {
    if (activeRowsToExport.length === 0) {
      showToast("⚠️ No hay filas para copiar");
      return;
    }
    const text = activeRowsToExport.map(r => r.solomon).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedType("solomon");
    showToast(`📋 ${activeRowsToExport.length} Cuentas Solomon copiadas al portapapeles`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyBoth = () => {
    if (activeRowsToExport.length === 0) {
      showToast("⚠️ No hay filas para copiar");
      return;
    }
    const text = activeRowsToExport
      .map(r => `${r.solomon}\t${formatAmount(r.monto)}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopiedType("both");
    showToast(`📋 ${activeRowsToExport.length} Cuentas y Montos copiados para Excel`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        showToast("📥 Texto pegado desde el portapapeles");
      }
    } catch {
      showToast("⚠️ No se pudo leer el portapapeles directamente. Pégalo con Ctrl+V.");
    }
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_TEXT);
    showToast("✨ Ejemplo de Flix cargado");
  };

  const handleClear = () => {
    setInputText("");
    showToast("🗑️ Texto limpiado");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl glass-card border border-white/15 shadow-2xl bg-[#0b0f19] text-white overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 border border-purple-500/40 text-purple-300">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Ordenar Flix
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Formato Distribución &amp; Solomon
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Reordena montos de Flix según la secuencia oficial de distribución (incluye cuenta 801 para Others).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Input Textarea & Controls */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Pegar listado de Flix</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 hover:text-white border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                    title="Pegar texto del portapapeles"
                  >
                    <ClipboardPaste className="w-3 h-3 text-indigo-400" />
                    <span>Pegar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 text-[11px] font-semibold text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-all cursor-pointer"
                    title="Cargar un ejemplo con los 25 ítems"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-300" />
                    <span>Ejemplo</span>
                  </button>
                  {inputText && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-[11px] font-semibold text-red-400 border border-red-500/20 flex items-center gap-1 transition-all cursor-pointer"
                      title="Limpiar texto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={13}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Pega el texto aquí con formato:\nComplejo Monto\n\nEjemplo:\nAbasto 457,820.10\nDot 282,192.83\nAlto Avellaneda 259,102.40\nOthers 50,000.00`}
                  className="w-full p-3.5 rounded-2xl bg-[#080c16] border border-slate-700/80 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner resize-y leading-relaxed"
                />
              </div>

              {/* Parsing Guide Note */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Parser inteligente</span>
                </div>
                <p>
                  Reconoce miles con coma (<code className="text-emerald-300 font-mono">1,234.56</code>), puntos o tabulaciones.
                  Cualquier fila con <strong className="text-white">&quot;Others&quot;</strong> se vincula a la cuenta Solomon <strong className="text-emerald-300 font-mono">801-00000000000000000</strong>.
                </p>
              </div>

              {/* Unparsed lines alert if any */}
              {unparsedLines.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>{unparsedLines.length} línea(s) no reconocidas:</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[10px] text-amber-200/80 bg-black/30 p-2 rounded-lg">
                    {unparsedLines.map((line, idx) => (
                      <div key={idx} className="truncate">⚠️ {line}</div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-300/70">
                    Asegúrate de que cada renglón tenga el nombre del complejo y el monto al final.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Ordered Table & Quick Export Buttons */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Summary KPIs & Copy Toolbar */}
              <div className="p-4 rounded-2xl bg-[#0e1322] border border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Flix</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        ${totalMonto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-8 w-[1px] bg-white/10" />
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Complejos</span>
                      <span className="text-base font-bold text-white flex items-center gap-1">
                        <span>{matchedCount} / 25</span>
                        {matchedCount === 25 && (
                          <Check className="w-4 h-4 text-emerald-400" />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Format toggles */}
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useCommaDecimal}
                        onChange={(e) => setUseCommaDecimal(e.target.checked)}
                        className="rounded border-slate-700 bg-[#080c16] text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[11px]">Decimal con coma (Excel AR)</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={copyOnlyMatched}
                        onChange={(e) => setCopyOnlyMatched(e.target.checked)}
                        className="rounded border-slate-700 bg-[#080c16] text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[11px]">Solo detectados ({matchedCount})</span>
                    </label>
                  </div>
                </div>

                {/* Main Copy Action Buttons */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopyMontos}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    title="Copia solo los montos ordenados exactamente según la tabla de distribución"
                  >
                    {copiedType === "montos" ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>Copiar Montos</span>
                  </button>

                  <button
                    onClick={handleCopySolomon}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                    title="Copia las cuentas Solomon ordenadas (formato con 17 ceros, incluyendo 801 para Others)"
                  >
                    {copiedType === "solomon" ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>Copiar Cuentas Solomon</span>
                  </button>

                  <button
                    onClick={handleCopyBoth}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Copia Cuentas Solomon y Montos separados por tabulación (para pegar directo en Excel)"
                  >
                    {copiedType === "both" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span>Copiar Cuenta y Monto</span>
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#080c16] shadow-xl">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-slate-400 uppercase font-bold sticky top-0 backdrop-blur-md z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10">#</th>
                        <th className="px-3 py-2.5">Cuenta Solomon</th>
                        <th className="px-3 py-2.5">Complejo</th>
                        <th className="px-3 py-2.5 text-right">Monto Flix</th>
                        <th className="px-3 py-2.5 text-center w-20">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {rows.map((row) => (
                        <tr 
                          key={row.codigoCuenta}
                          className={`transition-colors duration-100 ${
                            row.matched
                              ? row.codigoCuenta === "801"
                                ? "bg-purple-950/20 hover:bg-purple-950/30"
                                : "hover:bg-white/[0.02]"
                              : "opacity-40 hover:opacity-75"
                          }`}
                        >
                          <td className="px-3 py-2 text-center text-slate-500 font-sans text-[11px]">
                            {row.orden}
                          </td>
                          <td className="px-3 py-2 text-indigo-300 font-semibold">
                            {row.solomon}
                          </td>
                          <td className="px-3 py-2 font-sans font-medium text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span>{row.nombre}</span>
                              {row.codigoCuenta === "801" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  801
                                </span>
                              )}
                            </div>
                            {row.rawMatchName && (
                              <span className="text-[10px] text-slate-500 block truncate">
                                Matcheó: &quot;{row.rawMatchName}&quot;
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-sm">
                            {row.matched ? (
                              <span className="text-emerald-400">
                                ${row.monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-600">$0,00</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-sans">
                            {row.matched ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                <Check className="w-3 h-3" />
                                <span>OK</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] text-slate-500 bg-white/5 border border-white/5">
                                <span>$0</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 flex items-center justify-between bg-white/[0.02] text-xs">
          <span className="text-slate-500">
            Total {rows.length} cuentas Solomon disponibles • Orden idéntico a la tabla de distribución
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
