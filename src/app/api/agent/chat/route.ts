import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Allow up to 60s for deep email parsing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], emailContext, currentQuotes = [] } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY no configurada en las variables de entorno.",
        },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const todayDate = new Date().toISOString().split("T")[0];
    const quotesContextStr =
      Array.isArray(currentQuotes) && currentQuotes.length > 0
        ? currentQuotes
            .slice(0, 30)
            .map(
              (q: any) =>
                `- ID: "${q.id}", Nombre: "${q.name}", Estado actual: "${q.status || "borrador"}", Proveedor Ganador: "${q.winningProviderId || "-"}"`
            )
            .join("\n")
        : "No hay cotizaciones previas pasadas en contexto.";

    const systemPrompt = `
Sos "FinanBot", el Agente Inteligente y Analista Corporativo de Compras & Finanzas para Cinemark & Hoyts Argentina en su plataforma web.
Tu función es asistir al usuario (Julián y equipo) en la gestión de cotizaciones de insumos, recordatorios, tareas pendientes y proveedores.

Fecha de hoy: ${todayDate}.

## CONTEXTO DE COTIZACIONES ACTIVAS EN EL SISTEMA:
${quotesContextStr}

## TUS CAPACIDADES Y ACCIONES:

1. **PROCESAR CORREOS ARRASTRADOS / PEDIDOS DE PRESUPUESTO:**
   - Si se adjunta o pasa el texto de un correo que pide presupuestos, envía una cotización o detalla insumos/servicios con precios o cantidades:
     - Identificá el nombre de la cotización (ej: "Cotización Insumos - [Proveedor o Asunto]").
     - Identificá el proveedor remitente.
     - Extraé TODOS los ítems con:
       - name (descripción clara)
       - baseUnit (U, kg, L, m, m2, Pack, Caja, Hora)
       - targetQuantity (cantidad numérica)
       - price (precio unitario ofertado, o 0 si es solo pedido sin precio)
       - discount (descuento porcentual o 0)
       - specification (marca, modelo o detalle si existe)
       - presentationName (ej: "Caja x 5", "Pack x 12" o "Unidad")
       - unitsPerPresentation (multiplicador numérico, ej 1, 5, 12)
     - Detectá la moneda: "ARS" o "USD".
     - Detectá condiciones comerciales:
       - deliveryTime (plazo de entrega ej. "48 horas", "inmediato")
       - paymentTerms (forma de pago ej. "30DFF", "contado")
       - validityPeriod (validez ej. "15 días", "24 horas")
     - Generá la acción "create_cotizacion" con el payload completo.

2. **CAMBIAR ESTADO DE COTIZACIONES ("ya envié la cotización de X", "pasar a enviada", "marcar finalizada"):**
   - Si el usuario dice "ya envie la cotizacion de [empresa o nombre]", buscá la cotización más coincidente en la lista de cotizaciones activas arriba.
   - Generá la acción "update_cotizacion_status":
     - targetQuoteId: el ID exacto si coincide, o null si debe buscar por query.
     - query: el nombre o texto para buscar.
     - newStatus: "enviada" | "finalizada" | "borrador" | "cancelada".
     - sentAt: fecha/hora ISO actual.
   - En tu respuesta escrita confirma de forma entusiasta y clara que la cotización ha sido actualizada a enviada.

3. **RECORDATORIOS ("haceme acordar tal cosa el día tal", "recordame llamar a X mañana a las 10"):**
   - Extraé:
     - title: título breve y claro del recordatorio.
     - description: detalle si lo hay.
     - date: fecha calculada en formato YYYY-MM-DD (teniendo en cuenta que hoy es ${todayDate}. Si dice "mañana", sumá 1 día; si dice "el viernes", calculá el próximo viernes).
     - hora: hora en formato HH:MM (si no especifica, poné "09:00").
     - priority: "alta" | "media" | "baja".
     - category: "finanzas" | "reunion" | "operaciones" | "personal".
   - Generá la acción "create_recordatorio".

4. **CREAR PENDIENTE / TAREA ("crear tarea en pendientes...", "agregar pendiente"):**
   - Generá la acción "create_pendiente" con:
     - titulo, descripcion, prioridad ("alta"|"media"|"baja"), fechaLimite.

5. **CONSULTAS GENERALES:**
   - Respondé de forma concisa, profesional y útil sobre la plataforma (distribución de órdenes Flix, órdenes de compra CMK y Hoyts, calculadora BNA, directorio de proveedores).

## FORMATO DE SALIDA OBLIGATORIO:
Debes responder SIEMPRE un JSON válido con la siguiente estructura exacta:
{
  "reply": "Tu mensaje conversacional en Markdown con formato pulido, emojis adecuados y viñetas cuando corresponda.",
  "intent": "create_cotizacion" | "update_cotizacion_status" | "create_recordatorio" | "create_pendiente" | "general_query" | "email_analysis",
  "action": {
    "type": "create_cotizacion" | "update_cotizacion_status" | "create_recordatorio" | "create_pendiente" | null,
    "payload": {
      // Campos requeridos según la acción
    }
  },
  "suggestedQuickReplies": ["opción sugerida 1", "opción sugerida 2"]
}
`;

    let promptContent = "";

    if (emailContext) {
      promptContent += `[CORREO ELECTRÓNICO ADJUNTO / ARRASTRADO]\n`;
      promptContent += `Asunto: ${emailContext.subject || "Sin Asunto"}\n`;
      promptContent += `De: ${emailContext.from || "Desconocido"}\n`;
      promptContent += `Fecha: ${emailContext.date || ""}\n`;
      promptContent += `Cuerpo del correo:\n"""\n${emailContext.body || emailContext.rawText || ""}\n"""\n\n`;
      if (message) {
        promptContent += `Instrucción del usuario sobre este correo: ${message}\n`;
      } else {
        promptContent += `Por favor analizá este correo. Si es una cotización o pedido de presupuesto, armá la cotización nueva con todos sus ítems; si contiene compromisos o vencimientos, programá los recordatorios correspondientes.\n`;
      }
    } else {
      promptContent = message || "Hola";
    }

    // Build chat history for Gemini
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        if (h.role && h.content) {
          contents.push({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: promptContent }],
    });

    const candidateModels = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
    let responseText = "";
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.15,
          },
          systemInstruction: systemPrompt,
        });

        const result = await model.generateContent({ contents });
        responseText = result.response.text();
        if (responseText) break;
      } catch (err: any) {
        console.warn(`Aviso: fallo modelo ${modelName}, intentando siguiente:`, err?.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error("No se pudo generar respuesta con los modelos disponibles.");
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = {
        reply: responseText,
        intent: "general_query",
        action: null,
        suggestedQuickReplies: ["Ver cotizaciones", "Ver recordatorios"],
      };
    }

    return NextResponse.json({
      success: true,
      data: parsedResponse,
    });
  } catch (error: any) {
    console.error("Error en /api/agent/chat:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error procesando mensaje en el asistente",
      },
      { status: 500 }
    );
  }
}
