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
