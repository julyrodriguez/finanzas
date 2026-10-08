"use client";

import React, { useState } from "react";
import { 
  X, 
  Flame, 
  Zap, 
  Code2, 
  Key, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles,
  Cpu,
  AlertTriangle
} from "lucide-react";

interface ProveedorSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  firecrawlApiKey: string;
  geminiApiKey: string;
  onSaveFirecrawlApiKey: (key: string) => void;
  onSaveGeminiApiKey: (key: string) => void;
}

export function ProveedorSkillsModal({
  isOpen,
  onClose,
  firecrawlApiKey,
  geminiApiKey,
  onSaveFirecrawlApiKey,
  onSaveGeminiApiKey,
}: ProveedorSkillsModalProps) {
  const [fcKeyInput, setFcKeyInput] = useState(firecrawlApiKey);
  const [gemKeyInput, setGemKeyInput] = useState(geminiApiKey);
  const [isSavedFc, setIsSavedFc] = useState(false);
  const [isSavedGem, setIsSavedGem] = useState(false);

  if (!isOpen) return null;

  const handleSaveFc = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveFirecrawlApiKey(fcKeyInput.trim());
    setIsSavedFc(true);
    setTimeout(() => setIsSavedFc(false), 2000);
  };

  const handleSaveGem = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGeminiApiKey(gemKeyInput.trim());
    setIsSavedGem(true);
    setTimeout(() => setIsSavedGem(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0b111e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.08] bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Configuración de Motores IA & Skills
              </h2>
              <p className="text-xs text-slate-400">
                Gestión de claves de Google Gemini, Firecrawl y habilidades de prospección
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

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Gemini API Key Config */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Clave Google Gemini API (Estructuración IA)</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Obtener clave gratis en Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-300">
              Gemini se encarga de sintetizar la evidencia web, los antecedentes y estructurar los campos de cada proveedor. Si Google reportó tu clave anterior como filtrada (error 403), generá una nueva gratis en Google AI Studio y pegala acá.
            </p>
            <form onSubmit={handleSaveGem} className="flex gap-2">
              <input
                type="password"
                value={gemKeyInput}
                onChange={(e) => setGemKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSavedGem ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                <span>{isSavedGem ? "Guardado" : "Guardar Clave"}</span>
              </button>
            </form>
          </div>

          {/* Firecrawl API Key Config */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-orange-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-white">Clave Firecrawl API (Opcional)</span>
              </div>
              <a
                href="https://firecrawl.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Obtener en firecrawl.dev</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-300">
              Habilita la skill de deep crawl de directorios con <code>@firecrawl/skills</code>. Si no tenés clave, el <strong>Motor Híbrido IA</strong> rastrea la web directamente sin costo.
            </p>
            <form onSubmit={handleSaveFc} className="flex gap-2">
              <input
                type="password"
                value={fcKeyInput}
                onChange={(e) => setFcKeyInput(e.target.value)}
                placeholder="fc-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSavedFc ? <Check className="w-3.5 h-3.5 text-white" /> : null}
                <span>{isSavedFc ? "Guardado" : "Guardar Clave"}</span>
              </button>
            </form>
          </div>

          {/* List of Integrated Agent Skills from GitHub */}
          <div className="space-y-2.5 pt-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-slate-300" />
              <span>Skills & Metodologías de GitHub Conectadas</span>
            </h3>

            {/* Skill 1 */}
            <div className="p-3 rounded-xl bg-slate-950/40 border border-white/[0.05] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  firecrawl-lead-gen & company-directories
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Firecrawl / Skills
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Extracción estructurada de prospectos y empresas por categoría, capturando correos legítimamente accesibles.
              </p>
            </div>

            {/* Skill 2 */}
            <div className="p-3 rounded-xl bg-slate-950/40 border border-white/[0.05] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  Live Web Prospecting & Multi-Source Crawler
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Nativo • Sin costo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Rastreo en vivo de Argentina en 4 fases simultáneas con extracción de teléfonos y emails oficiales desde los portales.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
