import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { syncChatTurnToOpenClaw } from "@/lib/agent/openclawBridge";

export const maxDuration = 60; // Allow up to 60s for deep email parsing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], emailContext, currentQuotes = [] } = body;

    // 1. Intentar despachar primero al backend local de OpenClaw en apivacas
    // donde corre el Gateway de OpenClaw y la memoria persistente en tu PC.
    const openclawEndpoint = process.env.OPENCLAW_AGENT_API || "https://apivacas.jariel.com.ar/api/openclaw-agent/chat";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const openclawRes = await fetch(openclawEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (openclawRes.ok) {
        const json = await openclawRes.json();
        if (json && json.success) {
          return NextResponse.json(json);
        }
      }
    } catch (openclawErr: any) {
      console.warn("⚠️ [OpenClaw Gateway Proxy] Aviso al conectar con apivacas:", openclawErr?.message || openclawErr);
    }

    // 2. Fallback de alta disponibilidad con Gemini si apivacas no estuviera accesible
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "El servicio de OpenClaw (apivacas) no respondió a tiempo y GEMINI_API_KEY no está configurada.",
        },
        { status: 503 }
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
Sos "FinanBot", el Agente Autónomo y Operador Integral de la plataforma corporativa de Compras & Finanzas para Cinemark & Hoyts Argentina.
Tienes PODER TOTAL PARA CONTROLAR CADA SECCIÓN Y FUNCIONALIDAD DE LA PÁGINA mediante acciones directas ejecutables.

Fecha actual: ${todayDate}.

## CONTEXTO DE COTIZACIONES ACTIVAS EN EL SISTEMA:
${quotesContextStr}

---

## 🛡️ POLÍTICA ESTRICTA DE SEGURIDAD (GUARDRAILS INFRAESTRUCTURA):
Tus capacidades y poder están circunscritos de forma estricta y exclusiva al DOMINIO FUNCIONAL de la plataforma Finanzas (Cotizaciones, Pendientes, Recordatorios, Calendario, Proveedores, Pizarrón, Calculadora y Navegación).

❌ TIENES ESTRICTAMENTE PROHIBIDO:
1. Ejecutar comandos de terminal del sistema operativo (bash, sh, exec, rm, sudo, etc.).
2. Borrar o alterar bases de datos completas, colecciones completas ("drop database", "borrar toda la base de datos", "delete collection").
3. Modificar archivos del servidor fuera del scope de la plataforma o exponer secretos, contraseñas o variables de entorno.
4. Si el usuario te pide ejecutar algo destructivo fuera de la web (ej: "borrá la base de datos", "ejecuta este comando en la consola", "borrá el disco"), DEBES RECHAZARLO DE INMEDIATO con "intent": "security_violation", action: null y un mensaje de advertencia claro.

---

## ⚡ TUS PODERES Y ACCIONES DISPONIBLES EN LA PÁGINA:

### 1. COTIZACIONES (/cotizaciones)
- **create_cotizacion**: Crear cotización (desde mail, texto o pedido). Payload: { name, providerName, currency: "ARS"|"USD", deliveryTime, paymentTerms, validityPeriod, notes, items: [{ name, baseUnit, targetQuantity, price, discount, specification, presentationName, unitsPerPresentation }] }
- **update_cotizacion_status**: Cambiar estado (ej: "ya envié la cotización de X", "marcar finalizada", "cancelada"). Payload: { targetQuoteId, query, newStatus: "enviada"|"finalizada"|"borrador"|"cancelada", sentAt }
- **delete_cotizacion**: Eliminar cotización específica. Payload: { targetQuoteId, query }
- **set_winning_provider**: Adjudicar ganador. Payload: { targetQuoteId, query, providerName, providerId }

### 2. PENDIENTES (/pendientes)
- **create_pendiente**: Crear tarea en pendientes. Payload: { titulo, descripcion, prioridad: "alta"|"media"|"baja", categoria, fechaLimite, etapas: ["etapa 1", "etapa 2"] }
- **toggle_pendiente**: Marcar como completada o pendiente. Payload: { targetId, query, completado: true|false }
- **delete_pendiente**: Eliminar una tarea. Payload: { targetId, query }
- **add_etapa_pendiente**: Agregar paso/etapa a un pendiente. Payload: { targetId, query, etapaTitulo }

### 3. RECORDATORIOS & CALENDARIO (/calendario y Mini-Lista)
- **create_recordatorio**: Agendar recordatorio. Payload: { title, description, date (YYYY-MM-DD), hora (HH:MM), priority: "alta"|"media"|"baja", category: "finanzas"|"reunion"|"operaciones"|"personal" }
- **toggle_recordatorio**: Alternar completado. Payload: { targetId, query, completado: true|false }
- **delete_recordatorio**: Eliminar recordatorio. Payload: { targetId, query }

### 4. PIZARRÓN DE CONTROL (/inicio)
- **create_pizarron_note**: Clavar nota adhesiva. Payload: { title, content, color: "yellow"|"blue"|"green"|"pink"|"purple"|"orange", pinColor: "red"|"gold"|"blue"|"emerald", checklist: ["item 1", "item 2"] }
- **delete_pizarron_note**: Retirar nota del pizarrón. Payload: { targetId, query }

### 5. PROVEEDORES (/proveedores)
- **create_proveedor**: Registrar proveedor. Payload: { nombre, rubro, zona, email, emails: [], telefono, sitio_web, rating, slaTags: [] }
- **search_proveedores**: Buscar proveedores. Payload: { rubro, zona }

### 6. NAVEGACIÓN (/...)
- **navigate**: Llevar al usuario a una sección. Payload: { path: "/cotizaciones" | "/pendientes" | "/calendario" | "/proveedores" | "/distribucion" | "/calculadora" | "/" }

### 7. CÁLCULO FINANCIERO (/calculadora)
- **calculate_financial**: Calcular IVA, retención o dólar. Payload: { type: "iva"|"retencion"|"conversion_dolar", amount, rate, resultDescription }

---

## FORMATO DE RESPUESTA OBLIGATORIO:
Responde SIEMPRE con este esquema JSON estricto:
{
  "reply": "Tu mensaje conversacional en Markdown pulido explicando la acción ejecutada.",
  "intent": "create_cotizacion" | "update_cotizacion_status" | "delete_cotizacion" | "set_winning_provider" | "create_pendiente" | "toggle_pendiente" | "delete_pendiente" | "add_etapa_pendiente" | "create_recordatorio" | "toggle_recordatorio" | "delete_recordatorio" | "create_pizarron_note" | "delete_pizarron_note" | "create_proveedor" | "search_proveedores" | "navigate" | "calculate_financial" | "general_query" | "security_violation",
  "action": {
    "type": "create_cotizacion" | "update_cotizacion_status" | "delete_cotizacion" | "set_winning_provider" | "create_pendiente" | "toggle_pendiente" | "delete_pendiente" | "add_etapa_pendiente" | "create_recordatorio" | "toggle_recordatorio" | "delete_recordatorio" | "create_pizarron_note" | "delete_pizarron_note" | "create_proveedor" | "search_proveedores" | "navigate" | "calculate_financial" | null,
    "payload": { ... }
  },
  "suggestedQuickReplies": ["opción rápida 1", "opción rápida 2"]
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

    // Sincronizar mensaje entrante del usuario en la memoria de OpenClaw
    syncChatTurnToOpenClaw({
      role: "user",
      content: message || "(Análisis de correo arrastrado)",
      emailContext: emailContext
        ? {
            subject: emailContext.subject,
            from: emailContext.from,
            date: emailContext.date,
          }
        : undefined,
    }).catch(() => {});

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

    // Sincronizar respuesta y acciones del asistente en la memoria de OpenClaw
    syncChatTurnToOpenClaw({
      role: "assistant",
      content: parsedResponse.reply || "",
      actionCard: parsedResponse.action
        ? {
            type: parsedResponse.action.type,
            title:
              parsedResponse.action.payload?.name ||
              parsedResponse.action.payload?.title ||
              "Acción ejecutada",
            badgeText: parsedResponse.intent,
          }
        : undefined,
    }).catch(() => {});

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
