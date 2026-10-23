import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compras - Cotizaciones",
  description: "Gestión, consulta y comparativa de cotizaciones de compras por rubro y proveedor.",
  alternates: {
    canonical: "/cotizaciones",
  },
  openGraph: {
    title: "Compras - Cotizaciones | Finanzas",
    description: "Gestión, consulta y comparativa de cotizaciones de compras por rubro y proveedor.",
    url: "/cotizaciones",
  },
};

export default function CotizacionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
