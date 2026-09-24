"use client";

import React from "react";
import { FolderPlus, Terminal, Folder, X } from "lucide-react";

interface OrderCmdBarProps {
  showCMDSection: boolean;
  selectedOCIds: string[];
  setSelectedOCIds: (ids: string[]) => void;
  cmdFolderPath: string;
  onSavePath: (path: string) => void;
  cmdCommand: string;
  onCopyCMD: () => void;
}

export function OrderCmdBar({
  showCMDSection,
  selectedOCIds,
  setSelectedOCIds,
  cmdFolderPath,
  onSavePath,
  cmdCommand,
  onCopyCMD,
}: OrderCmdBarProps) {
  if (!showCMDSection || selectedOCIds.length === 0) return null;

  return (
    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
            <FolderPlus className="w-4 h-4" />
            Generador de Carpetas para Windows (CMD)
          </h4>
          <p className="text-[10px] text-slate-400">
            Has seleccionado <strong>{selectedOCIds.length}</strong> órdenes de compra. Ejecuta este comando en la terminal CMD de Windows para crear sus carpetas automáticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedOCIds([])}
            className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-medium transition-colors cursor-pointer"
          >
            Limpiar selección
          </button>
          <button
            onClick={onCopyCMD}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white shadow-sm text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Copiar Comando CMD</span>
          </button>
        </div>
      </div>

      {/* Ruta de carpeta para el CD */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-black/25 p-2 rounded-lg border border-white/5">
        <label className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pl-1">
          <Folder className="w-3.5 h-3.5 text-blue-400" />
          Ubicación de Carpeta:
        </label>
        <div className="relative w-full">
          <input
            type="text"
            value={cmdFolderPath}
            onChange={(e) => onSavePath(e.target.value)}
            placeholder="Ej. C:\Proyectos\Facturas (se guardará automáticamente)"
            className="w-full pl-2.5 pr-7 py-1 text-[11px] rounded-md bg-black/40 border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-white outline-none transition-colors placeholder-slate-500 font-sans"
          />
          {cmdFolderPath && (
            <button
              onClick={() => onSavePath("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              title="Limpiar ubicación"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-blue-200 overflow-x-auto whitespace-pre">
        {cmdCommand}
      </div>
    </div>
  );
}
