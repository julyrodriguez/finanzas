import { NextRequest, NextResponse } from "next/server";
import { generateDraftEmail } from "@/lib/proveedores/providerSearchService";
import { DraftEmailParams } from "@/types/proveedor";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DraftEmailParams;

    if (!body || !body.proveedores || body.proveedores.length === 0 || !body.solicitud) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requiere al menos un proveedor y la descripción de la solicitud.",
        },
        { status: 400 }
      );
    }

    const draft = await generateDraftEmail(
      body.proveedores,
      body.solicitud.trim(),
      body.complejo || "Cinemark & Hoyts",
      body.fechaLimite
    );

    return NextResponse.json({
      success: true,
      ...draft,
    });
  } catch (error: any) {
    console.error("Error en /api/proveedores/draft-email:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al generar borrador de correo",
      },
      { status: 500 }
    );
  }
}
