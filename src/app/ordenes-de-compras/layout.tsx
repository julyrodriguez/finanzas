import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Órdenes de Compra | Finanzas",
  description: "Gestión corporativa, estados, autorizaciones y seguimiento presupuestario de Cinemark & Hoyts.",
  alternates: {
    canonical: "/ordenes-de-compras",
  },
};

export default function OrdenesDeComprasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
