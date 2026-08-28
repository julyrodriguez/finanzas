"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  X, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  ShieldCheck, 
  DollarSign, 
  Users,
  Sparkles
} from "lucide-react";
import { 
  ApprovalConfig, 
  DEFAULT_APPROVAL_CONFIG, 
  getStoredApprovalConfig, 
  saveStoredApprovalConfig 
} from "@/lib/approvalConfig";

interface ApprovalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: ApprovalConfig) => void;
  showToast?: (message: string) => void;
}

export function ApprovalConfigModal({
  isOpen,
  onClose,
  onConfigSaved,
  showToast,
}: ApprovalConfigModalProps) {
  const [config, setConfig] = useState<ApprovalConfig>(DEFAULT_APPROVAL_CONFIG);
  const [newAreaSigner, setNewAreaSigner] = useState("");

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredApprovalConfig());
      setNewAreaSigner("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddAreaSigner = () => {
    const trimmed = newAreaSigner.trim();
    if (!trimmed) return;
    if (config.firmantesAreaNivel1.includes(trimmed)) return;
    setConfig((prev) => ({
      ...prev,
      firmantesAreaNivel1: [...prev.firmantesAreaNivel1, trimmed],
    }));
    setNewAreaSigner("");
  };

  const handleRemoveAreaSigner = (name: string) => {
    setConfig((prev) => ({
      ...prev,
      firmantesAreaNivel1: prev.firmantesAreaNivel1.filter((s) => s !== name),
    }));
  };

  const handleResetDefaults = () => {
    if (confirm("¿Restablecer los límites y firmadores a los valores por defecto?")) {
      setConfig(DEFAULT_APPROVAL_CONFIG);
    }
  };

  const handleSave = () => {
    saveStoredApprovalConfig(config);
    if (onConfigSaved) onConfigSaved(config);
    if (showToast) showToast("⚙️ Configuración de aprobaciones guardada con éxito");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0e1322] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0b0f19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Configuración de Firmas y Límites de Aprobación
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta los topes de monto y los firmadores autorizados para la liberación inteligente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Límites de Montos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Topes y Límites de Monto</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Límite Nivel 1 */}
              <div className="p-3.5 rounded-xl bg-[#080c16] border border-slate-800 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Límite Nivel 1 (Tomás + Área)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">$</span>
                  <input
                    type="number"
                    value={config.limiteNivel1}
                    onChange={(e) => setConfig({ ...config, limiteNivel1: Math.max(0, Number(e.target.value)) })}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white font-mono text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Hasta este importe, se aprueba con Tomás (auto al mandar) y 1 firma de área.
                </p>
              </div>

              {/* Límite Nivel 2 */}
              <div className="p-3.5 rounded-xl bg-[#080c16] border border-slate-800 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Límite Nivel 2 (Mondelo + Darío)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">$</span>
                  <input
                    type="number"
                    value={config.limiteNivel2}
                    onChange={(e) => setConfig({ ...config, limiteNivel2: Math.max(0, Number(e.target.value)) })}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white font-mono text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Entre Nivel 1 y este tope, se requiere firma de Pablo Mondelo y Darío.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Firmadores Nivel 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Firmadores Nivel 1 (Hasta ${config.limiteNivel1.toLocaleString("es-AR")})</span>
            </div>

            <div className="p-4 rounded-xl bg-[#080c16] border border-slate-800 space-y-3">
              {/* Firmante Base Automático */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Firma 1 Automática al Mandar:
                </label>
                <input
                  type="text"
                  value={config.firmanteBaseNivel1}
                  onChange={(e) => setConfig({ ...config, firmanteBaseNivel1: e.target.value })}
                  placeholder="ej: Tomas"
                  className="w-full px-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500">
                  Al cambiar una orden a estado &quot;Mandada&quot; con monto ≤ ${config.limiteNivel1.toLocaleString("es-AR")}, asumirá automáticamente la firma de este responsable.
                </p>
              </div>

              {/* Firmantes de Área (Segunda Firma) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300">
                  Firmantes de Área Habilitados (Firma 2):
                </label>

                <div className="flex flex-wrap gap-2">
                  {config.firmantesAreaNivel1.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAreaSigner(name)}
                        className="text-indigo-400 hover:text-red-400 transition-colors p-0.5"
                        title={`Quitar a ${name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Agregar nuevo firmante de área */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newAreaSigner}
                    onChange={(e) => setNewAreaSigner(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAreaSigner();
                      }
                    }}
                    placeholder="Nuevo firmante de área (ej: Juan Pérez)..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddAreaSigner}
                    disabled={!newAreaSigner.trim()}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Firmadores Nivel 2 (Mayor monto) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Firmadores Nivel 2 (De ${config.limiteNivel1.toLocaleString("es-AR")} a ${config.limiteNivel2.toLocaleString("es-AR")})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#080c16] border border-slate-800">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Firma 1 Requerida:
                </label>
                <input
                  type="text"
                  value={config.firmante1Nivel2}
                  onChange={(e) => setConfig({ ...config, firmante1Nivel2: e.target.value })}
                  placeholder="ej: Pablo Mondelo"
                  className="w-full px-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Firma 2 Requerida:
                </label>
                <input
                  type="text"
                  value={config.firmante2Nivel2}
                  onChange={(e) => setConfig({ ...config, firmante2Nivel2: e.target.value })}
                  placeholder="ej: Dario"
                  className="w-full px-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0b0f19] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Restablecer valores por defecto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Por Defecto</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
