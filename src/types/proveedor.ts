export interface ProveedorCotizacionParticipacion {
  id: string;             // ID o firebaseId de la cotización
  name: string;           // Nombre de la cotización
  date?: string | Date;   // Fecha de creación
  status?: string;        // Estado (ej. 'finalizada', 'enviada', 'cancelada', 'borrador')
  isWinner?: boolean;     // Si resultó el proveedor ganador
  variantUsed?: string;   // Variante de nombre utilizada en la cotización (ej. "TACCO")
  itemsCount?: number;    // Cantidad de ítems cotizados
}

export interface Proveedor {
  id: string;
  _id?: string;
  nombre: string;
  norm?: string;
  aliases?: string[];            // Sinónimos o variantes registradas
  rubro?: string;
  zona?: string;
  ubicacion?: string;            // Ubicación física / zona de operaciones
  pais?: string;                 // País de radicación (ej. "Argentina", etc.)
  es_argentina?: boolean;        // Indicador si está radicado en Argentina
  descripcion_trabajos?: string; // Información de sus trabajos / especialidad
  clientes_proyectos?: string;    // Con quién trabajó o proyectos/clientes destacados
  email?: string;                // Correo de contacto principal (compatibilidad)
  emails?: string[];             // Lista de correos registrados (soporta múltiples emails)
  telefono?: string;             // Teléfono o WhatsApp de contacto
  sitio_web?: string;            // Sitio web oficial o perfil comercial
  linkedin?: string;             // Enlace o perfil de LinkedIn
  fuente?: string;               // URL de referencia o procedencia ('cotizaciones', 'busqueda_ia', etc.)
  fuente_nombre?: string;        // Nombre legible de la fuente
  tipo_fuente?: "sitio_oficial" | "directorio_empresarial" | "guia_b2b" | "camara_sectorial" | "web" | "cotizaciones" | "manual";
  confiabilidad?: "alta" | "media" | "baja"; // Calificación de confianza según datos verificados
  guardado?: boolean;            // Indicador si está guardado en favoritos/registro permanente
  fecha_busqueda?: string;       // Timestamp de cuándo se descubrió
  notas?: string;                // Notas personalizadas de Cinemark & Hoyts
  cotizaciones?: ProveedorCotizacionParticipacion[]; // Cotizaciones en las que participó
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type SearchEngineType = "hybrid" | "firecrawl";
export type SearchDepthType = "profunda" | "rapida";

export interface ProveedorSearchParams {
  rubro: string;
  zona: string;
  especificaciones?: string;
  engine?: SearchEngineType;
  profundidad?: SearchDepthType;
  geminiApiKey?: string;
  firecrawlApiKey?: string;
}

export interface ProveedorSearchResult {
  success: boolean;
  proveedores: Proveedor[];
  engineUsed: SearchEngineType;
  query: string;
  zona: string;
  total: number;
  message?: string;
  logs?: string[];
}

export interface DraftEmailParams {
  proveedores: Proveedor[];
  asunto?: string;
  solicitud: string;
  complejo?: string;
  fechaLimite?: string;
  contactoRemitente?: {
    nombre: string;
    cargo: string;
    empresa: string;
    telefono: string;
  };
}

export interface DraftEmailResult {
  success: boolean;
  subject: string;
  body: string;
  recipients: string[];
}
