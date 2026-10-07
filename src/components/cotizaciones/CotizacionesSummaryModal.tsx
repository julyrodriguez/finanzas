"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Sparkles,
  Layers,
  MessageSquare,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CotizacionesSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryText: string;
  quoteName?: string;
  onCopySuccess?: () => void;
}

export function CotizacionesSummaryModal({
  isOpen,
  onClose,
  summaryText,
  quoteName = "",
  onCopySuccess
}: CotizacionesSummaryModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [editableText, setEditableText] = useState<string>(summaryText);

  // Sync state when summaryText changes or modal opens
  React.useEffect(() => {
    setEditableText(summaryText);
  }, [summaryText, isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editableText);
      setCopied(true);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Error al copiar resumen:", e);
    }
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(editableText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0b0f19] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Resumen Ejecutivo para WhatsApp</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Listo para compartir
                  </span>
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-md">
                  {quoteName || "Comparativa de Proveedores y Precios"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Podés editar el texto antes de copiarlo o enviarlo:</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {editableText.length} caracteres
              </span>
            </div>

            {/* Editable Preview Area */}
            <div className="relative">
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                rows={16}
                className="w-full bg-[#060810] border border-white/[0.08] focus:border-emerald-500/50 rounded-2xl p-4 font-mono text-xs text-slate-200 outline-none leading-relaxed transition-all resize-none shadow-inner"
                placeholder="Generando resumen..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#080c16] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleCopy}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "¡Copiado al Portapapeles!" : "Copiar para WhatsApp"}</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-bold text-xs transition-colors cursor-pointer"
                title="Abrir WhatsApp Web con el resumen cargado"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Abrir en WhatsApp</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
