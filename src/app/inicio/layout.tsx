import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard y Resumen Financiero",
  description: "Panel principal con indicadores clave, órdenes de compra recientes, distribución presupuestaria y cotizaciones oficiales en tiempo real.",
  alternates: {
    canonical: "/inicio",
  },
  openGraph: {
    title: "Dashboard y Resumen Financiero | Finanzas",
    description: "Panel principal con indicadores clave, órdenes de compra recientes y cotizaciones en vivo.",
    url: "/inicio",
  },
};

export default function InicioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
