"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  ChevronDown, 
  Check, 
  Clock, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  PackageCheck
} from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { getStoredApprovalConfig, parseMontoToNumber } from "@/lib/approvalConfig";

export type OrderStatusKey = "pendiente" | "mandada" | "liberada" | "entregada" | "cancelada";

interface OrderStatusMenuProps {
  orden: OrdenCompra;
  isOrdenesUser?: boolean;
  onStatusChange?: (ordenId: string, updatedFields: Partial<OrdenCompra>) => void;
  showToast?: (message: string) => void;
}

export function getOrderStatus(orden: OrdenCompra): OrderStatusKey {
  if (orden.cancelada) return "cancelada";
  if (orden.entregada) return "entregada";
  if (orden.liberada) return "liberada";
  if (orden.mandada) return "mandada";
  return "pendiente";
}

export const STATUS_CONFIG: Record<
  OrderStatusKey,
  {
    label: string;
    description: string;
    badgeClass: string;
    dotClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pendiente: {
    label: "Pendiente",
    description: "Sin enviar a autorizar",
    badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30 hover:border-slate-400/50",
    dotClass: "bg-slate-400",
    icon: Clock,
  },
  mandada: {
    label: "Mandada",
    description: "Enviada a autorizar",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:border-amber-400/50",
    dotClass: "bg-amber-400",
    icon: Send,
  },
  liberada: {
    label: "Liberada",
    description: "Autorizada para pago",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:border-emerald-400/50",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    icon: Check,
  },
  entregada: {
    label: "Entregada",
    description: "Pago / comprobante entregado",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:border-emerald-400/50",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    icon: PackageCheck,
  },
  cancelada: {
    label: "Cancelada",
    description: "Orden desestimada",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/30 hover:border-red-400/50",
    dotClass: "bg-red-400",
    icon: XCircle,
  },
};

export function OrderStatusMenu({
  orden,
  isOrdenesUser = false,
  onStatusChange,
  showToast,
}: OrderStatusMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; openUpward: boolean }>({
    top: 0,
    left: 0,
    openUpward: false,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentStatus = getOrderStatus(orden);
  const config = STATUS_CONFIG[currentStatus];

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 260;
    const dropdownWidth = 224;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    setMenuPosition({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left,
      openUpward,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    function handleScrollOrResize() {
      updatePosition();
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const handleSelectStatus = async (targetStatus: OrderStatusKey) => {
    if (targetStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setIsUpdating(true);

    const configApproval = getStoredApprovalConfig();
    const numMonto = parseMontoToNumber(orden.monto);
    let updateData: Partial<OrdenCompra> = {};

    switch (targetStatus) {
      case "pendiente":
        updateData = {
          liberada: false,
          mandada: false,
          entregada: false,
          cancelada: false,
          enviado: false,
          firmado1: false,
          firmado2: false,
          firmante1: "",
          firmante2: "",
          fechaFirma1: "",
          fechaFirma2: "",
        };
        break;
      case "mandada": {
        const canAutoSign = numMonto <= configApproval.limiteNivel1;
        updateData = {
          liberada: false,
          mandada: true,
          entregada: false,
          cancelada: false,
          ...(canAutoSign ? {
            firmado1: true,
            firmante1: orden.firmante1 || configApproval.firmanteBaseNivel1 || "Tomas",
            fechaFirma1: orden.fechaFirma1 || new Date().toISOString(),
          } : {}),
        };
        break;
      }
      case "liberada":
        updateData = {
          liberada: true,
          mandada: false,
          entregada: false,
          cancelada: false,
          firmado1: true,
          firmado2: true,
        };
        break;
      case "entregada":
        updateData = {
          liberada: false,
          mandada: false,
          entregada: true,
          cancelada: false,
        };
        break;
      case "cancelada":
        updateData = {
          cancelada: true,
        };
        break;
    }

    // Optimistic parent update
    if (orden.id && onStatusChange) {
      onStatusChange(orden.id, updateData);
    }

    // Firestore update
    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, updateData);
        if (showToast) {
          showToast(`Estado de OC ${orden.numOC || ""} actualizado a ${STATUS_CONFIG[targetStatus].label}`);
        }
      } catch (err) {
        console.error("Error al actualizar estado en Firestore:", err);
        if (showToast) {
          showToast("Error al guardar el estado en el servidor");
        }
      }
    }

    setIsUpdating(false);
  };

  // If user has restricted permissions, render a simple read-only pill
  if (isOrdenesUser) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <>
      {/* Trigger Button (Smart Pill) */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) {
            updatePosition();
          }
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-sm cursor-pointer ${
          config.badgeClass
        } ${isUpdating ? "opacity-60 cursor-wait" : ""}`}
        title="Cambiar estado de la orden"
      >
        <span className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${config.dotClass}`} />
        <span className="tracking-tight">{config.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Modal / Popover via Portal */}
      {isOpen && mounted && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            transform: menuPosition.openUpward ? "translateY(-100%)" : "none",
            zIndex: 9999,
          }}
          className="w-56 rounded-2xl bg-[#0b0f19] border border-slate-700/80 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5 mb-1">
            Cambiar Estado
          </div>

          <div className="space-y-0.5">
            {(["pendiente", "mandada", "liberada", "entregada", "cancelada"] as const).map((key) => {
              const itemConfig = STATUS_CONFIG[key];
              const isSelected = key === currentStatus;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectStatus(key)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-white/10 text-white font-bold"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${itemConfig.dotClass}`} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate leading-tight">{itemConfig.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{itemConfig.description}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
