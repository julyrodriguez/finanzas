import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proceso de Liberación de Pagos",
  description: "Módulo de autorización y liberación de pagos por proveedor y compañía (Hoyts y CMK) con normalización y copiado rápido de datos.",
  alternates: {
    canonical: "/proceso-de-liberacion",
  },
  openGraph: {
    title: "Proceso de Liberación | Finanzas",
    description: "Autorización y liberación de pagos por proveedor y compañía.",
    url: "/proceso-de-liberacion",
  },
};

export default function ProcesoLiberacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
