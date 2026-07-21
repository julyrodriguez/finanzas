import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { 
  ShoppingBag, 
  Clock, 
  Plus, 
  Filter, 
  Download, 
  FileText, 
  Search,
  AlertCircle,
  Building,
  DollarSign
} from "lucide-react";

export default function OrdenesDeComprasPage() {
  const dummyOrders = [
    {
      id: "OC-2026-001",
      proveedor: "Suministros Tech S.A.S.",
      fecha: "20/07/2026",
      monto: "$ 4,500,000 COP",
      estado: "Pendiente Aprobación",
    },
    {
      id: "OC-2026-002",
      proveedor: "Servicios y Equipos Global",
      fecha: "18/07/2026",
      monto: "$ 12,300,000 COP",
      estado: "En Proceso",
    },
    {
      id: "OC-2026-003",
      proveedor: "Papelería & Oficina Corp",
      fecha: "15/07/2026",
      monto: "$ 890,000 COP",
      estado: "Completada",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#090d16]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header 
          title="Órdenes de Compra" 
          subtitle="Gestión, emisión y seguimiento de órdenes de adquisición de bienes y servicios" 
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Main Hero Card: Próximamente */}
          <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-[#0d1526] to-[#090d16] p-8 md:p-10 shadow-2xl">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Módulo en Construcción</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Gestión de Órdenes de Compra
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">
                    ¡Próximamente!
                  </span>
                </h2>

                <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                  Pronto podrás crear, cotizar, aprobar y descargar órdenes de compra digitales con firma electrónica y trazabilidad total de tus proveedores.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button 
                    disabled 
                    className="px-5 py-2.5 rounded-xl bg-indigo-600/40 text-gray-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-2 cursor-not-allowed opacity-80"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Órden de Compra (Próximamente)
                  </button>
                  <button 
                    disabled 
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 border border-white/10 text-xs font-medium flex items-center gap-2 cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    Exportar Reporte
                  </button>
                </div>
              </div>

              {/* Status Box */}
              <div className="lg:w-80 p-6 rounded-2xl glass-card border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Funcionalidades</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    En Desarrollo
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs text-gray-300">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Aprobación multinivel de compras
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Integración con catálogo de proveedores
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Generación de PDF automatizada
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Table Preview Skeleton / Mockup */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-400" />
                  Listado de Órdenes de Compra (Vista previa)
                </h3>
                <p className="text-xs text-gray-400">Demostración de la interfaz que se integrará</p>
              </div>

              {/* Filter Bar Controls Mockup */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    disabled
                    placeholder="Filtrar proveedor..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 opacity-60 cursor-not-allowed"
                  />
                </div>
                <button disabled className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 opacity-60 cursor-not-allowed">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="rounded-2xl glass-card border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Proveedor</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Monto Estimado</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {dummyOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-emerald-400 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-gray-500" />
                          {order.id}
                        </td>
                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-gray-500" />
                          {order.proveedor}
                        </td>
                        <td className="px-6 py-4 text-gray-400">{order.fecha}</td>
                        <td className="px-6 py-4 font-semibold text-gray-100">{order.monto}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {order.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="px-2 py-1 rounded bg-white/5 text-amber-400 text-[10px] font-medium border border-white/10">
                            Próximamente
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-white/5 bg-white/[0.01] text-center">
                <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Módulo de carga y creación de Órdenes de Compra disponible próximamente.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
