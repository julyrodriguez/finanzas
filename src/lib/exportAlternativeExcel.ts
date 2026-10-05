import ExcelJS from "exceljs";
import { type OrdenCompra } from "@/types/ordenes";

/**
 * Crea una imagen PNG en base64 de un botón estilizado como forma con bordes redondeados.
 * Permite que en Excel sea un objeto de dibujo real (Shape/Drawing) al cual se le puede
 * hacer clic derecho y asignarle una macro con "Asignar macro...".
 */
function createButtonImage(
  text: string,
  bgColor: string,
  width: number = 460,
  height: number = 68,
  fontSize: number = 22
): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fondo rectángulo redondeado
    ctx.fillStyle = bgColor;
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(4, 4, width - 8, height - 8, 12);
      ctx.fill();
    } else {
      ctx.fillRect(4, 4, width - 8, height - 8);
    }

    // Borde sutil brillante
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Texto del botón
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 1);

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Canvas no disponible para generar botón gráfico:", e);
    return null;
  }
}

function normalizeSignerName(name?: string): string {
  if (!name) return "";
  const n = name.trim();
  const lower = n.toLowerCase();
  if (lower.includes("tomas") || lower.includes("tomás")) return "Tomas";
  if (lower.includes("victoria")) return "Victoria";
  if (lower.includes("tristan") || lower.includes("tristán")) return "Tristan";
  if (lower.includes("pablo gonzalez") || lower.includes("pablo gonzález") || lower.includes("gonzalez") || lower.includes("gonzález")) return "Pablo Gonzalez";
  if (lower.includes("mondelo")) return "Pablo Mondelo";
  if (lower.includes("jorgelina")) return "Jorgelina";
  if (lower.includes("dario") || lower.includes("darío")) return "Dario";
  if (lower.includes("matias") || lower.includes("matías")) return "Matias";
  if (lower.includes("hernan") || lower.includes("hernán")) return "Hernan";
  if (lower.includes("martin") || lower.includes("martín")) return "Martin";
  return n;
}

function getTimestampSeconds(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val > 1e11 ? Math.floor(val / 1000) : val;
  if (val.seconds) return val.seconds;
  if (val.getTime) return Math.floor(val.getTime() / 1000);
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

/**
 * Exporta la versión ALTERNATIVA MODERNA del Excel.
 * 
 * Mejoras clave de diseño y UX:
 * 1. Barra de Navegación Rápida Superior en TODAS las hojas (teletransportación en 1 clic).
 * 2. Tarjetas KPI ejecutivas en fila 2 (Total Órdenes, Monto Total, Pendientes, Mandadas, Liberadas).
 * 3. BUSCADOR INTERACTIVO integrado (celda de búsqueda + botón Buscar + botón Limpiar).
 * 4. BOTONES DE FILTRO RÁPIDO POR ESTADO (Todas, Pendientes, Mandadas, Liberadas).
 * 5. Bloqueo de paneles (Freeze Panes) para que el buscador, los filtros y las cabeceras queden siempre fijas.
 * 6. Estética refinada: paleta Slate moderna (#0B1120 / #0F172A), badges redondeados con contraste óptimo.
 * 7. Reglas de Tomás por nivel blindadas (< $5.5M autofirma, >= $5.5M asigna Pablo Mondelo / Matías).
 */
export async function exportAlternativeExcel(ordenes: OrdenCompra[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Finanzas - Edición Alternativa";
  wb.created = new Date();

  // Asegurar ordenamiento inicial por N° OC descendente
  const sortedOrders = [...ordenes].sort((a, b) => {
    const numA = parseInt(a.numOC, 10) || 0;
    const numB = parseInt(b.numOC, 10) || 0;
    if (numB !== numA) return numB - numA;
    const timeA = getTimestampSeconds(a.createdAt || a.fechaOC);
    const timeB = getTimestampSeconds(b.createdAt || b.fechaOC);
    return timeB - timeA;
  });

  const totalOrders = sortedOrders.length;
  // Fila 1: Nav Bar, Fila 2: KPI Cards, Fila 3: Search & Filter Bar, Fila 4: Spacer, Fila 5: Headers, Fila 6+: Datos
  const firstDataRow = 6;
  const lastRow = Math.max(totalOrders + firstDataRow - 1, firstDataRow);

  // Paleta de colores ejecutiva (Slate / Indigo / Emerald / Amber)
  const COLOR_NAVY_DARK = "0B1120"; // Slate 950
  const COLOR_NAVY = "0F172A"; // Slate 900
  const COLOR_NAVY_LIGHT = "1E293B"; // Slate 800
  const COLOR_HEADER_TXT = "FFFFFF";
  const COLOR_EMERALD = "166534"; // Green 700 (Liberada)
  const COLOR_EMERALD_LIGHT = "DCFCE7";
  const COLOR_AMBER = "B45309"; // Amber 700 (Mandada)
  const COLOR_AMBER_LIGHT = "FEF3C7";
  const COLOR_INDIGO = "4338CA"; // Indigo 700 (Pendiente)
  const COLOR_INDIGO_LIGHT = "E0E7FF";
  const COLOR_BLUE = "0284C7"; // Sky 600
  const COLOR_BLUE_LIGHT = "E0F2FE";
  const COLOR_ZEBRA = "F8FAFC";
  const COLOR_BORDER = "CBD5E1";

  // Helper para barra de navegación superior compartida en todas las hojas
  const addTopNavBar = (ws: ExcelJS.Worksheet, activeTab: string) => {
    ws.getRow(1).height = 30;
    
    // Título / Brand en A1:D1
    ws.mergeCells("A1:D1");
    const brand = ws.getCell("A1");
    brand.value = "⚡ FINANZAS | CONTROL & LIBERACIÓN DE ÓRDENES";
    brand.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    brand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_DARK } };
    brand.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    
    // Links de navegación
    const navItems = [
      { text: "📋 Órdenes de Compra", sheet: "Órdenes de Compra", colStart: 5, colEnd: 6 },
      { text: "🔄 Proceso Liberación", sheet: "Proceso de Liberación", colStart: 7, colEnd: 8 },
      { text: "📨 Enviados a Firmar", sheet: "Enviados a Firmar", colStart: 9, colEnd: 10 },
      { text: "⚡ Enviados a Tomás", sheet: "Enviados a Tomas", colStart: 11, colEnd: 12 },
      { text: "✍️ Pegado Masivo", sheet: "Pegado Masivo (Batch)", colStart: 13, colEnd: 14 },
      { text: "👥 Resumen Firmantes", sheet: "Resumen Firmantes", colStart: 15, colEnd: 16 },
      { text: "📈 Estadísticas", sheet: "Estadísticas", colStart: 17, colEnd: 18 },
      { text: "❓ Guía y Macros", sheet: "Guía y Macros (VBA)", colStart: 19, colEnd: 20 },
    ];

    navItems.forEach(item => {
      ws.mergeCells(1, item.colStart, 1, item.colEnd);
      const cell = ws.getCell(1, item.colStart);
      const isActive = item.sheet === activeTab;
      
      cell.value = { text: item.text, hyperlink: `#'${item.sheet}'!A1` };
      cell.font = {
        name: "Segoe UI",
        size: 8.5,
        bold: isActive,
        color: { argb: isActive ? "FF38BDF8" : "FFCBD5E1" },
        underline: false,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isActive ? "FF1E293B" : "FF0F172A" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        bottom: { style: isActive ? "medium" : "thin", color: { argb: isActive ? "FF38BDF8" : "FF334155" } }
      };
    });
  };

  // -------------------------------------------------------------------------
  // HOJA 1: Órdenes de Compra (Edición Alternativa con Buscador y Filtros)
  // -------------------------------------------------------------------------
  const wsOrdenes = wb.addWorksheet("Órdenes de Compra", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
  });

  // Fila 1: Barra de navegación superior
  addTopNavBar(wsOrdenes, "Órdenes de Compra");

  // Fila 2: Tarjetas KPI Ejecutivas
  wsOrdenes.getRow(2).height = 42;

  // KPI 1: Total Órdenes (A2:C2)
  wsOrdenes.mergeCells("A2:C2");
  const kpi1 = wsOrdenes.getCell("A2");
  kpi1.value = `📦 TOTAL: ${totalOrders} ÓRDENES`;
  kpi1.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  kpi1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  kpi1.alignment = { vertical: "middle", horizontal: "center" };
  kpi1.border = {
    top: { style: "thin", color: { argb: "FF475569" } },
    left: { style: "thin", color: { argb: "FF475569" } },
    right: { style: "thin", color: { argb: "FF475569" } },
    bottom: { style: "thin", color: { argb: "FF475569" } },
  };

  // KPI 2: Monto Total en Cartera (D2:F2)
  wsOrdenes.mergeCells("D2:F2");
  const kpi2 = wsOrdenes.getCell("D2");
  kpi2.value = { formula: `SUM(E${firstDataRow}:E${lastRow})` };
  kpi2.numFmt = `"$ "#,##0.00`;
  kpi2.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF818CF8" } };
  kpi2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  kpi2.alignment = { vertical: "middle", horizontal: "center" };
  kpi2.border = kpi1.border;

  // KPI 3: Pendientes (G2:H2)
  wsOrdenes.mergeCells("G2:H2");
  const kpi3 = wsOrdenes.getCell("G2");
  kpi3.value = { formula: `"⏳ Pendientes: " & COUNTIF(G${firstDataRow}:G${lastRow},"Pendiente")` };
  kpi3.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF38BDF8" } };
  kpi3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C4A6E" } };
  kpi3.alignment = { vertical: "middle", horizontal: "center" };
  kpi3.border = kpi1.border;

  // KPI 4: Mandadas (I2:J2)
  wsOrdenes.mergeCells("I2:J2");
  const kpi4 = wsOrdenes.getCell("I2");
  kpi4.value = { formula: `"📨 Mandadas: " & COUNTIF(G${firstDataRow}:G${lastRow},"Mandada")` };
  kpi4.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFBBF24" } };
  kpi4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF78350F" } };
  kpi4.alignment = { vertical: "middle", horizontal: "center" };
  kpi4.border = kpi1.border;

  // KPI 5: Liberadas (K2:L2)
  wsOrdenes.mergeCells("K2:L2");
  const kpi5 = wsOrdenes.getCell("K2");
  kpi5.value = { formula: `"✅ Liberadas: " & COUNTIF(G${firstDataRow}:G${lastRow},"Liberada")` };
  kpi5.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF4ADE80" } };
  kpi5.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
  kpi5.alignment = { vertical: "middle", horizontal: "center" };
  kpi5.border = kpi1.border;

  // Ruta SharePoint (M2:T2)
  wsOrdenes.mergeCells("M2:N2");
  const lblRuta = wsOrdenes.getCell("M2");
  lblRuta.value = "📁 SharePoint:";
  lblRuta.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  lblRuta.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  lblRuta.alignment = { vertical: "middle", horizontal: "center" };

  wsOrdenes.mergeCells("O2:T2");
  const cellRuta = wsOrdenes.getCell("O2");
  cellRuta.value = "(Pegá acá tu ruta local de SharePoint para cd /d)";
  cellRuta.font = { name: "Segoe UI", size: 8.5, italic: true, color: { argb: "FF713F12" } };
  cellRuta.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  cellRuta.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cellRuta.border = {
    top: { style: "dashed", color: { argb: "FFEAB308" } },
    left: { style: "dashed", color: { argb: "FFEAB308" } },
    right: { style: "dashed", color: { argb: "FFEAB308" } },
    bottom: { style: "dashed", color: { argb: "FFEAB308" } },
  };

  // -------------------------------------------------------------------------
  // Fila 3: BARRA INTERACTIVA: BUSCADOR RÁPIDO Y BOTONES DE FILTRO
  // -------------------------------------------------------------------------
  wsOrdenes.getRow(3).height = 36;

  // Etiqueta Buscador (A3:B3)
  wsOrdenes.mergeCells("A3:B3");
  const lblSearch = wsOrdenes.getCell("A3");
  lblSearch.value = "🔍 BUSCADOR RÁPIDO:";
  lblSearch.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  lblSearch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  lblSearch.alignment = { vertical: "middle", horizontal: "center" };

  // Campo editable donde el usuario escribe el texto a buscar (C3:E3)
  wsOrdenes.mergeCells("C3:E3");
  const cellSearchInput = wsOrdenes.getCell("C3");
  cellSearchInput.value = "";
  cellSearchInput.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  cellSearchInput.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } }; // Light Amber/Cream
  cellSearchInput.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cellSearchInput.border = {
    top: { style: "medium", color: { argb: "FF38BDF8" } },
    left: { style: "medium", color: { argb: "FF38BDF8" } },
    right: { style: "medium", color: { argb: "FF38BDF8" } },
    bottom: { style: "medium", color: { argb: "FF38BDF8" } },
  };

  // Botón F3: Buscar
  const cellBtnBuscar = wsOrdenes.getCell("F3");
  cellBtnBuscar.value = "🔍 BUSCAR";
  cellBtnBuscar.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnBuscar.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
  cellBtnBuscar.alignment = { vertical: "middle", horizontal: "center" };

  // Botón G3: Limpiar
  const cellBtnLimpiar = wsOrdenes.getCell("G3");
  cellBtnLimpiar.value = "✖ LIMPIAR";
  cellBtnLimpiar.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnLimpiar.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
  cellBtnLimpiar.alignment = { vertical: "middle", horizontal: "center" };

  // Etiqueta Filtros por Estado (H3)
  const lblFiltros = wsOrdenes.getCell("H3");
  lblFiltros.value = "⚡ FILTROS:";
  lblFiltros.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  lblFiltros.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  lblFiltros.alignment = { vertical: "middle", horizontal: "center" };

  // Botón I3: Todas
  const cellBtnTodas = wsOrdenes.getCell("I3");
  cellBtnTodas.value = "📋 TODAS";
  cellBtnTodas.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnTodas.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  cellBtnTodas.alignment = { vertical: "middle", horizontal: "center" };

  // Botón J3: Pendientes
  const cellBtnPend = wsOrdenes.getCell("J3");
  cellBtnPend.value = "⏳ PENDIENTES";
  cellBtnPend.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnPend.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
  cellBtnPend.alignment = { vertical: "middle", horizontal: "center" };

  // Botón K3: Mandadas
  const cellBtnMand = wsOrdenes.getCell("K3");
  cellBtnMand.value = "📨 MANDADAS";
  cellBtnMand.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnMand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } };
  cellBtnMand.alignment = { vertical: "middle", horizontal: "center" };

  // Botón L3: Liberadas
  const cellBtnLib = wsOrdenes.getCell("L3");
  cellBtnLib.value = "✅ LIBERADAS";
  cellBtnLib.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnLib.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  cellBtnLib.alignment = { vertical: "middle", horizontal: "center" };

  // Botones de acción adicionales
  // M3:N3 -> Nueva OC
  wsOrdenes.mergeCells("M3:N3");
  const cellBtnNueva = wsOrdenes.getCell("M3");
  cellBtnNueva.value = "➕ NUEVA OC";
  cellBtnNueva.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnNueva.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
  cellBtnNueva.alignment = { vertical: "middle", horizontal: "center" };

  // O3:P3 -> Copiar Texto Mail
  wsOrdenes.mergeCells("O3:P3");
  const cellBtnCopiar = wsOrdenes.getCell("O3");
  cellBtnCopiar.value = "📋 COPIAR TEXTO";
  cellBtnCopiar.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnCopiar.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  cellBtnCopiar.alignment = { vertical: "middle", horizontal: "center" };

  // Q3:R3 -> CMD Carpetas
  wsOrdenes.mergeCells("Q3:R3");
  const cellBtnCMD = wsOrdenes.getCell("Q3");
  cellBtnCMD.value = "📁 CMD CARPETAS";
  cellBtnCMD.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  cellBtnCMD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
  cellBtnCMD.alignment = { vertical: "middle", horizontal: "center" };

  // S3:T3 -> Proceso de Liberación
  wsOrdenes.mergeCells("S3:T3");
  const cellBtnProc = wsOrdenes.getCell("S3");
  cellBtnProc.value = { text: "🔄 VER PROCESO ➔", hyperlink: "#'Proceso de Liberación'!A1" };
  cellBtnProc.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" }, underline: false };
  cellBtnProc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
  cellBtnProc.alignment = { vertical: "middle", horizontal: "center" };

  // Insertar formas gráficas flotantes correspondientes para permitir clic derecho -> "Asignar macro..."
  const shapeButtons = [
    { text: "🔍 BUSCAR", color: "#0284C7", col: 5.02, row: 2.06, w: 100, h: 28 },
    { text: "✖ LIMPIAR", color: "#475569", col: 6.02, row: 2.06, w: 100, h: 28 },
    { text: "📋 TODAS", color: "#1E293B", col: 8.02, row: 2.06, w: 90, h: 28 },
    { text: "⏳ PENDIENTES", color: "#0284C7", col: 9.02, row: 2.06, w: 120, h: 28 },
    { text: "📨 MANDADAS", color: "#D97706", col: 10.02, row: 2.06, w: 110, h: 28 },
    { text: "✅ LIBERADAS", color: "#166534", col: 11.02, row: 2.06, w: 110, h: 28 },
    { text: "➕ NUEVA OC", color: "#059669", col: 12.02, row: 2.06, w: 140, h: 28 },
    { text: "📋 COPIAR TXT", color: "#4338CA", col: 14.02, row: 2.06, w: 140, h: 28 },
  ];

  shapeButtons.forEach(btn => {
    const imgData = createButtonImage(btn.text, btn.color, 320, 60, 20);
    if (imgData) {
      const id = wb.addImage({ base64: imgData, extension: "png" });
      wsOrdenes.addImage(id, {
        tl: { col: btn.col, row: btn.row },
        ext: { width: btn.w, height: btn.h },
      });
    }
  });

  // Fila 4: Guía visual / Explicación del buscador (A4:T4)
  wsOrdenes.mergeCells("A4:T4");
  const bannerHint = wsOrdenes.getCell("A4");
  bannerHint.value = "💡 Escribí en el recuadro amarillo (C3) y tocá [🔍 BUSCAR] para filtrar por N° OC, Proveedor, Solicitud o Detalle. O tocá los botones para ver solo [⏳ PENDIENTES], [📨 MANDADAS] o [✅ LIBERADAS].";
  bannerHint.font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "FF94A3B8" } };
  bannerHint.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerHint.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsOrdenes.getRow(4).height = 20;

  // -------------------------------------------------------------------------
  // Fila 5: Cabeceras de Columnas
  // -------------------------------------------------------------------------
  const columnsOrdenes = [
    { header: "Empresa", key: "empresa", width: 12 },
    { header: "N° Solicitud", key: "solicitud", width: 14 },
    { header: "N° OC", key: "numOC", width: 13 },
    { header: "Proveedor / Razón Social", key: "razonSocial", width: 34 },
    { header: "Monto ($)", key: "monto", width: 18 },
    { header: "Forma de Pago", key: "formaPago", width: 15 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Firmante 1", key: "firmante1", width: 16 },
    { header: "Firmado 1", key: "firmado1", width: 12 },
    { header: "Firmante 2", key: "firmante2", width: 16 },
    { header: "Firmado 2", key: "firmado2", width: 12 },
    { header: "Entregada", key: "entregada", width: 12 },
    { header: "Detalle / Motivo", key: "motivo", width: 38 },
    { header: "OC Relacionada", key: "relatedOC", width: 16 },
    { header: "Creado Por", key: "creadoPor", width: 15 },
    { header: "Link SharePoint / OneDrive", key: "linkSharepoint", width: 32 },
    { header: "Fecha Creación", key: "fechaCreacion", width: 15 },
    { header: "📋 Formato Copiar (Fórmula)", key: "formatoCopiar", width: 44 },
    { header: "📁 CMD Crear Carpetas (Fórmula)", key: "cmdCarpetas", width: 40 },
  ];

  const headerRow = wsOrdenes.getRow(5);
  headerRow.height = 28;
  columnsOrdenes.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Habilitar AutoFilter en Fila 5 para soporte nativo de filtros de Excel
  wsOrdenes.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: lastRow, column: columnsOrdenes.length },
  };

  // -------------------------------------------------------------------------
  // Filas 6+: Datos de las Órdenes de Compra
  // -------------------------------------------------------------------------
  sortedOrders.forEach((o, index) => {
    const rowNum = firstDataRow + index;
    const isEven = index % 2 === 0;

    let montoNum = 0;
    if (typeof o.monto === "number") {
      montoNum = o.monto;
    } else if (typeof o.monto === "string") {
      const cleaned = (o.monto as string).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
      montoNum = parseFloat(cleaned) || 0;
    }

    let estadoStr = "Pendiente";
    if (o.liberada) estadoStr = "Liberada";
    else if (o.mandada) estadoStr = "Mandada";

    const numMonto = Number(montoNum) || 0;

    // Determinar firmantes respetando las reglas por nivel
    let exportFirmante1 = o.firmante1?.trim() || "";
    let exportFirmante2 = o.firmante2?.trim() || "";

    if (!exportFirmante1) {
      if (o.enviadoA1?.trim()) {
        exportFirmante1 = o.enviadoA1.trim();
      } else if (numMonto <= 5500000 && (o.mandada || estadoStr === "Mandada" || estadoStr === "Liberada")) {
        exportFirmante1 = "Tomas";
      }
    }

    if (!exportFirmante2 && o.enviadoA2?.trim()) {
      exportFirmante2 = o.enviadoA2.trim();
    }

    exportFirmante1 = normalizeSignerName(exportFirmante1);
    exportFirmante2 = normalizeSignerName(exportFirmante2);

    const firmado1Str = (o.firmado1 || estadoStr === "Liberada") ? "Sí" : "No";
    const firmado2Str = (o.firmado2 || estadoStr === "Liberada") ? "Sí" : "No";

    const formulaCopiar = `IF(G${rowNum}="Liberada", "OC 0" & C${rowNum} & " - " & D${rowNum}, "OC " & C${rowNum} & " " & A${rowNum} & CHAR(10) & "Proveedor: " & D${rowNum} & CHAR(10) & "Monto: " & TEXT(E${rowNum}, "$ #,##0") & CHAR(10) & "Detalle: " & M${rowNum} & CHAR(10) & "Forma de Pago: " & F${rowNum} & IF(P${rowNum}<>"", CHAR(10) & "Link: " & P${rowNum}, ""))`;
    const formulaCMD = `"mkdir ""OC " & C${rowNum} & " " & A${rowNum} & " " & SUBSTITUTE(D${rowNum}, """", "") & """"`;

    let fechaStr = "";
    if (o.fechaOC) fechaStr = String(o.fechaOC).split("T")[0];
    else if (o.createdAt) {
      const s = getTimestampSeconds(o.createdAt);
      if (s) fechaStr = new Date(s * 1000).toISOString().split("T")[0];
    }

    const numOCInt = parseInt(o.numOC, 10);
    const valOC = !isNaN(numOCInt) && numOCInt > 0 ? numOCInt : (o.numOC || "");

    const row = wsOrdenes.addRow([
      o.empresa || "Hoyts",
      o.numSolicitud || "-",
      valOC,
      o.razonSocial || "",
      numMonto,
      o.formaPago || "30DFF",
      estadoStr,
      exportFirmante1,
      firmado1Str,
      exportFirmante2,
      firmado2Str,
      o.entregada ? "Sí" : "No",
      o.motivo || "",
      o.relatedOC || "",
      o.creadoPor || "",
      o.linkSharepoint || "",
      fechaStr,
      { formula: formulaCopiar },
      { formula: formulaCMD },
    ]);

    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (!isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + COLOR_ZEBRA },
        };
      }

      // Alineaciones específicas
      if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 4 || colNumber === 13) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 5) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
      } else if (colNumber === 7) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: "Segoe UI", size: 9, bold: true };
        if (estadoStr === "Liberada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_EMERALD_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF" + COLOR_EMERALD } };
        } else if (estadoStr === "Mandada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_AMBER_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF" + COLOR_AMBER } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_INDIGO_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF" + COLOR_INDIGO } };
        }
      } else if (colNumber === 9 || colNumber === 11) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        const isSi = (colNumber === 9 ? firmado1Str : firmado2Str) === "Sí";
        cell.font = {
          name: "Segoe UI",
          size: 9,
          bold: isSi,
          color: { argb: isSi ? "FF" + COLOR_EMERALD : "FF94A3B8" },
        };
      } else if (colNumber === 12) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 14 || colNumber === 15) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.font = { name: "Segoe UI", size: 8, color: { argb: "FF475569" } };
      }
    });
  });

  // Validaciones de datos y dropdowns en Órdenes de Compra
  const firmantesListStr = '"Tomas,Victoria,Tristan,Pablo Gonzalez,Jorgelina,Pablo Mondelo,Dario,Matias,Hernan,Martin"';
  for (let r = firstDataRow; r <= lastRow; r++) {
    wsOrdenes.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Pendiente,Mandada,Liberada"'],
    };
    wsOrdenes.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [firmantesListStr],
    };
    wsOrdenes.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Sí,No"'],
    };
    wsOrdenes.getCell(`J${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [firmantesListStr],
    };
    wsOrdenes.getCell(`K${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Sí,No"'],
    };
  }

  wsOrdenes.columns = columnsOrdenes.map(c => ({ width: c.width }));

  // -------------------------------------------------------------------------
  // HOJA 2: Proceso de Liberación
  // -------------------------------------------------------------------------
  const wsProceso = wb.addWorksheet("Proceso de Liberación", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
  });

  addTopNavBar(wsProceso, "Proceso de Liberación");

  // Fila 2: Cabeceras y Botones
  const columnsProceso = [
    { header: "N° OC", key: "numOC", width: 13 },
    { header: "N° Solicitud", key: "numSol", width: 14 },
    { header: "Empresa", key: "empresa", width: 14 },
    { header: "Proveedor", key: "proveedor", width: 34 },
    { header: "Detalle", key: "detalle", width: 36 },
    { header: "Monto ($)", key: "monto", width: 18 },
    { header: "Estado Liberación", key: "estadoLib", width: 28 },
    { header: "Enviada A (Firmante)", key: "enviadaA", width: 22 },
    { header: "¿Firma 1?", key: "f1", width: 12 },
    { header: "¿Firma 2?", key: "f2", width: 12 },
    { header: "Acción / Ir a Hoja", key: "accion", width: 24 },
  ];

  const headerProcRow = wsProceso.getRow(2);
  headerProcRow.height = 28;
  columnsProceso.forEach((col, index) => {
    const cell = headerProcRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Botón flotante para Actualizar Proceso
  const imgAct = createButtonImage("🔄 ACTUALIZAR PROCESO", "#059669", 360, 60, 20);
  if (imgAct) {
    const id = wb.addImage({ base64: imgAct, extension: "png" });
    wsProceso.addImage(id, { tl: { col: 10.02, row: 0.06 }, ext: { width: 190, height: 26 } });
  }

  wsProceso.columns = columnsProceso.map(c => ({ width: c.width }));

  // -------------------------------------------------------------------------
  // HOJA 3: Enviados a Firmar
  // -------------------------------------------------------------------------
  const wsEnviados = wb.addWorksheet("Enviados a Firmar", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  addTopNavBar(wsEnviados, "Enviados a Firmar");

  // Fila 2: Selector de Firmante
  wsEnviados.getRow(2).height = 36;
  const lblEnv = wsEnviados.getCell("A2");
  lblEnv.value = "👤 Firmante a quien se mandó:";
  lblEnv.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  lblEnv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  lblEnv.alignment = { vertical: "middle", horizontal: "right" };

  const cellEnv = wsEnviados.getCell("B2");
  cellEnv.value = "Tomas";
  cellEnv.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF854D0E" } };
  cellEnv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  cellEnv.alignment = { vertical: "middle", horizontal: "center" };
  cellEnv.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [firmantesListStr],
  };

  const hintEnv = wsEnviados.getCell("C2");
  hintEnv.value = "👈 Elegí a quién le mandaste las órdenes por correo o Teams";
  hintEnv.font = { name: "Segoe UI", size: 8.5, italic: true, color: { argb: "FF94A3B8" } };
  hintEnv.alignment = { vertical: "middle", horizontal: "left" };

  // Fila 3: Botón y Guía
  wsEnviados.getRow(3).height = 24;
  wsEnviados.mergeCells("A3:K3");
  const row3Env = wsEnviados.getCell("A3");
  row3Env.value = "Pegá en la Columna A el texto copiado de Outlook o Teams. La macro pasará las órdenes a 'Mandada' y las contabilizará.";
  row3Env.font = { name: "Segoe UI", size: 8.5, italic: true, color: { argb: "FF94A3B8" } };
  row3Env.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  row3Env.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Forma botón registrar
  const btnImgEnv = createButtonImage("📨 REGISTRAR ENVÍO A FIRMAR", "#4338CA", 400, 60, 20);
  if (btnImgEnv) {
    const id = wb.addImage({ base64: btnImgEnv, extension: "png" });
    wsEnviados.addImage(id, { tl: { col: 4.02, row: 1.06 }, ext: { width: 240, height: 28 } });
  }

  // Fila 4: Cabeceras
  const headersEnv = [
    "Texto Pegado (Mail o Chat)",
    "N° OC Detectado",
    "¿Existe en Base?",
    "Empresa",
    "Proveedor / Razón Social",
    "Monto ($)",
    "Estado Actual",
    "¿Firma 1?",
    "¿Firma 2?",
    "Diagnóstico Envío",
    "Texto Copiar de Respuesta",
  ];

  const headerEnvRow = wsEnviados.getRow(4);
  headerEnvRow.height = 28;
  headersEnv.forEach((h, i) => {
    const c = headerEnvRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  for (let r = 5; r <= 124; r++) {
    const fNum = `IF(A${r}="","",IFERROR(VALUE(IF(ISNUMBER(SEARCH("OC",A${r})),TRIM(MID(SUBSTITUTE(SUBSTITUTE(TRIM(MID(A${r},SEARCH("OC",A${r})+2,30)),":"," ")," ",REPT(" ",30)),1,30)),TRIM(MID(SUBSTITUTE(TRIM(A${r})," ",REPT(" ",30)),1,30)))),IF(ISNUMBER(SEARCH("OC",A${r})),TRIM(MID(SUBSTITUTE(SUBSTITUTE(TRIM(MID(A${r},SEARCH("OC",A${r})+2,30)),":"," ")," ",REPT(" ",30)),1,30)),TRIM(MID(SUBSTITUTE(TRIM(A${r})," ",REPT(" ",30)),1,30)))))`;
    const matchExpr = `IFERROR(MATCH(IFERROR(VALUE(SUBSTITUTE(SUBSTITUTE(TRIM(B${r}),"OC","")," ","")),TRIM(B${r})),'Órdenes de Compra'!$C$${firstDataRow}:$C$${lastRow},0),MATCH(TRIM(B${r}),'Órdenes de Compra'!$C$${firstDataRow}:$C$${lastRow},0))`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(${matchExpr}),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$${firstDataRow}:$A$${lastRow},${matchExpr}),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$${firstDataRow}:$D$${lastRow},${matchExpr}),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$${firstDataRow}:$E$${lastRow},${matchExpr}),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow},${matchExpr}),"")`;
    const fF1 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$I$${firstDataRow}:$I$${lastRow},${matchExpr}),"")`;
    const fF2 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$K$${firstDataRow}:$K$${lastRow},${matchExpr}),"")`;
    const fDiag = `IF(B${r}="","",IF(C${r}="NO","No existe en base de datos",IF(G${r}="Liberada","Ya está 100% Liberada",IF(H${r}="Sí","Ya tiene Firma 1 -> Se registrará para Firma 2","Pendiente Firma 1 -> Se registrará para Firma 1"))))`;
    const fTexto = `IF(B${r}="","",IF(C${r}="SÍ","OC " & B${r} & " " & D${r} & " - Enviada a firmar a " & $B$2,""))`;

    const row = wsEnviados.addRow([
      "",
      { formula: fNum },
      { formula: fExiste },
      { formula: fEmpresa },
      { formula: fProv },
      { formula: fMonto },
      { formula: fEstado },
      { formula: fF1 },
      { formula: fF2 },
      { formula: fDiag },
      { formula: fTexto },
    ]);

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber === 2 || colNumber === 3 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  }

  wsEnviados.columns = [
    { width: 34 }, { width: 16 }, { width: 15 }, { width: 12 }, { width: 30 },
    { width: 16 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 36 },
    { width: 44 },
  ];

  // -------------------------------------------------------------------------
  // HOJA 4: Enviados a Tomas (Con Reglas de Escala y Firmantes de Nivel)
  // -------------------------------------------------------------------------
  const wsTomas = wb.addWorksheet("Enviados a Tomas", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  addTopNavBar(wsTomas, "Enviados a Tomas");

  // Fila 2: Título y Botón
  wsTomas.getRow(2).height = 36;
  const lblTom = wsTomas.getCell("A2");
  lblTom.value = "⚡ PROCESO ESPECIAL TOMÁS (Autofirma < $5.5M / Asignación por Nivel ≥ $5.5M)";
  lblTom.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  lblTom.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  lblTom.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const btnImgTom = createButtonImage("⚡ PROCESAR ENVIADAS A TOMÁS", "#D97706", 420, 60, 20);
  if (btnImgTom) {
    const id = wb.addImage({ base64: btnImgTom, extension: "png" });
    wsTomas.addImage(id, { tl: { col: 4.02, row: 1.06 }, ext: { width: 260, height: 28 } });
  }

  // Fila 3: Banner Reglas
  wsTomas.getRow(3).height = 24;
  wsTomas.mergeCells("A3:K3");
  const row3Tom = wsTomas.getCell("A3");
  row3Tom.value = "• Si el monto es < $5.5M: Firma 1 de Tomás es AUTOMÁTICA y pasa a esperar 2da firma. • Si es ≥ $5.5M: Tomás NO firma; se asigna a Pablo Mondelo ($5.5M-$18M) o Matías ($18M-$150M) con Firma 1 = 'No'.";
  row3Tom.font = { name: "Segoe UI", size: 8, italic: true, color: { argb: "FF94A3B8" } };
  row3Tom.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  row3Tom.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Fila 4: Cabeceras
  const headersTom = [
    "Texto Pegado (Mail o Chat)",
    "N° OC Detectado",
    "¿Existe en Base?",
    "Empresa",
    "Proveedor / Razón Social",
    "Monto ($)",
    "Estado Actual",
    "Filtro $5.5M",
    "Firma 1 Tomás",
    "Diagnóstico / Estado Resultante",
    "Texto Copiar de Respuesta",
  ];

  const headerTomRow = wsTomas.getRow(4);
  headerTomRow.height = 28;
  headersTom.forEach((h, i) => {
    const c = headerTomRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  for (let r = 5; r <= 124; r++) {
    const fNum = `IF(A${r}="","",IFERROR(VALUE(IF(ISNUMBER(SEARCH("OC",A${r})),TRIM(MID(SUBSTITUTE(SUBSTITUTE(TRIM(MID(A${r},SEARCH("OC",A${r})+2,30)),":"," ")," ",REPT(" ",30)),1,30)),TRIM(MID(SUBSTITUTE(TRIM(A${r})," ",REPT(" ",30)),1,30)))),IF(ISNUMBER(SEARCH("OC",A${r})),TRIM(MID(SUBSTITUTE(SUBSTITUTE(TRIM(MID(A${r},SEARCH("OC",A${r})+2,30)),":"," ")," ",REPT(" ",30)),1,30)),TRIM(MID(SUBSTITUTE(TRIM(A${r})," ",REPT(" ",30)),1,30)))))`;
    const matchExpr = `IFERROR(MATCH(IFERROR(VALUE(SUBSTITUTE(SUBSTITUTE(TRIM(B${r}),"OC","")," ","")),TRIM(B${r})),'Órdenes de Compra'!$C$${firstDataRow}:$C$${lastRow},0),MATCH(TRIM(B${r}),'Órdenes de Compra'!$C$${firstDataRow}:$C$${lastRow},0))`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(${matchExpr}),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$${firstDataRow}:$A$${lastRow},${matchExpr}),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$${firstDataRow}:$D$${lastRow},${matchExpr}),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$${firstDataRow}:$E$${lastRow},${matchExpr}),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow},${matchExpr}),"")`;
    const fFiltro = `IF(F${r}="","",IF(F${r}<5500000,"< $5.5M (Autofirma)","≥ $5.5M (Manual)"))`;
    const fF1 = `IF(F${r}="","",IF(F${r}<5500000,"Firma 1 Automática (Tomas)",IF(F${r}<=18000000,"Requiere Firma 1 (Pablo Mondelo)",IF(F${r}<=150000000,"Requiere Firma 1 (Matías)","Requiere Firma 1 (Darío)"))))`;
    const fDiag = `IF(F${r}="","",IF(F${r}<5500000,"Mandada (Espera 2da Firma)",IF(F${r}<=18000000,"Mandada (Espera 1ra Pablo Mondelo)",IF(F${r}<=150000000,"Mandada (Espera 1ra Matías)","Mandada (Espera 1ra Darío)"))))`;
    const fTexto = `IF(B${r}="","",IF(F${r}<5500000,"OC " & B${r} & " " & D${r} & " - Firma 1 de Tomas aplicada (Espera 2da firma)",IF(F${r}<=18000000,"OC " & B${r} & " " & D${r} & " - Excede $5.5M: esperando 1ra firma de Pablo Mondelo","OC " & B${r} & " " & D${r} & " - Excede $5.5M: esperando 1ra firma de Matías")))`;

    const row = wsTomas.addRow([
      "",
      { formula: fNum },
      { formula: fExiste },
      { formula: fEmpresa },
      { formula: fProv },
      { formula: fMonto },
      { formula: fEstado },
      { formula: fFiltro },
      { formula: fF1 },
      { formula: fDiag },
      { formula: fTexto },
    ]);

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber === 2 || colNumber === 3 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  }

  wsTomas.columns = [
    { width: 34 }, { width: 16 }, { width: 15 }, { width: 12 }, { width: 30 },
    { width: 16 }, { width: 14 }, { width: 20 }, { width: 26 }, { width: 32 },
    { width: 44 },
  ];

  // -------------------------------------------------------------------------
  // HOJA 5: Pegado Masivo (Batch) - Firmas de Autorización
  // -------------------------------------------------------------------------
  const wsBatch = wb.addWorksheet("Pegado Masivo (Batch)", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
  });

  addTopNavBar(wsBatch, "Pegado Masivo (Batch)");

  // Fila 2: Selector de Firmante
  wsBatch.getRow(2).height = 36;
  const lblFirmante = wsBatch.getCell("A2");
  lblFirmante.value = "👤 Firmante a registrar:";
  lblFirmante.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  lblFirmante.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  lblFirmante.alignment = { vertical: "middle", horizontal: "right" };

  const cellFirmante = wsBatch.getCell("B2");
  cellFirmante.value = "Tomas";
  cellFirmante.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF854D0E" } };
  cellFirmante.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  cellFirmante.alignment = { vertical: "middle", horizontal: "center" };
  cellFirmante.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [firmantesListStr],
  };

  const btnImgBatch = createButtonImage("⚡ FIRMAR ÓRDENES DETECTADAS", "#166534", 420, 60, 20);
  if (btnImgBatch) {
    const id = wb.addImage({ base64: btnImgBatch, extension: "png" });
    wsBatch.addImage(id, { tl: { col: 4.02, row: 1.06 }, ext: { width: 260, height: 28 } });
  }

  // Fila 3: Guía
  wsBatch.getRow(3).height = 24;
  wsBatch.mergeCells("A3:M3");
  const row3B = wsBatch.getCell("A3");
  row3B.value = "Pegá en la Columna A las OCs firmadas. La macro registrará la firma del firmante seleccionado y liberará la orden automáticamente.";
  row3B.font = { name: "Segoe UI", size: 8.5, italic: true, color: { argb: "FF94A3B8" } };
  row3B.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  row3B.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Fila 4: Cabeceras
  const headersBatch = [
    "Texto Pegado (Mail o Chat)",
    "N° OC Detectado",
    "¿Existe en Base?",
    "Empresa",
    "Proveedor / Razón Social",
    "Monto ($)",
    "Estado Actual",
    "¿Firma 1?",
    "¿Firma 2?",
    "Nivel Monto",
    "Rol Firmante",
    "Acción a Realizar",
    "Texto Copiar de Respuesta",
  ];

  const headerBatchRow = wsBatch.getRow(4);
  headerBatchRow.height = 28;
  headersBatch.forEach((h, i) => {
    const c = headerBatchRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  for (let r = 5; r <= 124; r++) {
    const fNum = `IF(A${r}="","",IFERROR(VALUE(IF(ISNUMBER(SEARCH("OC",A${r})),TRIM(MID(SUBSTITUTE(SUBSTITUTE(TRIM(MID(A${r},SEARCH("OC",A${r})+2,30)),":"," ")," ",REPT(" ",30)),1,30)),TRIM(MID(SUBSTITUTE(TRIM(A${r})," ",REPT(" ",30)),1,30)))),IF(ISNUMBER(SEARCH("OC",A${r})),TRIM(MID(SUBSTITUTE(SUBSTITUTE(TRIM(MID(A${r},SEARCH("OC",A${r})+2,30)),":"," ")," ",REPT(" ",30)),1,30)),TRIM(MID(SUBSTITUTE(TRIM(A${r})," ",REPT(" ",30)),1,30)))))`;
    const matchExpr = `IFERROR(MATCH(IFERROR(VALUE(SUBSTITUTE(SUBSTITUTE(TRIM(B${r}),"OC","")," ","")),TRIM(B${r})),'Órdenes de Compra'!$C$${firstDataRow}:$C$${lastRow},0),MATCH(TRIM(B${r}),'Órdenes de Compra'!$C$${firstDataRow}:$C$${lastRow},0))`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(${matchExpr}),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$${firstDataRow}:$A$${lastRow},${matchExpr}),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$${firstDataRow}:$D$${lastRow},${matchExpr}),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$${firstDataRow}:$E$${lastRow},${matchExpr}),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow},${matchExpr}),"")`;
    const fF1 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$I$${firstDataRow}:$I$${lastRow},${matchExpr}),"")`;
    const fF2 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$K$${firstDataRow}:$K$${lastRow},${matchExpr}),"")`;
    const fNivel = `IF(F${r}="","",IF(F${r}<=5000000,"Nivel 1 (<= 5M)",IF(F${r}<=18000000,"Nivel 2 (5M a 18M)",IF(F${r}<=150000000,"Nivel 3 (18M a 150M)","Nivel 4 (> 150M)"))))`;
    const fRol = `IF(OR(B${r}="",$B$2=""),"",IF(F${r}<=5000000,IF($B$2="Tomas","Firma 1",IF(OR($B$2="Victoria",$B$2="Tristan",$B$2="Pablo Gonzalez",$B$2="Jorgelina"),"Firma 2","No corresponde")),IF(F${r}<=18000000,IF($B$2="Pablo Mondelo","Firma 1",IF($B$2="Dario","Firma 2","No corresponde")),IF(F${r}<=150000000,IF(OR($B$2="Matias",$B$2="Hernan"),"Firma 1",IF($B$2="Dario","Firma 2","No corresponde")),IF(OR($B$2="Dario",$B$2="Hernan"),"Firma 1",IF($B$2="Martin","Firma 2","No corresponde"))))))`;
    const fAccion = `IF(B${r}="","",IF(G${r}="Liberada","Ya está 100% Liberada",IF(K${r}="No corresponde","Firmante no habilitado para este monto",IF(K${r}="Firma 1",IF(H${r}="Sí","Ya tiene Firma 1",IF(I${r}="Sí","Aplica Firma 1 -> ¡100% LIBERADA!","Aplica Firma 1 (Pendiente F2)")),IF(K${r}="Firma 2",IF(I${r}="Sí","Ya tiene Firma 2",IF(H${r}="Sí","Aplica Firma 2 -> ¡100% LIBERADA!","Aplica Firma 2 (Pendiente F1)")),"")))))`;
    const fTexto = `IF(B${r}="","",IF(ISNUMBER(SEARCH("100% LIBERADA",L${r})),"OC 0" & B${r} & " - " & E${r},"OC " & B${r} & " " & D${r} & " - Firma de " & $B$2 & " registrada"))`;

    const row = wsBatch.addRow([
      "",
      { formula: fNum },
      { formula: fExiste },
      { formula: fEmpresa },
      { formula: fProv },
      { formula: fMonto },
      { formula: fEstado },
      { formula: fF1 },
      { formula: fF2 },
      { formula: fNivel },
      { formula: fRol },
      { formula: fAccion },
      { formula: fTexto },
    ]);

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber === 2 || colNumber === 3 || colNumber === 7 || colNumber === 8 || colNumber === 9 || colNumber === 10 || colNumber === 11) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  }

  wsBatch.columns = [
    { width: 34 }, { width: 16 }, { width: 15 }, { width: 12 }, { width: 30 },
    { width: 16 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 18 },
    { width: 16 }, { width: 34 }, { width: 44 },
  ];

  // -------------------------------------------------------------------------
  // HOJA 6: Resumen Firmantes
  // -------------------------------------------------------------------------
  const wsFirmantes = wb.addWorksheet("Resumen Firmantes", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
  });

  addTopNavBar(wsFirmantes, "Resumen Firmantes");

  const firmantesList = [
    { name: "Tomas", altName: "Tomás", nivel: "Nivel 1 (Hasta 5.5M)" },
    { name: "Victoria", altName: "Victoria", nivel: "Nivel 1 (Área)" },
    { name: "Tristan", altName: "Tristán", nivel: "Nivel 1 (Área)" },
    { name: "Pablo Gonzalez", altName: "Pablo González", nivel: "Nivel 1 (Área)" },
    { name: "Jorgelina", altName: "Jorgelina", nivel: "Nivel 1 (Área)" },
    { name: "Pablo Mondelo", altName: "Pablo Mondelo", nivel: "Nivel 2 (5.5M a 18M)" },
    { name: "Dario", altName: "Darío", nivel: "Nivel 2 y 3 (Firma 2)" },
    { name: "Matias", altName: "Matías", nivel: "Nivel 3 (18M a 150M)" },
    { name: "Hernan", altName: "Hernán", nivel: "Nivel 3 y 4 (Firma 1)" },
    { name: "Martin", altName: "Martín", nivel: "Nivel 4 (> 150M)" },
  ];

  const headersResumen = [
    "Firmante",
    "Nivel de Autorización",
    "Órdenes Pendientes F1",
    "Órdenes Pendientes F2",
    "Total Pendientes de Firma",
    "Monto Total en Espera ($)",
  ];

  const headerResRow = wsFirmantes.getRow(2);
  headerResRow.height = 28;
  headersResumen.forEach((h, i) => {
    const c = headerResRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  firmantesList.forEach((f, idx) => {
    const r = 3 + idx;
    const fPend1 = `COUNTIFS('Órdenes de Compra'!$H$${firstDataRow}:$H$${lastRow}, "${f.name}", 'Órdenes de Compra'!$I$${firstDataRow}:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow}, "<>Liberada")`;
    const fPend2 = `COUNTIFS('Órdenes de Compra'!$J$${firstDataRow}:$J$${lastRow}, "${f.name}", 'Órdenes de Compra'!$K$${firstDataRow}:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow}, "<>Liberada")`;
    const fTotal = `C${r}+D${r}`;
    const fMonto = `SUMIFS('Órdenes de Compra'!$E$${firstDataRow}:$E$${lastRow}, 'Órdenes de Compra'!$H$${firstDataRow}:$H$${lastRow}, "${f.name}", 'Órdenes de Compra'!$I$${firstDataRow}:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow}, "<>Liberada") + SUMIFS('Órdenes de Compra'!$E$${firstDataRow}:$E$${lastRow}, 'Órdenes de Compra'!$J$${firstDataRow}:$J$${lastRow}, "${f.name}", 'Órdenes de Compra'!$K$${firstDataRow}:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow}, "<>Liberada")`;

    const row = wsFirmantes.addRow([
      f.altName,
      f.nivel,
      { formula: fPend1 },
      { formula: fPend2 },
      { formula: fTotal },
      { formula: fMonto },
    ]);

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber === 1) cell.font = { name: "Segoe UI", size: 9.5, bold: true };
      if (colNumber === 3 || colNumber === 4 || colNumber === 5) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
      if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
      }
    });
  });

  wsFirmantes.columns = [
    { width: 22 }, { width: 28 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 26 }
  ];

  // -------------------------------------------------------------------------
  // HOJA 7: Estadísticas
  // -------------------------------------------------------------------------
  const wsStats = wb.addWorksheet("Estadísticas", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
  });

  addTopNavBar(wsStats, "Estadísticas");

  const headersStats = [
    "Estado",
    "Cantidad de Órdenes",
    "% del Total de Órdenes",
    "Monto Total ($)",
    "% del Monto Total",
  ];

  const headerStatRow = wsStats.getRow(2);
  headerStatRow.height = 28;
  headersStats.forEach((h, i) => {
    const c = headerStatRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY_LIGHT } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.border = {
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  const estadosStats = [
    { label: "Pendientes", badge: "Pendiente" },
    { label: "Mandadas", badge: "Mandada" },
    { label: "Liberadas", badge: "Liberada" },
  ];

  estadosStats.forEach((est, idx) => {
    const r = 3 + idx;
    const fCant = `COUNTIF('Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow}, "${est.badge}")`;
    const fPctCant = `B${r}/$B$6`;
    const fMonto = `SUMIF('Órdenes de Compra'!$G$${firstDataRow}:$G$${lastRow}, "${est.badge}", 'Órdenes de Compra'!$E$${firstDataRow}:$E$${lastRow})`;
    const fPctMonto = `D${r}/$D$6`;

    const row = wsStats.addRow([
      est.label,
      { formula: fCant },
      { formula: fPctCant },
      { formula: fMonto },
      { formula: fPctMonto },
    ]);

    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNumber === 1) cell.font = { name: "Segoe UI", size: 9.5, bold: true };
      if (colNumber === 2) cell.alignment = { vertical: "middle", horizontal: "center" };
      if (colNumber === 3 || colNumber === 5) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.numFmt = "0.0%";
      }
      if (colNumber === 4) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
      }
    });
  });

  // Fila Total en Estadísticas
  const rowTotStat = wsStats.addRow([
    "TOTAL CARTERA",
    { formula: "SUM(B3:B5)" },
    { formula: "SUM(C3:C5)" },
    { formula: "SUM(D3:D5)" },
    { formula: "SUM(E3:E5)" },
  ]);
  rowTotStat.height = 26;
  rowTotStat.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF38BDF8" } },
      bottom: { style: "medium", color: { argb: "FF38BDF8" } },
    };
    if (colNumber === 2) cell.alignment = { vertical: "middle", horizontal: "center" };
    if (colNumber === 3 || colNumber === 5) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.numFmt = "0.0%";
    }
    if (colNumber === 4) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = `"$ "#,##0.00;("$ "#,##0.00);"-"`;
    }
  });

  wsStats.columns = [
    { width: 22 }, { width: 22 }, { width: 24 }, { width: 26 }, { width: 24 }
  ];

  // -------------------------------------------------------------------------
  // HOJA 8: Guía y Macros (VBA)
  // -------------------------------------------------------------------------
  const wsGuia = wb.addWorksheet("Guía y Macros (VBA)");
  addTopNavBar(wsGuia, "Guía y Macros (VBA)");

  wsGuia.columns = [
    { width: 6 }, { width: 110 }
  ];

  const guiaLines = [
    "",
    "MANUAL OPERATIVO Y CÓDIGO VBA PARA LA EDICIÓN ALTERNATIVA",
    "===========================================================",
    "",
    "1. CÓMO ACTIVAR LAS MACROS EN ESTE EXCEL (PASO ÚNICO):",
    "---------------------------------------------------------",
    "1) Presioná ALT + F11 en Excel (se abrirá el Editor de Visual Basic).",
    "2) Andá al menú superior: Insertar > Módulo.",
    "3) Copiá y pegá TODO el código que figura abajo en el recuadro blanco.",
    "4) Guardá el archivo como 'Libro de Excel habilitado para macros (*.xlsm)'.",
    "5) Hacé clic derecho sobre cada botón en las hojas y elegí 'Asignar macro...'.",
    "",
    "2. NUEVAS FUNCIONES DE LA EDICIÓN ALTERNATIVA:",
    "------------------------------------------------",
    "• BUSCADOR INTERACTIVO (Hoja Órdenes de Compra):",
    "  Escribí cualquier texto o número en el recuadro amarillo (C3) y hacé clic en [🔍 BUSCAR].",
    "  Filtrará al instante la tabla mostrando únicamente las filas coincidentes.",
    "  Para restablecer la vista completa, hacé clic en [✖ LIMPIAR].",
    "",
    "• BOTONES DE FILTRO RÁPIDO POR ESTADO:",
    "  [⏳ PENDIENTES]: Muestra en un clic solo las órdenes pendientes.",
    "  [📨 MANDADAS]: Muestra solo las órdenes enviadas a firmar.",
    "  [✅ LIBERADAS]: Muestra solo las órdenes 100% autorizadas y liberadas.",
    "  [📋 TODAS]: Quita cualquier filtro y muestra todas las órdenes.",
    "",
    "• BARRA DE NAVEGACIÓN RÁPIDA SUPERIOR:",
    "  Fila 1 de todas las hojas: hacé clic en cualquier pestaña para ir al instante sin buscar abajo.",
    "",
    "• ESCALA POR NIVELES DE MONTOS EN ENVIADOS A TOMÁS:",
    "  < $5.5M: Tomás firma automáticamente Firma 1 (automática).",
    "  ≥ $5.5M: No la firma Tomás (límite superado). Se asigna a Pablo Mondelo ($5.5M a $18M),",
    "           Matías ($18M a $150M) o Darío (> $150M) con Firma 1 = 'No'.",
    "",
    "===========================================================",
    "CÓDIGO VBA COMPLETO PARA COPIAR Y PEGAR EN EL MÓDULO:",
    "===========================================================",
    "",
    "' ===========================================================",
    "' MÓDULO: MacrosFinanzasAlternativa",
    "' ===========================================================",
    "",
    "Sub BuscarOrden()",
    "    Dim ws As Worksheet, txt As String, lastRow As Long, r As Long",
    "    Dim ocStr As String, solStr As String, provStr As String, detStr As String",
    "    Dim cantEncontradas As Long",
    "    ",
    "    Set ws = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If ws Is Nothing Then Set ws = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    If ws Is Nothing Then Exit Sub",
    "    ",
    "    txt = Trim(CStr(ws.Range(\"C3\").Value))",
    "    If txt = \"\" Or InStr(txt, \"Escribí\") > 0 Then",
    "        txt = Trim(InputBox(\"Ingresá N° OC, Proveedor, Solicitud o palabra clave a buscar:\", \"Buscador Rápido de Órdenes\"))",
    "        If txt <> \"\" Then ws.Range(\"C3\").Value = txt",
    "    End If",
    "    ",
    "    If txt = \"\" Then Exit Sub",
    "    ",
    "    Application.ScreenUpdating = False",
    "    On Error Resume Next",
    "    If ws.FilterMode Then ws.ShowAllData",
    "    On Error GoTo 0",
    "    ",
    "    lastRow = ws.Cells(ws.Rows.Count, \"C\").End(xlUp).Row",
    "    If lastRow < 6 Then lastRow = 6",
    "    ",
    "    cantEncontradas = 0",
    "    For r = 6 To lastRow",
    "        ocStr = CStr(ws.Cells(r, 3).Value)",
    "        solStr = CStr(ws.Cells(r, 2).Value)",
    "        provStr = CStr(ws.Cells(r, 4).Value)",
    "        detStr = CStr(ws.Cells(r, 13).Value)",
    "        ",
    "        If InStr(1, ocStr, txt, vbTextCompare) > 0 Or _",
    "           InStr(1, provStr, txt, vbTextCompare) > 0 Or _",
    "           InStr(1, solStr, txt, vbTextCompare) > 0 Or _",
    "           InStr(1, detStr, txt, vbTextCompare) > 0 Then",
    "            ws.Rows(r).Hidden = False",
    "            cantEncontradas = cantEncontradas + 1",
    "        Else",
    "            ws.Rows(r).Hidden = True",
    "        End If",
    "    Next r",
    "    ",
    "    Application.ScreenUpdating = True",
    "    If cantEncontradas = 0 Then",
    "        MsgBox \"No se encontraron órdenes que contengan '\" & txt & \"'.\", vbInformation, \"Búsqueda sin resultados\"",
    "        ws.Rows(\"6:\" & lastRow).Hidden = False",
    "    End If",
    "End Sub",
    "",
    "Sub LimpiarBusqueda()",
    "    Dim ws As Worksheet, lastRow As Long",
    "    Set ws = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If ws Is Nothing Then Set ws = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    If ws Is Nothing Then Exit Sub",
    "    ",
    "    Application.ScreenUpdating = False",
    "    ws.Range(\"C3\").Value = \"\"",
    "    lastRow = ws.Cells(ws.Rows.Count, \"C\").End(xlUp).Row",
    "    If lastRow >= 6 Then ws.Rows(\"6:\" & lastRow).Hidden = False",
    "    On Error Resume Next",
    "    If ws.FilterMode Then ws.ShowAllData",
    "    On Error GoTo 0",
    "    Application.ScreenUpdating = True",
    "End Sub",
    "",
    "Sub FiltrarTodas()",
    "    LimpiarBusqueda",
    "End Sub",
    "",
    "Sub FiltrarPendientes()",
    "    FiltrarPorEstado \"Pendiente\"",
    "End Sub",
    "",
    "Sub FiltrarMandadas()",
    "    FiltrarPorEstado \"Mandada\"",
    "End Sub",
    "",
    "Sub FiltrarLiberadas()",
    "    FiltrarPorEstado \"Liberada\"",
    "End Sub",
    "",
    "Private Sub FiltrarPorEstado(estadoBuscado As String)",
    "    Dim ws As Worksheet, lastRow As Long, r As Long, cant As Long",
    "    Set ws = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If ws Is Nothing Then Set ws = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    If ws Is Nothing Then Exit Sub",
    "    ",
    "    Application.ScreenUpdating = False",
    "    ws.Range(\"C3\").Value = \"\"",
    "    lastRow = ws.Cells(ws.Rows.Count, \"C\").End(xlUp).Row",
    "    If lastRow < 6 Then Exit Sub",
    "    ",
    "    On Error Resume Next",
    "    If ws.FilterMode Then ws.ShowAllData",
    "    On Error GoTo 0",
    "    ",
    "    cant = 0",
    "    For r = 6 To lastRow",
    "        If Trim(CStr(ws.Cells(r, 7).Value)) = estadoBuscado Then",
    "            ws.Rows(r).Hidden = False",
    "            cant = cant + 1",
    "        Else",
    "            ws.Rows(r).Hidden = True",
    "        End If",
    "    Next r",
    "    Application.ScreenUpdating = True",
    "End Sub",
    "",
    "Sub NuevaOrdenCompra()",
    "    Dim ws As Worksheet",
    "    Set ws = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If ws Is Nothing Then Set ws = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    If ws Is Nothing Then Exit Sub",
    "    ",
    "    Application.ScreenUpdating = False",
    "    On Error Resume Next",
    "    If ws.FilterMode Then ws.ShowAllData",
    "    ws.Rows(\"6:\" & ws.Rows.Count).Hidden = False",
    "    On Error GoTo 0",
    "    ",
    "    ws.Rows(6).Insert Shift:=xlDown",
    "    ws.Range(\"A7:T7\").Copy",
    "    ws.Range(\"A6:T6\").PasteSpecial xlPasteFormats",
    "    Application.CutCopyMode = False",
    "    ",
    "    ws.Range(\"A6:F6\").ClearContents",
    "    ws.Range(\"H6:K6\").ClearContents",
    "    ws.Range(\"L6:M6\").ClearContents",
    "    ws.Range(\"P6:T6\").ClearContents",
    "    ",
    "    ws.Range(\"G6\").Value = \"Pendiente\"",
    "    ws.Range(\"G6\").Interior.Color = RGB(224, 231, 255)",
    "    ws.Range(\"G6\").Font.Color = RGB(67, 56, 202)",
    "    ws.Range(\"G6\").Font.Bold = True",
    "    ",
    "    ws.Range(\"I6\").Value = \"No\"",
    "    ws.Range(\"K6\").Value = \"No\"",
    "    ws.Range(\"L6\").Value = Format(Date, \"yyyy-mm-dd\")",
    "    ",
    "    ws.Range(\"N6\").Formula = \"=IF(G6=\"\"Liberada\"\", \"\"OC 0\"\" & C6 & \"\" - \"\" & D6, \"\"OC \"\" & C6 & \"\" \"\" & A6 & CHAR(10) & \"\"Proveedor: \"\" & D6 & CHAR(10) & \"\"Monto: \"\" & TEXT(E6, \"\"$ #,##0\"\") & CHAR(10) & \"\"Detalle: \"\" & M6 & CHAR(10) & \"\"Forma de Pago: \"\" & F6 & IF(P6<>\"\"\"\", CHAR(10) & \"\"Link: \"\" & P6, \"\"\"\"))\"",
    "    ws.Range(\"O6\").Formula = \"=\"\"mkdir \"\"\"\"OC \"\" & C6 & \"\" \"\" & A6 & \"\" \"\" & SUBSTITUTE(D6, \"\"\"\"\"\"\"\", \"\"\"\") & \"\"\"\"\"\"\"",
    "    ",
    "    Application.ScreenUpdating = True",
    "    ws.Activate",
    "    ws.Range(\"C6\").Select",
    "    MsgBox \"¡Nueva fila creada en la posición 6!\" & vbCrLf & _",
    "           \"Completá el N° OC, Proveedor y Monto.\", vbInformation, \"Nueva Orden Creada\"",
    "End Sub",
    "",
    "Sub ProcesarEnviadosAFirmar()",
    "    Dim wsEnv As Worksheet, wsOC As Worksheet",
    "    Dim firmante As String, ocVal As Variant, rawStr As String, cleanStr As String",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant, cant As Long",
    "    ",
    "    On Error Resume Next",
    "    Set wsEnv = ThisWorkbook.Sheets(\"Enviados a Firmar\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    On Error GoTo 0",
    "    ",
    "    If wsEnv Is Nothing Or wsOC Is Nothing Then Exit Sub",
    "    ",
    "    firmante = Trim(CStr(wsEnv.Range(\"B2\").Value))",
    "    If firmante = \"\" Then",
    "        MsgBox \"Por favor elegí a quién le mandaste las órdenes en la celda B2.\", vbExclamation",
    "        Exit Sub",
    "    End If",
    "    ",
    "    lastBatchRow = wsEnv.Cells(wsEnv.Rows.Count, \"B\").End(xlUp).Row",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    cant = 0",
    "    ",
    "    For r = 5 To lastBatchRow",
    "        ocVal = \"\"",
    "        If Not IsError(wsEnv.Cells(r, 2).Value) Then ocVal = wsEnv.Cells(r, 2).Value",
    "        If Trim(CStr(ocVal)) = \"\" And Not IsError(wsEnv.Cells(r, 1).Value) Then ocVal = wsEnv.Cells(r, 1).Value",
    "        rawStr = Trim(CStr(ocVal))",
    "        If rawStr <> \"\" Then",
    "            cleanStr = Trim(Replace(Replace(Replace(UCase(rawStr), \"OC\", \"\"), \":\", \"\"), \"-\", \"\"))",
    "            rowOC = CVErr(xlErrNA)",
    "            If IsNumeric(cleanStr) Then rowOC = Application.Match(CLng(Val(cleanStr)), wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If IsError(rowOC) And cleanStr <> \"\" Then rowOC = Application.Match(cleanStr, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If IsError(rowOC) Then rowOC = Application.Match(rawStr, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            ",
    "            If Not IsError(rowOC) Then",
    "                If wsOC.Cells(rowOC, 7).Value <> \"Liberada\" Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Mandada\"",
    "                    wsOC.Cells(rowOC, 7).Interior.Color = RGB(254, 243, 199)",
    "                    wsOC.Cells(rowOC, 7).Font.Color = RGB(180, 83, 9)",
    "                    wsOC.Cells(rowOC, 7).Font.Bold = True",
    "                End If",
    "                If wsOC.Cells(rowOC, 9).Value <> \"Sí\" Then",
    "                    wsOC.Cells(rowOC, 8).Value = firmante",
    "                    wsOC.Cells(rowOC, 9).Value = \"No\"",
    "                ElseIf wsOC.Cells(rowOC, 11).Value <> \"Sí\" Then",
    "                    wsOC.Cells(rowOC, 10).Value = firmante",
    "                    wsOC.Cells(rowOC, 11).Value = \"No\"",
    "                End If",
    "                cant = cant + 1",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    Application.Calculate",
    "    On Error Resume Next: ActualizarProcesoLiberacion: On Error GoTo 0",
    "    MsgBox \"¡\" & cant & \" órdenes registradas como enviadas a \" & firmante & \"!\", vbInformation, \"Envío Registrado\"",
    "End Sub",
    "",
    "Sub ProcesarEnviadosATomas()",
    "    Dim wsTom As Worksheet, wsOC As Worksheet",
    "    Dim ocVal As Variant, rawStr As String, cleanStr As String, monto As Double",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant",
    "    Dim cantTotal As Long, cantAutoFirma As Long",
    "    ",
    "    On Error Resume Next",
    "    Set wsTom = ThisWorkbook.Sheets(\"Enviados a Tomas\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    On Error GoTo 0",
    "    ",
    "    If wsTom Is Nothing Or wsOC Is Nothing Then Exit Sub",
    "    ",
    "    lastBatchRow = wsTom.Cells(wsTom.Rows.Count, \"B\").End(xlUp).Row",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    cantTotal = 0: cantAutoFirma = 0",
    "    ",
    "    For r = 5 To lastBatchRow",
    "        ocVal = \"\"",
    "        If Not IsError(wsTom.Cells(r, 2).Value) Then ocVal = wsTom.Cells(r, 2).Value",
    "        If Trim(CStr(ocVal)) = \"\" And Not IsError(wsTom.Cells(r, 1).Value) Then ocVal = wsTom.Cells(r, 1).Value",
    "        rawStr = Trim(CStr(ocVal))",
    "        If rawStr <> \"\" Then",
    "            cleanStr = Trim(Replace(Replace(Replace(UCase(rawStr), \"OC\", \"\"), \":\", \"\"), \"-\", \"\"))",
    "            rowOC = CVErr(xlErrNA)",
    "            If IsNumeric(cleanStr) Then rowOC = Application.Match(CLng(Val(cleanStr)), wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If IsError(rowOC) And cleanStr <> \"\" Then rowOC = Application.Match(cleanStr, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If IsError(rowOC) Then rowOC = Application.Match(rawStr, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            ",
    "            If Not IsError(rowOC) Then",
    "                monto = 0",
    "                If IsNumeric(wsOC.Cells(rowOC, 5).Value2) And Not IsEmpty(wsOC.Cells(rowOC, 5).Value2) Then",
    "                    monto = CDbl(wsOC.Cells(rowOC, 5).Value2)",
    "                Else",
    "                    Dim sMontoTom As String",
    "                    sMontoTom = Trim(Replace(Replace(Replace(Replace(wsOC.Cells(rowOC, 5).Text, \"$\", \"\"), \" \", \"\"), Chr(160), \"\"), vbTab, \"\"))",
    "                    If InStr(sMontoTom, \".\") > 0 And InStr(sMontoTom, \",\") > 0 Then",
    "                        sMontoTom = Replace(sMontoTom, \".\", \"\")",
    "                        sMontoTom = Replace(sMontoTom, \",\", \".\")",
    "                    ElseIf InStr(sMontoTom, \".\") > 0 Then",
    "                        Dim pMTom() As String: pMTom = Split(sMontoTom, \".\")",
    "                        If UBound(pMTom) >= 2 Or Len(pMTom(UBound(pMTom))) = 3 Then sMontoTom = Replace(sMontoTom, \".\", \"\")",
    "                    ElseIf InStr(sMontoTom, \",\") > 0 Then",
    "                        Dim cMTom() As String: cMTom = Split(sMontoTom, \",\")",
    "                        If UBound(cMTom) >= 2 Or Len(cMTom(UBound(cMTom))) = 3 Then sMontoTom = Replace(sMontoTom, \",\", \"\") Else sMontoTom = Replace(sMontoTom, \",\", \".\")",
    "                    End If",
    "                    If IsNumeric(sMontoTom) Then monto = Val(sMontoTom)",
    "                End If",
    "                ",
    "                If wsOC.Cells(rowOC, 7).Value <> \"Liberada\" Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Mandada\"",
    "                    wsOC.Cells(rowOC, 7).Interior.Color = RGB(254, 243, 199)",
    "                    wsOC.Cells(rowOC, 7).Font.Color = RGB(180, 83, 9)",
    "                    wsOC.Cells(rowOC, 7).Font.Bold = True",
    "                End If",
    "                ",
    "                If monto < 5500000 Then",
    "                    wsOC.Cells(rowOC, 8).Value = \"Tomas\"",
    "                    wsOC.Cells(rowOC, 9).Value = \"Sí\"",
    "                    cantAutoFirma = cantAutoFirma + 1",
    "                ElseIf monto <= 18000000 Then",
    "                    wsOC.Cells(rowOC, 8).Value = \"Pablo Mondelo\"",
    "                    wsOC.Cells(rowOC, 9).Value = \"No\"",
    "                ElseIf monto <= 150000000 Then",
    "                    wsOC.Cells(rowOC, 8).Value = \"Matias\"",
    "                    wsOC.Cells(rowOC, 9).Value = \"No\"",
    "                Else",
    "                    wsOC.Cells(rowOC, 8).Value = \"Dario\"",
    "                    wsOC.Cells(rowOC, 9).Value = \"No\"",
    "                End If",
    "                cantTotal = cantTotal + 1",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    Application.Calculate",
    "    On Error Resume Next: ActualizarProcesoLiberacion: On Error GoTo 0",
    "    MsgBox \"¡Enviadas a Tomás procesadas!\" & vbCrLf & _",
    "           \"• Total pasadas a Mandadas: \" & cantTotal & vbCrLf & _",
    "           \"• Con Firma 1 automática de Tomás (< $5.5M): \" & cantAutoFirma & vbCrLf & _",
    "           \"• Mayores a $5.5M (asignadas a Pablo Mondelo / Matías según monto): \" & (cantTotal - cantAutoFirma), vbInformation, \"Tomas Procesado\"",
    "End Sub",
    "",
    "Sub AplicarFirmasDesdePegadoMasivo()",
    "    Dim wsBatch As Worksheet, wsOC As Worksheet",
    "    Dim firmante As String, ocVal As Variant, rawStr As String, cleanStr As String",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant, cant As Long",
    "    ",
    "    On Error Resume Next",
    "    Set wsBatch = ThisWorkbook.Sheets(\"Pegado Masivo (Batch)\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    On Error GoTo 0",
    "    ",
    "    If wsBatch Is Nothing Or wsOC Is Nothing Then Exit Sub",
    "    firmante = Trim(CStr(wsBatch.Range(\"B2\").Value))",
    "    If firmante = \"\" Then Exit Sub",
    "    ",
    "    lastBatchRow = wsBatch.Cells(wsBatch.Rows.Count, \"B\").End(xlUp).Row",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    cant = 0",
    "    ",
    "    For r = 5 To lastBatchRow",
    "        ocVal = \"\"",
    "        If Not IsError(wsBatch.Cells(r, 2).Value) Then ocVal = wsBatch.Cells(r, 2).Value",
    "        If Trim(CStr(ocVal)) = \"\" And Not IsError(wsBatch.Cells(r, 1).Value) Then ocVal = wsBatch.Cells(r, 1).Value",
    "        rawStr = Trim(CStr(ocVal))",
    "        If rawStr <> \"\" Then",
    "            cleanStr = Trim(Replace(Replace(Replace(UCase(rawStr), \"OC\", \"\"), \":\", \"\"), \"-\", \"\"))",
    "            rowOC = CVErr(xlErrNA)",
    "            If IsNumeric(cleanStr) Then rowOC = Application.Match(CLng(Val(cleanStr)), wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If IsError(rowOC) And cleanStr <> \"\" Then rowOC = Application.Match(cleanStr, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If IsError(rowOC) Then rowOC = Application.Match(rawStr, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            ",
    "            If Not IsError(rowOC) Then",
    "                If wsOC.Cells(rowOC, 9).Value <> \"Sí\" Then",
    "                    wsOC.Cells(rowOC, 8).Value = firmante",
    "                    wsOC.Cells(rowOC, 9).Value = \"Sí\"",
    "                ElseIf wsOC.Cells(rowOC, 11).Value <> \"Sí\" Then",
    "                    wsOC.Cells(rowOC, 10).Value = firmante",
    "                    wsOC.Cells(rowOC, 11).Value = \"Sí\"",
    "                End If",
    "                ",
    "                If wsOC.Cells(rowOC, 9).Value = \"Sí\" And wsOC.Cells(rowOC, 11).Value = \"Sí\" Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Liberada\"",
    "                    wsOC.Cells(rowOC, 7).Interior.Color = RGB(220, 252, 231)",
    "                    wsOC.Cells(rowOC, 7).Font.Color = RGB(22, 101, 52)",
    "                    wsOC.Cells(rowOC, 7).Font.Bold = True",
    "                End If",
    "                cant = cant + 1",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    Application.Calculate",
    "    On Error Resume Next: ActualizarProcesoLiberacion: On Error GoTo 0",
    "    MsgBox \"¡Firmas de \" & firmante & \" registradas en \" & cant & \" órdenes!\", vbInformation, \"Firmas Registradas\"",
    "End Sub",
    "",
    "Sub ActualizarProcesoLiberacion()",
    "    Dim wsProc As Worksheet, wsOC As Worksheet",
    "    Dim lastOCRow As Long, lastProcRow As Long, outRow As Long, r As Long, grupo As Integer",
    "    Dim est As String, f1 As String, f1Ok As String, f2 As String, f2Ok As String",
    "    Dim ocNum As Variant, sol As Variant, emp As Variant, prov As Variant, mot As Variant, monto As Double",
    "    Dim matchGrupo As Integer, estLib As String, envA As String, linkText As String, linkSheet As String",
    "    Dim f1Has As Boolean, f2Has As Boolean",
    "    ",
    "    On Error Resume Next",
    "    Set wsProc = ThisWorkbook.Sheets(\"Proceso de Liberación\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    On Error GoTo 0",
    "    ",
    "    If wsProc Is Nothing Or wsOC Is Nothing Then Exit Sub",
    "    ",
    "    Application.ScreenUpdating = False",
    "    lastProcRow = wsProc.Cells(wsProc.Rows.Count, \"A\").End(xlUp).Row",
    "    If lastProcRow >= 3 Then wsProc.Range(\"A3:K\" & lastProcRow).Clear",
    "    ",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    outRow = 3",
    "    ",
    "    For grupo = 1 To 4",
    "        For r = 6 To lastOCRow",
    "            est = Trim(wsOC.Cells(r, 7).Value)",
    "            If est = \"Mandada\" Then",
    "                f1 = Trim(wsOC.Cells(r, 8).Value)",
    "                f1Ok = Trim(wsOC.Cells(r, 9).Value)",
    "                f2 = Trim(wsOC.Cells(r, 10).Value)",
    "                f2Ok = Trim(wsOC.Cells(r, 11).Value)",
    "                f1Has = (f1 <> \"\" And f1 <> \"(Sin enviar)\")",
    "                f2Has = (f2 <> \"\" And f2 <> \"(Sin enviar)\")",
    "                ",
    "                matchGrupo = 0",
    "                If f1Ok <> \"Sí\" And f2Ok <> \"Sí\" Then",
    "                    If f1Has Then matchGrupo = 3 Else matchGrupo = 1",
    "                ElseIf f1Ok = \"Sí\" And f2Ok <> \"Sí\" Then",
    "                    If f2Has Then matchGrupo = 4 Else matchGrupo = 2",
    "                ElseIf f1Ok <> \"Sí\" And f2Ok = \"Sí\" Then",
    "                    If f1Has Then matchGrupo = 3 Else matchGrupo = 1",
    "                End If",
    "                ",
    "                If matchGrupo = grupo Then",
    "                    ocNum = wsOC.Cells(r, 3).Value",
    "                    sol = wsOC.Cells(r, 2).Value",
    "                    emp = wsOC.Cells(r, 1).Value",
    "                    prov = wsOC.Cells(r, 4).Value",
    "                    mot = wsOC.Cells(r, 13).Value",
    "                    monto = 0",
    "                    If IsNumeric(wsOC.Cells(r, 5).Value2) And Not IsEmpty(wsOC.Cells(r, 5).Value2) Then",
    "                        monto = CDbl(wsOC.Cells(r, 5).Value2)",
    "                    Else",
    "                        Dim sMontoProc As String",
    "                        sMontoProc = Trim(Replace(Replace(Replace(Replace(wsOC.Cells(r, 5).Text, \"$\", \"\"), \" \", \"\"), Chr(160), \"\"), vbTab, \"\"))",
    "                        If InStr(sMontoProc, \".\") > 0 And InStr(sMontoProc, \",\") > 0 Then",
    "                            sMontoProc = Replace(sMontoProc, \".\", \"\")",
    "                            sMontoProc = Replace(sMontoProc, \",\", \".\")",
    "                        ElseIf InStr(sMontoProc, \".\") > 0 Then",
    "                            Dim pMProc() As String: pMProc = Split(sMontoProc, \".\")",
    "                            If UBound(pMProc) >= 2 Or Len(pMProc(UBound(pMProc))) = 3 Then sMontoProc = Replace(sMontoProc, \".\", \"\")",
    "                        ElseIf InStr(sMontoProc, \",\") > 0 Then",
    "                            Dim cMProc() As String: cMProc = Split(sMontoProc, \",\")",
    "                            If UBound(cMProc) >= 2 Or Len(cMProc(UBound(cMProc))) = 3 Then sMontoProc = Replace(sMontoProc, \",\", \"\") Else sMontoProc = Replace(sMontoProc, \",\", \".\")",
    "                        End If",
    "                        If IsNumeric(sMontoProc) Then monto = Val(sMontoProc)",
    "                    End If",
    "                    ",
    "                    Select Case matchGrupo",
    "                        Case 1",
    "                            estLib = ChrW(9679) & \" Sin mandar a nadie\"",
    "                            envA = \"(Sin enviar)\"",
    "                            If monto < 5500000 Then",
    "                                linkText = \"Ir a Enviados a Tomas\"",
    "                                linkSheet = \"Enviados a Tomas\"",
    "                            Else",
    "                                linkText = \"Ir a Enviados a Firmar\"",
    "                                linkSheet = \"Enviados a Firmar\"",
    "                            End If",
    "                        Case 2",
    "                            estLib = ChrW(9679) & \" Esperando envío a 2da firma\"",
    "                            envA = \"(Sin enviar a 2da)\"",
    "                            linkText = \"Ir a Enviados a Firmar\"",
    "                            linkSheet = \"Enviados a Firmar\"",
    "                        Case 3",
    "                            estLib = ChrW(9679) & \" Enviada a 1ra Firma\"",
    "                            envA = f1",
    "                            linkText = \"Ir a Pegado Masivo\"",
    "                            linkSheet = \"Pegado Masivo (Batch)\"",
    "                        Case 4",
    "                            estLib = ChrW(9679) & \" Enviada a 2da Firma\"",
    "                            envA = f2",
    "                            linkText = \"Ir a Pegado Masivo\"",
    "                            linkSheet = \"Pegado Masivo (Batch)\"",
    "                    End Select",
    "                    ",
    "                    wsProc.Cells(outRow, 1).Value = ocNum",
    "                    wsProc.Cells(outRow, 2).Value = sol",
    "                    wsProc.Cells(outRow, 3).Value = emp",
    "                    wsProc.Cells(outRow, 4).Value = prov",
    "                    wsProc.Cells(outRow, 5).Value = mot",
    "                    wsProc.Cells(outRow, 6).Value = monto",
    "                    wsProc.Cells(outRow, 6).NumberFormat = \"\"\"$\"\"#,##0.00;(\"\"$\"\"#,##0.00);\"\"-\"\"\"",
    "                    wsProc.Cells(outRow, 7).Value = estLib",
    "                    wsProc.Cells(outRow, 8).Value = envA",
    "                    wsProc.Cells(outRow, 9).Value = f1Ok",
    "                    wsProc.Cells(outRow, 10).Value = f2Ok",
    "                    wsProc.Hyperlinks.Add Anchor:=wsProc.Cells(outRow, 11), Address:=\"\", SubAddress:=\"'\" & linkSheet & \"'!A1\", TextToDisplay:=linkText",
    "                    ",
    "                    wsProc.Cells(outRow, 1).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 2).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 3).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 4).HorizontalAlignment = xlLeft",
    "                    wsProc.Cells(outRow, 5).HorizontalAlignment = xlLeft",
    "                    wsProc.Cells(outRow, 6).HorizontalAlignment = xlRight",
    "                    wsProc.Cells(outRow, 7).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 8).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 9).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 10).HorizontalAlignment = xlCenter",
    "                    wsProc.Cells(outRow, 11).HorizontalAlignment = xlCenter",
    "                    ",
    "                    Select Case matchGrupo",
    "                        Case 1: wsProc.Cells(outRow, 7).Font.Color = RGB(147, 51, 234)",
    "                        Case 2: wsProc.Cells(outRow, 7).Font.Color = RGB(2, 132, 199)",
    "                        Case 3: wsProc.Cells(outRow, 7).Font.Color = RGB(217, 119, 6)",
    "                        Case 4: wsProc.Cells(outRow, 7).Font.Color = RGB(22, 101, 52)",
    "                    End Select",
    "                    wsProc.Cells(outRow, 7).Font.Bold = True",
    "                    ",
    "                    outRow = outRow + 1",
    "                End If",
    "            End If",
    "        Next r",
    "    Next grupo",
    "    ",
    "    Application.ScreenUpdating = True",
    "End Sub",
    "",
    "Sub CopiarFormatoParaCorreo()",
    "    Dim wsOC As Worksheet",
    "    Dim rngIntersect As Range, area As Range, fRow As Range",
    "    Dim dictFilas As Object",
    "    Dim textoAcumulado As String, textoFila As String",
    "    Dim ocNum As String, ocsList As String",
    "    Dim cantOC As Long, r As Long, lastRow As Long",
    "    ",
    "    On Error Resume Next",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    If wsOC Is Nothing Then Exit Sub",
    "    ",
    "    lastRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    If lastRow < 6 Then Exit Sub",
    "    ",
    "    Set rngIntersect = Intersect(Selection, wsOC.Range(\"A6:T\" & lastRow))",
    "    If rngIntersect Is Nothing Then",
    "        MsgBox \"Por favor seleccioná con el mouse las filas de las órdenes que querés copiar.\", vbExclamation, \"Sin selección\"",
    "        Exit Sub",
    "    End If",
    "    ",
    "    Set dictFilas = CreateObject(\"Scripting.Dictionary\")",
    "    For Each area In rngIntersect.Areas",
    "        For Each fRow In area.Rows",
    "            r = fRow.Row",
    "            If Not dictFilas.exists(r) Then",
    "                dictFilas.Add r, True",
    "                textoFila = wsOC.Cells(r, 14).Text",
    "                ocNum = wsOC.Cells(r, 3).Text",
    "                If Trim(textoFila) <> \"\" Then",
    "                    If textoAcumulado <> \"\" Then textoAcumulado = textoAcumulado & vbCrLf & vbCrLf",
    "                    textoAcumulado = textoAcumulado & textoFila",
    "                    If ocsList <> \"\" Then ocsList = ocsList & \", \"",
    "                    ocsList = ocsList & \"OC \" & ocNum",
    "                    cantOC = cantOC + 1",
    "                End If",
    "            End If",
    "        Next fRow",
    "    Next area",
    "    ",
    "    If cantOC = 0 Then Exit Sub",
    "    ",
    "    Dim objClipboard As Object",
    "    On Error Resume Next",
    "    Set objClipboard = CreateObject(\"New:{1C3B4210-F441-11CE-B9EA-00AA006B1A69}\")",
    "    If Err.Number = 0 Then",
    "        objClipboard.SetText textoAcumulado",
    "        objClipboard.PutInClipboard",
    "    Else",
    "        Dim objHTML As Object",
    "        Set objHTML = CreateObject(\"htmlfile\")",
    "        objHTML.ParentWindow.ClipboardData.SetData \"text\", textoAcumulado",
    "    End If",
    "    On Error GoTo 0",
    "    ",
    "    MsgBox \"¡\" & cantOC & \" órdenes copiadas al portapapeles!\" & vbCrLf & _",
    "           \"• Órdenes: \" & ocsList & vbCrLf & _",
    "           \"Ya podés pegar con Ctrl + V en Outlook, Teams o Gmail.\", vbInformation, \"Copiado al Portapapeles\"",
    "End Sub",
  ];

  guiaLines.forEach((lineText, idx) => {
    const row = wsGuia.addRow(["", lineText]);
    row.height = 18;
    const c = row.getCell(2);
    if (lineText.startsWith("=") || lineText.startsWith("MANUAL") || lineText.startsWith("1.") || lineText.startsWith("2.")) {
      c.font = { name: "Consolas", size: 10, bold: true, color: { argb: "FF0284C7" } };
    } else if (lineText.startsWith("Sub ") || lineText.startsWith("End Sub") || lineText.startsWith("Private Sub")) {
      c.font = { name: "Consolas", size: 9.5, bold: true, color: { argb: "FF166534" } };
    } else {
      c.font = { name: "Consolas", size: 9, color: { argb: "FF334155" } };
    }
  });

  // Generar archivo binario y disparar descarga en el navegador
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Ordenes_Compra_ALTERNATIVA_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
