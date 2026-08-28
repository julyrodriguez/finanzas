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
  Sparkles,
  UserCheck
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
  const [newSignerName, setNewSignerName] = useState("");
  const [newSignerLimit, setNewSignerLimit] = useState<string>("5000000");

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredApprovalConfig());
      setNewSignerName("");
      setNewSignerLimit("5000000");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateSignerLimit = (name: string, newLimit: number) => {
    setConfig((prev) => ({
      ...prev,
      limitesIndividuales: {
        ...prev.limitesIndividuales,
        [name]: Math.max(0, newLimit),
      },
    }));
  };

  const handleAddAreaSigner = () => {
    const trimmed = newSignerName.trim();
    if (!trimmed) return;
    const limitNum = Math.max(0, Number(newSignerLimit) || config.limiteNivel1);

    setConfig((prev) => {
      const exists = prev.firmantesAreaNivel1.includes(trimmed);
      return {
        ...prev,
        firmantesAreaNivel1: exists ? prev.firmantesAreaNivel1 : [...prev.firmantesAreaNivel1, trimmed],
        limitesIndividuales: {
          ...prev.limitesIndividuales,
          [trimmed]: limitNum,
        },
      };
    });

    setNewSignerName("");
    setNewSignerLimit("5000000");
  };

  const handleRemoveAreaSigner = (name: string) => {
    setConfig((prev) => {
      const newLimits = { ...prev.limitesIndividuales };
      delete newLimits[name];
      return {
        ...prev,
        firmantesAreaNivel1: prev.firmantesAreaNivel1.filter((s) => s !== name),
        limitesIndividuales: newLimits,
      };
    });
  };

  const handleResetDefaults = () => {
    if (confirm("¿Restablecer todos los firmadores y montos a los valores por defecto?")) {
      setConfig(DEFAULT_APPROVAL_CONFIG);
    }
  };

  const handleSave = () => {
    saveStoredApprovalConfig(config);
    if (onConfigSaved) onConfigSaved(config);
    if (showToast) showToast("⚙️ Montos y firmadores guardados con éxito");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0e1322] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0b0f19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Montos y Límites por Firmante
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta el monto máximo individual que cada persona tiene autorización para firmar
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
          
          {/* 1. Firmantes de Nivel 1 (Firma Base y Área) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Firmadores de Área y Base</span>
              </div>
              <span className="text-[11px] text-slate-500">Monto Máximo de Firma</span>
            </div>

            {/* Tomás (Firma 1 Automática) */}
            <div className="p-3.5 rounded-xl bg-[#080c16] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">{config.firmanteBaseNivel1}</span>
                  <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/25">
                    Firma 1 Automática al Mandar
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  Si la orden es menor o igual a este monto, asume su firma automáticamente al pasar a &quot;Mandada&quot;.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  value={config.limiteTomas}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig({ 
                      ...config, 
                      limiteTomas: val,
                      limiteNivel1: val,
                      limitesIndividuales: { ...config.limitesIndividuales, [config.firmanteBaseNivel1]: val }
                    });
                  }}
                  className="w-36 px-3 py-1.5 rounded-lg bg-[#111726] border border-slate-700/80 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
                />
              </div>
            </div>

            {/* Lista de Firmantes de Área */}
            <div className="space-y-2">
              {config.firmantesAreaNivel1.map((name) => {
                const currentLimit = config.limitesIndividuales[name] ?? config.limiteNivel1;
                return (
                  <div
                    key={name}
                    className="p-3 rounded-xl bg-[#080c16] border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-white text-xs block truncate">{name}</span>
                        <span className="text-[10px] text-slate-400">Firma 2 de Área</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        value={currentLimit}
                        onChange={(e) => handleUpdateSignerLimit(name, Number(e.target.value))}
                        className="w-36 px-3 py-1.5 rounded-lg bg-[#111726] border border-slate-700/80 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAreaSigner(name)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                        title={`Eliminar firmante ${name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Agregar nuevo firmante con su monto */}
            <div className="p-3.5 rounded-xl bg-[#111726]/60 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={newSignerName}
                onChange={(e) => setNewSignerName(e.target.value)}
                placeholder="Nombre del nuevo firmante..."
                className="flex-1 px-3 py-2 rounded-lg bg-[#080c16] border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  value={newSignerLimit}
                  onChange={(e) => setNewSignerLimit(e.target.value)}
                  placeholder="Monto límite..."
                  className="w-36 px-3 py-2 rounded-lg bg-[#080c16] border border-slate-700/80 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
                />
                <button
                  type="button"
                  onClick={handleAddAreaSigner}
                  disabled={!newSignerName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Firmantes de Montos Mayores (Nivel 2) */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Firmadores de Montos Mayores (Nivel Superior)</span>
              </div>
              <span className="text-[11px] text-slate-500">Monto Máximo de Firma</span>
            </div>

            <div className="space-y-2">
              {/* Pablo Mondelo */}
              <div className="p-3.5 rounded-xl bg-[#080c16] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{config.firmante1Nivel2}</span>
                    <span className="text-[10px] font-semibold bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/25">
                      Firma 1 Requerida (&gt; ${config.limiteTomas.toLocaleString("es-AR")})
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Debe autorizar explícitamente órdenes que superen el límite de Tomás.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={config.limiteMondelo}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setConfig({ 
                        ...config, 
                        limiteMondelo: val,
                        limiteNivel2: Math.max(val, config.limiteDario),
                        limitesIndividuales: { ...config.limitesIndividuales, [config.firmante1Nivel2]: val }
                      });
                    }}
                    className="w-36 px-3 py-1.5 rounded-lg bg-[#111726] border border-slate-700/80 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
                  />
                </div>
              </div>

              {/* Darío */}
              <div className="p-3.5 rounded-xl bg-[#080c16] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{config.firmante2Nivel2}</span>
                    <span className="text-[10px] font-semibold bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/25">
                      Firma 2 Requerida (&gt; ${config.limiteTomas.toLocaleString("es-AR")})
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Segunda firma necesaria para liberar montos mayores junto a Pablo Mondelo.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={config.limiteDario}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setConfig({ 
                        ...config, 
                        limiteDario: val,
                        limiteNivel2: Math.max(config.limiteMondelo, val),
                        limitesIndividuales: { ...config.limitesIndividuales, [config.firmante2Nivel2]: val }
                      });
                    }}
                    className="w-36 px-3 py-1.5 rounded-lg bg-[#111726] border border-slate-700/80 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
                  />
                </div>
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
              <span>Guardar Montos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
