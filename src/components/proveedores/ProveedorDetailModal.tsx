"use client";

import React, { useState, useEffect } from "react";
import { Proveedor } from "@/types/proveedor";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  X,
  Send,
  Plus,
  Trash2,
  Edit3,
  Save,
  FileText,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";

interface ProveedorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  proveedor: Proveedor | null;
  onSaveProveedor?: (updated: Proveedor) => Promise<void> | void;
  onDraftEmail?: (proveedor: Proveedor) => void;
  onToggleSave?: (proveedor: Proveedor) => void;
  isSaved?: boolean;
}

function LinkedinIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

export function ProveedorDetailModal({
  isOpen,
  onClose,
  proveedor,
  onSaveProveedor,
  onDraftEmail,
  onToggleSave,
  isSaved = false,
}: ProveedorDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form edit state
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [sitioWeb, setSitioWeb] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rubro, setRubro] = useState("");
  const [notas, setNotas] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState("");

  // Copy status
  const [copiedAllEmails, setCopiedAllEmails] = useState(false);
  const [copiedSingleIndex, setCopiedSingleIndex] = useState<number | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  useEffect(() => {
    if (proveedor) {
      setNombre(proveedor.nombre || "");
      setUbicacion(proveedor.ubicacion || proveedor.zona || "");
      setSitioWeb(proveedor.sitio_web || "");
      setLinkedin(proveedor.linkedin || "");
      setTelefono(proveedor.telefono || "");
      setRubro(proveedor.rubro || "");
      setNotas(proveedor.notas || "");

      // Normalize emails list: combine emails array with single email
      const emList: string[] = [];
      if (Array.isArray(proveedor.emails)) {
        proveedor.emails.forEach((e) => {
          if (typeof e === "string" && e.trim() && !emList.includes(e.trim())) emList.push(e.trim());
        });
      }
      if (typeof proveedor.email === "string" && proveedor.email.trim() && !emList.includes(proveedor.email.trim())) {
        emList.push(proveedor.email.trim());
      }
      setEmails(emList);
      setIsEditing(false);
      setNewEmailInput("");
    }
  }, [proveedor, isOpen]);

  if (!isOpen || !proveedor) return null;

  // Copy all emails
  const handleCopyAllEmails = () => {
    if (emails.length === 0) return;
    navigator.clipboard.writeText(emails.join(", "));
    setCopiedAllEmails(true);
    setTimeout(() => setCopiedAllEmails(false), 2200);
  };

  // Copy single email
  const handleCopySingleEmail = (em: string, idx: number) => {
    navigator.clipboard.writeText(em);
    setCopiedSingleIndex(idx);
    setTimeout(() => setCopiedSingleIndex(null), 2000);
  };

  // Copy phone
  const handleCopyPhone = () => {
    if (!telefono) return;
    navigator.clipboard.writeText(telefono);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Add new email
  const handleAddEmail = () => {
    const trimmed = newEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      alert("Por favor ingresá una dirección de correo válida.");
      return;
    }
    if (!emails.includes(trimmed)) {
      setEmails([...emails, trimmed]);
    }
    setNewEmailInput("");
    if (!isEditing) setIsEditing(true);
  };

  // Remove email
  const handleRemoveEmail = (idx: number) => {
    setEmails(emails.filter((_, i) => i !== idx));
    if (!isEditing) setIsEditing(true);
  };

  // Save changes
  const handleSave = async () => {
    if (!nombre.trim()) {
      alert("El nombre de la empresa no puede estar vacío.");
      return;
    }

    setIsSaving(true);
    try {
      // Include any email typed in input that wasn't submitted with plus button
      let finalEmails = [...emails];
      const pendingEmail = newEmailInput.trim().toLowerCase();
      if (pendingEmail && pendingEmail.includes("@") && pendingEmail.includes(".")) {
        if (!finalEmails.includes(pendingEmail)) {
          finalEmails.push(pendingEmail);
          setEmails(finalEmails);
          setNewEmailInput("");
        }
      }

      const updatedData: Proveedor = {
        ...proveedor,
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim(),
        zona: ubicacion.trim(),
        sitio_web: sitioWeb.trim(),
        linkedin: linkedin.trim(),
        telefono: telefono.trim(),
        rubro: rubro.trim(),
        notas: notas.trim(),
        emails: finalEmails,
        email: finalEmails[0] || "",
        guardado: true,
      };

      if (onSaveProveedor) {
        await onSaveProveedor(updatedData);
      }
      setIsEditing(false);
    } catch (e: any) {
      alert(`Error al guardar: ${e.message || e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const cotizaciones = Array.isArray(proveedor.cotizaciones) ? proveedor.cotizaciones : [];
  const aliases = Array.isArray(proveedor.aliases) ? proveedor.aliases.filter(a => a !== proveedor.nombre) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0a0f1d] border border-white/10 shadow-2xl shadow-blue-950/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-white/[0.08] bg-slate-950/60 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Ficha del Proveedor
              </span>
              {proveedor.fuente === "cotizaciones" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  Detectado en Cotizaciones
                </span>
              )}
              {isSaved && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center gap-1">
                  <BookmarkCheck className="w-3 h-3" />
                  <span>En Guardados</span>
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Razón Social / Nombre Comercial:</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full text-lg sm:text-xl font-bold text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nombre de la empresa..."
                />
              </div>
            ) : (
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{nombre}</span>
                  {sitioWeb && (
                    <a
                      href={sitioWeb.startsWith("http") ? sitioWeb : `https://${sitioWeb}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-400 transition-colors"
                      title="Visitar sitio web oficial"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                    </a>
                  )}
                </h2>

                {aliases.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Asimilado con:</span>
                    {aliases.map((al, idx) => (
                      <span key={idx} className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-white/5">
                        {al}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleSave && (
              <button
                onClick={() => onToggleSave(proveedor)}
                className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                  isSaved
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                    : "bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title={isSaved ? "Quitar de guardados" : "Guardar en favoritos"}
              >
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
            )}

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span>Editar</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-600/30 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? "Guardando..." : "Guardar"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-300">
          
          {/* Card: Datos Generales (Ubicación, Web, LinkedIn, Teléfono, Rubro) */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Información General & Canales de Contacto</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ubicación */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Ubicación / Zona de Cobertura:</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    placeholder="Ej. CABA y GBA, Argentina"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-sm font-medium text-white flex items-center gap-1.5">
                    {ubicacion ? (
                      <span>{ubicacion}</span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Sin ubicación informada</span>
                    )}
                  </div>
                )}
              </div>

              {/* Rubro */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Rubro / Especialidad:</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={rubro}
                    onChange={(e) => setRubro(e.target.value)}
                    placeholder="Ej. Informática, Bolsas, Mantenimiento..."
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-sm font-medium text-white">
                    {rubro ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs">
                        {rubro}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Sin rubro asignado</span>
                    )}
                  </div>
                )}
              </div>

              {/* Página Web */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Página Web:</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={sitioWeb}
                    onChange={(e) => setSitioWeb(e.target.value)}
                    placeholder="Ej. https://www.empresa.com.ar"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                ) : (
                  <div className="text-sm">
                    {sitioWeb ? (
                      <a
                        href={sitioWeb.startsWith("http") ? sitioWeb : `https://${sitioWeb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 font-mono text-xs"
                      >
                        <span className="truncate max-w-[280px]">{sitioWeb}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-500 italic text-xs">No informada</span>
                    )}
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <LinkedinIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>LinkedIn Oficial:</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="Ej. https://linkedin.com/company/empresa"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                ) : (
                  <div className="text-sm">
                    {linkedin ? (
                      <a
                        href={linkedin.startsWith("http") ? linkedin : `https://${linkedin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 font-mono text-xs"
                      >
                        <span className="truncate max-w-[280px]">{linkedin}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-500 italic text-xs">No registrado</span>
                    )}
                  </div>
                )}
              </div>

              {/* Teléfono / WhatsApp */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Teléfono / WhatsApp:</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. +54 11 4000-0000"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    {telefono ? (
                      <>
                        <a
                          href={`tel:${telefono.replace(/\s+/g, "")}`}
                          className="text-emerald-400 hover:underline font-mono text-xs"
                        >
                          {telefono}
                        </a>
                        <button
                          onClick={handleCopyPhone}
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Copiar teléfono"
                        >
                          {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-500 italic text-xs">No informado</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* CARD DE CORREOS ELECTRÓNICOS (Múltiples emails + Copiar todos) */}
          {/* ================================================================ */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0e1628] to-[#0a101f] border border-blue-500/20 space-y-4 shadow-lg shadow-blue-950/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Correos Electrónicos Registrados</span>
                    <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {emails.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Canales de contacto y envío de pliegos de cotización
                  </p>
                </div>
              </div>

              {/* Botón Principal: Copiar todos los mails */}
              {emails.length > 0 && (
                <button
                  onClick={handleCopyAllEmails}
                  className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm shadow-blue-600/10"
                  title="Copiar todos los correos separados por coma para pegar en CCO"
                >
                  {copiedAllEmails ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in-50" />
                      <span className="text-emerald-300 font-extrabold">¡Todos Copiados!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-blue-300" />
                      <span>Copiar Todos los Correos</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Lista de emails */}
            {emails.length > 0 ? (
              <div className="space-y-2">
                {emails.map((em, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/80 border border-white/[0.06] hover:border-blue-500/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <a
                        href={`mailto:${em}`}
                        className="font-mono text-xs sm:text-sm text-slate-200 hover:text-blue-300 hover:underline truncate"
                        title="Abrir en cliente de correo"
                      >
                        {em}
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopySingleEmail(em, idx)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copiar este correo"
                      >
                        {copiedSingleIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {isEditing && (
                        <button
                          onClick={() => handleRemoveEmail(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Eliminar correo de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-white/10 text-center text-xs text-slate-500">
                No hay correos registrados para este proveedor.
              </div>
            )}

            {/* Input para agregar correo adicional */}
            {(isEditing || emails.length === 0) && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                  placeholder="Agregar nuevo correo (ej. compras@empresa.com)..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Correo</span>
                </button>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* SECCIÓN ABAJO: COTIZACIONES EN LAS QUE PARTICIPÓ */}
          {/* ================================================================ */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Cotizaciones en las que Participó</span>
                    <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {cotizaciones.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Historial de comparativas y presupuestos donde cotizó este proveedor
                  </p>
                </div>
              </div>
            </div>

            {cotizaciones.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cotizaciones.map((cot, idx) => {
                  const dateStr = cot.date && !isNaN(new Date(cot.date).getTime())
                    ? new Date(cot.date).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Fecha no reg.";

                  const isFinal = cot.status === "finalizada";
                  const isCancel = cot.status === "cancelada";

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] hover:border-indigo-500/30 transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight line-clamp-2">
                            {cot.name || "Cotización sin nombre"}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                              isFinal
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                : isCancel
                                ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                                : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {cot.status || "Borrador"}
                          </span>
                        </div>

                        {cot.variantUsed && cot.variantUsed !== nombre && (
                          <div className="text-[11px] text-slate-400 mt-1 font-mono">
                            <span className="text-slate-500">Cotizó como:</span>{" "}
                            <span className="text-slate-300">{cot.variantUsed}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04] text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{dateStr}</span>
                        </span>

                        <Link
                          href={`/cotizaciones?id=${cot.id}`}
                          className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline flex items-center gap-1"
                        >
                          <span>Ver Comparativa</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-950/40 border border-dashed border-white/10 text-center space-y-2">
                <FileText className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">
                  Este proveedor aún no ha participado en cotizaciones registradas en el sistema.
                </p>
                <p className="text-[11px] text-slate-500">
                  Podés pedirle presupuesto directamente o agregarlo a tu próxima solicitud de cotización.
                </p>
              </div>
            )}
          </div>

          {/* Notas Adicionales */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/[0.08] space-y-2">
            <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Notas & Antecedentes Internos
            </h3>
            {isEditing ? (
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Escribí notas sobre plazos de entrega, persona de contacto, condiciones comerciales..."
                className="w-full text-xs p-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-blue-500 leading-relaxed"
              />
            ) : (
              <p className="text-xs text-slate-300 leading-relaxed">
                {notas || (
                  <span className="text-slate-500 italic">
                    Sin notas adicionales registradas. Hacé clic en "Editar" para agregar comentarios internos.
                  </span>
                )}
              </p>
            )}
          </div>

        </div>

        {/* Modal Bottom Action Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span>Editar Datos</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onDraftEmail && emails.length > 0 && (
              <button
                onClick={() => onDraftEmail({ ...proveedor, emails, email: emails[0] })}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Pedir Cotización</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
