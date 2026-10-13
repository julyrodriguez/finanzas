import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registro y Buscador de Proveedores",
  description: "Registro centralizado de proveedores, asimilación de cotizaciones y buscador inteligente con IA.",
  alternates: {
    canonical: "/proveedores",
  },
  openGraph: {
    title: "Registro de Proveedores | Finanzas",
    description: "Padrón centralizado de proveedores de Cinemark & Hoyts.",
    url: "/proveedores",
  },
};

export default function ProveedoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
