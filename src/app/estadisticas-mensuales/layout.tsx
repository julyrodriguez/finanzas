import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estadísticas Mensuales y Novedades",
  description: "Análisis mensual de órdenes de compra, comparativa trimestral de volúmenes, días pico, desglose OPEX vs CAPEX y proyecciones operativas.",
  alternates: {
    canonical: "/estadisticas-mensuales",
  },
  openGraph: {
    title: "Estadísticas Mensuales | Finanzas",
    description: "Comparativas mensuales, análisis de días pico, OPEX vs CAPEX y métricas de impacto de nuevos umbrales.",
    url: "/estadisticas-mensuales",
  },
};

export default function EstadisticasMensualesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
