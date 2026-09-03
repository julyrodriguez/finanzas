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
    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
            <FolderPlus className="w-4 h-4" />
            Generador de Carpetas para Windows (CMD)
          </h4>
          <p className="text-[10px] text-gray-400">
            Has seleccionado <strong>{selectedOCIds.length}</strong> órdenes de compra. Ejecuta este comando en la terminal CMD de Windows para crear sus carpetas automáticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedOCIds([])}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-[11px] font-semibold transition-all cursor-pointer"
          >
            Limpiar selección
          </button>
          <button
            onClick={onCopyCMD}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Copiar Comando CMD</span>
          </button>
        </div>
      </div>

      {/* Ruta de carpeta para el CD */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-black/20 p-2 rounded-xl border border-white/5">
        <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pl-1">
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          Ubicación de Carpeta:
        </label>
        <div className="relative w-full">
          <input
            type="text"
            value={cmdFolderPath}
            onChange={(e) => onSavePath(e.target.value)}
            placeholder="Ej. C:\Proyectos\Facturas (se guardará automáticamente)"
            className="w-full pl-3 pr-8 py-1.5 text-[11px] rounded-lg bg-black/40 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white outline-none transition-all placeholder-gray-600 font-sans"
          />
          {cmdFolderPath && (
            <button
              onClick={() => onSavePath("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Limpiar ubicación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-indigo-200 overflow-x-auto whitespace-pre">
        {cmdCommand}
      </div>
    </div>
  );
}
