import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Módulo Temporal y Carga Masiva",
  description: "Actualización masiva de compañías desde Columna D del Excel e importación por lotes de órdenes históricas a MongoDB.",
  alternates: {
    canonical: "/temporal",
  },
  openGraph: {
    title: "Módulo Temporal | Finanzas",
    description: "Actualización masiva de compañías e importación de órdenes históricas.",
    url: "/temporal",
  },
};

export default function TemporalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
