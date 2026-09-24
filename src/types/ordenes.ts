import { Timestamp, FieldValue } from "firebase/firestore";

export interface Nota {
  id: string;
  texto: string;
  autor: string;
  fecha: string;
}

export interface OrdenCompra {
  id?: string;
  empresa: "Hoyts" | "CMK";
  numSolicitud: string;
  numOC: string;
  razonSocial: string;
  monto: number | string;
  motivo: string;
  formaPago: string;
  liberada: boolean;
  mandada: boolean;
  entregada?: boolean;
  cancelada?: boolean;
  creadoPor?: string;
  notas?: Nota[];
  createdAt?: Timestamp | FieldValue | null;
  relatedOC?: string;
  enviado?: boolean;
  firmado1?: boolean;
  firmado2?: boolean;
  firmante1?: string;
  firmante2?: string;
  fechaFirma1?: string;
  fechaFirma2?: string;
  linkSharepoint?: string;
  enviadoA1?: string;
  enviadoA2?: string;
  fechaEnvio1?: string;
  fechaEnvio2?: string;
}

export interface CreadorBadgeStyle {
  badge: string;
  icon: string;
  text: string;
  name: string;
}

export function getCreadorBadgeStyle(creador?: string): CreadorBadgeStyle {
  const c = (creador || "").toLowerCase().trim();
  if (c.includes("oalvarez")) {
    return {
      badge: "bg-pink-500/15 border-pink-500/30 text-pink-300 font-semibold shadow-sm shadow-pink-950/20",
      icon: "text-pink-400",
      text: "text-pink-300",
      name: creador || "oalvarez",
    };
  }
  if (c.includes("julian")) {
    return {
      badge: "bg-blue-500/15 border-blue-500/30 text-blue-300 font-semibold shadow-sm shadow-blue-950/20",
      icon: "text-blue-400",
      text: "text-blue-300",
      name: creador || "julian",
    };
  }
  if (c.includes("talbrecht")) {
    return {
      badge: "bg-red-500/15 border-red-500/30 text-red-300 font-semibold shadow-sm shadow-red-950/20",
      icon: "text-red-400",
      text: "text-red-300",
      name: creador || "talbrecht",
    };
  }
  return {
    badge: "bg-white/[0.04] border-white/5 text-slate-300 font-medium",
    icon: "text-slate-400",
    text: "text-slate-300",
    name: creador || "Usuario",
  };
}
