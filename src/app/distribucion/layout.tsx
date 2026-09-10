import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Distribución de Gastos por Empresa",
  description: "Herramienta de cálculo y reparto porcentual de facturas y órdenes de compra entre Hoyts y Cinemark (CMK).",
  alternates: {
    canonical: "/distribucion",
  },
  openGraph: {
    title: "Distribución de Gastos | Finanzas",
    description: "Cálculo y distribución porcentual de costos entre Hoyts y Cinemark.",
    url: "/distribucion",
  },
};

export default function DistribucionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
