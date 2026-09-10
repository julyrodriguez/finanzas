import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seguimiento de Órdenes de Compra",
  description: "Consulta operativa del estado de tramitación, entrega y recepción de órdenes de compra para usuarios autorizados.",
  alternates: {
    canonical: "/seguimiento-de-ordenes",
  },
  openGraph: {
    title: "Seguimiento de Órdenes | Finanzas",
    description: "Consulta en tiempo real del estado de tramitación y entrega de órdenes de compra.",
    url: "/seguimiento-de-ordenes",
  },
};

export default function SeguimientoOrdenesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
