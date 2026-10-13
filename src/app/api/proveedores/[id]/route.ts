import { NextRequest, NextResponse } from "next/server";

const TARGET_API_URL = process.env.NEXT_PUBLIC_PROVEEDORES_API_BASE || "https://apivacas.jariel.com.ar/api/proveedores";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const res = await fetch(`${TARGET_API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Error en proxy /api/proveedores/[id] PUT:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Error al actualizar proveedor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: any = undefined;
    try {
      body = await request.json();
    } catch {}

    const res = await fetch(`${TARGET_API_URL}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Error en proxy /api/proveedores/[id] DELETE:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Error al eliminar proveedor" },
      { status: 500 }
    );
  }
}
