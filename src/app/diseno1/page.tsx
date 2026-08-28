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
  Plus
} from "lucide-react";

export default function Diseno1Page() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"todas" | "hoyts" | "cmk">("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Auto-apply enterprise theme when visiting this page
  useEffect(() => {
    if (theme !== "enterprise") {
      setTheme("enterprise");
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
      title="Diseño 1: Stripe / Vercel Enterprise"
      subtitle="Estética SaaS corporativa: precisión geométrica, contraste de alta definición y máxima legibilidad"
      publicRoute={true}
    >
      <div className="space-y-8 pb-16">
        {/* Banner de Presentación del Estilo */}
        <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-slate-950 border border-indigo-500/30 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                Diseño 1 • SaaS Enterprise V2
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Stripe & Vercel Dashboard Architecture
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Diseñado para flujos financieros de alta exigencia: fondos <strong className="text-white">Obsidian/Slate</strong>, bordes geométricos nítidos de 1px, acentos en <strong className="text-indigo-400">Azul Índigo Royal</strong> y <strong className="text-emerald-400">Esmeralda</strong>, tipografía con jerarquía estricta y tablas optimizadas para lectura rápida.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/diseno2"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-all flex items-center gap-2"
              >
                <span>✨ Ver Diseño 2 (VisionOS)</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setTheme("enterprise")}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar a toda la web</span>
              </button>
            </div>
          </div>

          {/* Tokens rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-indigo-500/20 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3 h-3 rounded-full bg-[#090d16] border border-slate-700"></span>
              <span>Fondo: <code>#090d16</code></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3 h-3 rounded-full bg-[#111726] border border-indigo-500/40"></span>
              <span>Tarjetas: <code>#111726</code></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
              <span>Acento: <code>Indigo Royal #6366f1</code></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>Éxito: <code>Emerald #10b981</code></span>
            </div>
          </div>
        </div>

        {/* Métricas / KPIs Estilo Enterprise */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Métricas y Rendimiento Financiero
            </h3>
            <span className="text-xs text-slate-400 font-mono">Actualizado en tiempo real</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-[#111726] border border-slate-800 shadow-md hover:border-indigo-500/40 transition-all group">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Facturado Mes</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                $ 15.490.400
              </div>
              <div className="flex items-center text-xs text-emerald-400 gap-1 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+14.2% vs mes anterior</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111726] border border-slate-800 shadow-md hover:border-amber-500/40 transition-all group">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Órdenes Pendientes</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                12 <span className="text-xs font-normal text-slate-400 font-sans">solicitudes</span>
              </div>
              <div className="flex items-center text-xs text-amber-300 gap-1 font-medium">
                <span>3 requieren autorización urgente</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111726] border border-slate-800 shadow-md hover:border-emerald-500/40 transition-all group">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Pagos Liberados Hoy</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                $ 6.130.000
              </div>
              <div className="flex items-center text-xs text-emerald-400 gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% procesadas en Interbanking</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111726] border border-slate-800 shadow-md hover:border-indigo-500/40 transition-all group">
              <div className="flex items-center justify-between text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Eficiencia Operativa</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                98.6%
              </div>
              <div className="flex items-center text-xs text-slate-400 gap-1 font-medium">
                <span>Tiempo prom. liberación: 4.2h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Órdenes Interactiva en Estilo Enterprise */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Órdenes de Compra Activas
              </h3>
              <p className="text-xs text-slate-400">
                Visualización corporativa con densidad balanceada y estados de color nítidos
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro de Empresas Tabs */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                {(["todas", "hoyts", "cmk"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                      activeTab === tab
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "todas" ? "Todas" : tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar OC, proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-48 sm:w-64"
                />
              </div>

              <button className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20">
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Orden</span>
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0c121e] text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Solicitud / OC</th>
                  <th className="py-3 px-4">Proveedor (Razón Social)</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4">Forma Pago</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredOrders.map((ord, idx) => (
                  <tr
                    key={ord.id}
                    className="hover:bg-indigo-500/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          ord.empresa === "Hoyts"
                            ? "bg-purple-950/70 text-purple-300 border border-purple-800/60"
                            : "bg-teal-950/70 text-teal-300 border border-teal-800/60"
                        }`}
                      >
                        {ord.empresa}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white tracking-tight">
                        {ord.numOC}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {ord.numSolicitud}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">
                        {ord.razonSocial}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">
                        {ord.motivo}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 text-sm">
                      {ord.monto}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                      {ord.formaPago}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                          ord.estado === "Liberada"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : ord.estado === "Mandada"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            : ord.estado === "Entregada"
                            ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ord.estado === "Liberada"
                              ? "bg-emerald-400"
                              : ord.estado === "Mandada"
                              ? "bg-sky-400"
                              : ord.estado === "Entregada"
                              ? "bg-indigo-400"
                              : "bg-amber-400"
                          }`}
                        />
                        {ord.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleCopy(`${ord.numOC} - ${ord.razonSocial} (${ord.monto})`, idx)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 transition-all inline-flex items-center gap-1 text-[11px]"
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

        {/* Formulario de prueba en Estilo Enterprise */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Formularios y Controles en Diseño 1</span>
          </div>
          <p className="text-xs text-slate-400">
            Controles con bordes nítidos, enfoque en azul índigo eléctrico y contrastes optimizados para no fatigar la vista.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número de Solicitud
              </label>
              <input
                type="text"
                defaultValue="SOL-9012"
                className="w-full px-3.5 py-2 rounded-lg bg-[#0b0f19] border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Razón Social / Proveedor
              </label>
              <input
                type="text"
                defaultValue="Distribuidora Cuyo S.A."
                className="w-full px-3.5 py-2 rounded-lg bg-[#0b0f19] border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Forma de Pago
              </label>
              <select className="w-full px-3.5 py-2 rounded-lg bg-[#0b0f19] border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500">
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
