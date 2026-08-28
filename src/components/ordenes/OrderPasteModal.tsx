"use client";

import React from "react";
import { Link2, X, Loader2 } from "lucide-react";

interface OrderPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  pasteText: string;
  setPasteText: (val: string) => void;
  processingPaste: boolean;
  onProcessPaste: (e: React.FormEvent) => void;
}

export function OrderPasteModal({
  isOpen,
  onClose,
  pasteText,
  setPasteText,
  processingPaste,
  onProcessPaste,
}: OrderPasteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d131f] p-6 shadow-2xl space-y-4 my-auto">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-400" />
            Vincular Enlace desde Texto de OC
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Pega el texto copiado de la orden de compra (que incluya el número de OC y el link de SharePoint al final). El sistema vinculará el link a la orden correspondiente, o la creará si aún no existe.
        </p>

        <form onSubmit={onProcessPaste} className="space-y-4">
          <div>
            <textarea
              rows={8}
              required
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`OC 12783 Hoyts\nProveedor: Electroclamar\nMonto: $ 7.772.661\nDetalle: Capex reparaciones HVAC Moron\nForma de Pago: 30DFF Y 60% ANTICIPO\nhttps://tuempresa.sharepoint.com/...`}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:border-emerald-500/50 resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processingPaste}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              {processingPaste ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Vincular / Crear</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
