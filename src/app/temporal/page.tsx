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
  Building2,
  Layers,
  Sparkles,
  Filter,
  Check
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

interface ParsedUpdateRow {
  numOC: string;
  colDRaw: string;
  empresa: string; // "Hoyts" | "CMK" | ""
  razonSocial: string;
  matchedInDb: boolean;
  currentEmpresaInDb: string;
  status: "will_update" | "already_same" | "not_in_db" | "invalid_company";
  statusLabel: string;
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

function normalizeOCKey(val: unknown): string {
  if (val == null) return "";
  const str = String(val).trim().toLowerCase();
  // Strip leading zeroes for flexible matching: "007532" -> "7532"
  const parsed = parseInt(str, 10);
  if (!isNaN(parsed) && String(parsed) === str.replace(/^0+/, "")) {
    return String(parsed);
  }
  return str;
}

function parseEmpresaColD(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim();
  const lower = str.toLowerCase();
  if (lower.includes("hoyt") || lower === "h") return "Hoyts";
  if (lower.includes("cmk") || lower.includes("cinemark") || lower === "c") return "CMK";
  if (lower === "hoyts") return "Hoyts";
  if (lower === "cmk") return "CMK";
  return str;
}

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

  const parts = strVal.split(/[/-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    if (year < 100) year += 2000;

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
  const [activeTab, setActiveTab] = useState<"update-company" | "import-new">("update-company");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // MongoDB state
  const [allOrders, setAllOrders] = useState<MongoOrder[]>([]);
  const [existingOCs, setExistingOCs] = useState<Set<string>>(new Set());
  const [existingOrdersMap, setExistingOrdersMap] = useState<Map<string, MongoOrder>>(new Map());
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);

  // Tab 1: Update companies state
  const [parsedUpdateRows, setParsedUpdateRows] = useState<ParsedUpdateRow[]>([]);
  const [updatingCompany, setUpdatingCompany] = useState<boolean>(false);
  const [updateProgressPercent, setUpdateProgressPercent] = useState<number>(0);
  const [updateResult, setUpdateResult] = useState<{
    totalProcessed: number;
    modifiedCount: number;
    hoytsCount: number;
    cmkCount: number;
  } | null>(null);

  // Tab 2: Bulk import state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [importResult, setImportResult] = useState<{
    totalFile: number;
    skippedExisting: number;
    insertedCount: number;
  } | null>(null);

  // Bottom table filters
  const [searchMongo, setSearchMongo] = useState<string>("");
  const [mongoCompanyFilter, setMongoCompanyFilter] = useState<"all" | "pending" | "hoyts" | "cmk">("pending");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // 1. Load existing OCs list from MongoDB
  const loadExistingOCs = async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch(`${API_BASE_URL}?limit=0`, { cache: "no-store" });
      if (!res.ok) throw new Error("Error consultando MongoDB");
      const data = await res.json();
      if (data.success && Array.isArray(data.ordenes)) {
        const ocsSet = new Set<string>();
        const ocsMap = new Map<string, MongoOrder>();

        data.ordenes.forEach((o: any) => {
          if (o.numOC) {
            const raw = String(o.numOC).trim().toLowerCase();
            const norm = normalizeOCKey(o.numOC);
            ocsSet.add(raw);
            ocsSet.add(norm);
            ocsMap.set(raw, o);
            ocsMap.set(norm, o);
          }
        });

        setAllOrders(data.ordenes);
        setExistingOCs(ocsSet);
        setExistingOrdersMap(ocsMap);
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
    setUpdateResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

      if (rawRows.length === 0) {
        showToast("⚠️ El archivo Excel está vacío.");
        setIsParsing(false);
        return;
      }

      const fileOCsSet = new Set<string>();
      const processedImport: ParsedRow[] = [];
      const processedUpdates: ParsedUpdateRow[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i] || [];

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

        if (!rawOC) continue;

        // Col 1: proveedor
        const razonSocial = String(row[1] || "").trim();

        // Col 2: fecha
        const dateParsed = parseExcelDate(row[2]);

        // Col 3: compañía en Excel (Columna D)
        const colDRaw = String(row[3] || "").trim();
        const empresaVal = parseEmpresaColD(row[3]);

        // Col 5: monto
        const montoVal = parseMontoNumber(row[5]);

        // Col 7: descripcion / motivo
        const motivoVal = String(row[7] || "").trim();

        // Col 8: usuario
        const usuarioVal = String(row[8] || "").trim() || "julian";

        // Duplicate checks
        const ocKey = rawOC.toLowerCase();
        const normKey = normalizeOCKey(rawOC);
        const isDuplicateInDb = existingOCs.has(ocKey) || existingOCs.has(normKey);
        const isDuplicateInFile = fileOCsSet.has(ocKey);
        fileOCsSet.add(ocKey);

        const isValid = !isDuplicateInDb && !isDuplicateInFile && rawOC.length > 0;

        let errorReason = "";
        if (isDuplicateInDb) errorReason = "Ya existe en la base de datos";
        else if (isDuplicateInFile) errorReason = "Duplicada dentro del mismo Excel";

        processedImport.push({
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

        // UPDATE ROWS (Columna D -> MongoDB)
        const matchedMongo = existingOrdersMap.get(ocKey) || existingOrdersMap.get(normKey);
        const matchedInDb = Boolean(matchedMongo);
        const currentEmpresaInDb = matchedMongo?.empresa?.trim() || "";

        let status: ParsedUpdateRow["status"] = "will_update";
        let statusLabel = "";

        if (!empresaVal) {
          status = "invalid_company";
          statusLabel = colDRaw ? `No reconocida ("${colDRaw}")` : "Columna D vacía";
        } else if (!matchedInDb) {
          status = "not_in_db";
          statusLabel = "No existe en MongoDB";
        } else if (currentEmpresaInDb.toLowerCase() === empresaVal.toLowerCase()) {
          status = "already_same";
          statusLabel = `Ya asignada (${currentEmpresaInDb})`;
        } else {
          status = "will_update";
          statusLabel = currentEmpresaInDb ? `Cambiar: ${currentEmpresaInDb} ➔ ${empresaVal}` : `Asignar: ${empresaVal}`;
        }

        processedUpdates.push({
          numOC: rawOC,
          colDRaw,
          empresa: empresaVal,
          razonSocial: razonSocial || matchedMongo?.razonSocial || "Sin Proveedor",
          matchedInDb,
          currentEmpresaInDb,
          status,
          statusLabel,
        });
      }

      setParsedRows(processedImport);
      setParsedUpdateRows(processedUpdates);
      showToast(`📄 Excel procesado: ${processedUpdates.length} filas analizadas.`);
    } catch (err) {
      console.error("Error al leer el archivo Excel:", err);
      showToast("❌ Error al procesar el archivo Excel. Verifica el formato.");
    } finally {
      setIsParsing(false);
    }
  };

  // 3. Computed stats for Company Updates (Tab 1)
  const updateStats = useMemo(() => {
    const total = parsedUpdateRows.length;
    const willUpdate = parsedUpdateRows.filter((r) => r.status === "will_update");
    const alreadySame = parsedUpdateRows.filter((r) => r.status === "already_same");
    const notInDb = parsedUpdateRows.filter((r) => r.status === "not_in_db");
    const invalidCompany = parsedUpdateRows.filter((r) => r.status === "invalid_company");

    const hoytsCount = willUpdate.filter((r) => r.empresa === "Hoyts").length;
    const cmkCount = willUpdate.filter((r) => r.empresa === "CMK").length;

    return {
      total,
      willUpdateCount: willUpdate.length,
      alreadySameCount: alreadySame.length,
      notInDbCount: notInDb.length,
      invalidCompanyCount: invalidCompany.length,
      hoytsCount,
      cmkCount,
      readyRows: willUpdate,
    };
  }, [parsedUpdateRows]);

  // 4. Computed stats for Import (Tab 2)
  const importStats = useMemo(() => {
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

  // 5. Submit Company Updates to MongoDB via POST /api/ordenes/bulk-update-company
  const handleConfirmUpdateCompanies = async () => {
    if (updateStats.willUpdateCount === 0) {
      showToast("⚠️ No hay órdenes con cambios de compañía pendientes.");
      return;
    }

    if (!confirm(`¿Estás seguro de actualizar la compañía de ${updateStats.willUpdateCount} órdenes en MongoDB según la Columna D del Excel?`)) {
      return;
    }

    setUpdatingCompany(true);
    setUpdateProgressPercent(0);

    const readyRows = updateStats.readyRows;
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(readyRows.length / CHUNK_SIZE);
    let totalModified = 0;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, readyRows.length);
        const chunk = readyRows.slice(start, end);

        const payload = {
          updates: chunk.map((r) => ({
            numOC: r.numOC,
            empresa: r.empresa,
          })),
        };

        const res = await fetch(`${API_BASE_URL}/bulk-update-company`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error en lote ${i + 1} de ${totalChunks}: HTTP ${res.status}`);
        }

        const data = await res.json();
        totalModified += (data.modifiedCount || 0) + (data.matchedCount || 0);

        const currentPercent = Math.round(((i + 1) / totalChunks) * 100);
        setUpdateProgressPercent(currentPercent);
      }

      // Invalidate caches so Estadísticas and Proveedores get fresh company data
      try {
        localStorage.removeItem("finanzas_estadisticas_cache_v1");
        localStorage.removeItem("finanzas_proveedores_registry_v1");
      } catch (e) {
        console.warn("No se pudo limpiar localStorage:", e);
      }

      setUpdateResult({
        totalProcessed: readyRows.length,
        modifiedCount: totalModified,
        hoytsCount: updateStats.hoytsCount,
        cmkCount: updateStats.cmkCount,
      });

      showToast(`🎉 ¡Compañías actualizadas con éxito! Se procesaron ${readyRows.length} órdenes.`);

      // Clear parsed preview and reload MongoDB orders
      setParsedUpdateRows([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadExistingOCs();
    } catch (err: any) {
      console.error("Error durante la actualización masiva de compañías:", err);
      showToast(`❌ Error: ${err.message || "Fallo en la actualización masiva."}`);
    } finally {
      setUpdatingCompany(false);
    }
  };

  // 6. Submit New Orders Import via POST /api/ordenes/bulk
  const handleConfirmImport = async () => {
    if (importStats.readyCount === 0) {
      showToast("⚠️ No hay órdenes válidas para importar.");
      return;
    }

    if (!confirm(`¿Estás seguro de importar ${importStats.readyCount} órdenes históricas a MongoDB como Entregadas/Finalizadas?`)) {
      return;
    }

    setImporting(true);
    setProgressPercent(0);

    const readyRows = importStats.readyRows;
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(readyRows.length / CHUNK_SIZE);
    let successfullyInserted = 0;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, readyRows.length);
        const chunk = readyRows.slice(start, end);

        const payload = chunk.map((r) => ({
          firebaseId: `import_oc_${r.numOC}`,
          numOC: r.numOC,
          numSolicitud: "",
          razonSocial: r.razonSocial,
          monto: r.monto,
          empresa: r.empresa,
          motivo: r.motivo,
          formaPago: "30DFF",
          entregada: true,
          liberada: false,
          mandada: false,
          cancelada: false,
          creadoPor: r.creadoPor,
          fechaOC: r.fechaOC ? r.fechaOC.toISOString() : null,
          anio: r.anio,
          mes: r.mes,
          notas: [],
          preserveExisting: true,
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

      // Invalidate caches
      try {
        localStorage.removeItem("finanzas_estadisticas_cache_v1");
        localStorage.removeItem("finanzas_proveedores_registry_v1");
      } catch (e) {
        console.warn("No se pudo limpiar localStorage:", e);
      }

      setImportResult({
        totalFile: importStats.total,
        skippedExisting: importStats.existingCount + importStats.duplicateInFileCount,
        insertedCount: successfullyInserted,
      });

      showToast(`🎉 ¡Importación completada! Se procesaron ${successfullyInserted} órdenes en MongoDB.`);
      
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

  // 7. Filtered orders in MongoDB
  const mongoStats = useMemo(() => {
    const total = allOrders.length;
    const pending = allOrders.filter((o) => !o.empresa || o.empresa.trim() === "").length;
    const hoyts = allOrders.filter((o) => o.empresa?.trim().toLowerCase() === "hoyts").length;
    const cmk = allOrders.filter((o) => {
      const e = o.empresa?.trim().toLowerCase();
      return e === "cmk" || e === "cinemark";
    }).length;
    return { total, pending, hoyts, cmk };
  }, [allOrders]);

  const filteredMongoOrders = useMemo(() => {
    let list = allOrders;

    if (mongoCompanyFilter === "pending") {
      list = list.filter((o) => !o.empresa || o.empresa.trim() === "");
    } else if (mongoCompanyFilter === "hoyts") {
      list = list.filter((o) => o.empresa?.trim().toLowerCase() === "hoyts");
    } else if (mongoCompanyFilter === "cmk") {
      list = list.filter((o) => {
        const e = o.empresa?.trim().toLowerCase();
        return e === "cmk" || e === "cinemark";
      });
    }

    if (!searchMongo.trim()) return list;
    const q = searchMongo.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.numOC?.toLowerCase().includes(q) ||
        o.razonSocial?.toLowerCase().includes(q) ||
        o.motivo?.toLowerCase().includes(q)
    );
  }, [allOrders, mongoCompanyFilter, searchMongo]);

  return (
    <AppLayout
      title="Temporal"
      subtitle="Actualización masiva de Compañías (Columna D) y gestión de órdenes históricas"
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
                <Building2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Módulo de Asignación y Carga Masiva
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold">
                    Columna D = Compañía (Hoyts / CMK)
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                    Actualiza directamente en MongoDB
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
                  Asigna la compañía a las más de 5.000 órdenes históricas cargadas sin alterar fechas, montos ni proveedores. 
                  El sistema cruzará el número de OC (Columna A) y aplicará la compañía especificada en la <strong>Columna D</strong> (<span className="text-amber-300 font-medium">Hoyts</span> o <span className="text-rose-300 font-medium">CMK</span>).
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
                <span>Refrescar Base ({allOrders.length})</span>
              </button>
            </div>
          </div>

          {/* TAB SELECTOR */}
          <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/10">
            <button
              onClick={() => setActiveTab("update-company")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "update-company"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-white/5"
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Actualizar Compañías (Columna D)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                {mongoStats.pending} sin asignar
              </span>
            </button>

            <button
              onClick={() => setActiveTab("import-new")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "import-new"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-white/5"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Importar Nuevas OCs Históricas</span>
            </button>
          </div>
        </div>

        {/* SUCCESS NOTICES */}
        {updateResult && (
          <div className="p-6 rounded-3xl bg-emerald-950/30 border border-emerald-500/30 backdrop-blur-md animate-in fade-in space-y-3">
            <div className="flex items-center gap-3 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-6 h-6" />
              <span>¡Compañías actualizadas exitosamente en MongoDB!</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-slate-400 block mb-1">Total OCs procesadas</span>
                <span className="text-lg font-bold text-white font-mono">{updateResult.totalProcessed}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10">
                <span className="text-slate-400 block mb-1">Actualizadas / Sincronizadas</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">{updateResult.modifiedCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 block mb-1">Asignadas a Hoyts</span>
                <span className="text-lg font-bold text-amber-300 font-mono">{updateResult.hoytsCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-rose-400 block mb-1">Asignadas a CMK</span>
                <span className="text-lg font-bold text-rose-300 font-mono">{updateResult.cmkCount}</span>
              </div>
            </div>
          </div>
        )}

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
              <h3 className="font-semibold text-white text-base">
                {activeTab === "update-company" 
                  ? "Seleccionar Archivo Excel para Actualizar Compañías"
                  : "Seleccionar Archivo Excel para Importar Nuevas OCs"}
              </h3>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>
                {activeTab === "update-company"
                  ? "Columna A = N° OC | Columna D = Compañía (Hoyts / CMK)"
                  : "Columna A = N° OC | Columna B = Proveedor | Columna C = Fecha | Columna D = Compañía | Columna F = Monto"}
              </span>
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

          {/* TAB 1: UPDATE COMPANIES PREVIEW & ACTIONS */}
          {activeTab === "update-company" && parsedUpdateRows.length > 0 && (
            <div className="space-y-6 pt-2 animate-in fade-in">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Total Filas en Excel</span>
                  <span className="text-xl font-bold text-white font-mono">{updateStats.total}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-400 block mb-1">Listas para Actualizar</span>
                  <span className="text-xl font-bold text-emerald-300 font-mono">{updateStats.willUpdateCount}</span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-slate-300">
                    <span className="text-amber-300">Hoyts: {updateStats.hoytsCount}</span>
                    <span>·</span>
                    <span className="text-rose-300">CMK: {updateStats.cmkCount}</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Ya con la misma Compañía</span>
                  <span className="text-xl font-bold text-slate-300 font-mono">{updateStats.alreadySameCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-xs text-amber-400 block mb-1">No en BD / Sin Compañía</span>
                  <span className="text-xl font-bold text-amber-300 font-mono">
                    {updateStats.notInDbCount + updateStats.invalidCompanyCount}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {updatingCompany && (
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-indigo-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      Actualizando compañías en MongoDB en lotes de 500...
                    </span>
                    <span className="font-mono font-bold text-indigo-400">{updateProgressPercent}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                      style={{ width: `${updateProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ACTION BUTTON */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/40 border border-white/10">
                <div className="text-xs text-slate-400">
                  Se actualizará la compañía de <strong className="text-white font-semibold">{updateStats.willUpdateCount}</strong> órdenes de compra en MongoDB sin modificar montos ni proveedores.
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setParsedUpdateRows([]);
                      setFileName(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={updatingCompany}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmUpdateCompanies}
                    disabled={updatingCompany || updateStats.willUpdateCount === 0}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xl transition-all cursor-pointer ${
                      updatingCompany || updateStats.willUpdateCount === 0
                        ? "bg-indigo-600/50 text-indigo-200 cursor-not-allowed"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 active:scale-95"
                    }`}
                  >
                    {updatingCompany ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Actualizando ({updateProgressPercent}%)...</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        <span>Confirmar y Actualizar {updateStats.willUpdateCount} OCs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* PREVIEW TABLE */}
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-3 bg-slate-800/60 border-b border-white/5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Vista previa de las primeras 25 filas del Excel</span>
                  <span className="text-slate-400 font-mono">Mostrando {Math.min(parsedUpdateRows.length, 25)} de {parsedUpdateRows.length}</span>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-white/5 uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">N° OC</th>
                        <th className="py-2.5 px-3">Proveedor</th>
                        <th className="py-2.5 px-3">Col D (Excel)</th>
                        <th className="py-2.5 px-3 text-center">Compañía Detectada</th>
                        <th className="py-2.5 px-3 text-center">Estado Actual en BD</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {parsedUpdateRows.slice(0, 25).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-white">{r.numOC}</td>
                          <td className="py-2 px-3 font-medium text-slate-200 truncate max-w-[220px]" title={r.razonSocial}>
                            {r.razonSocial}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono">{r.colDRaw || "-"}</td>
                          <td className="py-2 px-3 text-center">
                            {r.empresa === "Hoyts" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Hoyts
                              </span>
                            ) : r.empresa === "CMK" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                CMK
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">No detectada</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.matchedInDb ? (
                              r.currentEmpresaInDb ? (
                                <span className="text-slate-300 font-semibold text-[11px]">{r.currentEmpresaInDb}</span>
                              ) : (
                                <span className="text-amber-400/80 text-[10px]">Sin asignar</span>
                              )
                            ) : (
                              <span className="text-red-400 text-[10px]">No en Mongo</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.status === "will_update" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                {r.statusLabel}
                              </span>
                            ) : r.status === "already_same" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-white/10">
                                {r.statusLabel}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30" title={r.statusLabel}>
                                <AlertCircle className="w-3 h-3" />
                                {r.statusLabel}
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

          {/* TAB 2: BULK IMPORT PREVIEW & ACTIONS */}
          {activeTab === "import-new" && parsedRows.length > 0 && (
            <div className="space-y-6 pt-2 animate-in fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Total Filas en Excel</span>
                  <span className="text-xl font-bold text-white font-mono">{importStats.total}</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-xs text-amber-400 block mb-1">Ya existen en la BD (Omitir)</span>
                  <span className="text-xl font-bold text-amber-300 font-mono">{importStats.existingCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-400 block mb-1">Nuevas OCs a Importar</span>
                  <span className="text-xl font-bold text-emerald-300 font-mono">{importStats.readyCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-xs text-indigo-400 block mb-1">Monto Total a Incorporar</span>
                  <span className="text-xl font-bold text-indigo-300 font-mono truncate block">
                    {formatCurrency(importStats.totalMonto)}
                  </span>
                </div>
              </div>

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

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/40 border border-white/10">
                <div className="text-xs text-slate-400">
                  Se importarán <strong className="text-white font-semibold">{importStats.readyCount}</strong> órdenes nuevas con estado <strong className="text-emerald-400">Entregada / Finalizada</strong>.
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
                    disabled={importing || importStats.readyCount === 0}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xl transition-all cursor-pointer ${
                      importing || importStats.readyCount === 0
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
                        <span>Confirmar e Importar {importStats.readyCount} OCs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MONGODB ORDERS MONITOR & EXPLORER */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-base">
                  Órdenes Registradas en MongoDB
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
                  {allOrders.length.toLocaleString("es-AR")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualiza el estado de las órdenes en la base local y verifica la compañía asignada a cada una.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por N° OC, proveedor..."
                value={searchMongo}
                onChange={(e) => setSearchMongo(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/50"
              />
              {searchMongo && (
                <button
                  onClick={() => setSearchMongo("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-slate-500" />
              Filtrar por:
            </span>
            <button
              onClick={() => setMongoCompanyFilter("pending")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                mongoCompanyFilter === "pending"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-800/60 text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              Sin Compañía ({mongoStats.pending})
            </button>
            <button
              onClick={() => setMongoCompanyFilter("hoyts")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                mongoCompanyFilter === "hoyts"
                  ? "bg-amber-600/30 text-amber-200 border border-amber-500/50"
                  : "bg-slate-800/60 text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              Hoyts ({mongoStats.hoyts})
            </button>
            <button
              onClick={() => setMongoCompanyFilter("cmk")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                mongoCompanyFilter === "cmk"
                  ? "bg-rose-600/30 text-rose-200 border border-rose-500/50"
                  : "bg-slate-800/60 text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              CMK ({mongoStats.cmk})
            </button>
            <button
              onClick={() => setMongoCompanyFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                mongoCompanyFilter === "all"
                  ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50"
                  : "bg-slate-800/60 text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              Todas ({mongoStats.total})
            </button>
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
                  ) : filteredMongoOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No se encontraron órdenes con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMongoOrders.slice(0, 50).map((o) => (
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
                          {o.empresa?.trim().toLowerCase() === "hoyts" ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Hoyts
                            </span>
                          ) : o.empresa?.trim().toLowerCase() === "cmk" || o.empresa?.trim().toLowerCase() === "cinemark" ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              CMK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-white/5">
                              Sin Asignar
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredMongoOrders.length > 50 && (
              <div className="p-2.5 bg-slate-800/60 border-t border-white/5 text-center text-xs text-slate-400 font-mono">
                Mostrando 50 de {filteredMongoOrders.length.toLocaleString("es-AR")} órdenes. Usa el buscador o los filtros para ver cualquier registro.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
