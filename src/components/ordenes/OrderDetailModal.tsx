"use client";

import React, { useMemo } from "react";
import { 
  X, 
  Eye, 
  FileText, 
  User as UserIcon, 
  Clock, 
  SendHorizontal, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Building2, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  ExternalLink, 
  Copy, 
  Edit3, 
  MessageSquare, 
  Check 
} from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";
import { getStoredApprovalConfig } from "@/lib/approvalConfig";

interface OrderDetailModalProps {
  orden: OrdenCompra | null;
  onClose: () => void;
  isOrdenesUser?: boolean;
  onEdit?: (orden: OrdenCompra) => void;
  newNotaText: string;
  setNewNotaText: (val: string) => void;
  savingNota: boolean;
  onAddNota: (e: React.FormEvent) => void;
  showToast?: (message: string) => void;
  getFormattedCreatedAt?: (orden: OrdenCompra | null) => string;
}

export function OrderDetailModal({
  orden,
  onClose,
  isOrdenesUser,
  onEdit,
  newNotaText,
  setNewNotaText,
  savingNota,
  onAddNota,
  showToast,
  getFormattedCreatedAt,
}: OrderDetailModalProps) {
  const config = useMemo(() => getStoredApprovalConfig(), []);

  if (!orden) return null;

  const numMonto = typeof orden.monto === "number" 
    ? orden.monto 
    : Number(String(orden.monto).replace(/[^0-9.-]+/g, "")) || 0;

  const tierInfo = useMemo(() => {
    if (numMonto <= config.limiteNivel1) {
      return {
        tierName: "Nivel 1 (Hasta $5.000.000)",
        f1Label: "Firma 1 (Base): Tomás",
        f2Label: `Firma 2 (Área): ${config.firmantes2Nivel1.join(", ")}`,
        isF1Signed: Boolean(orden.firmado1 || (orden.mandada && numMonto <= config.limiteNivel1)),
        f1Signer: orden.firmante1 || (orden.mandada ? "Tomas" : "Pendiente"),
        isF2Signed: Boolean(orden.firmado2),
        f2Signer: orden.firmante2 || "Pendiente de Área",
      };
    } else if (numMonto > config.limiteNivel1 && numMonto <= config.limiteNivel2) {
      return {
        tierName: "Nivel 2 (De $5M a $18.000.000)",
        f1Label: `Firma 1: ${config.firmantes1Nivel2.join(", ")}`,
        f2Label: `Firma 2: ${config.firmantes2Nivel2.join(", ")}`,
        isF1Signed: Boolean(orden.firmado1),
        f1Signer: orden.firmante1 || "Pendiente de P. Mondelo",
        isF2Signed: Boolean(orden.firmado2),
        f2Signer: orden.firmante2 || "Pendiente de Darío",
      };
    } else if (numMonto > config.limiteNivel2 && numMonto <= config.limiteNivel3) {
      return {
        tierName: "Nivel 3 (De $18M a $150.000.000)",
        f1Label: `Firma 1: ${config.firmantes1Nivel3.join(" / ")}`,
        f2Label: `Firma 2: ${config.firmantes2Nivel3.join(", ")}`,
        isF1Signed: Boolean(orden.firmado1),
        f1Signer: orden.firmante1 || "Pendiente de Matías/Hernán",
        isF2Signed: Boolean(orden.firmado2),
        f2Signer: orden.firmante2 || "Pendiente de Darío",
      };
    } else {
      return {
        tierName: "Nivel 4 (Más de $150.000.000)",
        f1Label: `Firma 1: ${config.firmantes1Nivel4.join(" / ")}`,
        f2Label: `Firma 2: ${config.firmantes2Nivel4.join(", ")}`,
        isF1Signed: Boolean(orden.firmado1),
        f1Signer: orden.firmante1 || "Pendiente de Darío/Hernán",
        isF2Signed: Boolean(orden.firmado2),
        f2Signer: orden.firmante2 || "Pendiente de Martín",
      };
    }
  }, [numMonto, config, orden]);

  const handleCopySummary = () => {
    const summary = `OC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: $ ${Number(orden.monto).toLocaleString("es-AR")}
Forma de Pago: ${orden.formaPago || "30DFF"}
Motivo: ${orden.motivo || "Sin motivo"}
Estado: ${orden.liberada ? "Liberada" : orden.mandada ? "Mandada" : "Pendiente"}`;

    navigator.clipboard.writeText(summary);
    if (showToast) showToast(`📋 Resumen de OC ${orden.numOC} copiado al portapapeles`);
  };

  const getStatusBadge = () => {
    if (orden.cancelada) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          Cancelada
        </span>
      );
    }
    if (orden.entregada) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          Entregada
        </span>
      );
    }
    if (orden.liberada) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Liberada (100%)
        </span>
      );
    }
    if (orden.mandada) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Mandada (En Proceso)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-500/15 border border-slate-500/30 text-slate-300 font-bold text-xs">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        Pendiente
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl bg-[#0e1322] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0b0f19]">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-xl text-xs font-bold font-mono tracking-wider border shadow-sm ${
                orden.empresa === "Hoyts"
                  ? "bg-purple-950/80 text-purple-300 border-purple-700/60"
                  : "bg-teal-950/80 text-teal-300 border-teal-700/60"
              }`}
            >
              {orden.empresa}
            </span>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white font-mono tracking-tight">
                  OC: {orden.numOC}
                </h3>
                {orden.numSolicitud && (
                  <span className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                    Sol: {orden.numSolicitud}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Tarjeta Principal de Proveedor y Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-[#080c16] border border-slate-800 space-y-1 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Proveedor / Razón Social
              </span>
              <div className="text-base font-bold text-white tracking-tight truncate">
                {orden.razonSocial}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-500" />
                  {orden.formaPago || "30DFF"}
                </span>
                {orden.creadoPor && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-slate-500" />
                    Creado por {orden.creadoPor}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                Monto Total
              </span>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                {typeof orden.monto === "number"
                  ? `$ ${orden.monto.toLocaleString("es-AR")}`
                  : orden.monto}
              </div>
            </div>
          </div>

          {/* Motivo y Descripción Completa */}
          <div className="p-4 rounded-2xl bg-[#080c16] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                Descripción / Motivo de Compra
              </span>
              {orden.linkSharepoint && (
                <a
                  href={orden.linkSharepoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-600 text-[11px] font-semibold transition-all"
                >
                  <span>Abrir SharePoint</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <p className="text-slate-200 text-xs font-medium leading-relaxed whitespace-pre-wrap bg-[#111726]/60 p-3.5 rounded-xl border border-slate-800/80">
              {orden.motivo || "Sin descripción o motivo registrado."}
            </p>
          </div>

          {/* Sección de Firmas y Aprobaciones */}
          <div className="p-4 rounded-2xl bg-[#080c16] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Estado de Firmas y Aprobación ({tierInfo.tierName})
              </span>
              <span className="text-[10.5px] font-semibold text-slate-400">
                {orden.liberada ? "🟢 Doble Firma Completa" : tierInfo.isF1Signed || tierInfo.isF2Signed ? "🟡 1 Firma Registrada" : "⚪ Pendiente de Firmas"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Firma 1 Card */}
              <div className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                tierInfo.isF1Signed 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-[#111726]/60 border-slate-800"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 text-xs">{tierInfo.f1Label}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                    tierInfo.isF1Signed 
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                      : "bg-white/5 text-slate-400 border border-white/10"
                  }`}>
                    {tierInfo.isF1Signed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {tierInfo.isF1Signed ? "Firmado" : "Pendiente"}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white">
                  Firmante: <span className={tierInfo.isF1Signed ? "text-emerald-400" : "text-slate-400"}>{tierInfo.f1Signer}</span>
                </div>
                {orden.fechaFirma1 && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(orden.fechaFirma1).toLocaleString("es-AR")}
                  </div>
                )}
              </div>

              {/* Firma 2 Card */}
              <div className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                tierInfo.isF2Signed 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-[#111726]/60 border-slate-800"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 text-xs">{tierInfo.f2Label}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                    tierInfo.isF2Signed 
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                      : "bg-white/5 text-slate-400 border border-white/10"
                  }`}>
                    {tierInfo.isF2Signed ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {tierInfo.isF2Signed ? "Firmado" : "Pendiente"}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white">
                  Firmante: <span className={tierInfo.isF2Signed ? "text-emerald-400" : "text-slate-400"}>{tierInfo.f2Signer}</span>
                </div>
                {orden.fechaFirma2 && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(orden.fechaFirma2).toLocaleString("es-AR")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bitácora de Notas & Comentarios */}
          <div className="p-4 rounded-2xl bg-[#080c16] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                Bitácora de Notas ({orden.notas?.length || 0})
              </span>
            </div>

            {/* Listado de Notas */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {!orden.notas || orden.notas.length === 0 ? (
                <div className="p-4 text-center bg-[#111726]/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  Aún no hay notas registradas para esta orden.
                </div>
              ) : (
                orden.notas.map((nota) => (
                  <div key={nota.id} className="p-3 rounded-xl bg-[#111726]/80 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {nota.autor}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Clock className="w-3 h-3" />
                        {nota.fecha}
                      </span>
                    </div>
                    <p className="text-slate-200 leading-relaxed font-medium">{nota.texto}</p>
                  </div>
                ))
              )}
            </div>

            {/* Formulario para agregar una nueva Nota */}
            {!isOrdenesUser && (
              <form onSubmit={onAddNota} className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={newNotaText}
                  onChange={(e) => setNewNotaText(e.target.value)}
                  placeholder="Escribir una nueva nota o comentario..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-[#111726] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  disabled={savingNota || !newNotaText.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {savingNota ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <SendHorizontal className="w-3.5 h-3.5" />
                      <span>Agregar Nota</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0b0f19] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar Resumen</span>
          </button>

          <div className="flex items-center gap-2">
            {!isOrdenesUser && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(orden);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Orden</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
