"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  ArrowUpRight,
  Sparkles,
  Layers,
  Zap,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  Sliders,
  ShieldCheck,
  Plus,
  Eye
} from "lucide-react";

export default function Diseno2Page() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"todas" | "hoyts" | "cmk">("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Auto-apply glassmorphism theme when visiting this page
  useEffect(() => {
    if (theme !== "glassmorphism") {
      setTheme("glassmorphism");
    }
  }, [theme, setTheme]);

  const sampleOrders = [
    {
      id: "1",
      numSolicitud: "SOL-8921",
      numOC: "OC-45892",
      empresa: "Hoyts",
      razonSocial: "Coca-Cola FEMSA Argentina S.A.",
      monto: "$ 4.850.000,00",
      motivo: "Reposición stock bebidas combo cines Q3",
      formaPago: "30DFF",
      estado: "Liberada",
      creadoPor: "julian",
      fecha: "28/08/2026",
    },
    {
      id: "2",
      numSolicitud: "SOL-8924",
      numOC: "OC-45899",
      empresa: "CMK",
      razonSocial: "Distribuidora Mayorista Golosinas S.R.L.",
      monto: "$ 1.280.400,00",
      motivo: "Insumos candy bar y pochocleras sucursal Abasto",
      formaPago: "Transferencia 48hs",
      estado: "Pendiente",
      creadoPor: "oalvarez",
      fecha: "28/08/2026",
    },
    {
      id: "3",
      numSolicitud: "SOL-8930",
      numOC: "OC-45910",
      empresa: "Hoyts",
      razonSocial: "Servicios de Seguridad Integral Prosegur",
      monto: "$ 8.420.000,00",
      motivo: "Vigilancia nocturna y blindaje de complejos agosto",
      formaPago: "60DFF",
      estado: "Mandada",
      creadoPor: "talbrecht",
      fecha: "27/08/2026",
    },
    {
      id: "4",
      numSolicitud: "SOL-8935",
      numOC: "OC-45922",
      empresa: "CMK",
      razonSocial: "Telecom Argentina S.A.",
      monto: "$ 940.000,00",
      motivo: "Fibra óptica dedicada enlace sucursales",
      formaPago: "Débito Automático",
      estado: "Entregada",
      creadoPor: "julian",
      fecha: "26/08/2026",
    },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredOrders = sampleOrders.filter((ord) => {
    const matchesTab =
      activeTab === "todas" || ord.empresa.toLowerCase() === activeTab;
    const matchesSearch =
      ord.numOC.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.numSolicitud.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <AppLayout
      title="Diseño 2: Apple Glassmorphism (VisionOS)"
      subtitle="Estética de cristal translúcido, reflejos especulares, profundidad óptica y micro-resplandores ambientales"
      publicRoute={true}
    >
      <div className="space-y-8 pb-16 relative">
        {/* Luces ambientales de fondo */}
        <div className="fixed top-20 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
        <div className="fixed top-1/3 right-10 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        {/* Hero Banner Glass */}
        <div className="p-6 md:p-8 rounded-3xl bg-white/[0.035] backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-gradient-to-tr from-purple-500/20 via-pink-500/20 to-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 text-xs font-semibold tracking-wide uppercase shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
                Diseño 2 • VisionOS Glass Crystal
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                Apple VisionOS Translucent Experience
              </h2>
              <p className="text-sm sm:text-base text-gray-200 leading-relaxed drop-shadow-sm font-normal">
                Efecto de cristal pulido esmerilado con desenfoque de fondo multicapa (<code className="text-cyan-300">backdrop-blur-2xl</code>), bordes de luz reflectante, botones con gradientes de vidrio y tarjetas de volumen orgánico.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/diseno1"
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md text-white border border-white/20 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
              >
                <span>⚡ Ver Diseño 1 (SaaS)</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setTheme("glassmorphism")}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:brightness-110 text-white font-bold text-xs sm:text-sm shadow-[0_8px_25px_rgba(168,85,247,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/25 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar a toda la web</span>
              </button>
            </div>
          </div>

          {/* Tokens de Diseño Glass */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-gray-200">
              <span className="w-3.5 h-3.5 rounded-full bg-[#05070e] border border-white/30"></span>
              <span>Fondo: <code>#05070e Cosmic</code></span>
            </div>
            <div className="flex items-center gap-2 text-gray-200">
              <span className="w-3.5 h-3.5 rounded-full bg-white/10 border border-white/40 backdrop-blur-sm"></span>
              <span>Cristal: <code>Blur 24px + 4% Opacity</code></span>
            </div>
            <div className="flex items-center gap-2 text-gray-200">
              <span className="w-3.5 h-3.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></span>
              <span>Acento 1: <code>Purple #a855f7</code></span>
            </div>
            <div className="flex items-center gap-2 text-gray-200">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
              <span>Acento 2: <code>Cyan #22d3ee</code></span>
            </div>
          </div>
        </div>

        {/* Tarjetas Glassmórficas de KPIs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              Paneles de Cristal y Datos Financieros
            </h3>
            <span className="text-xs text-purple-300/80 font-mono">Vision Engine Online</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white/[0.035] backdrop-blur-xl border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:bg-white/[0.06] hover:border-white/30 transition-all group">
              <div className="flex items-center justify-between text-gray-300 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Facturado Mes</span>
                <div className="p-2 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-cyan-500/20 text-cyan-300 border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 drop-shadow">
                $ 15.490.400
              </div>
              <div className="flex items-center text-xs text-emerald-300 gap-1 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+14.2% rendimiento</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/[0.035] backdrop-blur-xl border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:bg-white/[0.06] hover:border-white/30 transition-all group">
              <div className="flex items-center justify-between text-gray-300 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Órdenes Pendientes</span>
                <div className="p-2 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-300 border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 drop-shadow">
                12 <span className="text-xs font-normal text-gray-300 font-sans">solicitudes</span>
              </div>
              <div className="flex items-center text-xs text-amber-300 gap-1 font-medium">
                <span>3 requieren autorización</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/[0.035] backdrop-blur-xl border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:bg-white/[0.06] hover:border-white/30 transition-all group">
              <div className="flex items-center justify-between text-gray-300 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Pagos Liberados Hoy</span>
                <div className="p-2 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 drop-shadow">
                $ 6.130.000
              </div>
              <div className="flex items-center text-xs text-emerald-300 gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% procesadas</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/[0.035] backdrop-blur-xl border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:bg-white/[0.06] hover:border-white/30 transition-all group">
              <div className="flex items-center justify-between text-gray-300 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Eficiencia Operativa</span>
                <div className="p-2 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 text-purple-300 border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 drop-shadow">
                98.6%
              </div>
              <div className="flex items-center text-xs text-purple-300 gap-1 font-medium">
                <span>Tiempo prom: 4.2h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla Glassmórfica */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Órdenes de Compra</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-[10px] text-cyan-300">Live Glass</span>
              </h3>
              <p className="text-xs text-gray-300">
                Visualización con filas translúcidas y micro-iluminación al pasar el mouse
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro Tabs Glass */}
              <div className="flex items-center bg-white/5 backdrop-blur-md border border-white/15 rounded-2xl p-1">
                {(["todas", "hoyts", "cmk"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-1 rounded-xl text-xs font-bold capitalize transition-all ${
                      activeTab === tab
                        ? "bg-gradient-to-r from-purple-500/80 to-cyan-500/80 text-white shadow-md border border-white/30"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    {tab === "todas" ? "Todas" : tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Buscador Glass */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar OC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-2xl bg-white/[0.05] backdrop-blur-md border border-white/20 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 w-48 sm:w-60 shadow-inner"
                />
              </div>

              <button className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_4px_15px_rgba(168,85,247,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/20">
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Orden</span>
              </button>
            </div>
          </div>

          {/* Tabla Glass */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-inner">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] backdrop-blur-lg text-gray-200 border-b border-white/10 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Empresa</th>
                  <th className="py-3.5 px-4">Solicitud / OC</th>
                  <th className="py-3.5 px-4">Proveedor</th>
                  <th className="py-3.5 px-4 text-right">Monto</th>
                  <th className="py-3.5 px-4">Forma Pago</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredOrders.map((ord, idx) => (
                  <tr
                    key={ord.id}
                    className="hover:bg-white/[0.04] transition-colors group"
                  >
                    <td className="py-4 px-4 font-semibold">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-xl text-[11px] font-bold backdrop-blur-md border ${
                          ord.empresa === "Hoyts"
                            ? "bg-purple-500/20 text-purple-200 border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                            : "bg-cyan-500/20 text-cyan-200 border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                        }`}
                      >
                        {ord.empresa}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-white tracking-tight">
                        {ord.numOC}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {ord.numSolicitud}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-100">
                        {ord.razonSocial}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-xs">
                        {ord.motivo}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-white text-sm">
                      {ord.monto}
                    </td>
                    <td className="py-4 px-4 text-gray-300 font-mono text-[11px]">
                      {ord.formaPago}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md ${
                          ord.estado === "Liberada"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : ord.estado === "Mandada"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                            : ord.estado === "Entregada"
                            ? "bg-purple-500/20 text-purple-300 border-purple-400/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                            : "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ord.estado === "Liberada"
                              ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                              : ord.estado === "Mandada"
                              ? "bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
                              : ord.estado === "Entregada"
                              ? "bg-purple-400 shadow-[0_0_6px_#c084fc]"
                              : "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                          }`}
                        />
                        {ord.estado}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => handleCopy(`${ord.numOC} - ${ord.razonSocial} (${ord.monto})`, idx)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/15 backdrop-blur-md transition-all inline-flex items-center gap-1 text-[11px] shadow-sm"
                        title="Copiar datos de orden"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulario Glass de prueba */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Formularios y Controles Translúcidos</span>
          </div>
          <p className="text-xs text-gray-300">
            Campos de entrada con cristal esmerilado, iluminación reactiva y sombras internas de profundidad.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-200 mb-1.5">
                Número de Solicitud
              </label>
              <input
                type="text"
                defaultValue="SOL-9012"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/20 text-xs text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-200 mb-1.5">
                Razón Social / Proveedor
              </label>
              <input
                type="text"
                defaultValue="Distribuidora Cuyo S.A."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/20 text-xs text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-200 mb-1.5">
                Forma de Pago
              </label>
              <select className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0e1222] border border-white/20 text-xs text-white focus:outline-none focus:border-purple-400">
                <option>30DFF (Factura Electrónica)</option>
                <option>Transferencia Inmediata</option>
                <option>60DFF</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
