"use client";

import React, { useState } from "react";
import { Proveedor } from "@/types/proveedor";
import { 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  Bookmark, 
  BookmarkCheck, 
  Copy, 
  Check, 
  Send, 
  ShieldCheck, 
  Briefcase, 
  Users, 
  ExternalLink, 
  Compass, 
  CheckCircle2, 
  Sparkles,
  FileText,
  ChevronRight,
  Trash2
} from "lucide-react";

interface ProveedorCardProps {
  proveedor: Proveedor;
  isSaved?: boolean;
  isSelected?: boolean;
  onToggleSave?: (proveedor: Proveedor) => void;
  onToggleSelect?: (proveedor: Proveedor) => void;
  onDraftEmail?: (proveedor: Proveedor) => void;
  onInvestigate?: (proveedor: Proveedor) => void;
  onOpenDetail?: (proveedor: Proveedor) => void;
  onDelete?: (proveedor: Proveedor) => void;
}

function LinkedinIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
    </svg>
  );
}

export function ProveedorCard({
  proveedor,
  isSaved = false,
  isSelected = false,
  onToggleSave,
  onToggleSelect,
  onDraftEmail,
  onInvestigate,
  onOpenDetail,
  onDelete,
}: ProveedorCardProps) {
  const [copiedAllMails, setCopiedAllMails] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Normalize all emails safely
  const allEmails = Array.from(
    new Set(
      [
        ...(Array.isArray(proveedor?.emails) ? proveedor.emails : []),
        ...(typeof proveedor?.email === "string" ? [proveedor.email] : [])
      ]
        .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter(Boolean)
    )
  );

  const copyAllEmailsToClipboard = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (allEmails.length === 0) return;
    navigator.clipboard.writeText(allEmails.join(", "));
    setCopiedAllMails(true);
    setTimeout(() => setCopiedAllMails(false), 2000);
  };

  const copyPhoneToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const getReliabilityBadge = (conf?: string) => {
    switch (conf) {
      case "alta":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/5 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Verificado</span>
          </span>
        );
      case "media":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Directorio</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20 leading-none">
            <span>Web Abierta</span>
          </span>
        );
    }
  };

  const cotizacionesCount = Array.isArray(proveedor?.cotizaciones) ? proveedor.cotizaciones.length : 0;
  const ubicacionStr = proveedor?.ubicacion || proveedor?.zona || "";

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? "bg-gradient-to-b from-blue-950/40 via-slate-900/95 to-slate-950 border-blue-500/50 shadow-xl shadow-blue-950/30 ring-1 ring-blue-500/30"
          : "bg-gradient-to-b from-[#0d1424]/95 to-[#080d18]/95 hover:from-[#111a2e]/95 hover:to-[#0a101f]/95 border-white/[0.08] hover:border-blue-500/30 shadow-lg hover:shadow-2xl hover:shadow-blue-950/20"
      }`}
    >
      {/* Subtle top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 group-hover:via-blue-500/30 to-transparent transition-colors" />

      <div className="p-5 sm:p-6 space-y-4">
        {/* Top bar: Selection checkbox, Name & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {onToggleSelect && (
              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(proveedor)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900/80 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-500 transition-all"
                  title="Seleccionar para cotización conjunta"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onOpenDetail && onOpenDetail(proveedor)}
                  className="text-left text-base sm:text-lg font-bold text-white tracking-tight hover:text-blue-300 transition-colors cursor-pointer truncate max-w-full"
                >
                  {proveedor.nombre}
                </button>
                {proveedor.sitio_web && (
                  <a
                    href={proveedor.sitio_web.startsWith("http") ? proveedor.sitio_web : `https://${proveedor.sitio_web}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-400 hover:text-blue-400 transition-colors shrink-0"
                    title="Visitar sitio web oficial"
                  >
                    <ExternalLink className="w-3.5 h-3.5 inline" />
                  </a>
                )}
                {proveedor.linkedin && (
                  <a
                    href={proveedor.linkedin.startsWith("http") ? proveedor.linkedin : `https://${proveedor.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-400 hover:text-blue-400 transition-colors shrink-0"
                    title="Perfil de LinkedIn"
                  >
                    <LinkedinIcon className="w-3.5 h-3.5 inline text-blue-400" />
                  </a>
                )}
              </div>

              {/* Tags / Badges */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {cotizacionesCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-indigo-300 font-bold bg-indigo-500/15 px-2 py-0.5 rounded-lg border border-indigo-500/30 shadow-sm" title={`Participó en ${cotizacionesCount} cotizaciones registradas`}>
                    <FileText className="w-3 h-3 text-indigo-400" />
                    <span>{cotizacionesCount} {cotizacionesCount === 1 ? 'cotización' : 'cotizaciones'}</span>
                  </span>
                )}
                {proveedor?.es_argentina !== false && (!proveedor?.pais || String(proveedor.pais).toLowerCase() === "argentina") ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/25 shadow-sm" title="Proveedor radicado en Argentina">
                    <span>🇦🇷 Argentina</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/40 shadow-sm" title={`Proveedor radicado en el exterior: ${proveedor.pais || "Exterior"}`}>
                    <span>⚠️ {proveedor.pais || "Exterior"}</span>
                  </span>
                )}
                {proveedor.rubro && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-300 font-semibold bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                    <Briefcase className="w-3 h-3 text-blue-400" />
                    <span>{proveedor.rubro}</span>
                  </span>
                )}
                {ubicacionStr && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/80">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{ubicacionStr}</span>
                  </span>
                )}
                {getReliabilityBadge(proveedor.confiabilidad)}
              </div>
            </div>
          </div>

          {/* Top right actions: AI investigate & Bookmark */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {onInvestigate && (
              <button
                onClick={() => onInvestigate(proveedor)}
                className="p-2 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all active:scale-[0.92] cursor-pointer"
                title={`Investigar ${proveedor.nombre} con IA`}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {/* Bookmark save toggle */}
            {onToggleSave && (
              <button
                onClick={() => onToggleSave(proveedor)}
                className={`p-2 rounded-xl border transition-all active:scale-[0.92] cursor-pointer shrink-0 ${
                  isSaved
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25 shadow-sm shadow-amber-500/10"
                    : "bg-slate-800/50 border-white/[0.08] text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title={isSaved ? "Quitar de guardados" : "Guardar en favoritos"}
              >
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            )}

            {/* Delete provider button */}
            {onDelete && (
              <button
                onClick={() => onDelete(proveedor)}
                className="p-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all active:scale-[0.92] cursor-pointer shrink-0"
                title={`Eliminar ${proveedor.nombre} permanentemente`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Informacion de sus trabajos / servicios */}
        {proveedor.descripcion_trabajos && (
          <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Trabajos & Capacidad Técnica</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              {proveedor.descripcion_trabajos}
            </p>
          </div>
        )}

        {/* Con quién trabajó / Clientes */}
        {proveedor.clientes_proyectos && (
          <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Clientes & Referencias Detectadas</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              {proveedor.clientes_proyectos}
            </p>
          </div>
        )}

        {/* Aliases asimilados si no hay trabajos */}
        {!proveedor.descripcion_trabajos && (proveedor.aliases || []).length > 1 && (
          <div className="bg-slate-950/40 rounded-xl p-3 border border-white/[0.04] text-xs text-slate-400">
            <span className="text-slate-500 font-semibold">Variantes en cotizaciones: </span>
            <span>{(proveedor.aliases || []).join(" • ")}</span>
          </div>
        )}
      </div>

      {/* Contact Channels & Action Footer */}
      <div className="p-5 sm:p-6 pt-3.5 border-t border-white/[0.06] bg-slate-950/30 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Email button: supports single or multiple emails */}
          {allEmails.length > 0 ? (
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs px-2.5 py-1.5 rounded-xl transition-colors group/mail">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <a
                href={`mailto:${allEmails[0]}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline font-mono text-[11px] truncate max-w-[160px]"
                title={allEmails.join(", ")}
              >
                {allEmails[0]}
                {allEmails.length > 1 && (
                  <span className="ml-1 text-[10px] bg-blue-500/20 px-1 py-0.2 rounded text-blue-200">
                    +{allEmails.length - 1}
                  </span>
                )}
              </a>
              <button
                onClick={copyAllEmailsToClipboard}
                className="text-slate-400 hover:text-white ml-1 p-0.5 rounded transition-transform active:scale-90 cursor-pointer"
                title={`Copiar todos los correos (${allEmails.length})`}
              >
                {copiedAllMails ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-600" />
              Email no registrado
            </span>
          )}

          {/* Phone button */}
          {proveedor.telefono && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1.5 rounded-xl transition-colors">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <a
                href={`tel:${proveedor.telefono.replace(/\s+/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-[11px] hover:underline"
              >
                {proveedor.telefono}
              </a>
              <button
                onClick={(e) => copyPhoneToClipboard(proveedor.telefono!, e)}
                className="text-slate-400 hover:text-white ml-1 p-0.5 rounded transition-transform active:scale-90 cursor-pointer"
                title="Copiar teléfono"
              >
                {copiedPhone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Website link */}
          {proveedor.sitio_web && (
            <a
              href={proveedor.sitio_web.startsWith("http") ? proveedor.sitio_web : `https://${proveedor.sitio_web}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Sitio Web</span>
            </a>
          )}

          {/* LinkedIn link */}
          {proveedor.linkedin && (
            <a
              href={proveedor.linkedin.startsWith("http") ? proveedor.linkedin : `https://${proveedor.linkedin}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 hover:text-white text-xs px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <LinkedinIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>LinkedIn</span>
            </a>
          )}
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 mt-1">
          {onOpenDetail && (
            <button
              onClick={() => onOpenDetail(proveedor)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer"
              title="Ver ficha completa del proveedor"
            >
              <span>Ver Ficha</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {onDraftEmail && allEmails.length > 0 && (
            <button
              onClick={() => onDraftEmail({ ...proveedor, emails: allEmails, email: allEmails[0] })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] cursor-pointer"
              title="Redactar correo de cotización para este proveedor"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Cotizar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
