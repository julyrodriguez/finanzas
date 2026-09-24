"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  TrendingUp, 
  User as UserIcon, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Loader2,
  Percent
} from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { loginWithEmail } = useAuth();
  const router = useRouter();

  // Helper function to build email transparently
  const formatEmail = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    return trimmed.includes("@") ? trimmed : `${trimmed}@equipo.local`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fullEmail = formatEmail(username);

    try {
      await loginWithEmail(fullEmail, password);
      if (fullEmail.toLowerCase().startsWith("ordenes")) {
        router.push("/seguimiento-de-ordenes");
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error(err);
      const error = err as { code?: string };
      if (error.code === "auth/email-already-in-use") {
        setError("El usuario ya existe en el sistema.");
      } else if (error.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else if (
        error.code === "auth/invalid-credential" || 
        error.code === "auth/user-not-found" || 
        error.code === "auth/wrong-password"
      ) {
        setError("Usuario o contraseña incorrectos.");
      } else {
        setError("Ocurrió un error inesperado. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Corporate Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600/15 border border-blue-500/30 items-center justify-center text-blue-400 shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Finanzas
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Plataforma de gestión financiera corporativa
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="glass-card border border-white/10 p-6 sm:p-7 rounded-xl shadow-xl bg-[#0f1422]">
          <h2 className="text-sm font-semibold text-white mb-5 text-center">Iniciar Sesión</h2>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[#0b0f19] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[#0b0f19] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Entrar a la Plataforma</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom links */}
          <div className="mt-5 text-center">
            <div className="relative flex py-2 items-center justify-center mb-3">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">o continuar como</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <Link
              href="/distribucion"
              className="w-full py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Percent className="w-3.5 h-3.5 text-blue-400" />
              <span>Acceder a Distribución Pública</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
