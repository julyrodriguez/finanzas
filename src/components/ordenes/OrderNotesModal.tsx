"use client";

import React from "react";
import { MessageSquare, X, User as UserIcon, Clock, SendHorizontal, Loader2 } from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";

interface OrderNotesModalProps {
  orden: OrdenCompra | null;
  onClose: () => void;
  isOrdenesUser: boolean | undefined;
  newNotaText: string;
  setNewNotaText: (val: string) => void;
  savingNota: boolean;
  onAddNota: (e: React.FormEvent) => void;
}

export function OrderNotesModal({
  orden,
  onClose,
  isOrdenesUser,
  newNotaText,
  setNewNotaText,
  savingNota,
  onAddNota,
}: OrderNotesModalProps) {
  if (!orden) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md overflow-y-auto flex items-start justify-center p-4">
      <div className="w-full max-w-lg glass-card border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative space-y-5 my-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              Notas de la OC {orden.numOC} ({orden.empresa})
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Proveedor: {orden.razonSocial}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/5 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Listado de Notas Existentes */}
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {!orden.notas || orden.notas.length === 0 ? (
            <div className="p-6 text-center bg-white/5 rounded-2xl border border-white/5 text-gray-400 text-xs">
              Aún no hay notas registradas para esta orden. ¡Agrega la primera abajo!
            </div>
          ) : (
            orden.notas.map((nota) => (
              <div key={nota.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-400 text-[11px]">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {nota.autor}
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <Clock className="w-3 h-3" />
                    {nota.fecha}
                  </span>
                </div>
                <p className="text-gray-200 leading-relaxed">{nota.texto}</p>
              </div>
            ))
          )}
        </div>

        {/* Formulario para agregar una nueva Nota */}
        {!isOrdenesUser && (
          <form onSubmit={onAddNota} className="pt-3 border-t border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-gray-300">
              Agregar nueva nota
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={newNotaText}
                onChange={(e) => setNewNotaText(e.target.value)}
                placeholder="Escribe un comentario o nota sobre esta orden..."
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              <button
                type="submit"
                disabled={savingNota || !newNotaText.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingNota ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <SendHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
