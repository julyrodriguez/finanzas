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
 * Realiza una búsqueda web a través de DuckDuckGo HTML con parseo robusto
 */
async function searchWebDuckDuckGo(query: string, maxResults = 10, queryTag = ""): Promise<RawSearchItem[]> {
  try {
    const params = new URLSearchParams();
    params.append("q", query);

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
      if (!isDisallowed && rawUrl.startsWith("http")) {
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
 * Escanea un sitio web para extraer correos electrónicos, teléfonos y mención de clientes
 */
async function scrapeSiteContacts(url: string): Promise<ScrapedContactInfo> {
  const result: ScrapedContactInfo = {
    url,
    emails: [],
    phones: [],
    pageSnippet: "",
  };

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return result;

    const html = await res.text();

    // Regex para detectar correos electrónicos válidos
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

    // Regex para teléfonos argentinos comunes
    const phoneMatches = html.match(/(?:\+?54[\s-]?(?:9[\s-]?)?)?(?:0?[1-9]\d{1,3}[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g) || [];
    const cleanPhones = Array.from(new Set(phoneMatches))
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.replace(/\D/g, "").length >= 8 && p.replace(/\D/g, "").length <= 15)
      .slice(0, 2);
    result.phones = cleanPhones;

    // Buscar párrafos o secciones que hablen de clientes, obras o servicios
    const textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ");
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

  // Paso 1: Obtener resultados web según el motor y la profundidad
  if (engine === "firecrawl" && apiKeyToUse) {
    try {
      logs.push(`Consultando API de Firecrawl (Búsqueda profunda para "${rubro}" en "${zona}")...`);
      const searchQuery = `proveedores empresas contratistas ${rubro} ${zona} argentina contacto presupuestos`;
      rawItems = await searchWithFirecrawl(searchQuery, apiKeyToUse, 15);
      logs.push(`Firecrawl indexó ${rawItems.length} fuentes web y directorios.`);
    } catch (err: any) {
      logs.push(`Aviso Firecrawl (${err.message}). Activando fallback al Motor Híbrido Multicriterio.`);
      engineUsed = "hybrid";
    }
  }

  // Si no se usó Firecrawl o falló, ejecutar Búsqueda Multicriterio Profunda
  if (rawItems.length === 0) {
    const isDeep = profundidad !== "rapida";
    logs.push(`Iniciando búsqueda multicriterio ${isDeep ? "exhaustiva" : "rápida"} para "${rubro}" en "${zona}", Argentina...`);
    const cleanRubro = sanitizeSearchTerm(rubro);
    const cleanZona = sanitizeSearchTerm(zona);

    // Consultas variadas y profundas para abarcar empresas directas, cámaras y directorios comerciales
    const queries = [
      { q: `proveedores empresas ${cleanRubro} ${cleanZona} argentina contacto email`, tag: "Empresas Directas" },
      { q: `servicios ${cleanRubro} ${cleanZona} argentina clientes nosotros portfolio`, tag: "Servicios & Clientes" },
    ];

    const subTerms = cleanRubro.split(/\s+y\s+|\s*,\s*|\s+e\s+/i).map((t) => t.trim()).filter((t) => t.length > 2);
    if (subTerms.length > 1) {
      for (const sub of subTerms) {
        queries.push({
          q: `proveedores empresas contratistas ${sub} ${cleanZona} argentina contacto`,
          tag: `Especialidad: ${sub}`,
        });
      }
    }

    if (isDeep) {
      queries.push(
        { q: `directorio comercial empresas ${cleanRubro} ${cleanZona} argentina telefono`, tag: "Directorios Comerciales" },
        { q: `camara empresas contratistas ${cleanRubro} ${cleanZona} argentina`, tag: "Cámaras Sectoriales" },
        { q: `empresas de ${cleanRubro} en ${cleanZona} presupuestos contacto`, tag: "Presupuestos B2B" }
      );
    }

    logs.push(`Ejecutando consultas paralelas en la web para ${queries.map((q) => q.tag).join(", ")}...`);

    const queryBatches = await Promise.all(
      queries.map((q) => searchWebDuckDuckGo(q.q, isDeep ? 9 : 6, q.tag))
    );

    // Unificar y desduplicar por dominio
    const seenDomains = new Set<string>();
    const combined: RawSearchItem[] = [];

    for (const batch of queryBatches) {
      for (const item of batch) {
        try {
          const domain = new URL(item.url).hostname.replace(/^www\./, "");
          if (!seenDomains.has(domain)) {
            seenDomains.add(domain);
            combined.push(item);
          }
        } catch {
          combined.push(item);
        }
      }
    }

    rawItems = combined.slice(0, isDeep ? 22 : 10);
    logs.push(`Se localizaron ${rawItems.length} portales, empresas y directorios únicos.`);
  }

  // Paso 2: Escaneo en lotes de los sitios más prometedores para extraer datos de contacto y antecedentes
  const scrapeLimit = profundidad === "rapida" ? 5 : 12;
  const scrapeTargets = rawItems.slice(0, scrapeLimit);
  logs.push(`Extrayendo información de contacto y antecedentes directamente del HTML de ${scrapeTargets.length} sitios webs...`);

  // Ejecutar scraping en 2 bloques para no saturar conexiones
  const half = Math.ceil(scrapeTargets.length / 2);
  const batchA = await Promise.all(scrapeTargets.slice(0, half).map((item) => scrapeSiteContacts(item.url)));
  const batchB = await Promise.all(scrapeTargets.slice(half).map((item) => scrapeSiteContacts(item.url)));
  const contactsScraped = [...batchA, ...batchB];

  const contactMap = new Map<string, ScrapedContactInfo>();
  for (const c of contactsScraped) {
    contactMap.set(c.url, c);
  }

  // Paso 3: Armar contexto amplio para Gemini
  let evidenceText = `CONSULTA DE BÚSQUEDA EXHAUSTIVA:\n- Rubro: ${rubro}\n- Zona: ${zona}\n`;
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

    evidenceText += `\n[Fuente ${idx + 1} - ${item.queryTag || classification.tipo_fuente}]:\n`;
    evidenceText += `Título: ${item.title}\n`;
    evidenceText += `URL de Origen (Fuente): ${item.url}\n`;
    evidenceText += `Tipo de Fuente: ${classification.tipo_fuente} (${classification.fuente_nombre})\n`;
    evidenceText += `Descripción: ${item.snippet}\n`;
    if (emailsStr) evidenceText += `${emailsStr}\n`;
    if (phonesStr) evidenceText += `${phonesStr}\n`;
    if (extraSnippet) evidenceText += `${extraSnippet}\n`;
  });

  // Paso 4: Síntesis con Gemini (si hay clave disponible)
  const geminiKey = params.geminiApiKey || process.env.GEMINI_API_KEY || "";
  let proveedoresResult: Proveedor[] = [];

  if (!geminiKey) {
    logs.push("Aviso: No hay GEMINI_API_KEY configurada. Se utilizará el modo heurístico directo sobre la evidencia web.");
  } else {
    const genAI = new GoogleGenerativeAI(geminiKey);

  const systemPrompt = `
Sos un analista senior de Compras y Contrataciones corporativas para la cadena Cinemark & Hoyts Argentina.
Tu misión es extraer y estructurar una lista AMPLIA y EXHAUSTIVA de TODOS los proveedores reales identificados en la evidencia web para "${rubro}" en "${zona}".
Buscá incluir entre 8 y 20 proveedores diferentes si la evidencia lo permite.

REGLAS ESTRICTAS DE EXTRACCIÓN:
1. Extraé proveedores reales basándote en la evidencia web. NO inventes nombres ficticios.
2. Para CADA proveedor debes reportar obligatoriamente:
   - "nombre": Nombre comercial o razón social de la empresa.
   - "rubro": Especialidad o categoría exacta.
   - "zona": Cobertura geográfica (ej. "${zona}", o localidades específicas encontradas).
   - "descripcion_trabajos": Resumen detallado de qué trabajos realiza, servicios específicos, capacidad operativa y tecnología/equipos.
   - "clientes_proyectos": Con quién trabajó, clientes corporativos, obras o marcas atendidas (si no está explícito en la web, indicar "Cartera comercial de locales y empresas en la región").
   - "email": Correo electrónico de contacto/ventas para cotizar. Si figura en la evidencia, usalo. Si no figura, sugerí uno corporativo o dejá vacío "".
   - "telefono": Teléfono o WhatsApp de contacto.
   - "sitio_web": URL oficial de la empresa (o perfil comercial).
   - "fuente": URL EXACTA de la fuente de donde se extrajo la información (OBLIGATORIO: tomala de 'URL de Origen' en la evidencia).
   - "fuente_nombre": Nombre claro y legible de la fuente (ej: "Sitio Web Oficial (empresa.com.ar)", "Directorio Proveedores.com", "Guía Comercial LeadSet AI").
   - "tipo_fuente": "sitio_oficial" | "directorio_empresarial" | "guia_b2b" | "camara_sectorial" | "web".
   - "confiabilidad": "alta" (web propia, email claro y experiencia) | "media" | "baja".

FORMATO DE SALIDA (JSON ÚNICAMENTE):
{
  "proveedores": [
    {
      "nombre": "string",
      "rubro": "string",
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

  let proveedoresResult: Proveedor[] = [];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      logs.push(`Estructurando y validando todos los proveedores con Gemini (${modelName})...`);
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
          // Asignar o validar fuente de origen
          let sourceUrl = p.fuente || "";
          if (!sourceUrl || !sourceUrl.startsWith("http")) {
            // Emparejar con rawItems
            const matchingItem = rawItems.find(
              (r) =>
                r.title.toLowerCase().includes((p.nombre || "").toLowerCase()) ||
                r.url.toLowerCase().includes((p.nombre || "").toLowerCase().replace(/\s+/g, ""))
            );
            sourceUrl = matchingItem ? matchingItem.url : (p.sitio_web || rawItems[idx % rawItems.length]?.url || "");
          }

          const classification = classifySource(sourceUrl, p.nombre);

          // Verificar si teníamos email o teléfono scrapeado para esa URL
          let finalEmail = p.email || "";
          let finalPhone = p.telefono || "";

          for (const [sUrl, sc] of contactMap.entries()) {
            const sameSite =
              (p.sitio_web && sUrl.includes(new URL(p.sitio_web).hostname)) ||
              (sourceUrl && sUrl.includes(new URL(sourceUrl).hostname));
            if (sameSite) {
              if (!finalEmail && sc.emails.length > 0) finalEmail = sc.emails[0];
              if (!finalPhone && sc.phones.length > 0) finalPhone = sc.phones[0];
            }
          }

          return {
            id: `prov-${Date.now()}-${idx + 1}`,
            nombre: p.nombre || `Proveedor ${idx + 1}`,
            rubro: p.rubro || rubro,
            zona: p.zona || zona,
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
