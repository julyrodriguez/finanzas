"use client";

import React, { useState, useEffect } from "react";
import { Proveedor } from "@/types/proveedor";
import { 
  enrichMultipleProveedores, 
  enrichSingleProveedor, 
  bulkSaveEnrichedProveedores,
  EnrichProgressEvent 
} from "@/lib/proveedores/providerEnrichService";
import { saveProveedorToMongo } from "@/lib/serverSync";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Mail,
  Globe,
  Phone,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Check,
  Building2,
  RefreshCw,
  Info
} from "lucide-react";

function LinkedinIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
    </svg>
  );
}

interface ItemStatus {
  status: "idle" | "searching" | "completed" | "error";
  message?: string;
  savedInDb: boolean;
  newEmails: number;
}

interface ProveedorEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProveedores: Proveedor[];
  geminiApiKey?: string;
  onApplyEnriched: (enriched: Proveedor[]) => void;
  onSavedToDb?: (saved: Proveedor[]) => void;
}

export function ProveedorEnrichModal({
  isOpen,
  onClose,
  selectedProveedores,
  geminiApiKey,
  onApplyEnriched,
  onSavedToDb,
}: ProveedorEnrichModalProps) {
  const [autoSave, setAutoSave] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<EnrichProgressEvent | null>(null);
  
  // Results map key: provider id
  const [resultsMap, setResultsMap] = useState<Map<string, Proveedor>>(new Map());
  const [statusesMap, setStatusesMap] = useState<Map<string, ItemStatus>>(new Map());
  const [savingIndividualIds, setSavingIndividualIds] = useState<Set<string>>(new Set());
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Initialize or reset state when opening modal with new providers
  useEffect(() => {
    if (isOpen) {
      const initialResults = new Map<string, Proveedor>();
      const initialStatuses = new Map<string, ItemStatus>();

      selectedProveedores.forEach((p) => {
        initialResults.set(p.id, p);
        initialStatuses.set(p.id, {
          status: "idle",
          savedInDb: Boolean(p.guardado),
          newEmails: 0,
        });
      });

      setResultsMap(initialResults);
      setStatusesMap(initialStatuses);
      setCurrentProgress(null);
      setIsRunning(false);
    }
  }, [isOpen, selectedProveedores]);

  if (!isOpen) return null;

  const totalCount = selectedProveedores.length;
  const completedCount = Array.from(statusesMap.values()).filter(
    (s) => s.status === "completed"
  ).length;
  const unsavedCount = Array.from(resultsMap.values()).filter((p) => {
    const st = statusesMap.get(p.id);
    return st?.status === "completed" && !st.savedInDb;
  }).length;

  const handleStartEnrichment = async () => {
    setIsRunning(true);
    setCurrentProgress(null);

    const updatedResults = new Map(resultsMap);
    const updatedStatuses = new Map(statusesMap);

    await enrichMultipleProveedores(
      selectedProveedores,
      {
        autoSave,
        geminiApiKey,
      },
      (event) => {
        setCurrentProgress(event);
        const provId = event.currentProv.id;

        if (event.status === "searching") {
          updatedStatuses.set(provId, {
            status: "searching",
            message: event.message,
            savedInDb: false,
            newEmails: 0,
          });
          setStatusesMap(new Map(updatedStatuses));
        } else if (event.status === "completed" && event.enrichedProv) {
          updatedResults.set(provId, event.enrichedProv);
          const origMails = Array.isArray(event.currentProv.emails)
            ? event.currentProv.emails.length
            : event.currentProv.email ? 1 : 0;
          const newMails = Math.max(0, (event.enrichedProv.emails?.length || 0) - origMails);

          updatedStatuses.set(provId, {
            status: "completed",
            message: event.message,
            savedInDb: Boolean(autoSave),
            newEmails: newMails,
          });

          setResultsMap(new Map(updatedResults));
          setStatusesMap(new Map(updatedStatuses));
        } else if (event.status === "error") {
          updatedStatuses.set(provId, {
            status: "error",
            message: event.error || "Error al enriquecer",
            savedInDb: false,
            newEmails: 0,
          });
          setStatusesMap(new Map(updatedStatuses));
        }
      }
    );

    setIsRunning(false);

    // Apply automatically in view
    const allEnriched = Array.from(updatedResults.values());
    onApplyEnriched(allEnriched);
    if (autoSave && onSavedToDb) {
      onSavedToDb(allEnriched.filter((p) => updatedStatuses.get(p.id)?.savedInDb));
    }
  };

  // Save single provider to MongoDB
  const handleSaveSingle = async (prov: Proveedor) => {
    setSavingIndividualIds((prev) => new Set(prev).add(prov.id));
    try {
      const savedDoc = await saveProveedorToMongo({
        ...prov,
        guardado: true,
      });

      const updatedProv = {
        ...prov,
        guardado: true,
        id: savedDoc?._id || prov.id,
        _id: savedDoc?._id || prov._id,
      };

      setResultsMap((prev) => {
        const next = new Map(prev);
        next.set(prov.id, updatedProv);
        return next;
      });

      setStatusesMap((prev) => {
        const next = new Map(prev);
        const cur = next.get(prov.id) || { status: "completed", savedInDb: false, newEmails: 0 };
        next.set(prov.id, { ...cur, savedInDb: true });
        return next;
      });

      onApplyEnriched([updatedProv]);
      if (onSavedToDb) onSavedToDb([updatedProv]);
    } catch (err) {
      console.error("Error guardando proveedor individual:", err);
      alert(`No se pudo guardar a "${prov.nombre}". Reintente.`);
    } finally {
      setSavingIndividualIds((prev) => {
        const next = new Set(prev);
        next.delete(prov.id);
        return next;
      });
    }
  };

  // Bulk save all completed providers to MongoDB
  const handleBulkSave = async () => {
    setIsBulkSaving(true);
    try {
      const toSave = Array.from(resultsMap.values()).filter((p) => {
        const st = statusesMap.get(p.id);
        return !st?.savedInDb;
      });

      if (toSave.length === 0) return;

      const { savedCount } = await bulkSaveEnrichedProveedores(toSave);

      // Update local state to mark all as saved
      setStatusesMap((prev) => {
        const next = new Map(prev);
        toSave.forEach((p) => {
          const cur = next.get(p.id) || { status: "completed", savedInDb: false, newEmails: 0 };
          next.set(p.id, { ...cur, savedInDb: true });
        });
        return next;
      });

      const savedWithStatus = toSave.map((p) => ({ ...p, guardado: true }));
      onApplyEnriched(savedWithStatus);
      if (onSavedToDb) onSavedToDb(savedWithStatus);

      alert(`✅ Se guardaron con éxito ${savedCount} proveedores en la base de datos MongoDB.`);
    } catch (err: any) {
      console.error("Error en bulk save:", err);
      alert(`Error al guardar: ${err?.message || "Ocurrió un problema"}`);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 1800);
  };

  const handleCloseAndApply = () => {
    onApplyEnriched(Array.from(resultsMap.values()));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#090f1d] border border-white/10 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] bg-gradient-to-r from-blue-950/30 via-slate-900/60 to-slate-950 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Inteligencia Artificial & Rastreo Web Automático</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Rellenar Fichas de Proveedores con IA</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                {totalCount} {totalCount === 1 ? "proveedor" : "proveedores"}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              La IA rastrea DuckDuckGo y sitios web oficiales para encontrar correos de contacto, sitio web, LinkedIn, teléfono, ubicación y rubro, integrándolos a tu ficha.
            </p>
          </div>

          <button
            onClick={handleCloseAndApply}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options & Controls Bar */}
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* AutoSave Toggle */}
          <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              disabled={isRunning}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 accent-blue-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                Guardar automáticamente en la base de datos (MongoDB)
              </span>
              <span className="text-[11px] text-slate-400">
                {autoSave
                  ? "Al finalizar cada proveedor se persiste en la BD central."
                  : "Solo se cargará en la vista. Podrás guardar con 'Guardar' o 'Guardar Todos'."}
              </span>
            </div>
          </label>

          {/* Action Button: Start or Re-run */}
          <div className="flex items-center gap-2">
            {!isRunning && completedCount === 0 && (
              <button
                onClick={handleStartEnrichment}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Iniciar Relleno con IA ({totalCount})</span>
              </button>
            )}

            {!isRunning && completedCount > 0 && completedCount < totalCount && (
              <button
                onClick={handleStartEnrichment}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Continuar Faltantes</span>
              </button>
            )}

            {!isRunning && completedCount === totalCount && (
              <button
                onClick={handleStartEnrichment}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-ejecutar Todos</span>
              </button>
            )}

            {isRunning && (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Procesando...</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Progress Banner */}
        {isRunning && (
          <div className="px-5 py-3 bg-blue-950/30 border-b border-blue-500/20 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>{currentProgress?.message || "Iniciando análisis de proveedores..."}</span>
              </span>
              <span>
                {currentProgress?.completed || 0} de {totalCount} ({Math.round(((currentProgress?.completed || 0) / totalCount) * 100)}%)
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.round(((currentProgress?.completed || 0) / totalCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Providers List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {selectedProveedores.map((origProv) => {
            const enriched = resultsMap.get(origProv.id) || origProv;
            const statusInfo = statusesMap.get(origProv.id) || {
              status: "idle",
              savedInDb: Boolean(origProv.guardado),
              newEmails: 0,
            };
            const isSavingThis = savingIndividualIds.has(origProv.id);
            const allEmails = Array.from(
              new Set([
                ...(Array.isArray(enriched.emails) ? enriched.emails : []),
                ...(enriched.email ? [enriched.email] : [])
              ].filter(Boolean))
            );

            return (
              <div
                key={origProv.id}
                className={`p-4 rounded-2xl border transition-all ${
                  statusInfo.status === "completed"
                    ? "bg-[#0c1322] border-blue-500/30 shadow-md"
                    : statusInfo.status === "searching"
                    ? "bg-blue-950/20 border-blue-500/40 animate-pulse"
                    : statusInfo.status === "error"
                    ? "bg-rose-950/20 border-rose-500/30"
                    : "bg-[#0b101c]/70 border-white/[0.06]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  
                  {/* Left: Supplier Info */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-base text-white tracking-tight">
                        {enriched.nombre}
                      </span>

                      {/* Status Badge */}
                      {statusInfo.status === "idle" && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          Pendiente
                        </span>
                      )}
                      {statusInfo.status === "searching" && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Rastreando web...</span>
                        </span>
                      )}
                      {statusInfo.status === "completed" && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Completado</span>
                        </span>
                      )}
                      {statusInfo.status === "error" && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          <span>Error</span>
                        </span>
                      )}

                      {/* Saved in DB Indicator */}
                      {statusInfo.savedInDb ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Database className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Guardado en BD</span>
                        </span>
                      ) : statusInfo.status === "completed" ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          En vista (Sin guardar en BD)
                        </span>
                      ) : null}

                      {/* Rubro */}
                      {enriched.rubro && (
                        <span className="text-[11px] text-slate-400">
                          • {enriched.rubro}
                        </span>
                      )}
                    </div>

                    {/* Discovered details chips */}
                    <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
                      {/* Emails */}
                      {allEmails.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {allEmails.map((email) => (
                            <div
                              key={email}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-mono transition-colors"
                            >
                              <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                              <a href={`mailto:${email}`} className="hover:underline">
                                {email}
                              </a>
                              <button
                                onClick={() => copyToClipboard(email)}
                                className="ml-0.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                title="Copiar correo"
                              >
                                {copiedEmail === email ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : statusInfo.status === "completed" ? (
                        <span className="text-slate-500 italic text-[11px] flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-600" /> Sin emails públicos detectados
                        </span>
                      ) : null}

                      {/* Phone */}
                      {enriched.telefono && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{enriched.telefono}</span>
                        </div>
                      )}

                      {/* Website */}
                      {enriched.sitio_web && (
                        <a
                          href={enriched.sitio_web.startsWith("http") ? enriched.sitio_web : `https://${enriched.sitio_web}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                        >
                          <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{enriched.sitio_web.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                        </a>
                      )}

                      {/* LinkedIn */}
                      {enriched.linkedin && (
                        <a
                          href={enriched.linkedin.startsWith("http") ? enriched.linkedin : `https://${enriched.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 hover:text-white text-xs transition-colors"
                        >
                          <LinkedinIcon className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>LinkedIn</span>
                          <ExternalLink className="w-2.5 h-2.5 text-blue-400/70" />
                        </a>
                      )}

                      {/* Location */}
                      {(enriched.ubicacion || enriched.zona) && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          📍 {enriched.ubicacion || enriched.zona}
                        </span>
                      )}
                    </div>

                    {/* Work description preview */}
                    {enriched.descripcion_trabajos && (
                      <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04] leading-relaxed">
                        {enriched.descripcion_trabajos}
                      </p>
                    )}
                  </div>

                  {/* Right: Individual Save Button */}
                  <div className="flex items-center gap-2 self-start pt-1 shrink-0">
                    {statusInfo.status === "completed" && !statusInfo.savedInDb && (
                      <button
                        onClick={() => handleSaveSingle(enriched)}
                        disabled={isSavingThis}
                        className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        title="Guardar este proveedor en la base de datos MongoDB"
                      >
                        {isSavingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>Guardar</span>
                      </button>
                    )}

                    {statusInfo.savedInDb && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardado</span>
                      </span>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              {unsavedCount > 0
                ? `Hay ${unsavedCount} proveedores listos con información cargada pendientes de guardar.`
                : completedCount > 0
                ? "Todos los proveedores procesados están guardados y listos."
                : "Haz click en 'Iniciar Relleno con IA' para comenzar el proceso."}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Save Button if there are unsaved */}
            {unsavedCount > 0 && (
              <button
                onClick={handleBulkSave}
                disabled={isBulkSaving}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                title="Guardar todos los proveedores enriquecidos en la base de datos MongoDB"
              >
                {isBulkSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
                <span>Guardar Todos en Base de Datos ({unsavedCount})</span>
              </button>
            )}

            {/* Apply in View & Close */}
            <button
              onClick={handleCloseAndApply}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-600/25 ml-auto"
            >
              <span>{unsavedCount > 0 ? "Aplicar a la Vista y Cerrar" : "Cerrar"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
