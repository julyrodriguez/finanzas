import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || !body.message) {
      return NextResponse.json(
        { success: false, error: "El mensaje es obligatorio." },
        { status: 400 }
      );
    }

    const apiEndpoint = process.env.NEXT_PUBLIC_PROVEEDORES_CHAT_API || 
      (process.env.NEXT_PUBLIC_PROVEEDORES_API 
        ? process.env.NEXT_PUBLIC_PROVEEDORES_API.replace(/\/search$/, '/chat')
        : "https://apivacas.jariel.com.ar/api/proveedores-ia/chat");

    let serverResponse: Response | null = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    // Si falló el endpoint público externo, intentar contra localhost:3000 si estamos en el mismo servidor
    if (!serverResponse || !serverResponse.ok) {
      serverResponse = await fetch("http://localhost:3000/api/proveedores-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
    }

    if (!serverResponse || !serverResponse.ok) {
      const errData = await serverResponse?.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: errData?.error || "Error al comunicarse con el servicio de IA de proveedores",
        },
        { status: serverResponse?.status || 502 }
      );
    }

    const data = await serverResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error en /api/proveedores/chat:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno del asistente IA de proveedores",
      },
      { status: 500 }
    );
  }
}
