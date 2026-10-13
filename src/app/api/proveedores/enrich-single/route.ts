import { NextRequest, NextResponse } from "next/server";

const TARGET_API_URL = process.env.NEXT_PUBLIC_PROVEEDORES_API_BASE || "https://apivacas.jariel.com.ar/api/proveedores";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const endpoint = `${TARGET_API_URL}/enrich-single`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Error en proxy /api/proveedores/enrich-single POST:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Error al enriquecer proveedor con IA" },
      { status: 500 }
    );
  }
}
