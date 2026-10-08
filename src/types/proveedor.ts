export interface Proveedor {
  id: string;
  nombre: string;
  rubro: string;
  zona: string;
  descripcion_trabajos: string; // Pequeña información de sus trabajos / especialidad
  clientes_proyectos: string;    // Con quién trabajó o proyectos/clientes destacados
  email: string;                 // Correo de contacto principal
  telefono?: string;             // Teléfono o WhatsApp de contacto
  sitio_web?: string;            // Sitio web oficial o perfil comercial
  fuente: string;                // URL de referencia exacta de donde fue localizado
  fuente_nombre?: string;        // Nombre legible de la fuente (ej. "Sitio Oficial (climas.com.ar)", "Directorio Proveedores.com")
  tipo_fuente?: "sitio_oficial" | "directorio_empresarial" | "guia_b2b" | "camara_sectorial" | "web";
  confiabilidad?: "alta" | "media" | "baja"; // Calificación de confianza según datos verificados
  guardado?: boolean;            // Indicador si está guardado en favoritos/base local
  fecha_busqueda?: string;       // Timestamp de cuándo se descubrió
  notas?: string;                // Notas personalizadas de Cinemark & Hoyts
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
