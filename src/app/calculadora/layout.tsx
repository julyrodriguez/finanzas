import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculadora Financiera y Conversor",
  description: "Calculadora de importes netos, discriminación de alícuotas de IVA (21% y 10.5%), retenciones impositivas y cotización BNA.",
  alternates: {
    canonical: "/calculadora",
  },
  openGraph: {
    title: "Calculadora Financiera | Finanzas",
    description: "Cálculo de importes netos, IVA, retenciones y conversión de divisas.",
    url: "/calculadora",
  },
};

export default function CalculadoraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
