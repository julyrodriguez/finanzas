/**
 * Utilidades para cotizaciones: áreas estándar, formateo de creadores y resolución de usuarios.
 */

export const STANDARD_AREAS = [
  "Mantenimiento",
  "IT / Sistemas",
  "Servicios/Operaciones",
  "Marketing",
  "PCT/PLIEGOS",
  "Concesión / Candy",
  "Proyección",
  "RRHH",
  "Finanzas",
  "Compras",
  "Seguridad e Higiene",
] as const;

/**
 * Convierte un email o identificador de creador en un nombre legible para la UI.
 * Ej: "julian@equipo.local" -> "Julián"
 *     "talbrecht@equipo.local" -> "Tomás Albrecht"
 *     "oalvarez@equipo.local" -> "O. Álvarez"
 */
export function formatCreatorName(raw?: string | null): string {
  if (!raw || !raw.trim()) return "Sin creador";
  const trimmed = raw.trim();

  // Si ya es un nombre sin arroba, devolverlo formateado
  if (!trimmed.includes("@")) {
    return trimmed;
  }

  const prefix = trimmed.split("@")[0].toLowerCase();

  const knownMap: Record<string, string> = {
    julian: "Julián",
    talbrecht: "Tomás Albrecht",
    oalvarez: "O. Álvarez",
    ordenes: "Usuario Órdenes",
    finanbot: "FinanBot (IA)",
    admin: "Administrador",
    compras: "Compras",
    finanzas: "Finanzas",
  };

  if (knownMap[prefix]) {
    return knownMap[prefix];
  }

  // Si tiene formato nombre.apellido o nombre_apellido -> Nombre Apellido
  const formatted = prefix
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return formatted || trimmed;
}

/**
 * Obtiene el nombre legible del usuario autenticado actual para guardarlo como creador.
 */
export function resolveUserDisplayName(user: any): string {
  if (!user) return "Usuario";
  if (user.displayName && typeof user.displayName === "string" && user.displayName.trim()) {
    return user.displayName.trim();
  }
  if (user.email && typeof user.email === "string" && user.email.trim()) {
    return formatCreatorName(user.email);
  }
  return "Usuario";
}
