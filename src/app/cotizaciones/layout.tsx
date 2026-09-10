import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cotizaciones Oficiales BNA y Divisas",
  description: "Monitoreo en tiempo real de tipos de cambio del Banco Nación Argentina: Dólar Oficial, Dólar Tarjeta, Euro y calculadora de conversión.",
  alternates: {
    canonical: "/cotizaciones",
  },
  openGraph: {
    title: "Cotizaciones Oficiales BNA | Finanzas",
    description: "Monitoreo en tiempo real de tipos de cambio del Banco Nación Argentina.",
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
