import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pendientes de Pago y Tareas",
  description: "Control de órdenes de compra pendientes de entrega o liberación, notas de gestión operativa y recordatorios compartidos.",
  alternates: {
    canonical: "/pendientes",
  },
  openGraph: {
    title: "Pendientes de Pago | Finanzas",
    description: "Control de órdenes de compra pendientes de entrega o liberación.",
    url: "/pendientes",
  },
};

export default function PendientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
