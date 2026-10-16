/**
 * emailParser.ts
 * Parser para archivos de correo electrónico (.eml, .msg, .txt o texto copiado).
 * Decodifica encabezados MIME (From, Subject, Date, To) y extrae el cuerpo en texto plano.
 */

export interface ParsedEmail {
  subject: string;
  from: string;
  fromName?: string;
  fromEmail?: string;
  to: string;
  date: string;
  body: string;
  isQuoteRequest: boolean;
  detectedItemsHint?: string[];
  rawText: string;
}

/**
 * Decodifica encabezados MIME codificados en Base64 o Quoted-Printable (=?UTF-8?B?...?= o =?UTF-8?Q?...?=)
 */
function decodeMimeHeader(headerStr: string): string {
  if (!headerStr) return "";
  try {
    return headerStr.replace(
      /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g,
      (_match, _charset, encoding, encodedText) => {
        try {
          if (encoding.toUpperCase() === "B") {
            // Base64
            if (typeof atob === "function") {
              const binary = atob(encodedText);
              const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
              return new TextDecoder("utf-8").decode(bytes);
            }
            return Buffer.from(encodedText, "base64").toString("utf-8");
          } else if (encoding.toUpperCase() === "Q") {
            // Quoted-Printable
            const unescaped = encodedText
              .replace(/_/g, " ")
              .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) =>
                String.fromCharCode(parseInt(hex, 16))
              );
            return decodeURIComponent(escape(unescaped));
          }
        } catch {
          return encodedText;
        }
        return encodedText;
      }
    );
  } catch {
    return headerStr;
  }
}

/**
 * Decodifica texto codificado en Quoted-Printable (ej: =C3=A1 -> á)
 */
function decodeQuotedPrintable(str: string): string {
  try {
    const cleaned = str.replace(/=\r?\n/g, ""); // Soft line breaks
    const unescaped = cleaned.replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    try {
      return decodeURIComponent(escape(unescaped));
    } catch {
      return unescaped;
    }
  } catch {
    return str;
  }
}

/**
 * Limpia etiquetas HTML básicas si el cuerpo viene en HTML
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/th>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Parsea un archivo .eml completo o texto sin formato
 */
export function parseEmailContent(content: string, fileName?: string): ParsedEmail {
  const isEmlFormat =
    content.includes("From:") ||
    content.includes("Subject:") ||
    content.includes("Content-Type:") ||
    (fileName && fileName.toLowerCase().endsWith(".eml"));

  if (!isEmlFormat) {
    // Si es texto plano o un mensaje copiado directo
    const isQuote = detectQuoteKeywords(content);
    return {
      subject: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Mensaje de Correo Pegado",
      from: "Desconocido",
      to: "Cinemark & Hoyts Compras",
      date: new Date().toLocaleDateString("es-AR"),
      body: content.trim(),
      isQuoteRequest: isQuote,
      rawText: content,
    };
  }

  // Parseo de cabeceras RFC 822 / MIME
  const lines = content.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let currentHeader = "";
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      bodyStartIndex = i + 1;
      break;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      currentHeader = match[1].toLowerCase();
      headers[currentHeader] = match[2];
    } else if (currentHeader && (line.startsWith(" ") || line.startsWith("\t"))) {
      // Continuación de cabecera multilinea
      headers[currentHeader] += " " + line.trim();
    }
  }

  const rawSubject = decodeMimeHeader(headers["subject"] || fileName || "Sin Asunto");
  const rawFrom = decodeMimeHeader(headers["from"] || "Remitente Desconocido");
  const rawTo = decodeMimeHeader(headers["to"] || "Cinemark & Hoyts");
  const rawDate = headers["date"] || new Date().toLocaleDateString("es-AR");

  // Extraer nombre y email del From
  let fromName = rawFrom;
  let fromEmail = "";
  const emailMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    fromEmail = emailMatch[1];
    fromName = rawFrom.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || fromEmail;
  }

  // Extraer el cuerpo
  const rawBodyLines = lines.slice(bodyStartIndex).join("\n");
  let body = rawBodyLines;

  // Si tiene Quoted-Printable o Base64 en Content-Transfer-Encoding
  const transferEncoding = (headers["content-transfer-encoding"] || "").toLowerCase();
  if (transferEncoding.includes("quoted-printable")) {
    body = decodeQuotedPrintable(body);
  } else if (transferEncoding.includes("base64")) {
    try {
      const cleanB64 = body.replace(/\s/g, "");
      if (typeof atob === "function") {
        const binary = atob(cleanB64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        body = new TextDecoder("utf-8").decode(bytes);
      }
    } catch {}
  }

  // Si es multipart, buscar la primera parte text/plain o text/html
  if (body.includes("--") && headers["content-type"] && headers["content-type"].includes("boundary")) {
    const boundaryMatch = headers["content-type"].match(/boundary="?([^";]+)"?/);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split(`--${boundary}`);
      let extractedPlain = "";
      let extractedHtml = "";

      for (const part of parts) {
        if (part.includes("Content-Type: text/plain") || part.includes("content-type: text/plain")) {
          const partBody = part.split(/\r?\n\r?\n/).slice(1).join("\n\n");
          extractedPlain = partBody;
          break;
        } else if (part.includes("Content-Type: text/html") || part.includes("content-type: text/html")) {
          const partBody = part.split(/\r?\n\r?\n/).slice(1).join("\n\n");
          extractedHtml = stripHtmlTags(partBody);
        }
      }

      body = extractedPlain || extractedHtml || body;
    }
  }

  // Limpiar HTML si quedaron tags
  if (body.includes("<html") || body.includes("<div") || body.includes("<p>")) {
    body = stripHtmlTags(body);
  }

  const isQuote = detectQuoteKeywords(`${rawSubject} ${body}`);

  return {
    subject: rawSubject,
    from: rawFrom,
    fromName,
    fromEmail,
    to: rawTo,
    date: rawDate,
    body: body.trim(),
    isQuoteRequest: isQuote,
    rawText: content,
  };
}

/**
 * Detecta palabras clave relacionadas con presupuestos, cotizaciones e insumos
 */
function detectQuoteKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    "presupuesto",
    "cotización",
    "cotizacion",
    "precios",
    "lista de precios",
    "insumos",
    "pedido",
    "solicitud de",
    "validez de la oferta",
    "plazo de entrega",
    "condiciones de pago",
    "precio unitario",
    "cantidad",
    "importe",
    "descuento",
    "cinemark",
    "hoyts",
  ];
  return keywords.some((kw) => lower.includes(kw));
}
