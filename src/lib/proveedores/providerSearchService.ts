import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  Proveedor, 
  ProveedorSearchParams, 
  ProveedorSearchResult, 
  SearchEngineType, 
  SearchDepthType 
} from "@/types/proveedor";

const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

const DISALLOWED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "youtube.com",
  "wikipedia.org",
  "linkedin.com/login",
];

export function isForeignDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host.endsWith(".com.co") ||
      host.endsWith(".net.co") ||
      host.endsWith(".org.co") ||
      host.endsWith(".edu.co") ||
      host.endsWith(".gov.co") ||
      host.endsWith(".com.mx") ||
      host.endsWith(".com.cl") ||
      host.endsWith(".com.pe") ||
      host.endsWith(".es") ||
      host.includes("eldirectorio.co") ||
      host.includes("amarillascolombia") ||
      host.includes("paginasamarillas.com.co") ||
      host.includes("directoriodeempresas.co") ||
      host.startsWith("co.kompass.") ||
      host.startsWith("co.cylex.") ||
      host.startsWith("colombia.proveedores.")
    ) {
      return true;
    }
    if (host.endsWith(".co") && !host.endsWith(".com.ar") && !host.endsWith(".co.ar")) {
      if (host.includes("directorio") || host.includes("empresa") || host.includes("comercio") || host.includes("amarilla")) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function normalizeGeoTarget(zona: string): {
  isArgentinaTarget: boolean;
  searchGeoSuffix: string;
  specificZone: string;
  ddgRegion: string;
} {
  const clean = (zona || "").toLowerCase().trim();
  const isArgentina =
    !clean ||
    clean.includes("todo el pa") ||
    clean.includes("toda argentina") ||
    clean.includes("nacional") ||
    clean.includes("caba") ||
    clean.includes("gba") ||
    clean.includes("buenos aires") ||
    clean.includes("capital federal") ||
    clean.includes("cordoba") ||
    clean.includes("córdoba") ||
    clean.includes("mendoza") ||
    clean.includes("rosario") ||
    clean.includes("santa fe") ||
    clean.includes("neuquen") ||
    clean.includes("neuquén") ||
    clean.includes("salta") ||
    clean.includes("tucuman") ||
    clean.includes("tucumán") ||
    clean.includes("argentina");

  let searchGeoSuffix = "Argentina";
  let specificZone = zona;

  if (clean.includes("todo el pa") || clean.includes("nacional")) {
    searchGeoSuffix = 'Argentina "cobertura nacional"';
    specificZone = "Todo el país (Argentina)";
  } else if (clean.includes("caba") || clean.includes("gba") || clean.includes("buenos aires")) {
    searchGeoSuffix = 'Argentina ("CABA" OR "Buenos Aires" OR "GBA")';
    specificZone = "CABA y GBA, Argentina";
  } else if (isArgentina) {
    searchGeoSuffix = `${zona} Argentina`;
    specificZone = `${zona}, Argentina`;
  }

  return {
    isArgentinaTarget: isArgentina,
    searchGeoSuffix,
    specificZone,
    ddgRegion: isArgentina ? "ar-es" : "wt-wt",
  };
}

interface RawSearchItem {
  title: string;
  url: string;
  snippet: string;
  queryTag?: string;
}

interface ScrapedContactInfo {
  url: string;
  emails: string[];
  phones: string[];
  pageSnippet: string;
  detectedPais: string;
  esArgentina: boolean;
  detectedCity?: string;
}

/**
 * Determina el nombre descriptivo y tipo de fuente a partir de la URL de origen
 */
function classifySource(sourceUrl: string, companyName?: string): {
  fuente_nombre: string;
  tipo_fuente: "sitio_oficial" | "directorio_empresarial" | "guia_b2b" | "camara_sectorial" | "web";
} {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (
      host.includes("proveedores.com") ||
      host.includes("kompass.com") ||
      host.includes("leadset.ai") ||
      host.includes("dir.ar") ||
      host.includes("guiaindustrial") ||
      host.includes("paginasamarillas") ||
      host.includes("cylex") ||
      host.includes("argentinaproveedores") ||
      host.includes("guiafe")
    ) {
      return {
        fuente_nombre: `Directorio Empresarial (${host})`,
        tipo_fuente: "directorio_empresarial",
      };
    }

    if (host.includes("mercadolibre")) {
      return {
        fuente_nombre: `Mercado Libre Servicios (${host})`,
        tipo_fuente: "directorio_empresarial",
      };
    }

    if (
      host.includes("camara") ||
      host.includes("cac.com.ar") ||
      host.includes("cadiem") ||
      host.includes("uocra") ||
      host.includes("adimra") ||
      host.includes("colegio")
    ) {
      return {
        fuente_nombre: `Cámara Sectorial / Registro (${host})`,
        tipo_fuente: "camara_sectorial",
      };
    }

    // Si el nombre de la empresa coincide con el dominio, es muy probable que sea su sitio oficial
    const cleanCompany = (companyName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanCompany && (host.replace(/[^a-z0-9]/g, "").includes(cleanCompany) || cleanCompany.includes(host.split(".")[0]))) {
      return {
        fuente_nombre: `Sitio Web Oficial (${host})`,
        tipo_fuente: "sitio_oficial",
      };
    }

    return {
      fuente_nombre: `Portal Comercial / Web (${host})`,
      tipo_fuente: "web",
    };
  } catch {
    return {
      fuente_nombre: "Fuente Web",
      tipo_fuente: "web",
    };
  }
}

function sanitizeSearchTerm(text: string): string {
  if (!text) return "";
  return text
    .replace(/["'«»“”]/g, " ")
    .replace(/&/g, " y ")
    .replace(/[\/\\#,+()$~%.^:*?<>{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonRobustly(rawText: string): any {
  if (!rawText || typeof rawText !== "string") return null;
  try {
    return JSON.parse(rawText.trim());
  } catch (e0) {}

  const mdRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  const blocks: string[] = [];
  while ((match = mdRegex.exec(rawText)) !== null) {
    blocks.push(match[1]);
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(blocks[i].trim());
    } catch (e1) {}
  }

  const lastBrace = rawText.lastIndexOf("}");
  if (lastBrace !== -1) {
    let depth = 0;
    let start = -1;
    for (let i = lastBrace; i >= 0; i--) {
      if (rawText[i] === "}") depth++;
      else if (rawText[i] === "{") {
        depth--;
        if (depth === 0) {
          start = i;
          break;
        }
      }
    }
    if (start !== -1) {
      try {
        return JSON.parse(rawText.substring(start, lastBrace + 1));
      } catch (e2) {}
    }
  }

  return null;
}

/**
 * Realiza una búsqueda web a través de DuckDuckGo HTML con parseo robusto y regionalización
 */
async function searchWebDuckDuckGo(
  query: string,
  maxResults = 10,
  queryTag = "",
  region = "ar-es",
  filterForeign = true
): Promise<RawSearchItem[]> {
  try {
    const params = new URLSearchParams();
    params.append("q", query);
    if (region) {
      params.append("kl", region);
    }

    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      return [];
    }

    const html = await res.text();
    const results: RawSearchItem[] = [];

    const resultItemRegex = /<a class="result__url" href="([^"]+)">(?:[\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = resultItemRegex.exec(html)) !== null && results.length < maxResults) {
      let rawUrl = match[1].trim();
      let snippet = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      if (rawUrl.includes("uddg=")) {
        try {
          const parsed = new URL("https://html.duckduckgo.com" + rawUrl);
          const uddg = parsed.searchParams.get("uddg");
          if (uddg) rawUrl = decodeURIComponent(uddg);
        } catch {}
      }

      const isDisallowed = DISALLOWED_DOMAINS.some((d) => rawUrl.toLowerCase().includes(d));
      const isForeign = filterForeign && isForeignDomain(rawUrl);

      if (!isDisallowed && !isForeign && rawUrl.startsWith("http")) {
        let title = "";
        try {
          const u = new URL(rawUrl);
          title = u.hostname.replace(/^www\./, "");
        } catch {
          title = rawUrl;
        }

        results.push({
          title,
          url: rawUrl,
          snippet,
          queryTag,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error en searchWebDuckDuckGo:", error);
    return [];
  }
}

/**
 * Escanea un sitio web para extraer correos electrónicos, teléfonos, antecedentes y país de radicación
 */
async function scrapeSiteContacts(url: string): Promise<ScrapedContactInfo> {
  const result: ScrapedContactInfo = {
    url,
    emails: [],
    phones: [],
    pageSnippet: "",
    detectedPais: "Argentina",
    esArgentina: true,
  };

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return result;

    const html = await res.text();
    const textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ");
    const textLower = textOnly.toLowerCase();
    const urlLower = url.toLowerCase();

    // Detección de Colombia u otros países en el HTML
    const isColHost = isForeignDomain(url);
    const colKeywords = [
      "bogotá", "bogota", "medellín", "medellin", "cali", "barranquilla", "bucaramanga",
      "cartagena", "cundinamarca", "antioquia", "valle del cauca", "colombia"
    ];
    const hasColMarkers = colKeywords.filter((k) => textLower.includes(k));
    const hasColNit = textLower.includes("nit ") || textLower.includes("nit:") || textLower.includes("nit.");
    const hasColPhone = /\+57\s*\d|\(57\)\s*\d|60[1-5]\s*\d{7}/.test(textOnly);

    if (isColHost || hasColPhone || (hasColMarkers.length >= 2 && hasColNit) || (textLower.includes("colombia") && hasColMarkers.length >= 1)) {
      result.detectedPais = "Colombia";
      result.esArgentina = false;
      result.detectedCity = hasColMarkers[0] || "Colombia";
    }

    // Detección explícita de Argentina
    const argKeywords = [
      "buenos aires", "caba", "capital federal", "gran buenos aires", "gba",
      "córdoba", "rosario", "santa fe", "mendoza", "neuquén", "salta", "tucumán",
      "cuit", "afip", "arca", "argentina"
    ];
    const hasArgMarkers = argKeywords.filter((k) => textLower.includes(k));
    const hasArgPhone = /\+54\s*9?|\b011\s*\d|\(011\)|\b11\s*\d{4}\s*\d{4}/.test(textOnly);

    if (urlLower.includes(".com.ar") || urlLower.endsWith(".ar") || hasArgPhone || (hasArgMarkers.length > 0 && !hasColPhone)) {
      result.detectedPais = "Argentina";
      result.esArgentina = true;
      result.detectedCity = hasArgMarkers[0] ? hasArgMarkers[0].toUpperCase() : "Argentina";
    }

    // Regex para correos válidos
    const emailMatches = html.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || [];
    const validEmails = Array.from(new Set(emailMatches))
      .filter((e) => {
        const lower = e.toLowerCase();
        return (
          !lower.endsWith(".png") &&
          !lower.endsWith(".jpg") &&
          !lower.endsWith(".webp") &&
          !lower.endsWith(".svg") &&
          !lower.includes("example") &&
          !lower.includes("sentry") &&
          !lower.includes("domain") &&
          !lower.includes("wix")
        );
      })
      .slice(0, 3);
    result.emails = validEmails;

    // Teléfonos
    const phoneMatches = html.match(/(?:\+?54[\s-]?(?:9[\s-]?)?)?(?:0?[1-9]\d{1,3}[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g) || [];
    const cleanPhones = Array.from(new Set(phoneMatches))
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.replace(/\D/g, "").length >= 8 && p.replace(/\D/g, "").length <= 15)
      .slice(0, 2);
    result.phones = cleanPhones;

    // Antecedentes / obras
    const matchesClients = textOnly.match(/(?:clientes|trabajos|servicios|proyectos|obras|experiencia)[\s\S]{50,250}/gi);
    if (matchesClients && matchesClients.length > 0 && matchesClients[0]) {
      result.pageSnippet = matchesClients[0].replace(/\s+/g, " ").trim();
    }
  } catch {}

  return result;
}

/**
 * Consulta la API oficial de Firecrawl si se dispone de FIRECRAWL_API_KEY
 */
async function searchWithFirecrawl(query: string, apiKey: string, limit = 12): Promise<RawSearchItem[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firecrawl API respondió ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const items: RawSearchItem[] = [];

    if (data?.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        items.push({
          title: item.title || item.metadata?.title || "Proveedor",
          url: item.url || item.metadata?.sourceURL || "",
          snippet: item.markdown ? item.markdown.slice(0, 500) : item.description || "",
          queryTag: "Firecrawl",
        });
      }
    }

    return items;
  } catch (error) {
    console.error("Error en searchWithFirecrawl:", error);
    throw error;
  }
}

/**
 * Función principal para buscar y extraer una lista extensa de proveedores con IA y fuentes detalladas
 */
export async function searchProveedores(params: ProveedorSearchParams): Promise<ProveedorSearchResult> {
  const { rubro, zona, especificaciones, engine = "hybrid", profundidad = "profunda", firecrawlApiKey } = params;
  const logs: string[] = [];

  const apiKeyToUse = firecrawlApiKey || process.env.FIRECRAWL_API_KEY || "";
  let engineUsed: SearchEngineType = engine;
  let rawItems: RawSearchItem[] = [];

  const geoInfo = normalizeGeoTarget(zona);
  const cleanRubro = sanitizeSearchTerm(rubro);
  const isDeep = profundidad !== "rapida";

  if (geoInfo.isArgentinaTarget) {
    logs.push(`Filtro geográfico activo: Priorizando estrictamente Argentina (${geoInfo.specificZone}) y bloqueando dominios extranjeros.`);
  }

  // Paso 1: Obtener resultados web según el motor y la profundidad
  if (engine === "firecrawl" && apiKeyToUse) {
    try {
      logs.push(`Consultando API de Firecrawl (Búsqueda profunda para "${rubro}" en "${geoInfo.specificZone}")...`);
      const searchQuery = `proveedores empresas contratistas ${cleanRubro} ${geoInfo.searchGeoSuffix} contacto presupuestos`;
      const fcItems = await searchWithFirecrawl(searchQuery, apiKeyToUse, 15);
      rawItems = fcItems.filter((it) => !geoInfo.isArgentinaTarget || !isForeignDomain(it.url));
      logs.push(`Firecrawl indexó ${rawItems.length} fuentes web y directorios verificados.`);
    } catch (err: any) {
      logs.push(`Aviso Firecrawl (${err.message}). Activando fallback al Motor Híbrido Multicriterio.`);
      engineUsed = "hybrid";
    }
  }

  // Si no se usó Firecrawl o falló, ejecutar Búsqueda Multicriterio Profunda
  if (rawItems.length === 0) {
    logs.push(`Iniciando búsqueda multicriterio ${isDeep ? "exhaustiva" : "rápida"} para "${rubro}" en "${geoInfo.specificZone}"...`);

    // Consultas dirigidas a Argentina con anclas geográficas fuertes
    const queries = [
      { q: `proveedores empresas "${cleanRubro}" ${geoInfo.searchGeoSuffix} contacto email`, tag: "Empresas Directas" },
      { q: `servicios contratistas "${cleanRubro}" ${geoInfo.specificZone} clientes nosotros`, tag: "Servicios Locales" },
      { q: `"${cleanRubro}" Argentina site:com.ar contacto presupuesto`, tag: "Empresas .com.ar" },
      { q: `site:servicios.mercadolibre.com.ar "${cleanRubro}" ${geoInfo.searchGeoSuffix}`, tag: "Mercado Libre Servicios" },
      { q: `site:mercadolibre.com.ar/servicios "${cleanRubro}" Argentina`, tag: "Mercado Libre Servicios Arg" },
    ];

    const subTerms = cleanRubro.split(/\s+y\s+|\s*,\s*|\s+e\s+/i).map((t) => t.trim()).filter((t) => t.length > 2);
    if (subTerms.length > 1) {
      for (const sub of subTerms) {
        queries.push({
          q: `proveedores contratistas "${sub}" ${geoInfo.searchGeoSuffix} contacto`,
          tag: `Especialidad: ${sub}`,
        });
      }
    }

    if (isDeep) {
      queries.push(
        { q: `"mercadolibre.com.ar" empresas proveedores "${cleanRubro}" Argentina`, tag: "Mercado Libre Proveedores" },
        { q: `directorio comercial empresas "${cleanRubro}" Argentina "Buenos Aires" OR CABA telefono`, tag: "Directorios Comerciales" },
        { q: `camara empresas contratistas "${cleanRubro}" Argentina`, tag: "Cámaras Sectoriales" },
        { q: `presupuesto cotizacion "${cleanRubro}" empresas ${geoInfo.specificZone}`, tag: "Presupuestos B2B" },
        { q: `proveedores de "${cleanRubro}" en Argentina guia comercial`, tag: "Guías Argentinas" }
      );
    }

    logs.push(`Ejecutando consultas paralelas para ${queries.map((q) => q.tag).join(", ")}...`);

    const queryBatches = await Promise.all(
      queries.map((q) => searchWebDuckDuckGo(q.q, isDeep ? 9 : 6, q.tag, geoInfo.ddgRegion, geoInfo.isArgentinaTarget))
    );

    // Unificar y desduplicar (permitiendo publicaciones múltiples de Mercado Libre)
    const seenDomains = new Set<string>();
    const seenMlUrls = new Set<string>();
    const combined: RawSearchItem[] = [];

    for (const batch of queryBatches) {
      for (const item of batch) {
        try {
          const u = new URL(item.url);
          const domain = u.hostname.replace(/^www\./, "");
          if (domain.includes("mercadolibre")) {
            const cleanPath = u.pathname;
            if (!seenMlUrls.has(cleanPath) && seenMlUrls.size < 6) {
              seenMlUrls.add(cleanPath);
              combined.push(item);
            }
          } else if (!seenDomains.has(domain)) {
            seenDomains.add(domain);
            combined.push(item);
          }
        } catch {
          combined.push(item);
        }
      }
    }

    // Investigar a fondo en la web a los proveedores detectados en Mercado Libre
    const mlItems = combined.filter((it) => it.url.toLowerCase().includes("mercadolibre"));
    if (mlItems.length > 0) {
      logs.push(`Detectadas ${mlItems.length} publicaciones en Mercado Libre. Investigando a los proveedores en la web...`);

      const mlInvestigateQueries: { q: string; tag: string }[] = [];
      for (const mlItem of mlItems.slice(0, 4)) {
        const cleanTitle = mlItem.title
          .replace(/mercado\s*libre/gi, "")
          .replace(/servicio\s*de/gi, "")
          .replace(/encontr[aá]/gi, "")
          .replace(/\b(caba|gba|buenos aires|argentina)\b/gi, "")
          .replace(/[-|–•]/g, " ")
          .trim();

        const companyMatch = mlItem.snippet.match(/(?:somos|empresa|contacto|taller|servicios)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñA-Z0-9\s]{3,25})/i);
        const candidateName = companyMatch ? companyMatch[1].trim() : cleanTitle.split(" ").slice(0, 4).join(" ");

        if (candidateName && candidateName.length > 3) {
          mlInvestigateQueries.push({
            q: `"${candidateName}" Argentina contacto telefono web`,
            tag: `Investigación Web ML (${candidateName})`,
          });
        }
      }

      if (mlInvestigateQueries.length > 0) {
        const mlWebResults = await Promise.all(
          mlInvestigateQueries.map((iq) =>
            searchWebDuckDuckGo(iq.q, 3, iq.tag, geoInfo.ddgRegion, geoInfo.isArgentinaTarget)
          )
        );

        for (const batch of mlWebResults) {
          for (const item of batch) {
            try {
              const u = new URL(item.url);
              const domain = u.hostname.replace(/^www\./, "");
              if (!seenDomains.has(domain) && !domain.includes("mercadolibre")) {
                seenDomains.add(domain);
                combined.push(item);
                logs.push(`Proveedor investigado en la web: ${item.title} (${domain})`);
              }
            } catch {}
          }
        }
      }
    }

    rawItems = combined.slice(0, isDeep ? 28 : 15);
    logs.push(`Se localizaron ${rawItems.length} portales, empresas y publicaciones únicas verificadas.`);
  }

  // Paso 2: Escaneo en lotes de los sitios más prometedores
  const scrapeLimit = isDeep ? 16 : 8;
  const scrapeTargets = rawItems.slice(0, scrapeLimit);
  logs.push(`Inspeccionando a fondo información de contacto y antecedentes de ${scrapeTargets.length} sitios webs...`);

  const half = Math.ceil(scrapeTargets.length / 2);
  const batchA = await Promise.all(scrapeTargets.slice(0, half).map((item) => scrapeSiteContacts(item.url)));
  const batchB = await Promise.all(scrapeTargets.slice(half).map((item) => scrapeSiteContacts(item.url)));
  const contactsScraped = [...batchA, ...batchB];

  const contactMap = new Map<string, ScrapedContactInfo>();
  for (const c of contactsScraped) {
    contactMap.set(c.url, c);
  }

  // Paso 3: Armar contexto amplio para Gemini con alerta de país
  let evidenceText = `CONSULTA DE BÚSQUEDA EXHAUSTIVA:\n- Rubro: ${rubro}\n- Zona: ${zona} (${geoInfo.specificZone})\n`;
  if (especificaciones) {
    evidenceText += `- Requerimientos especiales: ${especificaciones}\n`;
  }
  evidenceText += `\nEVIDENCIA Y FUENTES DETALLADAS (${rawItems.length} fuentes encontradas):\n`;

  rawItems.forEach((item, idx) => {
    const scraped = contactMap.get(item.url);
    const emailsStr = scraped?.emails.length ? `Emails extraídos del sitio: ${scraped.emails.join(", ")}` : "";
    const phonesStr = scraped?.phones.length ? `Teléfonos extraídos: ${scraped.phones.join(", ")}` : "";
    const extraSnippet = scraped?.pageSnippet ? `Sección cartera/obras: ${scraped.pageSnippet}` : "";
    const classification = classifySource(item.url);
    const paisDet = scraped?.detectedPais || "Argentina";
    const avisoPais = scraped?.esArgentina === false ? ` ⚠️ [AVISO: PAÍS ${paisDet.toUpperCase()}]` : ` [PAÍS: ${paisDet.toUpperCase()}]`;

    evidenceText += `\n[Fuente ${idx + 1} - ${item.queryTag || classification.tipo_fuente}]${avisoPais}:\n`;
    evidenceText += `Título: ${item.title}\n`;
    evidenceText += `URL de Origen (Fuente): ${item.url}\n`;
    evidenceText += `Tipo de Fuente: ${classification.tipo_fuente} (${classification.fuente_nombre})\n`;
    evidenceText += `Descripción: ${item.snippet}\n`;
    if (emailsStr) evidenceText += `${emailsStr}\n`;
    if (phonesStr) evidenceText += `${phonesStr}\n`;
    if (extraSnippet) evidenceText += `${extraSnippet}\n`;
  });

  // Paso 4: Síntesis con Gemini
  const geminiKey = params.geminiApiKey || process.env.GEMINI_API_KEY || "";
  let proveedoresResult: Proveedor[] = [];

  if (!geminiKey) {
    logs.push("Aviso: No hay GEMINI_API_KEY configurada. Se utilizará el modo heurístico directo sobre la evidencia web.");
  } else {
    const genAI = new GoogleGenerativeAI(geminiKey);

    const systemPrompt = `
Sos un analista senior de Compras y Contrataciones corporativas para la cadena Cinemark & Hoyts ARGENTINA.
Tu misión es extraer y estructurar una lista AMPLIA y EXHAUSTIVA de TODOS los proveedores reales identificados en la evidencia web para "${rubro}" en "${zona}".
Buscá incluir entre 8 y 20 proveedores diferentes si la evidencia lo permite.

🚨 REGLAS ESTRICTAS DE VALIDACIÓN GEOGRÁFICA Y DE PAÍS:
1. LA EMPRESA CONTRATANTE ES CINEMARK & HOYTS EN ARGENTINA:
   - "Todo el país" significa TODA LA REPÚBLICA ARGENTINA (cobertura nacional en Argentina).
   - "CABA y GBA" significa Ciudad de Buenos Aires y Conurbano Bonaerense, ARGENTINA.
2. PRIORIDAD ABSOLUTA: PROVEEDORES RADICADOS EN ARGENTINA.
   - Da máxima prioridad a proveedores locales con sede, teléfonos (+54, 011, etc.), CUIT, dominios .ar/.com.ar o presencia en Argentina.
3. FILTRO ESTRICTO CONTRA FALSOS POSITIVOS DE COLOMBIA U OTROS PAÍSES:
   - NO mezcles proveedores de Colombia (Bogotá, Medellín, Cali, teléfonos +57, dominios .co/.com.co, NIT) ni de otros países.
   - Si una fuente de la evidencia es de Colombia u otro país, DESCÁRTALA en favor de proveedores de Argentina.
   - Si la evidencia contiene proveedores argentinos y extranjeros, selecciona ÚNICAMENTE los de Argentina.
4. SI EXCEPCIONALMENTE SE DETECTA UN PROVEEDOR EXTRANJERO RELEVANTE (ej. fabricante internacional directo de insumos especializados):
   - Debes ser 100% EXPLÍCITO Y ESPECÍFICO:
     * "pais": Indica el país exacto (ej. "Colombia", "Chile", "México", "España" o "Internacional").
     * "es_argentina": false.
     * "zona": Antepone el país y la ciudad (ej. "[Colombia] Bogotá", "[Exterior] Santiago de Chile").
   - Para proveedores de Argentina:
     * "pais": "Argentina".
     * "es_argentina": true.
     * "zona": Cobertura en Argentina (ej. "${zona}", "CABA y GBA", "Córdoba", etc.).
5. INTEGRACIÓN Y VALIDACIÓN DE MERCADO LIBRE Y WEB:
   - Encontrarás publicaciones de Mercado Libre Argentina (servicios.mercadolibre.com.ar o mercadolibre.com.ar) e investigaciones web complementarias de cada una.
   - NUNCA coloques "Mercado Libre" como el nombre de la empresa proveedora.
   - IDENTIFICA LA EMPRESA O CONTRATISTA REAL: Extrae la razón social, nombre comercial, taller o titular detrás de la publicación.
   - Si la investigación web asociada aportó su sitio web oficial, teléfono directo (+54...) o correo corporativo, CONSOLÍDALOS prioritariamente en el registro.
   - Si la única fuente es la publicación de Mercado Libre, indica en "fuente" el enlace de Mercado Libre, en "fuente_nombre" "Mercado Libre Servicios (Argentina)", y en "tipo_fuente" "directorio_empresarial".

CAMPOS OBLIGATORIOS PARA CADA PROVEEDOR:
- "nombre": Nombre comercial o razón social de la empresa.
- "rubro": Especialidad o categoría exacta.
- "pais": "Argentina" si es local, o el país exacto si es del exterior (ej. "Colombia").
- "es_argentina": boolean (true o false).
- "zona": Cobertura geográfica precisa.
- "descripcion_trabajos": Resumen detallado de trabajos que realiza, servicios específicos y capacidad operativa.
- "clientes_proyectos": Con quién trabajó, clientes corporativos, obras o marcas atendidas.
- "email": Correo corporativo de contacto/ventas.
- "telefono": Teléfono o WhatsApp de contacto con código de área (+54...).
- "sitio_web": URL oficial de la empresa (o perfil comercial).
- "fuente": URL EXACTA de la fuente de donde se extrajo la información.
- "fuente_nombre": Nombre claro y legible de la fuente.
- "tipo_fuente": "sitio_oficial" | "directorio_empresarial" | "guia_b2b" | "camara_sectorial" | "web".
- "confiabilidad": "alta" | "media" | "baja".

FORMATO DE SALIDA (JSON ÚNICAMENTE):
{
  "proveedores": [
    {
      "nombre": "string",
      "rubro": "string",
      "pais": "string",
      "es_argentina": boolean,
      "zona": "string",
      "descripcion_trabajos": "string",
      "clientes_proyectos": "string",
      "email": "string",
      "telefono": "string",
      "sitio_web": "string",
      "fuente": "string",
      "fuente_nombre": "string",
      "tipo_fuente": "sitio_oficial" | "directorio_empresarial" | "guia_b2b" | "camara_sectorial" | "web",
      "confiabilidad": "alta" | "media" | "baja"
    }
  ]
}
`;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        logs.push(`Estructurando y validando proveedores con Gemini (${modelName})...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.15,
          },
        });

        const response = await model.generateContent([
          { text: systemPrompt },
          { text: evidenceText },
        ]);

        const text = response.response.text();
        const parsed = parseJsonRobustly(text);

        if (parsed && Array.isArray(parsed.proveedores) && parsed.proveedores.length > 0) {
          proveedoresResult = parsed.proveedores.map((p: any, idx: number) => {
            let sourceUrl = p.fuente || "";
            if (!sourceUrl || !sourceUrl.startsWith("http")) {
              const matchingItem = rawItems.find(
                (r) =>
                  r.title.toLowerCase().includes((p.nombre || "").toLowerCase()) ||
                  r.url.toLowerCase().includes((p.nombre || "").toLowerCase().replace(/\s+/g, ""))
              );
              sourceUrl = matchingItem ? matchingItem.url : (p.sitio_web || rawItems[idx % rawItems.length]?.url || "");
            }

            const classification = classifySource(sourceUrl, p.nombre);

            let finalEmail = p.email || "";
            let finalPhone = p.telefono || "";
            let finalPais = p.pais || "Argentina";
            let finalEsArgentina = typeof p.es_argentina === "boolean" ? p.es_argentina : true;

            for (const [sUrl, sc] of contactMap.entries()) {
              const sameSite =
                (p.sitio_web && sUrl.includes(new URL(p.sitio_web).hostname)) ||
                (sourceUrl && sUrl.includes(new URL(sourceUrl).hostname));
              if (sameSite) {
                if (!finalEmail && sc.emails.length > 0) finalEmail = sc.emails[0];
                if (!finalPhone && sc.phones.length > 0) finalPhone = sc.phones[0];
                if (!sc.esArgentina) {
                  finalPais = sc.detectedPais;
                  finalEsArgentina = false;
                }
              }
            }

            // Detección determinista adicional para evitar cualquier escape de Colombia
            const checkStr = `${p.nombre} ${sourceUrl} ${p.sitio_web || ""} ${finalPhone} ${p.zona || ""} ${p.descripcion_trabajos || ""}`.toLowerCase();
            if (
              checkStr.includes("+57") ||
              checkStr.includes(".com.co") ||
              checkStr.includes("eldirectorio.co") ||
              checkStr.includes("bogotá") ||
              checkStr.includes("bogota") ||
              checkStr.includes("medellín") ||
              checkStr.includes("medellin") ||
              checkStr.includes("cali,") ||
              checkStr.includes("barranquilla") ||
              checkStr.includes("colombia")
            ) {
              finalPais = "Colombia";
              finalEsArgentina = false;
              if (!p.zona?.toLowerCase().includes("colombia")) {
                p.zona = `[Colombia] ${p.zona || "Bogotá"}`;
              }
            } else if (
              checkStr.includes(".com.ar") ||
              checkStr.includes(".ar/") ||
              checkStr.includes("+54") ||
              checkStr.includes("caba") ||
              checkStr.includes("buenos aires") ||
              checkStr.includes("gba") ||
              checkStr.includes("argentina")
            ) {
              finalPais = "Argentina";
              finalEsArgentina = true;
            }

            return {
              id: `prov-${Date.now()}-${idx + 1}`,
              nombre: p.nombre || `Proveedor ${idx + 1}`,
              rubro: p.rubro || rubro,
              zona: p.zona || zona,
              pais: finalPais,
              es_argentina: finalEsArgentina,
              descripcion_trabajos: p.descripcion_trabajos || "Servicios y provisión en el rubro.",
              clientes_proyectos: p.clientes_proyectos || "Empresas y locales comerciales de la región.",
              email: finalEmail,
              telefono: finalPhone,
              sitio_web: p.sitio_web || sourceUrl,
              fuente: sourceUrl,
              fuente_nombre: p.fuente_nombre || classification.fuente_nombre,
              tipo_fuente: p.tipo_fuente || classification.tipo_fuente,
              confiabilidad: p.confiabilidad || (finalEmail ? "alta" : "media"),
              fecha_busqueda: new Date().toISOString(),
            };
          });

          // Si el usuario buscaba en Argentina, priorizamos proveedores argentinos
          if (geoInfo.isArgentinaTarget) {
            const argentinos = proveedoresResult.filter((p) => p.es_argentina);
            const extranjeros = proveedoresResult.filter((p) => !p.es_argentina);

            if (argentinos.length >= 3) {
              proveedoresResult = argentinos;
              logs.push(`Filtro estricto: Se validaron ${argentinos.length} proveedores radicados en Argentina (falsos positivos descartados).`);
            } else {
              proveedoresResult = [...argentinos, ...extranjeros];
              if (extranjeros.length > 0) {
                logs.push(`Aviso: Se incluyen ${extranjeros.length} proveedores del exterior, claramente señalizados.`);
              }
            }
          }

          logs.push(`¡Éxito! Se consolidaron ${proveedoresResult.length} proveedores estructurados con Gemini (${modelName}).`);
          break;
        }
      } catch (err: any) {
        console.warn(`Error con modelo ${modelName}:`, err.message);
        if (err.message.includes("429") || err.message.includes("quota")) {
          logs.push(`Límite de cuota temporal en ${modelName}. Probando alternativa...`);
        } else {
          logs.push(`Modelo ${modelName} omitido (${err.message.slice(0, 60)}...). Probando siguiente alternativa...`);
        }
      }
    }
  }

  // Fallback Heurístico si los modelos fallan por cuota
  if (proveedoresResult.length === 0 && rawItems.length > 0) {
    logs.push("Construyendo lista detallada en modo heurístico a partir de los sitios encontrados...");
    proveedoresResult = rawItems.map((item, idx) => {
      const scraped = contactMap.get(item.url);
      const classification = classifySource(item.url, item.title);

      return {
        id: `prov-${Date.now()}-${idx + 1}`,
        nombre: item.title,
        rubro: rubro,
        zona: zona,
        pais: scraped?.detectedPais || "Argentina",
        es_argentina: scraped?.esArgentina ?? true,
        descripcion_trabajos: item.snippet || "Proveedor localizado en rastreo web para el rubro solicitado.",
        clientes_proyectos: scraped?.pageSnippet || "Clientes comerciales y corporativos en la zona.",
        email: scraped?.emails[0] || "",
        telefono: scraped?.phones[0] || "",
        sitio_web: item.url,
        fuente: item.url,
        fuente_nombre: classification.fuente_nombre,
        tipo_fuente: classification.tipo_fuente,
        confiabilidad: scraped?.emails.length ? "alta" : "media",
        fecha_busqueda: new Date().toISOString(),
      };
    });
  }

  return {
    success: true,
    proveedores: proveedoresResult,
    engineUsed,
    query: `${rubro} en ${zona}`,
    zona,
    total: proveedoresResult.length,
    logs,
  };
}

/**
 * Genera un borrador de correo formal de Solicitud de Cotización (RFP)
 */
export async function generateDraftEmail(
  proveedores: Proveedor[],
  solicitud: string,
  complejo = "Cinemark & Hoyts",
  fechaLimite?: string
): Promise<{ subject: string; body: string; recipients: string[] }> {
  const recipients = proveedores.map((p) => p.email).filter(Boolean);
  const nombresProveedores = proveedores.map((p) => p.nombre).join(", ");

  const prompt = `
Generá un correo formal de Solicitud de Presupuesto / Cotización de la empresa Cinemark & Hoyts Argentina para enviar a los proveedores seleccionados (${nombresProveedores}).

DATOS:
- Complejo / Destino: ${complejo}
- Detalle de la Solicitud / Requerimiento: ${solicitud}
- Fecha Límite de Presentación: ${fechaLimite || "A la mayor brevedad posible (próximos 3 días hábiles)"}
- Remitente: Departamento de Compras y Contrataciones, Cinemark & Hoyts Argentina

INSTRUCCIONES:
- Tono corporativo, profesional y claro.
- Solicitar que la cotización desglose precios unitarios, condiciones de pago, tiempo de entrega o ejecución, y validez de la oferta.
- Incluir un Asunto (Subject) claro que comience con "[Cinemark & Hoyts] Solicitud de Cotización - ...".
- Devolver ÚNICAMENTE JSON con el formato:
{
  "subject": "string",
  "body": "string"
}
`;

  const geminiKey = process.env.GEMINI_API_KEY || "";
  if (!geminiKey) {
    return {
      subject: `[Cinemark & Hoyts] Solicitud de Cotización - ${solicitud.slice(0, 40)}`,
      body: `Estimados,\n\nNos ponemos en contacto desde el Departamento de Compras de Cinemark & Hoyts Argentina con motivo de solicitarles cotización para el siguiente requerimiento:\n\n${solicitud}\n\nDestino / Complejo: ${complejo}\nFecha límite de recepción de propuestas: ${fechaLimite || "3 días hábiles"}.\n\nAgradeceremos nos indiquen:\n- Desglose de precios (con o sin IVA)\n- Tiempo estimado de entrega / inicio de tareas\n- Condiciones de pago y validez del presupuesto\n\nQuedamos a la espera de su respuesta.\n\nAtentamente,\nDepartamento de Compras\nCinemark & Hoyts Argentina`,
      recipients,
    };
  }
  const genAI = new GoogleGenerativeAI(geminiKey);

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });
      const res = await model.generateContent(prompt);
      const parsed = JSON.parse(res.response.text());
      return {
        subject: parsed.subject || `[Cinemark & Hoyts] Solicitud de Cotización - ${solicitud.slice(0, 40)}`,
        body: parsed.body || "",
        recipients,
      };
    } catch {}
  }

  return {
    subject: `[Cinemark & Hoyts] Solicitud de Cotización - ${solicitud.slice(0, 40)}`,
    body: `Estimados,\n\nNos ponemos en contacto desde el Departamento de Compras de Cinemark & Hoyts Argentina con motivo de solicitarles cotización para el siguiente requerimiento:\n\n${solicitud}\n\nDestino / Complejo: ${complejo}\nFecha límite de recepción de propuestas: ${fechaLimite || "3 días hábiles"}.\n\nAgradeceremos nos indiquen:\n- Desglose de precios (con o sin IVA)\n- Tiempo estimado de entrega / inicio de tareas\n- Condiciones de pago y validez del presupuesto\n\nQuedamos a la espera de su respuesta.\n\nAtentamente,\nDepartamento de Compras\nCinemark & Hoyts Argentina`,
    recipients,
  };
}
