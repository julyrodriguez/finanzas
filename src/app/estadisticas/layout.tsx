import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estadísticas Financieras y KPIs",
  description: "Análisis histórico exhaustivo de gastos, comparativas anuales y mensuales, evolución de costos, ranking de proveedores y ratios Hoyts vs CMK.",
  alternates: {
    canonical: "/estadisticas",
  },
  openGraph: {
    title: "Estadísticas Financieras | Finanzas",
    description: "Métricas históricas, comparativa por año y mes, ranking de proveedores y distribución de costos.",
    url: "/estadisticas",
  },
};

export default function EstadisticasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
