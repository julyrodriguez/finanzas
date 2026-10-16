"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  success: (title: string, description?: string, action?: ToastAction) => string;
  error: (title: string, description?: string, action?: ToastAction) => string;
  info: (title: string, description?: string, action?: ToastAction) => string;
  warning: (title: string, description?: string, action?: ToastAction) => string;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => "",
  dismissToast: () => {},
  success: () => "",
  error: () => "",
  info: () => "",
  warning: () => "",
});

type GlobalListener = (toast: Omit<ToastItem, "id">) => void;
let globalListeners: GlobalListener[] = [];

export const toast = {
  show: (item: Omit<ToastItem, "id">) => {
    globalListeners.forEach((fn) => fn(item));
  },
  success: (title: string, description?: string, action?: ToastAction) => {
    globalListeners.forEach((fn) => fn({ type: "success", title, description, action }));
  },
  error: (title: string, description?: string, action?: ToastAction) => {
    globalListeners.forEach((fn) => fn({ type: "error", title, description, action }));
  },
  info: (title: string, description?: string, action?: ToastAction) => {
    globalListeners.forEach((fn) => fn({ type: "info", title, description, action }));
  },
  warning: (title: string, description?: string, action?: ToastAction) => {
    globalListeners.forEach((fn) => fn({ type: "warning", title, description, action }));
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hovered, setHovered] = useState(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastItem = {
      ...item,
      id,
      duration: item.duration ?? (item.type === "error" ? 5500 : 3800),
    };
    setToasts((prev) => [...prev.slice(-4), newToast]);
    return id;
  }, []);

  useEffect(() => {
    const listener: GlobalListener = (item) => {
      showToast(item);
    };
    globalListeners.push(listener);
    return () => {
      globalListeners = globalListeners.filter((l) => l !== listener);
    };
  }, [showToast]);

  useEffect(() => {
    if (hovered || toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        dismissToast(t.id);
      }, t.duration || 3800)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, hovered, dismissToast]);

  const success = useCallback(
    (title: string, description?: string, action?: ToastAction) =>
      showToast({ type: "success", title, description, action }),
    [showToast]
  );
  const error = useCallback(
    (title: string, description?: string, action?: ToastAction) =>
      showToast({ type: "error", title, description, action }),
    [showToast]
  );
  const info = useCallback(
    (title: string, description?: string, action?: ToastAction) =>
      showToast({ type: "info", title, description, action }),
    [showToast]
  );
  const warning = useCallback(
    (title: string, description?: string, action?: ToastAction) =>
      showToast({ type: "warning", title, description, action }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, success, error, info, warning }}>
      {children}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const styles = {
              success: {
                border: "border-emerald-500/35",
                bg: "bg-[#0c1420]/95",
                icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
                bar: "bg-emerald-500",
              },
              error: {
                border: "border-red-500/40",
                bg: "bg-[#160d14]/95",
                icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
                bar: "bg-red-500",
              },
              warning: {
                border: "border-amber-500/35",
                bg: "bg-[#15120c]/95",
                icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
                bar: "bg-amber-500",
              },
              info: {
                border: "border-indigo-500/35",
                bg: "bg-[#0d1322]/95",
                icon: <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />,
                bar: "bg-indigo-500",
              },
            }[t.type];

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className={`pointer-events-auto relative overflow-hidden rounded-xl border ${styles.border} ${styles.bg} backdrop-blur-xl shadow-2xl shadow-black/70 px-3.5 py-3 flex items-start gap-2.5`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.bar}`} />
                {styles.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white leading-snug">{t.title}</p>
                  {t.description && (
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  {t.action && (
                    <button
                      onClick={() => {
                        t.action?.onClick();
                        dismissToast(t.id);
                      }}
                      className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white transition-colors"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(t.id)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                  aria-label="Cerrar notificación"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
