import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Módulo Interbanking y Descargas",
  description: "Automatización de inicio de sesión y descarga masiva de comprobantes de transferencias bancarias en PDF por lote y empresa.",
  alternates: {
    canonical: "/interbanking",
  },
  openGraph: {
    title: "Módulo Interbanking | Finanzas",
    description: "Automatización y descarga de comprobantes de transferencias bancarias.",
    url: "/interbanking",
  },
};

export default function InterbankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
