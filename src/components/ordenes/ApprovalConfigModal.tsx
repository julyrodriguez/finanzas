"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Settings, 
  X, 
  Plus, 
  Save, 
  RotateCcw, 
  Users,
  Loader2
} from "lucide-react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
import { 
  ApprovalConfig, 
  DEFAULT_APPROVAL_CONFIG, 
  getStoredApprovalConfig, 
  saveStoredApprovalConfig,
  fetchApprovalConfigFromServer,
  saveApprovalConfigToServer
} from "@/lib/approvalConfig";

interface ApprovalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: ApprovalConfig) => void;
  showToast?: (message: string) => void;
}

interface SignerSectionBoxProps {
  label: string;
  hint: string;
  signers: string[];
  fieldKey: keyof ApprovalConfig;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onInputChange?: (fieldKey: keyof ApprovalConfig, val: string) => void;
  badgeClass: string;
}

function SignerSectionBox({
  label,
  hint,
  signers,
  fieldKey,
  onAdd,
  onRemove,
  onInputChange,
  badgeClass,
}: SignerSectionBoxProps) {
  const [inputVal, setInputVal] = useState("");

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInputVal("");
    if (onInputChange) onInputChange(fieldKey, "");
  };

  const handleChange = (val: string) => {
    setInputVal(val);
    if (onInputChange) onInputChange(fieldKey, val);
  };

  return (
    <div className="p-3 rounded-xl bg-[#111726]/70 border border-slate-800 space-y-2 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white text-xs">{label}</span>
          <span className="text-[10px] text-slate-400">({signers.length} {signers.length === 1 ? "firmante" : "firmantes"})</span>
        </div>
        <p className="text-[10.5px] text-slate-400 leading-snug">{hint}</p>

        {/* Tag pills */}
        <div className="flex flex-wrap gap-1.5 pt-1 min-h-[30px]">
          {signers.map((name) => (
            <span
              key={name}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${badgeClass}`}
            >
              <span>{name}</span>
              <button
                type="button"
                onClick={() => onRemove(name)}
                className="hover:text-red-400 transition-colors p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                title={`Quitar a ${name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {signers.length === 0 && (
            <span className="text-[11px] text-amber-400 italic py-1">Sin firmantes asignados</span>
          )}
        </div>
      </div>

      {/* Inline Add Input */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            if (inputVal.trim()) {
              handleAdd();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Nombre del firmante..."
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080c16] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs font-medium"
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={handleAdd}
          disabled={!inputVal.trim()}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar</span>
        </motion.button>
      </div>
    </div>
  );
}

import { useRef } from "react";

export function ApprovalConfigModal({
  isOpen,
  onClose,
  onConfigSaved,
  showToast,
}: ApprovalConfigModalProps) {
  const [config, setConfig] = useState<ApprovalConfig>(DEFAULT_APPROVAL_CONFIG);
  const [saving, setSaving] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  
  const configRef = useRef<ApprovalConfig>(DEFAULT_APPROVAL_CONFIG);
  const isDirtyRef = useRef(false);
  const pendingInputsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      isDirtyRef.current = false;
      pendingInputsRef.current = {};
      const initial = getStoredApprovalConfig();
      setConfig(initial);
      configRef.current = initial;
      setServerLoading(true);

      // Sincronizar inmediatamente con el servidor MongoDB
      let active = true;
      fetchApprovalConfigFromServer()
        .then((cfg) => {
          if (active && cfg) {
            setServerConnected(true);
            // Si el usuario aún no editó nada en el modal, actualizar con la data fresca del servidor
            if (!isDirtyRef.current) {
              setConfig(cfg);
              configRef.current = cfg;
            }
          }
        })
        .catch(() => {
          if (active) setServerConnected(false);
        })
        .finally(() => {
          if (active) setServerLoading(false);
        });

      return () => {
        active = false;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (fieldKey: keyof ApprovalConfig, val: string) => {
    pendingInputsRef.current[fieldKey] = val;
    if (val.trim()) {
      isDirtyRef.current = true;
    }
  };

  const handleLimitChange = (key: "limiteNivel1" | "limiteNivel2" | "limiteNivel3", val: number) => {
    isDirtyRef.current = true;
    const next = { ...configRef.current, [key]: Math.max(0, val) };
    configRef.current = next;
    setConfig(next);
  };

  const addSignerTo = (key: keyof ApprovalConfig, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    isDirtyRef.current = true;

    const currentList = Array.isArray(configRef.current[key]) ? (configRef.current[key] as string[]) : [];
    // Se permite que el mismo nombre esté en otros niveles sin restricciones.
    // Solo evitamos duplicarlo exactamente dentro de este mismo campo.
    if (currentList.some((s) => s.trim().toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    const next = {
      ...configRef.current,
      [key]: [...currentList, trimmed],
    };
    configRef.current = next;
    setConfig(next);
  };

  const removeSignerFrom = (key: keyof ApprovalConfig, name: string) => {
    isDirtyRef.current = true;
    const currentList = Array.isArray(configRef.current[key]) ? (configRef.current[key] as string[]) : [];
    const next = {
      ...configRef.current,
      [key]: currentList.filter((s) => s.trim().toLowerCase() !== name.trim().toLowerCase()),
    };
    configRef.current = next;
    setConfig(next);
  };

  const handleResetDefaults = () => {
    if (confirm("¿Restablecer todas las escalas y firmadores a los valores por defecto?")) {
      isDirtyRef.current = true;
      configRef.current = DEFAULT_APPROVAL_CONFIG;
      setConfig(DEFAULT_APPROVAL_CONFIG);
    }
  };

  const handleClose = () => {
    const hasPending = Object.values(pendingInputsRef.current).some((v) => v && v.trim());
    if (isDirtyRef.current || hasPending) {
      if (confirm("Tenés cambios pendientes en los firmantes. ¿Deseas guardarlos antes de salir?")) {
        handleSave();
        return;
      }
    }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);

    // 1. Integrar inmediatamente cualquier firmante pendiente en los inputs sin hacer clic en "+ Agregar"
    let updatedConfig = { ...configRef.current };
    for (const [key, text] of Object.entries(pendingInputsRef.current)) {
      const trimmed = (text || "").trim();
      if (trimmed) {
        const fieldKey = key as keyof ApprovalConfig;
        const currentList = Array.isArray(updatedConfig[fieldKey])
          ? (updatedConfig[fieldKey] as string[])
          : [];
        if (!currentList.some((s) => s.trim().toLowerCase() === trimmed.toLowerCase())) {
          updatedConfig = {
            ...updatedConfig,
            [fieldKey]: [...currentList, trimmed],
          };
        }
      }
    }

    configRef.current = updatedConfig;
    setConfig(updatedConfig);
    pendingInputsRef.current = {};
    isDirtyRef.current = false;

    // 2. Guardar en el servidor MongoDB
    const ok = await saveApprovalConfigToServer(updatedConfig);
    setSaving(false);
    if (onConfigSaved) onConfigSaved(updatedConfig);
    if (showToast) {
      showToast(ok 
        ? "✅ Firmantes y escalas guardados en el servidor MongoDB" 
        : "⚠️ Guardado localmente (aviso: no se pudo sincronizar con el servidor MongoDB)"
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="relative w-full max-w-4xl rounded-2xl bg-[#0e1322] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0b0f19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Configurar Firmantes y Escalas de Aprobación
                </h3>
                {serverLoading ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    <span>Conectando con MongoDB...</span>
                  </span>
                ) : serverConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10.5px] text-emerald-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Servidor MongoDB conectado</span>
                  </span>
                ) : serverConnected === false ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-400 font-semibold">
                    <span>Modo local</span>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400">
                Agrega o quita firmantes habilitados para cada firma en los 4 niveles
              </p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* NIVEL 1: Hasta 5 Millones */}
          <div className="p-4 rounded-xl bg-[#080c16] border border-slate-800 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold font-mono text-[10px] border border-emerald-500/30">NIVEL 1</span>
                <h4 className="font-bold text-white text-sm">Hasta ${config.limiteNivel1.toLocaleString("es-AR")}</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Tope Nivel 1:</span>
                <span className="text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  value={config.limiteNivel1}
                  onChange={(e) => handleLimitChange("limiteNivel1", Number(e.target.value))}
                  className="w-32 px-2.5 py-1 rounded-lg bg-[#111726] border border-slate-700 text-white font-mono font-bold text-right focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <SignerSectionBox
                label="Firma 1 (Automática al pasar a Mandada)"
                hint="Se asume aprobada automáticamente si la orden está mandada y dentro del tope."
                signers={config.firmantes1Nivel1}
                fieldKey="firmantes1Nivel1"
                onAdd={(name) => addSignerTo("firmantes1Nivel1", name)}
                onRemove={(name) => removeSignerFrom("firmantes1Nivel1", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              />

              <SignerSectionBox
                label="Firma 2 (Responsables de Área)"
                hint="Al pegar la autorización de cualquiera de estas personas, la orden queda 100% liberada."
                signers={config.firmantes2Nivel1}
                fieldKey="firmantes2Nivel1"
                onAdd={(name) => addSignerTo("firmantes2Nivel1", name)}
                onRemove={(name) => removeSignerFrom("firmantes2Nivel1", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
              />
            </div>
          </div>

          {/* NIVEL 2: De 5M a 18M */}
          <div className="p-4 rounded-xl bg-[#080c16] border border-slate-800 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold font-mono text-[10px] border border-purple-500/30">NIVEL 2</span>
                <h4 className="font-bold text-white text-sm">
                  De ${config.limiteNivel1.toLocaleString("es-AR")} a ${config.limiteNivel2.toLocaleString("es-AR")}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Tope Nivel 2:</span>
                <span className="text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  value={config.limiteNivel2}
                  onChange={(e) => handleLimitChange("limiteNivel2", Number(e.target.value))}
                  className="w-32 px-2.5 py-1 rounded-lg bg-[#111726] border border-slate-700 text-white font-mono font-bold text-right focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <SignerSectionBox
                label="Firma 1 Requerida"
                hint="Debe mandar confirmación expresa de autorización."
                signers={config.firmantes1Nivel2}
                fieldKey="firmantes1Nivel2"
                onAdd={(name) => addSignerTo("firmantes1Nivel2", name)}
                onRemove={(name) => removeSignerFrom("firmantes1Nivel2", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-purple-500/15 border-purple-500/30 text-purple-300"
              />

              <SignerSectionBox
                label="Firma 2 Requerida"
                hint="Segunda firma obligatoria para completar la liberación."
                signers={config.firmantes2Nivel2}
                fieldKey="firmantes2Nivel2"
                onAdd={(name) => addSignerTo("firmantes2Nivel2", name)}
                onRemove={(name) => removeSignerFrom("firmantes2Nivel2", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-purple-500/15 border-purple-500/30 text-purple-300"
              />
            </div>
          </div>

          {/* NIVEL 3: De 18M a 150M */}
          <div className="p-4 rounded-xl bg-[#080c16] border border-slate-800 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold font-mono text-[10px] border border-blue-500/30">NIVEL 3</span>
                <h4 className="font-bold text-white text-sm">
                  De ${config.limiteNivel2.toLocaleString("es-AR")} a ${config.limiteNivel3.toLocaleString("es-AR")}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Tope Nivel 3:</span>
                <span className="text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  value={config.limiteNivel3}
                  onChange={(e) => handleLimitChange("limiteNivel3", Number(e.target.value))}
                  className="w-36 px-2.5 py-1 rounded-lg bg-[#111726] border border-slate-700 text-white font-mono font-bold text-right focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <SignerSectionBox
                label="Firma 1 Habilitados"
                hint="Cualquiera de ellos puede autorizar en 1ra instancia."
                signers={config.firmantes1Nivel3}
                fieldKey="firmantes1Nivel3"
                onAdd={(name) => addSignerTo("firmantes1Nivel3", name)}
                onRemove={(name) => removeSignerFrom("firmantes1Nivel3", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-blue-500/15 border-blue-500/30 text-blue-300"
              />

              <SignerSectionBox
                label="Firma 2 Habilitados"
                hint="Segunda firma requerida para completar la liberación."
                signers={config.firmantes2Nivel3}
                fieldKey="firmantes2Nivel3"
                onAdd={(name) => addSignerTo("firmantes2Nivel3", name)}
                onRemove={(name) => removeSignerFrom("firmantes2Nivel3", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-blue-500/15 border-blue-500/30 text-blue-300"
              />
            </div>
          </div>

          {/* NIVEL 4: Más de 150 Millones */}
          <div className="p-4 rounded-xl bg-[#080c16] border border-slate-800 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold font-mono text-[10px] border border-amber-500/30">NIVEL 4</span>
                <h4 className="font-bold text-white text-sm">
                  Más de ${config.limiteNivel3.toLocaleString("es-AR")}
                </h4>
              </div>
              <span className="text-[11px] text-amber-400 font-semibold">Directorio / Presidencia</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <SignerSectionBox
                label="Firma 1 Habilitados"
                hint="Cualquiera de ellos puede autorizar en 1ra instancia."
                signers={config.firmantes1Nivel4}
                fieldKey="firmantes1Nivel4"
                onAdd={(name) => addSignerTo("firmantes1Nivel4", name)}
                onRemove={(name) => removeSignerFrom("firmantes1Nivel4", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-amber-500/15 border-amber-500/30 text-amber-300"
              />

              <SignerSectionBox
                label="Firma 2 Habilitados"
                hint="Segunda firma requerida para montos máximos."
                signers={config.firmantes2Nivel4}
                fieldKey="firmantes2Nivel4"
                onAdd={(name) => addSignerTo("firmantes2Nivel4", name)}
                onRemove={(name) => removeSignerFrom("firmantes2Nivel4", name)}
                onInputChange={handleInputChange}
                badgeClass="bg-amber-500/15 border-amber-500/30 text-amber-300"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0b0f19] flex items-center justify-between gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Restablecer escalas por defecto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Por Defecto</span>
          </motion.button>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? "Guardando en Servidor..." : "Guardar Firmantes"}</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
