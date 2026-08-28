"use client";

import { useState, useRef, useEffect } from "react";
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
    badgeClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:border-indigo-400/50",
    dotClass: "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]",
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
  const menuRef = useRef<HTMLDivElement>(null);

  const currentStatus = getOrderStatus(orden);
  const config = STATUS_CONFIG[currentStatus];
  const Icon = config.icon;

  // Close dropdown on outside click or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectStatus = async (targetStatus: OrderStatusKey) => {
    if (targetStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    setIsUpdating(true);

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
        };
        break;
      case "mandada":
        updateData = {
          liberada: false,
          mandada: true,
          entregada: false,
          cancelada: false,
        };
        break;
      case "liberada":
        updateData = {
          liberada: true,
          mandada: true,
          entregada: false,
          cancelada: false,
        };
        break;
      case "entregada":
        updateData = {
          liberada: true,
          mandada: true,
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
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button (Smart Pill) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Dropdown Menu Modal / Popover */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1.5 w-56 rounded-2xl bg-[#0b0f19] border border-slate-700/80 shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/5 mb-1">
            Cambiar Estado
          </div>

          <div className="space-y-0.5">
            {(["pendiente", "mandada", "liberada", "entregada", "cancelada"] as const).map((key) => {
              const itemConfig = STATUS_CONFIG[key];
              const ItemIcon = itemConfig.icon;
              const isSelected = key === currentStatus;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectStatus(key)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors ${
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
        </div>
      )}
    </div>
  );
}
