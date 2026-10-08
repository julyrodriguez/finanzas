"use client";

import React, { useState, useEffect } from "react";
import { Proveedor } from "@/types/proveedor";
import { 
  X, 
  Mail, 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  Loader2, 
  ExternalLink,
  Users
} from "lucide-react";

interface ProveedorDraftEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProveedores: Proveedor[];
}

export function ProveedorDraftEmailModal({
  isOpen,
  onClose,
  selectedProveedores,
}: ProveedorDraftEmailModalProps) {
  const [solicitud, setSolicitud] = useState(
    "Solicitamos cotización para servicio y mantenimiento con desglose de precios, disponibilidad horaria y condiciones de contratación."
  );
  const [complejo, setComplejo] = useState("Cinemark & Hoyts Argentina");
  const [fechaLimite, setFechaLimite] = useState("Próximos 3 días hábiles");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  const recipientEmails = selectedProveedores.map((p) => p.email).filter(Boolean);

  const generateDraft = async () => {
    if (selectedProveedores.length === 0) return;
    setIsGenerating(true);

    try {
      const res = await fetch("/api/proveedores/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedores: selectedProveedores,
          solicitud,
          complejo,
          fechaLimite,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubject(data.subject);
        setBody(data.body);
      }
    } catch (err) {
      console.error("Error al generar borrador:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedProveedores.length > 0 && !body) {
      generateDraft();
    }
  }, [isOpen, selectedProveedores]);

  if (!isOpen) return null;

  const handleCopyBody = () => {
    navigator.clipboard.writeText(`${subject}\n\n${body}`);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyEmails = () => {
    navigator.clipboard.writeText(recipientEmails.join(", "));
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);
  };

  const mailtoHref = `mailto:${encodeURIComponent(recipientEmails.join(","))}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0b111e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.08] bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Redactor de Solicitud de Cotización (RFP)
              </h2>
              <p className="text-xs text-slate-400">
                Generá un correo formal personalizado para solicitar presupuestos a los proveedores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Destinatarios */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Destinatarios seleccionados ({recipientEmails.length})
              </span>
              {recipientEmails.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyEmails}
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  {copiedEmails ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copiar todos los correos</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800 max-h-24 overflow-y-auto">
              {selectedProveedores.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-200"
                >
                  <span className="font-semibold text-white">{p.nombre}</span>
                  {p.email ? (
                    <span className="text-slate-400 font-mono text-[11px]">({p.email})</span>
                  ) : (
                    <span className="text-amber-400 text-[10px]">(sin email)</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Ajustes de solicitud */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400">Complejo o Área Destino</label>
              <input
                type="text"
                value={complejo}
                onChange={(e) => setComplejo(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">Fecha Límite de Respuesta</label>
              <input
                type="text"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Detalle del requerimiento técnico</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={solicitud}
                onChange={(e) => setSolicitud(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={generateDraft}
                disabled={isGenerating}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Regenerar con IA"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Regenerar</span>
              </button>
            </div>
          </div>

          {/* Asunto y Cuerpo */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div>
              <label className="text-xs font-bold text-slate-300">Asunto del Correo</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-medium text-xs sm:text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300">Cuerpo del Mensaje</label>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full mt-1 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 text-xs sm:text-sm focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyBody}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition-colors border border-slate-700"
            >
              {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copiar Texto Completo</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={mailtoHref}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir en Cliente de Correo</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
