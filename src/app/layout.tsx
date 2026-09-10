import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://finanzas.jariel.com.ar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090d16",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Finanzas - Plataforma Corporativa",
    template: "%s | Finanzas",
  },
  description:
    "Plataforma corporativa integral para la gestión de órdenes de compra, control presupuestario, pagos a proveedores y métricas financieras de Cinemark & Hoyts.",
  applicationName: "Finanzas",
  authors: [{ name: "Finanzas Corporativo" }],
  generator: "Next.js",
  keywords: [
    "finanzas",
    "ordenes de compra",
    "proveedores",
    "cinemark",
    "hoyts",
    "gestion financiera",
    "pagos",
    "interbanking",
    "cotizaciones bna",
  ],
  referrer: "origin-when-cross-origin",
  creator: "Cinemark & Hoyts",
  publisher: "Cinemark & Hoyts",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName: "Finanzas - Plataforma Corporativa",
    title: "Finanzas - Plataforma Corporativa",
    description:
      "Gestión integral de órdenes de compra, pagos a proveedores, seguimiento presupuestario y métricas corporativas.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finanzas - Plataforma Corporativa",
    description:
      "Gestión integral de órdenes de compra, pagos a proveedores, seguimiento presupuestario y métricas corporativas.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#090d16] text-gray-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
