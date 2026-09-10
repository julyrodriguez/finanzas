"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Edit3, Plus, X, Clock, ChevronDown, AlertCircle, Trash2, Loader2, Building2, CheckCircle2, Sparkles } from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";
import { 
  getProvidersRegistry, 
  searchProviders, 
  cleanProviderName, 
  RegisteredProvider, 
  ProviderSearchResult 
} from "@/lib/providersRegistry";

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOrden: OrdenCompra | null;
  ordenes: OrdenCompra[];
  empresa: "Hoyts" | "CMK";
  setEmpresa: (val: "Hoyts" | "CMK") => void;
  numSolicitud: string;
  setNumSolicitud: (val: string) => void;
  numOC: string;
  setNumOC: (val: string) => void;
  razonSocial: string;
  setRazonSocial: (val: string) => void;
  monto: string;
  setMonto: (val: string) => void;
  motivo: string;
  setMotivo: (val: string) => void;
  formaPago: string;
  setFormaPago: (val: string) => void;
  cancelada: boolean;
  setCancelada: (val: boolean) => void;
  relatedOC: string;
  setRelatedOC: (val: string) => void;
  linkSharepoint: string;
  setLinkSharepoint: (val: string) => void;
  submitting: boolean;
  onSave: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
  getFormattedCreatedAt: (orden: OrdenCompra) => string;
}

export function OrderFormModal({
  isOpen,
  onClose,
  editingOrden,
  ordenes,
  empresa,
  setEmpresa,
  numSolicitud,
  setNumSolicitud,
  numOC,
  setNumOC,
  razonSocial,
  setRazonSocial,
  monto,
  setMonto,
  motivo,
  setMotivo,
  formaPago,
  setFormaPago,
  cancelada,
  setCancelada,
  relatedOC,
  setRelatedOC,
  linkSharepoint,
  setLinkSharepoint,
  submitting,
  onSave,
  onDelete,
  getFormattedCreatedAt,
}: OrderFormModalProps) {
  const [isOCListOpen, setIsOCListOpen] = useState(false);

  // Estados para autocompletado de proveedores
  const [providers, setProviders] = useState<RegisteredProvider[]>([]);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const providerInputContainerRef = useRef<HTMLDivElement | null>(null);

  // Cargar registro de proveedores (MongoDB + localStorage) al abrir el modal
  useEffect(() => {
    if (isOpen) {
      getProvidersRegistry().then((list) => {
        setProviders(list);
      });
      setIsProviderDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        providerInputContainerRef.current &&
        !providerInputContainerRef.current.contains(e.target as Node)
      ) {
        setIsProviderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escuchar si se registró un nuevo proveedor en tiempo real
  useEffect(() => {
    const handleNewProvider = (e: any) => {
      if (e.detail) {
        setProviders((prev) => {
          const exists = prev.some((p) => p.id === e.detail.id);
          if (exists) {
            return prev.map((p) => (p.id === e.detail.id ? e.detail : p));
          }
          return [e.detail, ...prev];
        });
      }
    };
    window.addEventListener("finanzas_provider_registered", handleNewProvider);
    return () => window.removeEventListener("finanzas_provider_registered", handleNewProvider);
  }, []);

  // Búsqueda de proveedores sugeridos a partir de 3 caracteres
  const trimmedRazon = razonSocial.trim();
  const searchResults: ProviderSearchResult[] = useMemo(() => {
    if (trimmedRazon.length < 3) return [];
    return searchProviders(trimmedRazon, providers, 8);
  }, [trimmedRazon, providers]);

  // Verificar si el texto escrito coincide con un proveedor registrado
  const matchedRegisteredProvider = useMemo(() => {
    if (!trimmedRazon) return null;
    const norm = cleanProviderName(trimmedRazon);
    return providers.find(
      (p) =>
        p.name.toLowerCase() === trimmedRazon.toLowerCase() ||
        p.norm === norm ||
        p.aliases.some((a) => a.toLowerCase() === trimmedRazon.toLowerCase())
    );
  }, [trimmedRazon, providers]);

  const showDropdown = isProviderDropdownOpen && trimmedRazon.length >= 3;
  const hasExactMatch = Boolean(matchedRegisteredProvider);
  const showNewProviderOption = !hasExactMatch && trimmedRazon.length >= 3;
  const totalDropdownItems = searchResults.length + (showNewProviderOption ? 1 : 0);

  const handleSelectProvider = (name: string) => {
    setRazonSocial(name);
    setIsProviderDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDownProvider = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || totalDropdownItems === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalDropdownItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalDropdownItems) % totalDropdownItems);
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        e.preventDefault();
        handleSelectProvider(searchResults[highlightedIndex].provider.name);
      } else if (highlightedIndex === searchResults.length && showNewProviderOption) {
        e.preventDefault();
        setIsProviderDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === "Escape") {
      setIsProviderDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md overflow-y-auto flex items-start justify-center p-4">
      <div className="w-full max-w-lg glass-card border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative space-y-5 my-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {editingOrden ? (
              <>
                <Edit3 className="w-5 h-5 text-emerald-400" />
                Editar Orden de Compra
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-emerald-400" />
                Agregar Solicitud de OC
              </>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/5 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4 text-xs">
          {editingOrden && editingOrden.createdAt && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between text-gray-400">
              <span className="font-medium text-gray-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Fecha de Creación
              </span>
              <span className="font-mono text-white font-semibold">
                {getFormattedCreatedAt(editingOrden)}
              </span>
            </div>
          )}

          {/* Selección de Empresa: Hoyts vs CMK */}
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">Empresa</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEmpresa("Hoyts")}
                className={`py-2.5 rounded-xl border font-semibold transition-all ${
                  empresa === "Hoyts"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md"
                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                }`}
              >
                Hoyts
              </button>
              <button
                type="button"
                onClick={() => setEmpresa("CMK")}
                className={`py-2.5 rounded-xl border font-semibold transition-all ${
                  empresa === "CMK"
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-md"
                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                }`}
              >
                CMK
              </button>
            </div>
          </div>

          {/* N° Solicitud (Opcional) & N° OC (Obligatorio) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 font-medium mb-1">
                N° Solicitud de Orden <span className="text-gray-500 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={numSolicitud}
                onChange={(e) => setNumSolicitud(e.target.value)}
                placeholder="ej: SOL-1002 (Opcional)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1">
                N° Orden de Compra (OC)
              </label>
              <input
                type="text"
                required
                value={numOC}
                onChange={(e) => setNumOC(e.target.value)}
                placeholder="ej: 45892"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Razón Social / Proveedor con Autocompletado desde MongoDB */}
          <div ref={providerInputContainerRef} className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-gray-300 font-medium">
                Razón Social / Proveedor
              </label>
              {matchedRegisteredProvider ? (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Registrado ({matchedRegisteredProvider.count} {matchedRegisteredProvider.count === 1 ? "orden" : "órdenes"})
                </span>
              ) : trimmedRazon.length >= 3 ? (
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Nuevo proveedor
                </span>
              ) : null}
            </div>

            <div className="relative">
              <input
                type="text"
                required
                value={razonSocial}
                onChange={(e) => {
                  setRazonSocial(e.target.value);
                  setIsProviderDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => {
                  if (trimmedRazon.length >= 3) {
                    setIsProviderDropdownOpen(true);
                  }
                }}
                onKeyDown={handleKeyDownProvider}
                placeholder="ej: Suministros Industriales S.A. (escribe 3 letras...)"
                autoComplete="off"
                className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
              <Building2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Menú flotante de sugerencias */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-64 overflow-y-auto bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-xl divide-y divide-white/5 scrollbar-thin">
                {searchResults.length > 0 ? (
                  <div className="p-1.5 space-y-1">
                    <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Proveedores sugeridos ({searchResults.length})
                    </div>
                    {searchResults.map((item, idx) => {
                      const isHighlighted = highlightedIndex === idx;
                      return (
                        <button
                          key={item.provider.id}
                          type="button"
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onClick={() => handleSelectProvider(item.provider.name)}
                          className={`w-full text-left px-3 py-2 rounded-xl border transition-colors duration-100 flex items-center justify-between gap-3 cursor-pointer ${
                            isHighlighted
                              ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-sm"
                              : "border-transparent hover:bg-white/5 text-slate-200 hover:text-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                              <span>{item.provider.name}</span>
                              {item.matchType === "exact" && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-normal">
                                  Exacto
                                </span>
                              )}
                            </div>
                            {item.matchType === "alias" && item.matchedText !== item.provider.name && (
                              <div className="text-[10px] text-slate-400 truncate">
                                Alias coincidente: <span className="text-slate-300 font-mono">{item.matchedText}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                            {item.provider.count} {item.provider.count === 1 ? "OC" : "OCs"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* Opción para registrar como nuevo proveedor si no coincide exactamente */}
                {showNewProviderOption && (
                  <div className="p-1.5">
                    <button
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(searchResults.length)}
                      onClick={() => {
                        setIsProviderDropdownOpen(false);
                        setHighlightedIndex(-1);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition-colors duration-100 flex items-center gap-2 cursor-pointer ${
                        highlightedIndex === searchResults.length
                          ? "bg-amber-500/15 text-amber-200 border-amber-500/40 shadow-sm"
                          : "border-transparent hover:bg-white/5 text-amber-300/90"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">
                          Usar nuevo proveedor: <span className="underline decoration-amber-400/50">"{trimmedRazon}"</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Se agregará al registro automáticamente al guardar la orden
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Monto & Forma de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 font-medium mb-1">
                Monto ($)
              </label>
              <input
                type="number"
                step="any"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="ej: 150000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1">
                Forma de Pago
              </label>
              <input
                type="text"
                required
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                placeholder="ej: 30DFF"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* OC Relacionada (Opcional) */}
          <div>
            <label className="block text-gray-300 font-medium mb-1">
              OC Relacionada (Opcional - Para mandar juntas)
            </label>
            <input
              type="text"
              value={relatedOC}
              onChange={(e) => setRelatedOC(e.target.value)}
              placeholder="ej: 04859 (N° de OC vinculada)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />

            {/* Selección rápida de últimas OCs */}
            <div className="flex items-center justify-between mt-1.5">
              <button
                type="button"
                onClick={() => setIsOCListOpen(!isOCListOpen)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>{isOCListOpen ? "Ocultar últimas OCs" : "Seleccionar de últimas OCs..."}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOCListOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {isOCListOpen && (
              <div className="mt-2 border border-white/10 rounded-xl bg-black/30 max-h-36 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                {ordenes
                  .filter(o => o.numOC && o.numOC.trim() !== "" && (!editingOrden || o.id !== editingOrden.id))
                  .map((o) => {
                    const ocNum = o.numOC.trim();
                    const isSelected = relatedOC
                      .split(/[\s,/\-]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .includes(ocNum);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          let currentOcs = relatedOC
                            .split(/[\s,/\-]+/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                          if (isSelected) {
                            currentOcs = currentOcs.filter((num) => num !== ocNum);
                          } else {
                            currentOcs.push(ocNum);
                          }
                          setRelatedOC(currentOcs.join(", "));
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors text-[11px] ${
                          isSelected 
                            ? "bg-purple-500/10 text-purple-200" 
                            : "hover:bg-white/5 text-gray-300"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-mono font-bold text-white flex items-center gap-1.5">
                            #{ocNum}
                            <span className={`text-[8px] font-sans px-1 rounded font-bold ${
                              o.empresa === "Hoyts"
                                ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                                : "bg-teal-500/15 text-teal-300 border border-teal-500/20"
                            }`}>
                              {o.empresa}
                            </span>
                          </span>
                          <span className="text-[10px] text-gray-400 truncate mt-0.5">
                            {o.razonSocial}
                          </span>
                        </div>
                        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                          isSelected 
                            ? "bg-purple-500/25 text-purple-300 border border-purple-500/30" 
                            : "bg-white/5 text-gray-500 border border-white/5"
                        }`}>
                          {isSelected ? "Seleccionada" : "Seleccionar"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Enlace de SharePoint / OneDrive */}
          <div>
            <label className="block text-gray-300 font-medium mb-1">
              Enlace de Carpeta (SharePoint / OneDrive)
            </label>
            <input
              type="text"
              value={linkSharepoint}
              onChange={(e) => setLinkSharepoint(e.target.value)}
              placeholder="ej: https://tuempresa.sharepoint.com/..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Detalle / Motivo */}
          <div>
            <label className="block text-gray-300 font-medium mb-1">
              Detalle / Motivo
            </label>
            <textarea
              required
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="ej: Adquisición de insumos de papelería y cartuchos"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Opción de Cancelar Orden (Solo al editar) */}
          {editingOrden && (
            <div className="pt-3 border-t border-white/5">
              <label 
                htmlFor="canceladaCheckbox"
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  cancelada 
                    ? "bg-red-500/10 border-red-500/30 text-red-200 font-semibold" 
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5">
                    <AlertCircle className={`w-4 h-4 ${cancelada ? "text-red-400 animate-pulse" : "text-gray-400"}`} />
                    Orden Cancelada
                  </span>
                  <p className="text-[10px] text-gray-500 font-normal">
                    Marcar esta orden como cancelada/desestimada
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    id="canceladaCheckbox"
                    checked={cancelada}
                    onChange={(e) => setCancelada(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${cancelada ? "bg-red-500" : "bg-white/10"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] left-[3px] transition-transform duration-200 ${cancelada ? "translate-x-4" : ""}`} />
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Action Buttons: Delete (when editing) + Cancel + Save */}
          <div className="pt-4 flex items-center justify-between gap-3 border-t border-white/10">
            {editingOrden && editingOrden.id ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(editingOrden.id!);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Orden</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {editingOrden ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingOrden ? "Guardar Cambios" : "Guardar Orden"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
