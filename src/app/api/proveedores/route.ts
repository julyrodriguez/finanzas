import { NextRequest, NextResponse } from "next/server";

const TARGET_API_URL = process.env.NEXT_PUBLIC_PROVEEDORES_API_BASE || "http://127.0.0.1:3000/api/proveedores";

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(TARGET_API_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Error del servidor de base de datos (${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error en proxy /api/proveedores GET:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Error al conectar con el servidor de base de datos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(TARGET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Error en proxy /api/proveedores POST:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Error al guardar proveedor" },
      { status: 500 }
    );
  }
}
