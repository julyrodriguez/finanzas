"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ProveedoresError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en sección Proveedores:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="p-8 rounded-2xl bg-slate-950/80 border border-white/10 max-w-md w-full space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Hubo un problema al cargar proveedores</h3>
          <p className="text-xs text-slate-400 mt-1">
            {error?.message || "Ocurrió un error inesperado al inicializar la vista."}
          </p>
        </div>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-blue-600/30"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Recargar Página</span>
        </button>
      </div>
    </div>
  );
}
