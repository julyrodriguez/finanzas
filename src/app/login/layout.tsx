import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso al Sistema",
  description: "Iniciar sesión de forma segura en la plataforma corporativa de Finanzas.",
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
