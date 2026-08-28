"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { 
  Download, 
  Play, 
  Terminal, 
  Building2, 
  Calendar as CalendarIcon, 
  Hash, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Key, 
  Eye, 
  EyeOff, 
  Sparkles,
  FileText,
  RefreshCw,
  Image as ImageIcon
} from "lucide-react";

interface DownloadedFile {
  name: string;
  url: string;
  localPath: string;
}

export default function InterbankingPage() {
  const { user, loading } = useAuth();

  const getCleanUsername = () => {
    if (!user) return "";
    if (user.displayName) return user.displayName;
    if (user.email) {
      const parts = user.email.split("@");
      return parts[0];
    }
    return "";
  };

  const username = getCleanUsername().toLowerCase();
  const isJulian = username === "julian";

  // Form states
  const [company, setCompany] = useState("CINEMARK ARGENTINA S.A.");
  const [lote, setLote] = useState("");
  const [monthYear, setMonthYear] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${yyyy}-${mm}`; // e.g. "2026-08"
  });

  // Collapsible Advanced Credentials
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [customCuil, setCustomCuil] = useState("");
  const [customUser, setCustomUser] = useState("");
  const [customPass, setCustomPass] = useState("");
  const [customCookies, setCustomCookies] = useState("");

  // Execution states
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "completed" | "failed">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [historyLogs, setHistoryLogs] = useState<string[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFile[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queue states
  const [queue, setQueue] = useState<string[]>([]);
  const [currentLote, setCurrentLote] = useState<string | null>(null);
  const [totalLotesCount, setTotalLotesCount] = useState<number>(0);
  const [completedLotes, setCompletedLotes] = useState<string[]>([]);
  const [failedLotes, setFailedLotes] = useState<{lote: string, error: string}[]>([]);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Derived state to disable fields
  const isBusy = status !== "idle" || queue.length > 0;

  // Combine logs of previous batches and current batch
  const allLogs = useMemo(() => [...historyLogs, ...logs], [historyLogs, logs]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allLogs]);

  // Polling hook to check task status of current lote
  useEffect(() => {
    if (!runId || status !== "running") return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`https://apivacas.jariel.com.ar/api/interbanking/status/${runId}`);
        if (!response.ok) {
          throw new Error("Error al consultar el estado de la automatización.");
        }
        const data = await response.json();
        
        if (data.success) {
          setLogs(data.logs || []);
          if (data.status === "completed") {
            setStatus("completed");
            setDownloadedFiles(data.files || []);
            if (currentLote) {
              setCompletedLotes((prev) => [...prev, currentLote]);
            }
            clearInterval(interval);
          } else if (data.status === "failed") {
            setStatus("failed");
            const errDetail = data.error || "La automatización falló por un error desconocido.";
            setErrorMsg(errDetail);
            setScreenshotUrl(data.screenshotUrl || null);
            if (currentLote) {
              setFailedLotes((prev) => [...prev, { lote: currentLote, error: errDetail }]);
            }
            clearInterval(interval);
          }
        }
      } catch (err: unknown) {
        console.error("Error en polling de estado:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [runId, status, currentLote]);

  // Descarga automática en el navegador cuando el backend completa la tarea del lote actual
  useEffect(() => {
    if (status === "completed" && downloadedFiles.length > 0) {
      downloadedFiles.forEach((file) => {
        const link = document.createElement("a");
        link.href = file.url;
        link.setAttribute("download", file.name);
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  }, [status, downloadedFiles]);

  // Queue runner: starts the next lote in the queue sequentially
  useEffect(() => {
    const processQueue = async () => {
      if (queue.length > 0 && status === "idle") {
        const nextLote = queue[0];
        setCurrentLote(nextLote);
        setStatus("starting");
        setLogs([]);

        setHistoryLogs((prev) => [
          ...prev,
          `==================================================`,
          `🚀 [Cola] Procesando lote ${nextLote} (${totalLotesCount - queue.length + 1} de ${totalLotesCount})...`,
          `==================================================`,
          `[Cliente] Solicitando ejecución para lote ${nextLote}...`,
        ]);

        const payload: {
          company: string;
          lote: string;
          monthYear: string;
          customCredentials?: {
            cuil?: string;
            user?: string;
            pass?: string;
          };
          cookies?: unknown[];
        } = {
          company,
          lote: nextLote,
          monthYear,
        };

        if (customCuil || customUser || customPass) {
          payload.customCredentials = {
            cuil: customCuil || undefined,
            user: customUser || undefined,
            pass: customPass || undefined,
          };
        }

        if (customCookies.trim()) {
          try {
            const parsed = JSON.parse(customCookies.trim());
            payload.cookies = parsed;
          } catch {
            // Ignoramos, ya validado en submit
          }
        }

        try {
          const response = await fetch("https://apivacas.jariel.com.ar/api/interbanking/run", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Error al iniciar el servidor de automatización.");
          }

          const data = await response.json();
          if (data.success) {
            setRunId(data.runId);
            setHistoryLogs((prev) => [
              ...prev,
              `[Cliente] Lote ${nextLote} encolado exitosamente. ID: ${data.runId}`,
              `[Cliente] Conectando con los logs del servidor...`,
            ]);
            setStatus("running");
          } else {
            throw new Error(data.error || "Respuesta inválida del servidor.");
          }
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : String(err);
          setHistoryLogs((prev) => [
            ...prev,
            `❌ [Cliente] Error al iniciar lote ${nextLote}: ${errMessage}`,
          ]);
          setFailedLotes((prev) => [...prev, { lote: nextLote, error: errMessage }]);
          
          // Avanzar al siguiente lote tras una pequeña pausa de 4 segundos
          setTimeout(() => {
            setQueue((prev) => prev.slice(1));
            setStatus("idle");
          }, 4000);
        }
      }
    };

    processQueue();
  }, [queue, status]);

  // Queue transition: waits after a batch completes/fails, saves its logs to history, and advances
  useEffect(() => {
    if ((status === "completed" || status === "failed") && currentLote) {
      // Esperar 5 segundos para que la descarga termine y no saturar el servidor
      const timer = setTimeout(() => {
        setHistoryLogs((prev) => [
          ...prev,
          ...logs,
          status === "completed" 
            ? `✅ Lote ${currentLote} completado exitosamente.`
            : `❌ Lote ${currentLote} falló: ${errorMsg || "Error"}`,
          `\n`
        ]);
        setLogs([]);
        
        // Limpiar variables del lote actual
        setRunId(null);
        setCurrentLote(null);
        setDownloadedFiles([]);
        setScreenshotUrl(null);
        setErrorMsg(null);
        
        // Descolar y avanzar
        setQueue((prev) => {
          const nextQueue = prev.slice(1);
          if (nextQueue.length === 0) {
            setHistoryLogs((h) => [
              ...h,
              `==================================================`,
              `🎉 [Cola] ¡Proceso de cola terminado!`,
              `Total de lotes procesados: ${totalLotesCount}`,
              `Exitosos: ${completedLotes.length}`,
              `Fallidos: ${failedLotes.length}`,
              `==================================================`,
            ]);
          }
          return nextQueue;
        });
        
        setStatus("idle");
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [status, currentLote, logs, errorMsg, completedLotes.length, failedLotes.length, totalLotesCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedLotes = lote
      .split(/[\s,]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
      
    if (parsedLotes.length === 0) {
      setErrorMsg("Debes ingresar al menos un número de lote.");
      return;
    }

    if (customCookies.trim()) {
      try {
        const parsed = JSON.parse(customCookies.trim());
        if (!Array.isArray(parsed)) {
          throw new Error("El JSON de cookies debe ser un arreglo de objetos [ { ... } ].");
        }
      } catch (err: unknown) {
        setErrorMsg(`JSON de cookies inválido: ${(err as Error).message}`);
        return;
      }
    }

    // Inicializar cola
    setQueue(parsedLotes);
    setTotalLotesCount(parsedLotes.length);
    setCompletedLotes([]);
    setFailedLotes([]);
    setHistoryLogs([]);
    setLogs([]);
    setDownloadedFiles([]);
    setScreenshotUrl(null);
    setErrorMsg(null);
    setRunId(null);
    setCurrentLote(null);
    setStatus("idle");
  };

  const handleReset = () => {
    setStatus("idle");
    setLote("");
    setLogs([]);
    setHistoryLogs([]);
    setDownloadedFiles([]);
    setScreenshotUrl(null);
    setErrorMsg(null);
    setRunId(null);
    setQueue([]);
    setCurrentLote(null);
    setTotalLotesCount(0);
    setCompletedLotes([]);
    setFailedLotes([]);
  };

  if (loading) {
    return (
      <AppLayout title="Automatización Interbanking" subtitle="Descarga automatizada de comprobantes CBU">
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-xs text-gray-400">Verificando permisos...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isJulian) {
    return (
      <AppLayout title="Acceso Restringido" subtitle="Módulo protegido">
        <div className="max-w-md mx-auto my-12 p-8 rounded-3xl glass-card border border-white/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-extrabold text-base">Acceso Denegado</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Este módulo de automatización de Interbanking está restringido únicamente al usuario administrador <strong>julian</strong>.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Automatización Interbanking" subtitle="Descarga automatizada de comprobantes CBU">
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Banner informativo */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-sm text-emerald-300">
          <Sparkles className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold text-white">Automatización de Descargas de CBU</p>
            <p className="text-gray-400 text-xs mt-0.5">
              Este módulo ejecuta un navegador automatizado en el servidor (<code className="text-emerald-400">apivacas.jariel.com.ar</code>) que inicia sesión, selecciona la empresa elegida, busca en el historial de CBU por el lote y mes provistos, descarga los archivos en PDF y los transmite directamente a esta página para tu descarga.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulario de control */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" /> Parámetros de Ejecución
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selector de Empresa */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-medium">Empresa</label>
                  <div className="relative">
                    <select
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      disabled={isBusy}
                      className="w-full bg-[#0d131f] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                    >
                      <option value="BULNES">BULNES</option>
                      <option value="CINEMARK ARGENTINA S.A.">CINEMARK ARGENTINA S.A.</option>
                      <option value="CINEMARK ARGENTINA SRL">CINEMARK ARGENTINA SRL</option>
                      <option value="HOYTS GENERAL CINEMA DE ARGENTINA SA">HOYTS GENERAL CINEMA DE ARGENTINA SA</option>
                      <option value="HOYTS GENERAL CINE DE ARGENTINA SA">HOYTS GENERAL CINE DE ARGENTINA SA</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Selector de Mes (calcula fechas) */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" /> Mes de Búsqueda
                  </label>
                  <input
                    type="month"
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                    disabled={isBusy}
                    className="w-full bg-[#0d131f] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500">
                    Se buscará automáticamente un rango de hasta 30 días (hasta el día 30 o el día de hoy si es el mes actual) para respetar el límite de rango de Interbanking.
                  </p>
                </div>

                {/* Número de Lote */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-gray-400" /> Número de Lotes
                  </label>
                  <input
                    type="text"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    disabled={isBusy}
                    placeholder="Ej. 152, 153, 164"
                    className="w-full bg-[#0d131f] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500">
                    Puedes ingresar múltiples números de lote separados por comas o espacios para descargarlos secuencialmente.
                  </p>
                </div>

                {/* Acordeón de Credenciales Personalizadas */}
                <div className="border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <Key className="w-3 h-3 text-amber-500" /> 
                    {showAdvanced ? "Ocultar Credenciales Avanzadas" : "Modificar Credenciales de Acceso (Opcional)"}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-3 p-3.5 rounded-xl bg-white/5 border border-white/5 animate-fadeIn">
                      <p className="text-[10px] text-amber-400 leading-relaxed">
                        Dejar estos campos vacíos para usar las credenciales configuradas por defecto en el servidor (.env). Rellenar solo si deseas usar una cuenta diferente para esta ejecución.
                      </p>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-gray-400 font-medium">CUIL / CUIT</label>
                        <input
                          type="text"
                          value={customCuil}
                          onChange={(e) => setCustomCuil(e.target.value)}
                          disabled={isBusy}
                          placeholder="Sin guiones, ej: 20469191436"
                          className="w-full bg-[#0d131f] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-gray-400 font-medium">Usuario Interbanking</label>
                        <input
                          type="text"
                          value={customUser}
                          onChange={(e) => setCustomUser(e.target.value)}
                          disabled={isBusy}
                          placeholder="Ej: gpainemal"
                          className="w-full bg-[#0d131f] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-gray-400 font-medium">Contraseña</label>
                        <div className="relative">
                          <input
                            type={showPass ? "text" : "password"}
                            value={customPass}
                            onChange={(e) => setCustomPass(e.target.value)}
                            disabled={isBusy}
                            placeholder="Contraseña de acceso"
                            className="w-full bg-[#0d131f] border border-white/5 rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-2 top-1.5 text-gray-400 hover:text-white"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 border-t border-white/5 pt-2">
                        <label className="text-[11px] text-gray-400 font-medium">JSON de Cookies (Opcional)</label>
                        <textarea
                          value={customCookies}
                          onChange={(e) => setCustomCookies(e.target.value)}
                          disabled={isBusy}
                          placeholder='Pega el arreglo JSON de cookies (de EditThisCookie), ej: [{"name": "sib", "value": "..."}]'
                          rows={3}
                          className="w-full bg-[#0d131f] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                        <p className="text-[9px] text-gray-500 leading-relaxed">
                          Al inyectar las cookies se omitirá el proceso de inicio de sesión y selección de empresa en el servidor, yendo directo a la interfaz del banco.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
                  {!isBusy ? (
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      <Play className="w-4 h-4 fill-slate-950 text-slate-950" /> Iniciar Descargas
                    </button>
                  ) : (
                    <>
                      {status !== "running" && status !== "starting" && (
                        <button
                          type="button"
                          onClick={handleReset}
                          className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all animate-pulse"
                        >
                          Cancelar y Restablecer
                        </button>
                      )}
                      {(status === "running" || status === "starting") && (
                        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Procesando Lote ({currentLote})...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Consola e Historial de Descarga */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pantalla de Estado y Archivos Descargados */}
            {/* Cola de Descargas Activa (Barra de progreso visual) */}
            {totalLotesCount > 1 && (
              <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4 animate-fadeIn">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                  Cola de Descarga de Lotes
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Progreso: {completedLotes.length + failedLotes.length} de {totalLotesCount} lotes</span>
                    <span className="font-semibold text-emerald-400">
                      {Math.round(((completedLotes.length + failedLotes.length) / totalLotesCount) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-950/60 rounded-full h-2 overflow-hidden border border-white/5">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${((completedLotes.length + failedLotes.length) / totalLotesCount) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2 text-center">
                      <span className="text-[10px] text-gray-500 block uppercase font-medium">Exitosos</span>
                      <span className="text-xs font-bold text-emerald-400">{completedLotes.length}</span>
                    </div>
                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-2 text-center">
                      <span className="text-[10px] text-gray-500 block uppercase font-medium">Fallidos</span>
                      <span className="text-xs font-bold text-rose-400">{failedLotes.length}</span>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-2 text-center">
                      <span className="text-[10px] text-gray-500 block uppercase font-medium">Restantes</span>
                      <span className="text-xs font-bold text-gray-300">{queue.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pantalla de Estado y Archivos Descargados */}
            {(status === "completed" || status === "failed" || status === "running" || status === "starting" || currentLote !== null) && (
              <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <CheckCircle2 className={`w-5 h-5 ${status === 'completed' ? 'text-emerald-400' : status === 'failed' ? 'text-rose-400' : 'text-amber-400 animate-pulse'}`} /> 
                  Estado: Lote {currentLote}
                </h3>

                {status === "starting" && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-2">
                    <p className="font-semibold flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Inicializando lote {currentLote}...
                    </p>
                    <p className="text-gray-400">
                      Iniciando la sesión segura y encolando la solicitud en el servidor. Por favor, espera.
                    </p>
                  </div>
                )}

                {status === "running" && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-2">
                    <p className="font-semibold flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Procesando lote {currentLote}...
                    </p>
                    <p className="text-gray-400">
                      Esto tomará entre 30 segundos y 1.5 minutos dependiendo de la velocidad de respuesta de Interbanking. Por favor, no cierres esta ventana.
                    </p>
                  </div>
                )}

                {status === "failed" && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> Error en Lote {currentLote}:
                    </p>
                    <p className="bg-slate-950/40 p-2.5 rounded-lg font-mono text-[11px] text-red-200 border border-rose-500/5">
                      {errorMsg}
                    </p>
                    {screenshotUrl && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Captura de pantalla de la pantalla del navegador al fallar:
                        </span>
                        <a 
                          href={screenshotUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block p-1 bg-white/5 border border-white/10 rounded-lg hover:border-emerald-500/40 transition-all overflow-hidden max-w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={screenshotUrl} 
                            alt="Error de navegador" 
                            className="max-h-48 object-contain rounded-md"
                          />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {status === "completed" && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                      ✨ El comprobante para el lote {currentLote} se ha descargado correctamente.
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Archivos Listos para Descargar:</span>
                      
                      {downloadedFiles.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No se registraron archivos, pero el proceso finalizó de forma correcta.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {downloadedFiles.map((file, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center justify-between p-3 rounded-xl bg-[#0d131f] border border-white/5 hover:border-white/10 transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-200 font-medium truncate max-w-xs md:max-w-md">
                                    {file.name}
                                  </p>
                                  <p className="text-[10px] text-gray-500 truncate">
                                    Servidor: {file.localPath.split("/").pop()}
                                  </p>
                                </div>
                              </div>
                              <a
                                href={file.url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> Descargar
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Aviso de transición de cola */}
                {queue.length > 1 && (status === "completed" || status === "failed") && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-center gap-2 animate-pulse mt-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Lote finalizado. Iniciando el siguiente lote ({queue[1]}) en unos segundos...</span>
                  </div>
                )}
              </div>
            )}

            {/* Consola de Eventos en Vivo */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-3 flex flex-col h-[400px]">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" /> Consola de Logs del Servidor
              </h3>
              
              <div className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl p-4 font-mono text-[11px] text-emerald-300/90 overflow-y-auto space-y-1 shadow-inner h-full">
                {allLogs.length === 0 ? (
                  <p className="text-gray-500 italic">La consola está lista. Inicia el proceso para ver los eventos en tiempo real...</p>
                ) : (
                  allLogs.map((logStr, i) => (
                    <div key={i} className="leading-5 whitespace-pre-wrap">
                      {logStr}
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
