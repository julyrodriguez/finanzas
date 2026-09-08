"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import * as XLSX from "xlsx";
import { 
  FileUp, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Loader2, 
  X, 
  Search, 
  Database, 
  ArrowRight, 
  Clock, 
  HelpCircle,
  Eye,
  RefreshCw,
  Coins,
  Building,
  Layers,
  Sparkles
} from "lucide-react";

interface ParsedRow {
  numOC: string;
  razonSocial: string;
  fechaStr: string;
  fechaOC: Date | null;
  anio: number | null;
  mes: number | null;
  empresa: string;
  monto: number;
  motivo: string;
  creadoPor: string;
  isDuplicateInDb: boolean;
  isDuplicateInFile: boolean;
  isValid: boolean;
  errorReason?: string;
}

interface MongoOrder {
  _id: string;
  firebaseId: string;
  numOC: string;
  razonSocial: string;
  monto: number;
  empresa: string;
  motivo: string;
  creadoPor: string;
  fechaOC?: string;
  anio?: number;
  entregada: boolean;
  liberada: boolean;
  mandada: boolean;
}

const API_BASE_URL = "https://apivacas.jariel.com.ar/api/ordenes";

function parseExcelDate(val: unknown): { date: Date | null; str: string; anio: number | null; mes: number | null } {
  if (!val) return { date: null, str: "-", anio: null, mes: null };

  // 1. If it's already a JS Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    return {
      date: val,
      str: val.toLocaleDateString("es-AR"),
      anio: val.getFullYear(),
      mes: val.getMonth(),
    };
  }

  // 2. If it's a number (Excel serial date, e.g. 45396)
  if (typeof val === "number" && val > 20000 && val < 60000) {
    const utcDays = val - 25569;
    const utcValue = utcDays * 86400 * 1000;
    const dateInfo = new Date(utcValue);
    const offset = dateInfo.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(dateInfo.getTime() + offset);
    return {
      date: localDate,
      str: localDate.toLocaleDateString("es-AR"),
      anio: localDate.getFullYear(),
      mes: localDate.getMonth(),
    };
  }

  // 3. If it's a string
  const strVal = String(val).trim();
  if (!strVal) return { date: null, str: "-", anio: null, mes: null };

  // Format DD/MM/YYYY or DD-MM-YYYY
  const parts = strVal.split(/[/-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    // If year is 2 digits e.g. 24 -> 2024
    if (year < 100) year += 2000;

    // Handle YYYY/MM/DD case
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }

    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return {
        date: d,
        str: d.toLocaleDateString("es-AR"),
        anio: d.getFullYear(),
        mes: d.getMonth(),
      };
    }
  }

  // Fallback to Date.parse
  const fallback = new Date(strVal);
  if (!isNaN(fallback.getTime())) {
    return {
      date: fallback,
      str: fallback.toLocaleDateString("es-AR"),
      anio: fallback.getFullYear(),
      mes: fallback.getMonth(),
    };
  }

  return { date: null, str: strVal, anio: null, mes: null };
}

function parseMontoNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    // Format e.g. "$ 1.250.000,50" -> "1250000.50"
    let clean = val.replace(/\$/g, "").replace(/\s+/g, "").trim();
    if (clean.includes(",") && clean.includes(".")) {
      clean = clean.replace(/\./g, "").replace(/,/g, ".");
    } else if (clean.includes(",")) {
      clean = clean.replace(/,/g, ".");
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TemporalPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [existingOCs, setExistingOCs] = useState<Set<string>>(new Set());
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    totalFile: number;
    skippedExisting: number;
    insertedCount: number;
  } | null>(null);

  // Table of existing orders without company in MongoDB
  const [pendingCompanyOrders, setPendingCompanyOrders] = useState<MongoOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [searchPending, setSearchPending] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // 1. Load existing OCs list from MongoDB to detect duplicates
  const loadExistingOCs = async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch(`${API_BASE_URL}?limit=0`, { cache: "no-store" });
      if (!res.ok) throw new Error("Error consultando MongoDB");
      const data = await res.json();
      if (data.success && Array.isArray(data.ordenes)) {
        const ocsSet = new Set<string>();
        const pendingList: MongoOrder[] = [];

        data.ordenes.forEach((o: any) => {
          if (o.numOC) {
            ocsSet.add(String(o.numOC).trim().toLowerCase());
          }
          // Check if it has no company assigned
          if (!o.empresa || o.empresa.trim() === "") {
            pendingList.push(o);
          }
        });

        setExistingOCs(ocsSet);
        setPendingCompanyOrders(pendingList);
      }
    } catch (err) {
      console.warn("No se pudieron precargar las OCs existentes de MongoDB:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadExistingOCs();
  }, []);

  // 2. Handle Excel File Selection & Parse
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + " KB");
    setIsParsing(true);
    setImportResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      // Convert sheet to array of rows (header: 1 gives raw 2D array)
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

      if (rawRows.length === 0) {
        showToast("⚠️ El archivo Excel está vacío.");
        setIsParsing(false);
        return;
      }

      const fileOCsSet = new Set<string>();
      const processed: ParsedRow[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i] || [];

        // Check if row has any content
        if (row.length === 0 || row.every((c) => c === "" || c == null)) {
          continue;
        }

        // Col 0: numero de oc
        const rawOC = String(row[0] || "").trim();

        // Skip header row if it contains non-numeric text like "OC", "N°", "Numero", etc.
        const isHeader = i === 0 && (
          rawOC.toLowerCase().includes("oc") || 
          rawOC.toLowerCase().includes("num") || 
          rawOC.toLowerCase().includes("orden") ||
          isNaN(Number(rawOC))
        );
        if (isHeader) continue;

        if (!rawOC) {
          continue;
        }

        // Col 1: proveedor
        const razonSocial = String(row[1] || "").trim();

        // Col 2: fecha
        const dateParsed = parseExcelDate(row[2]);

        // Col 3: celda vacía (donde luego se colocará la compañía: Hoyts o CMK)
        let empresaCol = String(row[3] || "").trim();
        let empresaVal = "";
        if (empresaCol.toLowerCase() === "hoyts") empresaVal = "Hoyts";
        else if (empresaCol.toLowerCase() === "cmk" || empresaCol.toLowerCase() === "cinemark") empresaVal = "CMK";

        // Col 5: monto
        const montoVal = parseMontoNumber(row[5]);

        // Col 7: descripcion / motivo
        const motivoVal = String(row[7] || "").trim();

        // Col 8: usuario que la genero
        const usuarioVal = String(row[8] || "").trim() || "julian";

        // Duplicate checks
        const ocKey = rawOC.toLowerCase();
        const isDuplicateInDb = existingOCs.has(ocKey);
        const isDuplicateInFile = fileOCsSet.has(ocKey);
        fileOCsSet.add(ocKey);

        const isValid = !isDuplicateInDb && !isDuplicateInFile && rawOC.length > 0;

        let errorReason = "";
        if (isDuplicateInDb) errorReason = "Ya existe en la base de datos";
        else if (isDuplicateInFile) errorReason = "Duplicada dentro del mismo Excel";

        processed.push({
          numOC: rawOC,
          razonSocial: razonSocial || "Sin Proveedor",
          fechaStr: dateParsed.str,
          fechaOC: dateParsed.date,
          anio: dateParsed.anio,
          mes: dateParsed.mes,
          empresa: empresaVal,
          monto: montoVal,
          motivo: motivoVal,
          creadoPor: usuarioVal,
          isDuplicateInDb,
          isDuplicateInFile,
          isValid,
          errorReason,
        });
      }

      setParsedRows(processed);
      showToast(`📄 Excel procesado: ${processed.length} filas analizadas.`);
    } catch (err) {
      console.error("Error al leer el archivo Excel:", err);
      showToast("❌ Error al procesar el archivo Excel. Verifica el formato.");
    } finally {
      setIsParsing(false);
    }
  };

  // 3. Computed stats of the parsed Excel
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const existingCount = parsedRows.filter((r) => r.isDuplicateInDb).length;
    const duplicateInFileCount = parsedRows.filter((r) => !r.isDuplicateInDb && r.isDuplicateInFile).length;
    const readyToImport = parsedRows.filter((r) => r.isValid);
    const totalMonto = readyToImport.reduce((acc, r) => acc + r.monto, 0);

    return {
      total,
      existingCount,
      duplicateInFileCount,
      readyCount: readyToImport.length,
      totalMonto,
      readyRows: readyToImport,
    };
  }, [parsedRows]);

  // 4. Send Chunks to MongoDB via POST /api/ordenes/bulk
  const handleConfirmImport = async () => {
    if (stats.readyCount === 0) {
      showToast("⚠️ No hay órdenes válidas para importar.");
      return;
    }

    if (!confirm(`¿Estás seguro de importar ${stats.readyCount} órdenes históricas a MongoDB como Entregadas/Finalizadas sin compañía?`)) {
      return;
    }

    setImporting(true);
    setProgressPercent(0);

    const readyRows = stats.readyRows;
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(readyRows.length / CHUNK_SIZE);
    let successfullyInserted = 0;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, readyRows.length);
        const chunk = readyRows.slice(start, end);

        // Prepare normalized payload for MongoDB
        const payload = chunk.map((r, chunkIdx) => ({
          firebaseId: `import_oc_${r.numOC}_${Date.now()}_${start + chunkIdx}`,
          numOC: r.numOC,
          numSolicitud: "",
          razonSocial: r.razonSocial,
          monto: r.monto,
          empresa: r.empresa, // Empty string as requested: "actualmente dejalos sin compañia"
          motivo: r.motivo,
          formaPago: "30DFF",
          // Marcadas como Entregadas / Finalizadas según indicación:
          entregada: true,
          liberada: false,
          mandada: false,
          cancelada: false,
          creadoPor: r.creadoPor,
          fechaOC: r.fechaOC ? r.fechaOC.toISOString() : null,
          anio: r.anio,
          mes: r.mes,
          notas: [],
        }));

        const res = await fetch(`${API_BASE_URL}/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordenes: payload }),
        });

        if (!res.ok) {
          throw new Error(`Error en lote ${i + 1} de ${totalChunks}: HTTP ${res.status}`);
        }

        const data = await res.json();
        successfullyInserted += (data.upsertedCount || 0) + (data.modifiedCount || 0) + (data.matchedCount || 0);

        const currentPercent = Math.round(((i + 1) / totalChunks) * 100);
        setProgressPercent(currentPercent);
      }

      setImportResult({
        totalFile: stats.total,
        skippedExisting: stats.existingCount + stats.duplicateInFileCount,
        insertedCount: successfullyInserted,
      });

      showToast(`🎉 ¡Importación completada! Se guardaron ${successfullyInserted} órdenes en MongoDB.`);
      
      // Clear file and reload pending list
      setParsedRows([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadExistingOCs();
    } catch (err) {
      console.error("Error durante la importación masiva:", err);
      showToast("❌ Hubo un fallo en la importación. Revisa la consola.");
    } finally {
      setImporting(false);
    }
  };

  // Filtered pending orders without company
  const filteredPending = useMemo(() => {
    if (!searchPending.trim()) return pendingCompanyOrders;
    const q = searchPending.toLowerCase().trim();
    return pendingCompanyOrders.filter(
      (o) =>
        o.numOC.toLowerCase().includes(q) ||
        o.razonSocial.toLowerCase().includes(q) ||
        o.motivo.toLowerCase().includes(q)
    );
  }, [pendingCompanyOrders, searchPending]);

  return (
    <AppLayout
      title="Temporal"
      subtitle="Carga masiva de órdenes históricas (Excel) sin compañía y preparación para migración"
    >
      <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-8 text-slate-200">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/95 border border-white/20 text-white shadow-2xl shadow-indigo-500/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        )}

        {/* HEADER NOTICE */}
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 backdrop-blur-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
                <FileUp className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Módulo Temporal: Carga Masiva de 6.000 OCs
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
                    Sin Compañía Asignada
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                    Estado: Entregadas / Finalizadas
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
                  Esta pestaña permite subir el archivo Excel con las órdenes históricas. Las órdenes se guardarán directamente en <strong>MongoDB en este servidor</strong> (sin tocar Firebase). Si una orden ya existe en la base, <strong>se omitirá sin modificarla</strong>. La compañía quedará vacía hasta que se asigne luego con el script correspondiente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={loadExistingOCs}
                disabled={loadingOrders}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-semibold text-white transition-all cursor-pointer"
                title="Recargar listado de órdenes en MongoDB"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin text-indigo-400" : ""}`} />
                <span>Refrescar Base</span>
              </button>
            </div>
          </div>
        </div>

        {/* SUCCESS IMPORT RESULT CARD */}
        {importResult && (
          <div className="p-6 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 backdrop-blur-md animate-in fade-in space-y-3">
            <div className="flex items-center gap-3 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-6 h-6" />
              <span>¡Importación finalizada con éxito!</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-slate-400 block mb-1">Filas procesadas en Excel</span>
                <span className="text-lg font-bold text-white font-mono">{importResult.totalFile}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-slate-400 block mb-1">Omitidas (ya existían en BD)</span>
                <span className="text-lg font-bold text-amber-400 font-mono">{importResult.skippedExisting}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-slate-400 block mb-1">Nuevas OCs insertadas en Mongo</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">+{importResult.insertedCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* DRAG & DROP / FILE SELECTOR */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white text-base">Seleccionar Archivo Excel (.xlsx / .xls)</h3>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Formato de columnas esperado: N° OC | Proveedor | Fecha | Vacio | Vacio | Monto | Ignorar | Motivo | Usuario</span>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              {isParsing ? (
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              ) : (
                <UploadCloud className="w-8 h-8 text-indigo-400" />
              )}
            </div>
            <h4 className="text-base font-semibold text-white mb-1">
              {fileName ? fileName : "Haz clic o arrastra tu archivo Excel aquí"}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {fileSize
                ? `Tamaño: ${fileSize} · Haz clic para elegir otro archivo`
                : "Soporta archivos Excel con hasta 10.000 filas (.xlsx, .xls)"}
            </p>
          </div>

          {/* PARSED FILE PREVIEW & STATS */}
          {parsedRows.length > 0 && (
            <div className="space-y-6 pt-2 animate-in fade-in">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Total Filas en Excel</span>
                  <span className="text-xl font-bold text-white font-mono">{stats.total}</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-xs text-amber-400 block mb-1">Ya existen en la BD (Omitir)</span>
                  <span className="text-xl font-bold text-amber-300 font-mono">{stats.existingCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-400 block mb-1">Nuevas OCs a Importar</span>
                  <span className="text-xl font-bold text-emerald-300 font-mono">{stats.readyCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-xs text-indigo-400 block mb-1">Monto Total a Incorporar</span>
                  <span className="text-xl font-bold text-indigo-300 font-mono truncate block">
                    {formatCurrency(stats.totalMonto)}
                  </span>
                </div>
              </div>

              {/* Progress bar during bulk upload */}
              {importing && (
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-indigo-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      Subiendo lotes a MongoDB en este servidor...
                    </span>
                    <span className="font-mono font-bold text-indigo-400">{progressPercent}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ACTION BUTTON */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/40 border border-white/10">
                <div className="text-xs text-slate-400">
                  Se importarán <strong className="text-white font-semibold">{stats.readyCount}</strong> órdenes nuevas con estado <strong className="text-emerald-400">Entregada / Finalizada</strong> y compañía pendiente.
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setParsedRows([]);
                      setFileName(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={importing}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing || stats.readyCount === 0}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xl transition-all cursor-pointer ${
                      importing || stats.readyCount === 0
                        ? "bg-indigo-600/50 text-indigo-200 cursor-not-allowed"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 active:scale-95"
                    }`}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Importando ({progressPercent}%)...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Confirmar e Importar {stats.readyCount} OCs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* TABLE PREVIEW (FIRST 20 ROWS) */}
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-3 bg-slate-800/60 border-b border-white/5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Vista previa de las primeras 20 filas analizadas</span>
                  <span className="text-slate-400 font-mono">Mostrando {Math.min(parsedRows.length, 20)} de {parsedRows.length}</span>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-white/5 uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">N° OC</th>
                        <th className="py-2.5 px-3">Proveedor</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3 text-right">Monto</th>
                        <th className="py-2.5 px-3">Motivo</th>
                        <th className="py-2.5 px-3">Usuario</th>
                        <th className="py-2.5 px-3 text-center">Acción / Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {parsedRows.slice(0, 20).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-white">{r.numOC}</td>
                          <td className="py-2 px-3 font-medium text-slate-200 truncate max-w-[200px]" title={r.razonSocial}>
                            {r.razonSocial}
                          </td>
                          <td className="py-2 px-3 text-slate-300 font-mono whitespace-nowrap">{r.fechaStr}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                            {formatCurrency(r.monto)}
                          </td>
                          <td className="py-2 px-3 text-slate-400 truncate max-w-[240px]" title={r.motivo}>
                            {r.motivo || "-"}
                          </td>
                          <td className="py-2 px-3 text-slate-300 text-[11px]">{r.creadoPor}</td>
                          <td className="py-2 px-3 text-center">
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                Lista
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30" title={r.errorReason}>
                                <AlertCircle className="w-3 h-3" />
                                Omitida
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
          )}
        </div>

        {/* EXISTING ORDERS WITHOUT COMPANY TABLE (IN MONGODB) */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white text-base">
                  Órdenes en MongoDB Pendientes de Asignar Compañía
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                  {pendingCompanyOrders.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Órdenes actualmente registradas en la base local que no tienen compañía (`Hoyts` o `CMK`) asignada.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por N° OC, proveedor..."
                value={searchPending}
                onChange={(e) => setSearchPending(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/50"
              />
              {searchPending && (
                <button
                  onClick={() => setSearchPending("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-white/5 uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">N° OC</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3">Motivo</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Compañía</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-400" />
                        <span>Cargando órdenes desde el servidor...</span>
                      </td>
                    </tr>
                  ) : filteredPending.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {pendingCompanyOrders.length === 0
                          ? "No hay órdenes pendientes de asignar compañía en MongoDB."
                          : "No se encontraron resultados con el filtro actual."}
                      </td>
                    </tr>
                  ) : (
                    filteredPending.slice(0, 50).map((o) => (
                      <tr key={o._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-white">{o.numOC}</td>
                        <td className="py-2 px-3 font-medium text-slate-200 truncate max-w-[200px]" title={o.razonSocial}>
                          {o.razonSocial}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                          {formatCurrency(o.monto)}
                        </td>
                        <td className="py-2 px-3 text-slate-400 truncate max-w-[240px]" title={o.motivo}>
                          {o.motivo || "-"}
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-[11px]">{o.creadoPor}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Entregada
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-white/5">
                            Sin Asignar
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredPending.length > 50 && (
              <div className="p-2.5 bg-slate-800/60 border-t border-white/5 text-center text-xs text-slate-400 font-mono">
                Mostrando 50 de {filteredPending.length} órdenes sin compañía.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
