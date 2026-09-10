import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendario de Pagos y Vencimientos",
  description: "Cronograma interactivo de vencimientos, programación de pagos a proveedores y control de flujos de fondos mensuales.",
  alternates: {
    canonical: "/calendario",
  },
  openGraph: {
    title: "Calendario de Pagos y Vencimientos | Finanzas",
    description: "Planificación de fechas de vencimiento y programación de pagos a proveedores.",
    url: "/calendario",
  },
};

export default function CalendarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
