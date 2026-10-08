import { NextRequest, NextResponse } from "next/server";
import { searchProveedores } from "@/lib/proveedores/providerSearchService";
import { ProveedorSearchParams } from "@/types/proveedor";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProveedorSearchParams;

    if (!body || !body.rubro || !body.zona) {
      return NextResponse.json(
        {
          success: false,
          error: "Los campos 'rubro' (tipo de proveedor) y 'zona' son obligatorios.",
        },
        { status: 400 }
      );
    }

    const result = await searchProveedores({
      rubro: body.rubro.trim(),
      zona: body.zona.trim(),
      especificaciones: body.especificaciones?.trim(),
      engine: body.engine || "hybrid",
      profundidad: body.profundidad || "profunda",
      firecrawlApiKey: body.firecrawlApiKey?.trim(),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error en /api/proveedores/search:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno al buscar proveedores",
      },
      { status: 500 }
    );
  }
}
