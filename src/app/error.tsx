"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { markFirestoreDisabled } from "@/lib/firebase";

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global App Error intercepted:", error);

    const msg = String(error?.message || "").toLowerCase();
    const isFirebaseQuota =
      msg.includes("quota") ||
      msg.includes("resource-exhausted") ||
      msg.includes("firestore") ||
      msg.includes("firebase");

    if (isFirebaseQuota) {
      markFirestoreDisabled(error);
      // Auto recovery: re-render the current component tree without the faulty Firestore dependency
      reset();
      return;
    }

    const isChunkOrNavError =
      error?.name === "ChunkLoadError" ||
      msg.includes("loading chunk") ||
      msg.includes("failed to fetch") ||
      msg.includes("could not load") ||
      msg.includes("couldn't load") ||
      msg.includes("dynamically imported module");

    if (isChunkOrNavError && typeof window !== "undefined") {
      window.location.reload();
    }
  }, [error, reset]);

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 text-center text-white">
      <div className="p-8 rounded-2xl bg-slate-900/90 border border-white/10 max-w-md w-full space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Recuperando vista
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Se detectó un aviso en los servicios en segundo plano. La plataforma utiliza MongoDB como servidor principal.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/";
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-all border border-white/10 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            Ir al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
