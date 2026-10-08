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
  Sparkles
} from "lucide-react";

interface ProveedorCardProps {
  proveedor: Proveedor;
  isSaved?: boolean;
  isSelected?: boolean;
  onToggleSave?: (proveedor: Proveedor) => void;
  onToggleSelect?: (proveedor: Proveedor) => void;
  onDraftEmail?: (proveedor: Proveedor) => void;
  onInvestigate?: (proveedor: Proveedor) => void;
}

export function ProveedorCard({
  proveedor,
  isSaved = false,
  isSelected = false,
  onToggleSave,
  onToggleSelect,
  onDraftEmail,
  onInvestigate,
}: ProveedorCardProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const copyToClipboard = (text: string, type: "email" | "phone") => {
    navigator.clipboard.writeText(text);
    if (type === "email") {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
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
              <div className="pt-0.5">
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
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                  <span className="truncate">{proveedor.nombre}</span>
                  {proveedor.sitio_web && (
                    <a
                      href={proveedor.sitio_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-400 transition-colors shrink-0"
                      title="Visitar sitio web oficial"
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline" />
                    </a>
                  )}
                </h3>
              </div>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-blue-300 font-semibold bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                  <Briefcase className="w-3 h-3 text-blue-400" />
                  <span>{proveedor.rubro}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/80">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{proveedor.zona}</span>
                </span>
                {getReliabilityBadge(proveedor.confiabilidad)}
              </div>
            </div>
          </div>

          {/* Top right actions: AI investigate & Bookmark */}
          <div className="flex items-center gap-1.5 shrink-0">
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
          </div>
        </div>

        {/* Informacion de sus trabajos / servicios */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Trabajos & Capacidad Técnica</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            {proveedor.descripcion_trabajos || "Servicios generales y provisión especializada en el rubro."}
          </p>
        </div>

        {/* Con quién trabajó / Clientes */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Clientes & Referencias Detectadas</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            {proveedor.clientes_proyectos || "Cartera comercial y empresas de la zona."}
          </p>
        </div>

        {/* Fuente de origen explícita */}
        {proveedor.fuente && (
          <div className="bg-slate-950/80 rounded-xl px-3.5 py-2.5 border border-cyan-500/20 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 min-w-0 truncate">
              <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-300">Origen:</span>
              <span className="text-cyan-300 font-medium truncate">
                {proveedor.fuente_nombre || "Rastreo Web"}
              </span>
            </div>
            <a
              href={proveedor.fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-mono transition-colors shrink-0 ml-auto"
              title="Abrir URL exacta de origen"
            >
              <span>Ver Fuente</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Contact Channels & Action Footer */}
      <div className="p-5 sm:p-6 pt-3.5 border-t border-white/[0.06] bg-slate-950/30 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Email button */}
          {proveedor.email ? (
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs px-2.5 py-1.5 rounded-xl transition-colors group/mail">
              <Mail className="w-3.5 h-3.5 text-blue-400" />
              <a
                href={`mailto:${proveedor.email}`}
                className="hover:underline font-mono text-[11px]"
                title="Enviar correo"
              >
                {proveedor.email}
              </a>
              <button
                onClick={() => copyToClipboard(proveedor.email, "email")}
                className="text-slate-400 hover:text-white ml-1 p-0.5 rounded transition-transform active:scale-90 cursor-pointer"
                title="Copiar email"
              >
                {copiedEmail ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-600" />
              Email no publicado en web
            </span>
          )}

          {/* Phone button */}
          {proveedor.telefono && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1.5 rounded-xl transition-colors">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <a
                href={`tel:${proveedor.telefono.replace(/\s+/g, "")}`}
                className="font-mono text-[11px] hover:underline"
              >
                {proveedor.telefono}
              </a>
              <button
                onClick={() => copyToClipboard(proveedor.telefono!, "phone")}
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
              href={proveedor.sitio_web}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Sitio Web</span>
            </a>
          )}
        </div>

        {/* Action CTAs */}
        {(onInvestigate || (onDraftEmail && proveedor.email)) && (
          <div className="flex items-center gap-2 mt-1">
            {onInvestigate && (
              <button
                onClick={() => onInvestigate(proveedor)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/25 hover:border-blue-500/40 text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer shadow-sm shadow-blue-500/5"
                title={`Consultar antecedentes y más info de ${proveedor.nombre} con IA`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Más Info IA</span>
              </button>
            )}

            {onDraftEmail && proveedor.email && (
              <button
                onClick={() => onDraftEmail(proveedor)}
                className={`${onInvestigate ? "flex-1" : "w-full"} flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98] cursor-pointer`}
                title="Redactar correo de cotización para este proveedor"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{onInvestigate ? "Cotizar" : "Redactar Solicitud"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
