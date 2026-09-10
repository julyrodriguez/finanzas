/**
 * providersRegistry.ts
 * Registro y normalización centralizada de proveedores.
 * 
 * Obtiene los proveedores desde el servidor local MongoDB (apivacas.jariel.com.ar)
 * sin consumir lecturas de Firebase.
 * Utiliza caché en localStorage para autocompletado instantáneo (0ms)
 * y soporta registro inmediato de nuevos proveedores.
 */

import { fetchOrdersFromMongo } from "./serverSync";

export interface RegisteredProvider {
  id: string; // Clave normalizada
  name: string; // Nombre canónico principal
  norm: string; // Nombre normalizado sin sufijos
  aliases: string[]; // Variantes encontradas en OCs
  count: number; // Cantidad de órdenes con este proveedor
}

const REGISTRY_CACHE_KEY = "finanzas_proveedores_registry_v1";
const STATS_CACHE_KEY = "finanzas_estadisticas_cache_v1";

/**
 * Mapeos manuales de sinónimos conocidos
 */
export const MANUAL_PROVIDER_SYNONYMS: Record<string, string> = {
  "ping": "ping solutions",
  "ping solution": "ping solutions",
  "ping solutions": "ping solutions",
  "ping solutions argentina": "ping solutions",
};

/**
 * Descriptores corporativos y de actividad comunes
 */
export const GENERIC_DESCRIPTORS = new Set([
  "solution", "solutions", "soluciones",
  "servicio", "servicios", "service", "services",
  "sistema", "sistemas", "system", "systems",
  "tecnologia", "tecnologias", "tech", "technology", "technologies",
  "digital", "digitales",
  "grupo", "group",
  "logistica", "logistics",
  "distribuidora", "distribucion",
  "consultora", "consultoria", "consulting",
  "comunicaciones", "comunicacion", "communications",
  "producciones", "produccion", "productions", "production",
  "medios", "media",
  "seguridad", "security",
  "comercial", "comercializadora",
  "internacional", "international",
  "red", "redes",
  "publicidad", "marketing",
  "mantenimiento", "limpieza",
  "argentina", "arg", "sur", "latam",
]);

/**
 * Normaliza nombres de proveedores: quita acentos, sufijos legales (SA, SRL),
 * caracteres especiales y palabras de ruido.
 */
export function cleanProviderName(raw: string): string {
  if (!raw) return "";
  let s = raw.toLowerCase();

  // Quitar acentos
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Reemplazar & por y
  s = s.replace(/&/g, " y ");

  // Quitar puntos en siglas
  s = s.replace(/\./g, "");

  // Quitar puntuación
  s = s.replace(/[,/\-_()"\x27\[\]{}:;!#*+]/g, " ");

  // Quitar formas jurídicas
  s = s.replace(
    /\b(srl|sa|sas|sacifi|saci|sh|ute|sca|se|cisa|ltda|limitada|inc|corp|llc)\b/g,
    " "
  );

  // Quitar palabras de relleno
  s = s.replace(/\b(argentina|arg|de|del|la|el|los|las)\b/g, " ");

  s = s.replace(/\s+/g, " ").trim();

  if (s.length < 2) {
    s = raw.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  }

  if (MANUAL_PROVIDER_SYNONYMS[s]) {
    s = MANUAL_PROVIDER_SYNONYMS[s];
  }

  return s;
}

/**
 * Quita los puntos de siglas societarias como S.A. o S.R.L. dejándolas como SA o SRL
 * para el formato de copiado de órdenes liberadas.
 */
export function cleanLegalSuffixDots(name: string): string {
  if (!name) return "";
  return name
    .replace(/\bS\s*\.\s*R\s*\.\s*L\s*\.?(\b|\s|$)/gi, "SRL$1")
    .replace(/\bS\s*\.\s*A\s*\.\s*S\s*\.?(\b|\s|$)/gi, "SAS$1")
    .replace(/\bS\s*\.\s*A\s*\.?(\b|\s|$)/gi, "SA$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Distancia de Levenshtein básica
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Evalúa si dos nombres normalizados representan el mismo proveedor
 */
export function areSimilarProviders(norm1: string, norm2: string): boolean {
  if (norm1 === norm2) return true;
  if (!norm1 || !norm2) return false;

  if (norm1.length < 4 || norm2.length < 4) return false;

  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length >= norm2.length ? norm1 : norm2;

  // Jaccard similarity entre tokens
  const tokens1 = norm1.split(" ").filter(Boolean);
  const tokens2 = norm2.split(" ").filter(Boolean);

  if (tokens1.length > 1 && tokens2.length > 1) {
    const set2 = new Set(tokens2);
    const intersection = tokens1.filter((t) => set2.has(t));
    const union = new Set([...tokens1, ...tokens2]);
    if (intersection.length / union.size >= 0.6) return true;
  }

  // Contención con descriptores genéricos
  const shorterTokens = tokens1.length <= tokens2.length ? tokens1 : tokens2;
  const longerTokens = tokens1.length > tokens2.length ? tokens1 : tokens2;
  if (shorterTokens.length >= 1 && shorterTokens.join("").length >= 4) {
    const matchedLongerIndices = new Set<number>();
    let allMatched = true;
    for (const st of shorterTokens) {
      let foundIdx = -1;
      for (let i = 0; i < longerTokens.length; i++) {
        if (!matchedLongerIndices.has(i) && (longerTokens[i] === st || (st.length > 4 && longerTokens[i].startsWith(st)))) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        matchedLongerIndices.add(foundIdx);
      } else {
        allMatched = false;
        break;
      }
    }

    if (allMatched) {
      const remaining = longerTokens.filter((_, idx) => !matchedLongerIndices.has(idx));
      if (remaining.length > 0 && remaining.every((t) => GENERIC_DESCRIPTORS.has(t))) {
        return true;
      }
    }
  }

  // Tolerancia Levenshtein
  const maxLen = longer.length;
  const dist = levenshteinDistance(norm1, norm2);
  if (maxLen <= 6 && dist <= 1) return true;
  if (maxLen > 6 && maxLen <= 10 && dist <= 2) return true;
  if (maxLen > 10 && dist <= 3) return true;

  // Coincidencia por prefijo
  if (shorter.length >= 4 && longer.startsWith(shorter)) {
    const rem = longer.slice(shorter.length).trim();
    const remTokens = rem.split(" ").filter(Boolean);
    if (remTokens.length > 0 && remTokens.every((t) => GENERIC_DESCRIPTORS.has(t))) {
      return true;
    }
    if (shorter.length >= 6 && rem.length <= 4) {
      return true;
    }
  }

  return false;
}

/**
 * Procesa una lista de órdenes y agrupa los proveedores idénticos/similares
 */
export function extractProvidersFromOrders(orders: Array<{ razonSocial?: string }>): RegisteredProvider[] {
  const rawCounts: Record<string, number> = {};

  orders.forEach((o) => {
    const raw = (o.razonSocial || "").toString().trim();
    if (!raw || raw.toLowerCase() === "sin proveedor") return;
    rawCounts[raw] = (rawCounts[raw] || 0) + 1;
  });

  const uniqueRaws = Object.keys(rawCounts).sort((a, b) => rawCounts[b] - rawCounts[a]);

  interface Cluster {
    id: string;
    canonical: string;
    norm: string;
    rawNames: string[];
    totalCount: number;
  }

  const clusters: Cluster[] = [];

  for (const raw of uniqueRaws) {
    const norm = cleanProviderName(raw);
    let matchedCluster: Cluster | null = null;

    for (const c of clusters) {
      if (c.norm === norm || areSimilarProviders(c.norm, norm)) {
        matchedCluster = c;
        break;
      }
    }

    if (matchedCluster) {
      if (!matchedCluster.rawNames.includes(raw)) {
        matchedCluster.rawNames.push(raw);
      }
      matchedCluster.totalCount += rawCounts[raw];
      if (rawCounts[raw] > rawCounts[matchedCluster.canonical]) {
        matchedCluster.canonical = raw;
      }
    } else {
      clusters.push({
        id: norm || raw.toLowerCase(),
        canonical: raw,
        norm: norm,
        rawNames: [raw],
        totalCount: rawCounts[raw],
      });
    }
  }

  return clusters
    .map((c) => ({
      id: c.id,
      name: c.canonical,
      norm: c.norm,
      aliases: c.rawNames,
      count: c.totalCount,
    }))
    .sort((a, b) => b.count - a.count);
}

// En memoria para acceso instantáneo
let memoryRegistry: RegisteredProvider[] | null = null;
let isFetchingServer = false;

/**
 * Obtiene el registro de proveedores desde localStorage o memoria.
 * Si no existe o está desactualizado, sincroniza en segundo plano desde el servidor MongoDB.
 */
export async function getProvidersRegistry(forceRefresh = false): Promise<RegisteredProvider[]> {
  if (typeof window === "undefined") return [];

  // Si ya tenemos en memoria y no es refresh forzado, devolver directo
  if (memoryRegistry && memoryRegistry.length > 0 && !forceRefresh) {
    return memoryRegistry;
  }

  // 1. Intentar cargar desde localStorage de proveedores
  try {
    const cached = localStorage.getItem(REGISTRY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryRegistry = parsed;
        // Si no es forzado, retornamos de inmediato y actualizamos en segundo plano
        if (!forceRefresh) {
          triggerBackgroundSync();
          return memoryRegistry;
        }
      }
    }
  } catch (e) {
    console.warn("Error leyendo caché de proveedores:", e);
  }

  // 2. Intentar cargar desde el caché existente de Estadísticas si está disponible
  try {
    const statsCached = localStorage.getItem(STATS_CACHE_KEY);
    if (statsCached) {
      const parsed = JSON.parse(statsCached);
      if (Array.isArray(parsed.orders) && parsed.orders.length > 0) {
        const fromStats = extractProvidersFromOrders(parsed.orders);
        if (fromStats.length > 0) {
          memoryRegistry = fromStats;
          saveRegistryToCache(fromStats);
          triggerBackgroundSync();
          return memoryRegistry;
        }
      }
    }
  } catch (e) {
    console.warn("Error extrayendo proveedores de estadísticas:", e);
  }

  // 3. Si no hay nada en caché o fue refresh forzado, consultar a MongoDB
  await syncProvidersFromServer();
  return memoryRegistry || [];
}

/**
 * Sincroniza los proveedores consultando a MongoDB (apivacas.jariel.com.ar)
 */
async function syncProvidersFromServer(): Promise<void> {
  if (isFetchingServer) return;
  isFetchingServer = true;

  try {
    const res = await fetchOrdersFromMongo({ limit: 0 });
    if (res && res.success && Array.isArray(res.ordenes)) {
      const providers = extractProvidersFromOrders(res.ordenes);
      memoryRegistry = providers;
      saveRegistryToCache(providers);
    }
  } catch (err) {
    console.warn("⚠️ [Proveedores] No se pudo sincronizar desde MongoDB:", err);
  } finally {
    isFetchingServer = false;
  }
}

function triggerBackgroundSync() {
  if (isFetchingServer) return;
  // Disparar en background sin bloquear
  setTimeout(() => {
    syncProvidersFromServer().catch(() => {});
  }, 1000);
}

function saveRegistryToCache(providers: RegisteredProvider[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(providers));
  } catch (e) {
    console.warn("No se pudo guardar registro de proveedores en localStorage:", e);
  }
}

/**
 * Normaliza un término para búsqueda (minúsculas, sin acentos ni signos)
 */
function normalizeSearchTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ProviderSearchResult {
  provider: RegisteredProvider;
  matchType: "exact" | "canonical" | "alias";
  matchedText: string;
}

/**
 * Busca sugerencias de proveedores según el término tipeado (mínimo 3 caracteres).
 * Retorna las mejores coincidencias ordenadas por relevancia y frecuencia de uso.
 */
export function searchProviders(
  query: string,
  providers: RegisteredProvider[],
  limit = 8
): ProviderSearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const normQuery = normalizeSearchTerm(trimmed);
  if (!normQuery) return [];

  const results: ProviderSearchResult[] = [];

  for (const p of providers) {
    const normCanonical = normalizeSearchTerm(p.name);
    const cleanNorm = p.norm;

    // 1. Coincidencia exacta
    if (normCanonical === normQuery || cleanNorm === normQuery) {
      results.push({
        provider: p,
        matchType: "exact",
        matchedText: p.name,
      });
      continue;
    }

    // 2. Coincidencia en el nombre canónico
    if (normCanonical.startsWith(normQuery)) {
      results.push({
        provider: p,
        matchType: "canonical",
        matchedText: p.name,
      });
      continue;
    }

    if (normCanonical.includes(normQuery) || cleanNorm.includes(normQuery)) {
      results.push({
        provider: p,
        matchType: "canonical",
        matchedText: p.name,
      });
      continue;
    }

    // 3. Coincidencia en alguno de sus alias
    let matchedAlias: string | null = null;
    for (const alias of p.aliases) {
      const normAlias = normalizeSearchTerm(alias);
      if (normAlias.includes(normQuery)) {
        matchedAlias = alias;
        break;
      }
    }

    if (matchedAlias) {
      results.push({
        provider: p,
        matchType: "alias",
        matchedText: matchedAlias,
      });
    }
  }

  // Ordenar: exactos primero, luego por cantidad de órdenes (frecuencia)
  results.sort((a, b) => {
    if (a.matchType === "exact" && b.matchType !== "exact") return -1;
    if (b.matchType === "exact" && a.matchType !== "exact") return 1;
    return b.provider.count - a.provider.count;
  });

  return results.slice(0, limit);
}

/**
 * Registra un nuevo proveedor de inmediato en memoria y caché local.
 * Si ya existe, suma 1 a su contador de órdenes.
 * Garantiza que en la siguiente OC ya esté disponible de inmediato.
 */
export function registerNewProvider(rawName: string): RegisteredProvider {
  const trimmed = (rawName || "").trim();
  if (!trimmed) {
    throw new Error("Nombre de proveedor inválido");
  }

  const norm = cleanProviderName(trimmed);
  const currentList = memoryRegistry ? [...memoryRegistry] : [];

  // Buscar si ya existe similar
  let existing = currentList.find((p) => p.norm === norm || areSimilarProviders(p.norm, norm));

  if (existing) {
    existing.count += 1;
    if (!existing.aliases.includes(trimmed)) {
      existing.aliases.push(trimmed);
    }
  } else {
    existing = {
      id: norm || trimmed.toLowerCase(),
      name: trimmed,
      norm: norm,
      aliases: [trimmed],
      count: 1,
    };
    currentList.unshift(existing);
  }

  // Reordenar por frecuencia
  currentList.sort((a, b) => b.count - a.count);
  memoryRegistry = currentList;
  saveRegistryToCache(currentList);

  // Notificar a listeners si los hay en ventana
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("finanzas_provider_registered", { detail: existing }));
  }

  return existing;
}
