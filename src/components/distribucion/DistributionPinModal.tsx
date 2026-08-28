"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";

interface DistributionPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinInput: string;
  setPinInput: (val: string) => void;
  pinError: string | null;
  onVerifyPin: (e: React.FormEvent) => void;
}

export function DistributionPinModal({
  isOpen,
  onClose,
  pinInput,
  setPinInput,
  pinError,
  onVerifyPin,
}: DistributionPinModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm p-6 rounded-3xl glass-card border border-white/10 shadow-2xl text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
          <ShieldAlert className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-1">
          <h3 className="text-white font-bold text-base">Seguridad de Datos</h3>
          <p className="text-xs text-gray-400">Ingresa el PIN de seguridad para modificar el Attendance 2026</p>
        </div>

        <form onSubmit={onVerifyPin} className="space-y-3">
          <input
            type="password"
            required
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="****"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-center text-lg focus:outline-none focus:border-emerald-500/50"
            autoFocus
          />

          {pinError && (
            <p className="text-[10px] text-red-400 font-semibold">{pinError}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
            >
              Confirmar PIN
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
