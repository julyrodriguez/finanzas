"use client";

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
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

  // Execution states
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFile[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Polling hook to check task status
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
            clearInterval(interval);
          } else if (data.status === "failed") {
            setStatus("failed");
            setErrorMsg(data.error || "La automatización falló por un error desconocido.");
            setScreenshotUrl(data.screenshotUrl || null);
            clearInterval(interval);
          }
        }
      } catch (err: any) {
        console.error("Error en polling de estado:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [runId, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lote) {
      setErrorMsg("Debes ingresar un número de lote.");
      return;
    }

    // Reset states
    setStatus("running");
    setLogs(["[Cliente] Iniciando solicitud de automatización..."]);
    setDownloadedFiles([]);
    setScreenshotUrl(null);
    setErrorMsg(null);
    setRunId(null);

    const payload: any = {
      company,
      lote,
      monthYear,
    };

    if (customCuil || customUser || customPass) {
      payload.customCredentials = {
        cuil: customCuil || undefined,
        user: customUser || undefined,
        pass: customPass || undefined,
      };
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
        setLogs((prev) => [...prev, `[Cliente] Tarea encolada en el servidor. ID de ejecución: ${data.runId}`, `[Cliente] Conectando con el stream de logs...`]);
      } else {
        throw new Error(data.error || "Respuesta inválida del servidor.");
      }
    } catch (err: any) {
      setStatus("failed");
      setErrorMsg(err.message);
      setLogs((prev) => [...prev, `❌ [Cliente] Error al conectar con el servidor: ${err.message}`]);
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setLote("");
    setLogs([]);
    setDownloadedFiles([]);
    setScreenshotUrl(null);
    setErrorMsg(null);
    setRunId(null);
  };

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
                      disabled={status === "running"}
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
                    disabled={status === "running"}
                    className="w-full bg-[#0d131f] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500">
                    Se buscará desde el día 1 hasta el último día del mes seleccionado de forma automática.
                  </p>
                </div>

                {/* Número de Lote */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-gray-400" /> Número de Lote
                  </label>
                  <input
                    type="text"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    disabled={status === "running"}
                    placeholder="Ej. 1823901"
                    className="w-full bg-[#0d131f] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
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
                          disabled={status === "running"}
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
                          disabled={status === "running"}
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
                            disabled={status === "running"}
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
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
                  {status === "idle" ? (
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      <Play className="w-4 h-4 fill-slate-950 text-slate-950" /> Iniciar Descarga
                    </button>
                  ) : (
                    <>
                      {status !== "running" && (
                        <button
                          type="button"
                          onClick={handleReset}
                          className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all"
                        >
                          Nueva Búsqueda
                        </button>
                      )}
                      {status === "running" && (
                        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Procesando en Servidor...
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
            {(status === "completed" || status === "failed" || status === "running") && (
              <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <CheckCircle2 className={`w-5 h-5 ${status === 'completed' ? 'text-emerald-400' : status === 'failed' ? 'text-rose-400' : 'text-amber-400 animate-pulse'}`} /> 
                  Resultado del Proceso
                </h3>

                {status === "running" && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-2">
                    <p className="font-semibold flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ejecutando script de navegación inteligente...
                    </p>
                    <p className="text-gray-400">
                      Esto tomará entre 30 segundos y 1.5 minutos dependiendo de la velocidad de respuesta de Interbanking. Por favor, no cierres esta ventana.
                    </p>
                  </div>
                )}

                {status === "failed" && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" /> Error de Automatización:
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
                      ✨ El comprobante se ha descargado y procesado correctamente en el servidor.
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
              </div>
            )}

            {/* Consola de Eventos en Vivo */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-3 flex flex-col h-[400px]">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" /> Consola de Logs del Servidor
              </h3>
              
              <div className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl p-4 font-mono text-[11px] text-emerald-300/90 overflow-y-auto space-y-1 shadow-inner h-full">
                {logs.length === 0 ? (
                  <p className="text-gray-500 italic">La consola está lista. Inicia el proceso para ver los eventos en tiempo real...</p>
                ) : (
                  logs.map((logStr, i) => (
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
