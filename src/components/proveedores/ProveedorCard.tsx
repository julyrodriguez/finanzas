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
  Compass
} from "lucide-react";

interface ProveedorCardProps {
  proveedor: Proveedor;
  isSaved?: boolean;
  isSelected?: boolean;
  onToggleSave?: (proveedor: Proveedor) => void;
  onToggleSelect?: (proveedor: Proveedor) => void;
  onDraftEmail?: (proveedor: Proveedor) => void;
}

export function ProveedorCard({
  proveedor,
  isSaved = false,
  isSelected = false,
  onToggleSave,
  onToggleSelect,
  onDraftEmail,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Verificado
          </span>
        );
      case "media":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            En Directorio
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Web abierta
          </span>
        );
    }
  };

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-200 p-5 ${
        isSelected
          ? "bg-slate-900/90 border-blue-500/60 shadow-lg shadow-blue-500/10"
          : "bg-[#0b111e]/80 hover:bg-[#0e1627]/90 border-white/[0.08] hover:border-white/20 shadow-md hover:shadow-xl"
      }`}
    >
      <div>
        {/* Top bar: Selection checkbox, Name & Actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(proveedor)}
                className="mt-1 w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-500"
                title="Seleccionar para cotización masiva"
              />
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                  {proveedor.nombre}
                  {proveedor.sitio_web && (
                    <a
                      href={proveedor.sitio_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-400 transition-colors"
                      title="Visitar sitio web oficial"
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline" />
                    </a>
                  )}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-blue-300 font-medium bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  <Briefcase className="w-3 h-3 text-blue-400" />
                  {proveedor.rubro}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {proveedor.zona}
                </span>
                {getReliabilityBadge(proveedor.confiabilidad)}
              </div>
            </div>
          </div>

          {/* Bookmark save toggle */}
          {onToggleSave && (
            <button
              onClick={() => onToggleSave(proveedor)}
              className={`p-2 rounded-xl border transition-all ${
                isSaved
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
              title={isSaved ? "Quitar de guardados" : "Guardar en favoritos"}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Informacion de sus trabajos / servicios */}
        <div className="mt-3.5 bg-slate-950/40 rounded-xl p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Trabajos & Capacidad Técnica</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {proveedor.descripcion_trabajos || "Servicios generales en el rubro."}
          </p>
        </div>

        {/* Con quién trabajó / Clientes */}
        <div className="mt-2.5 bg-slate-950/40 rounded-xl p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Con quién trabajó / Clientes & Referencias</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {proveedor.clientes_proyectos || "Cartera comercial y clientes corporativos de la región."}
          </p>
        </div>

        {/* Fuente de origen explícita */}
        {proveedor.fuente && (
          <div className="mt-2.5 bg-slate-950/70 rounded-xl px-3 py-2 border border-cyan-500/15 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-300">Fuente:</span>
              <span className="text-cyan-300 font-medium">
                {proveedor.fuente_nombre || "Rastreo Web"}
              </span>
            </div>
            <a
              href={proveedor.fuente}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-mono transition-colors"
              title="Abrir URL exacta de origen"
            >
              <span>Ver Origen</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Contact Channels & Action Footer */}
      <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Email button */}
          {proveedor.email ? (
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors group">
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
                className="text-slate-400 hover:text-white ml-1 p-0.5 rounded transition-colors"
                title="Copiar email"
              >
                {copiedEmail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <a
                href={`tel:${proveedor.telefono.replace(/\s+/g, "")}`}
                className="font-mono text-[11px] hover:underline"
              >
                {proveedor.telefono}
              </a>
              <button
                onClick={() => copyToClipboard(proveedor.telefono!, "phone")}
                className="text-slate-400 hover:text-white ml-1 p-0.5 rounded transition-colors"
                title="Copiar teléfono"
              >
                {copiedPhone ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Website link */}
          {proveedor.sitio_web && (
            <a
              href={proveedor.sitio_web}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Sitio Web</span>
            </a>
          )}
        </div>

        {/* Primary CTA */}
        {onDraftEmail && proveedor.email && (
          <button
            onClick={() => onDraftEmail(proveedor)}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Redactar Solicitud de Cotización</span>
          </button>
        )}
      </div>
    </div>
  );
}
