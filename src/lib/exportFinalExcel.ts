import ExcelJS from "exceljs";
import { OrdenCompra } from "@/types/ordenes";
import { parseMontoToNumber } from "@/lib/approvalConfig";
import { getTimestampSeconds } from "@/lib/serverSync";

/**
 * Genera y descarga el libro maestro de Excel definitivo ("Excel Final").
 * Diseñado con estética corporativa de alto impacto visual y las 7 herramientas operativas:
 * 1. "Órdenes de Compra": Base principal con botón [➕ NUEVA ORDEN], ordenada por OC, fórmulas y badges de estado.
 * 2. "Enviados a Firmar": Proceso de envío masivo con selector de firmante y cambio a estado 'Mandada'.
 * 3. "Enviados a Tomas": Proceso especial con regla < $5.500.000 (Firma 1 automática de Tomás y espera 2da firma).
 * 4. "Pegado Masivo (Batch)": Proceso de firmas/autorizaciones, detección Firma 1 vs Firma 2 y liberación al reunir ambas.
 * 5. "Resumen Firmantes": Matriz dinámica de control por responsable.
 * 6. "Estadísticas": Dashboard con tarjetas KPI y tablas comparativas de Pendientes, Mandadas y Liberadas.
 * 7. "Guía y Macros": Manual completo y código VBA para automatizar cada botón con 1 clic.
 */
export async function exportFinalExcel(ordenes: OrdenCompra[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Finanzas";
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
  // Fila 1 es Banner/Botón, Fila 2 es Cabecera, datos desde Fila 3 a lastRow
  const lastRow = Math.max(totalOrders + 2, 3);

  // Paleta de colores corporativa
  const COLOR_NAVY = "0F172A"; // Slate 900
  const COLOR_HEADER_TXT = "FFFFFF";
  const COLOR_EMERALD = "166534"; // Green 700
  const COLOR_EMERALD_LIGHT = "DCFCE7";
  const COLOR_AMBER = "B45309";
  const COLOR_AMBER_LIGHT = "FEF3C7";
  const COLOR_BLUE = "1E40AF";
  const COLOR_BLUE_LIGHT = "DBEAFE";
  const COLOR_RED = "991B1B";
  const COLOR_RED_LIGHT = "FEE2E2";
  const COLOR_ZEBRA = "F8FAFC";
  const COLOR_BORDER = "CBD5E1";

  // -------------------------------------------------------------------------
  // HOJA 1: Órdenes de Compra
  // -------------------------------------------------------------------------
  const wsOrdenes = wb.addWorksheet("Órdenes de Compra", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
  });

  // Fila 1: Banner Superior y Botón [➕ NUEVA ORDEN DE COMPRA]
  wsOrdenes.mergeCells("A1:P1");
  const bannerOC = wsOrdenes.getCell("A1");
  bannerOC.value = "BASE DE CONTROL Y GESTIÓN DE ÓRDENES DE COMPRA";
  bannerOC.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF" + COLOR_HEADER_TXT } };
  bannerOC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_NAVY } };
  bannerOC.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  wsOrdenes.mergeCells("Q1:S1");
  const btnNuevaOC = wsOrdenes.getCell("Q1");
  btnNuevaOC.value = "➕ NUEVA ORDEN DE COMPRA";
  btnNuevaOC.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
  btnNuevaOC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_EMERALD } };
  btnNuevaOC.alignment = { vertical: "middle", horizontal: "center" };
  btnNuevaOC.border = {
    top: { style: "medium", color: { argb: "FF14532D" } },
    bottom: { style: "medium", color: { argb: "FF14532D" } },
    left: { style: "medium", color: { argb: "FF14532D" } },
    right: { style: "medium", color: { argb: "FF14532D" } },
  };
  wsOrdenes.getRow(1).height = 32;

  // Fila 2: Cabeceras de Columnas
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
    { header: "📋 Formato Copiar (Fórmula)", key: "formatoCopiar", width: 48 },
    { header: "📁 CMD Crear Carpetas (Fórmula)", key: "cmdCarpetas", width: 48 },
  ];

  const headerRow2 = wsOrdenes.getRow(2);
  headerRow2.height = 28;
  columnsOrdenes.forEach((col, i) => {
    const cell = headerRow2.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF" + COLOR_HEADER_TXT } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (i >= 17) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } }; // Verde destacado
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    }
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF09101D" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Datos de Órdenes de Compra (desde fila 3)
  sortedOrders.forEach((o, idx) => {
    const rowNum = idx + 3;

    // Regla de Liberada: Si tiene ambas firmas, automáticamente es Liberada
    let estadoStr = "Pendiente";
    if (o.cancelada) estadoStr = "Cancelada";
    else if (o.entregada) estadoStr = "Entregada";
    else if (o.liberada || (o.firmado1 && o.firmado2)) estadoStr = "Liberada";
    else if (o.mandada) estadoStr = "Mandada";

    let fechaStr = "";
    const sec = getTimestampSeconds(o.createdAt || o.fechaOC);
    if (sec > 0) {
      fechaStr = new Date(sec * 1000).toLocaleDateString("es-AR");
    }

    const numMonto = parseMontoToNumber(o.monto);

    const formulaCopiar = `IF(G${rowNum}="Liberada", "OC 0" & C${rowNum} & " - " & D${rowNum}, "OC " & C${rowNum} & " " & A${rowNum} & CHAR(10) & "Proveedor: " & D${rowNum} & CHAR(10) & "Monto: " & TEXT(E${rowNum}, "$ #,##0") & CHAR(10) & "Detalle: " & M${rowNum} & CHAR(10) & "Forma de Pago: " & F${rowNum})`;
    const formulaCMD = `"mkdir ""OC " & C${rowNum} & " " & A${rowNum} & " " & SUBSTITUTE(D${rowNum}, """", "") & """"`;

    const row = wsOrdenes.addRow([
      o.empresa || "Hoyts",
      o.numSolicitud || "-",
      o.numOC || "",
      o.razonSocial || "",
      numMonto,
      o.formaPago || "30DFF",
      estadoStr,
      o.firmante1 || "",
      o.firmado1 ? "Sí" : "No",
      o.firmante2 || "",
      o.firmado2 ? "Sí" : "No",
      o.entregada ? "Sí" : "No",
      o.motivo || "",
      o.relatedOC || "",
      o.creadoPor || "",
      o.linkSharepoint || "",
      fechaStr,
      { formula: formulaCopiar },
      { formula: formulaCMD },
    ]);

    row.height = 22;
    const isEven = rowNum % 2 === 0;
    const bgRowColor = isEven ? COLOR_ZEBRA : "FFFFFF";

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgRowColor } };

      if (colNumber === 4 || colNumber === 13 || colNumber === 16 || colNumber === 18 || colNumber === 19) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 5) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      // Badge de Color en columna Estado (Col 7)
      if (colNumber === 7) {
        cell.font = { name: "Segoe UI", size: 9.5, bold: true };
        if (estadoStr === "Liberada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_EMERALD_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF" + COLOR_EMERALD } };
        } else if (estadoStr === "Mandada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_AMBER_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF" + COLOR_AMBER } };
        } else if (estadoStr === "Entregada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_BLUE_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF" + COLOR_BLUE } };
        } else if (estadoStr === "Cancelada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_RED_LIGHT } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF" + COLOR_RED } };
        }
      }
    });
  });

  // Ajuste de anchos
  columnsOrdenes.forEach((col, idx) => {
    wsOrdenes.getColumn(idx + 1).width = col.width;
  });

  // Autofiltro sobre la tabla desde fila 2
  wsOrdenes.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: lastRow, column: 19 },
  };

  // -------------------------------------------------------------------------
  // HOJA 2: Enviados a Firmar (NUEVA)
  // -------------------------------------------------------------------------
  const wsEnviados = wb.addWorksheet("Enviados a Firmar", {
    views: [{ showGridLines: true }],
  });

  wsEnviados.mergeCells("A1:M1");
  const bannerEnv = wsEnviados.getCell("A1");
  bannerEnv.value = "PROCESO DE ENVÍO A FIRMAR POR LOTE";
  bannerEnv.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerEnv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerEnv.alignment = { vertical: "middle", horizontal: "center" };
  wsEnviados.getRow(1).height = 32;

  const row2Env = wsEnviados.getRow(2);
  row2Env.height = 30;
  const lblEnv = row2Env.getCell(1);
  lblEnv.value = "Firmante Destinatario:";
  lblEnv.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  lblEnv.alignment = { vertical: "middle", horizontal: "right" };

  const cellEnv = row2Env.getCell(2);
  cellEnv.value = "Tomas";
  cellEnv.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF854D0E" } };
  cellEnv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  cellEnv.alignment = { vertical: "middle", horizontal: "center" };
  cellEnv.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"Tomas,Victoria,Tristan,Pablo Gonzalez,Jorgelina,Pablo Mondelo,Dario,Matias,Hernan,Martin"'],
  };

  const hintEnv = row2Env.getCell(3);
  hintEnv.value = "← Seleccioná a quién se le enviaron a firmar estas órdenes";
  hintEnv.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  hintEnv.alignment = { vertical: "middle", horizontal: "left" };

  wsEnviados.mergeCells("E2:G2");
  const btnMacroEnv = wsEnviados.getCell("E2");
  btnMacroEnv.value = "📨 BOTÓN: REGISTRAR ENVÍO A FIRMAR";
  btnMacroEnv.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  btnMacroEnv.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } }; // Indigo
  btnMacroEnv.alignment = { vertical: "middle", horizontal: "center" };

  wsEnviados.mergeCells("A3:M3");
  const row3Env = wsEnviados.getCell("A3");
  row3Env.value = "Pegá el texto de tu mail o chat en la Columna A. Las órdenes detectadas pasan al proceso de 'Mandadas' para el firmante elegido. Tip: Filtrá la columna B por '(No vacías)' para compactar la vista.";
  row3Env.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF475569" } };
  row3Env.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  wsEnviados.getRow(3).height = 24;

  const headersEnv = [
    "Texto Pegado (Mail o Chat)",
    "N° OC Detectado",
    "¿Existe en Base?",
    "Empresa",
    "Proveedor / Razón Social",
    "Monto ($)",
    "Estado Actual",
    "Firma 1 Actual",
    "Firma 2 Actual",
    "Nivel de Monto",
    "Paso de Envío Detectado",
    "Nuevo Estado Sugerido",
    "Texto Copiar de Seguimiento",
  ];

  const headerEnvRow = wsEnviados.getRow(4);
  headerEnvRow.height = 28;
  headersEnv.forEach((h, i) => {
    const c = headerEnvRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (let r = 5; r <= 124; r++) {
    const fNum = `IF(ISNUMBER(SEARCH("OC ", A${r})), TRIM(MID(SUBSTITUTE(TRIM(MID(A${r}, SEARCH("OC ", A${r}) + 3, 30)), " ", REPT(" ", 30)), 1, 30)), "")`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$3:$A$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$3:$D$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$3:$E$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$3:$G$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fF1 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$I$3:$I$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fF2 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$K$3:$K$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fNivel = `IF(F${r}="","",IF(F${r}<=5000000,"Nivel 1 (<= 5M)",IF(F${r}<=18000000,"Nivel 2 (5M a 18M)",IF(F${r}<=150000000,"Nivel 3 (18M a 150M)","Nivel 4 (> 150M)"))))`;
    const fPaso = `IF(B${r}="","",IF(H${r}="No","Envío a 1ra Firma","Envío a 2da Firma"))`;
    const fAccion = `IF(B${r}="","",IF(G${r}="Liberada","Ya está 100% Liberada","Pasa a Mandada (Enviada a " & $B$2 & ")"))`;
    const fTexto = `IF(B${r}="","", "OC " & B${r} & " " & D${r} & " - Enviada a firmar a " & $B$2)`;

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
      { formula: fNivel },
      { formula: fPaso },
      { formula: fAccion },
      { formula: fTexto },
    ]);

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };
      if (colNumber === 1 || colNumber === 5 || colNumber === 12 || colNumber === 13) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  }

  wsEnviados.columns = [
    { width: 34 }, { width: 16 }, { width: 15 }, { width: 12 }, { width: 30 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 },
    { width: 22 }, { width: 32 }, { width: 42 },
  ];
  wsEnviados.autoFilter = { from: { row: 4, column: 1 }, to: { row: 124, column: 13 } };

  // -------------------------------------------------------------------------
  // HOJA 3: Enviados a Tomas (NUEVA - Regla < $5.500.000)
  // -------------------------------------------------------------------------
  const wsTomas = wb.addWorksheet("Enviados a Tomas", {
    views: [{ showGridLines: true }],
  });

  wsTomas.mergeCells("A1:K1");
  const bannerTom = wsTomas.getCell("A1");
  bannerTom.value = "PROCESO ESPECIAL: ENVIADOS A TOMÁS (AUTOFIRMA < $5.500.000)";
  bannerTom.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerTom.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerTom.alignment = { vertical: "middle", horizontal: "center" };
  wsTomas.getRow(1).height = 32;

  const row2Tom = wsTomas.getRow(2);
  row2Tom.height = 30;
  wsTomas.mergeCells("E2:G2");
  const btnMacroTom = wsTomas.getCell("E2");
  btnMacroTom.value = "⚡ BOTÓN: PROCESAR ENVIADAS A TOMÁS";
  btnMacroTom.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  btnMacroTom.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD97706" } }; // Amber
  btnMacroTom.alignment = { vertical: "middle", horizontal: "center" };

  wsTomas.mergeCells("A3:K3");
  const row3Tom = wsTomas.getCell("A3");
  row3Tom.value = "Regla de Tomás: Las órdenes entran en estado 'Mandada'. Si el monto es menor a $5.500.000, la Firma 1 de Tomás es AUTOMÁTICA y queda a la espera de la 2da firma. Si es igual o mayor a $5.500.000, queda esperando el envío a la 1ra firma.";
  row3Tom.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF475569" } };
  row3Tom.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  wsTomas.getRow(3).height = 24;

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
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (let r = 5; r <= 124; r++) {
    const fNum = `IF(ISNUMBER(SEARCH("OC ", A${r})), TRIM(MID(SUBSTITUTE(TRIM(MID(A${r}, SEARCH("OC ", A${r}) + 3, 30)), " ", REPT(" ", 30)), 1, 30)), "")`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$3:$A$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$3:$D$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$3:$E$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$3:$G$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fFiltro = `IF(F${r}="","",IF(F${r}<5500000,"< $5.5M (Autofirma)","≥ $5.5M (Manual)"))`;
    const fF1 = `IF(F${r}="","",IF(F${r}<5500000,"Firma 1 Automática (Tomas)","Requiere Firma 1"))`;
    const fDiag = `IF(F${r}="","",IF(F${r}<5500000,"Mandada (Espera 2da Firma)","Mandada (Espera 1ra Firma)"))`;
    const fTexto = `IF(B${r}="","",IF(F${r}<5500000,"OC " & B${r} & " " & D${r} & " - Firma 1 de Tomas aplicada (Espera 2da firma)","OC " & B${r} & " " & D${r} & " - Enviada a Tomas esperando 1ra firma"))`;

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
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };
      if (colNumber === 1 || colNumber === 5 || colNumber === 10 || colNumber === 11) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  }

  wsTomas.columns = [
    { width: 34 }, { width: 16 }, { width: 15 }, { width: 12 }, { width: 30 },
    { width: 16 }, { width: 14 }, { width: 20 }, { width: 24 }, { width: 30 },
    { width: 44 },
  ];
  wsTomas.autoFilter = { from: { row: 4, column: 1 }, to: { row: 124, column: 11 } };

  // -------------------------------------------------------------------------
  // HOJA 4: Pegado Masivo (Batch) - Autorizaciones / Liberación
  // -------------------------------------------------------------------------
  const wsBatch = wb.addWorksheet("Pegado Masivo (Batch)", {
    views: [{ showGridLines: true }],
  });

  wsBatch.mergeCells("A1:M1");
  const bannerB = wsBatch.getCell("A1");
  bannerB.value = "PROCESO DE LIBERACIÓN Y FIRMAS POR LOTE";
  bannerB.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerB.alignment = { vertical: "middle", horizontal: "center" };
  wsBatch.getRow(1).height = 32;

  const row2B = wsBatch.getRow(2);
  row2B.height = 30;
  const lblFirmante = row2B.getCell(1);
  lblFirmante.value = "Firmante Seleccionado:";
  lblFirmante.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  lblFirmante.alignment = { vertical: "middle", horizontal: "right" };

  const cellFirmante = row2B.getCell(2);
  cellFirmante.value = "Tomas";
  cellFirmante.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF854D0E" } };
  cellFirmante.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  cellFirmante.alignment = { vertical: "middle", horizontal: "center" };
  cellFirmante.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"Tomas,Victoria,Tristan,Pablo Gonzalez,Jorgelina,Pablo Mondelo,Dario,Matias,Hernan,Martin"'],
  };

  const hintFirmante = row2B.getCell(3);
  hintFirmante.value = "← Cambiá el firmante desde la lista desplegable";
  hintFirmante.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  hintFirmante.alignment = { vertical: "middle", horizontal: "left" };

  wsBatch.mergeCells("E2:G2");
  const btnMacro = wsBatch.getCell("E2");
  btnMacro.value = "⚡ BOTÓN: FIRMAR ÓRDENES DETECTADAS";
  btnMacro.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  btnMacro.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  btnMacro.alignment = { vertical: "middle", horizontal: "center" };

  wsBatch.mergeCells("A3:M3");
  const row3B = wsBatch.getCell("A3");
  row3B.value = "Pegá el texto de tu mail o chat en la Columna A (ej: 'Oc 13052 HOYTS'). La fórmula detecta SOLO el número a un espacio de 'OC ' e ignora renglones de proveedor o monto. Al completar ambas firmas, la orden pasa a estado 'Liberada'.";
  row3B.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF475569" } };
  row3B.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  wsBatch.getRow(3).height = 24;

  const headersBatch = [
    "Texto Pegado (Mail o Chat)",
    "N° OC Detectado",
    "¿Existe en Base?",
    "Empresa",
    "Proveedor / Razón Social",
    "Monto ($)",
    "Estado Actual",
    "Firma 1 Actual",
    "Firma 2 Actual",
    "Nivel de Monto",
    "Rol de Firmante Elegido",
    "Diagnóstico y Acción",
    "Texto Copiar de Respuesta",
  ];

  const headerBRow = wsBatch.getRow(4);
  headerBRow.height = 28;
  headersBatch.forEach((h, i) => {
    const c = headerBRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    if (i === 1 || i === 10 || i === 11) {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
    } else {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    }
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (let r = 5; r <= 124; r++) {
    const fNum = `IF(ISNUMBER(SEARCH("OC ", A${r})), TRIM(MID(SUBSTITUTE(TRIM(MID(A${r}, SEARCH("OC ", A${r}) + 3, 30)), " ", REPT(" ", 30)), 1, 30)), "")`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$3:$A$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$3:$D$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$3:$E$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$3:$G$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fF1 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$I$3:$I$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
    const fF2 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$K$3:$K$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$3:$C$${lastRow},0)),"")`;
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
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };
      if (colNumber === 1 || colNumber === 5 || colNumber === 12 || colNumber === 13) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  }

  wsBatch.columns = [
    { width: 34 }, { width: 16 }, { width: 15 }, { width: 12 }, { width: 30 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 },
    { width: 22 }, { width: 32 }, { width: 42 },
  ];
  wsBatch.autoFilter = { from: { row: 4, column: 1 }, to: { row: 124, column: 13 } };

  // -------------------------------------------------------------------------
  // HOJA 5: Resumen Firmantes
  // -------------------------------------------------------------------------
  const wsFirmantes = wb.addWorksheet("Resumen Firmantes", {
    views: [{ showGridLines: true }],
  });

  wsFirmantes.mergeCells("A1:G1");
  const bannerF = wsFirmantes.getCell("A1");
  bannerF.value = "RESUMEN Y SEGUIMIENTO DE FIRMANTES (NIVELES DE AUTORIZACIÓN)";
  bannerF.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerF.alignment = { vertical: "middle", horizontal: "center" };
  wsFirmantes.getRow(1).height = 32;

  wsFirmantes.mergeCells("A2:G2");
  const noteF = wsFirmantes.getCell("A2");
  noteF.value = "Nota: Al reunir sus 2 firmas, la orden pasa automáticamente a 'Liberada' y sale del conteo de pendientes de firma.";
  noteF.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF475569" } };
  noteF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  wsFirmantes.getRow(2).height = 20;

  const headerFRow = wsFirmantes.getRow(3);
  headerFRow.height = 26;
  const headersF = [
    "Firmante / Responsable",
    "Nivel de Autorización",
    "Pendientes Firma 1",
    "Pendientes Firma 2",
    "Total a Firmar",
    "Monto Pendiente ($)",
    "Resumen para Copiar y Mandar",
  ];
  headersF.forEach((h, i) => {
    const c = headerFRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });

  const firmantesList = [
    { name: "Tomas", nivel: "Nivel 1 (Hasta 5M)" },
    { name: "Victoria", nivel: "Nivel 1 (Área)" },
    { name: "Tristan", nivel: "Nivel 1 (Área)" },
    { name: "Pablo Gonzalez", nivel: "Nivel 1 (Área)" },
    { name: "Jorgelina", nivel: "Nivel 1 (Área)" },
    { name: "Pablo Mondelo", nivel: "Nivel 2 (5M a 18M)" },
    { name: "Dario", nivel: "Nivel 2, 3 y 4" },
    { name: "Matias", nivel: "Nivel 3 (18M a 150M)" },
    { name: "Hernan", nivel: "Nivel 3 y 4" },
    { name: "Martin", nivel: "Nivel 4 (> 150M)" },
  ];

  firmantesList.forEach((f, idx) => {
    const r = idx + 4;
    const f1Count = `COUNTIFS('Órdenes de Compra'!$H$3:$H$${lastRow}, A${r}, 'Órdenes de Compra'!$I$3:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Liberada")`;
    const f2Count = `COUNTIFS('Órdenes de Compra'!$J$3:$J$${lastRow}, A${r}, 'Órdenes de Compra'!$K$3:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Liberada")`;
    const totalCount = `C${r}+D${r}`;
    const montoSum = `SUMIFS('Órdenes de Compra'!$E$3:$E$${lastRow}, 'Órdenes de Compra'!$H$3:$H$${lastRow}, A${r}, 'Órdenes de Compra'!$I$3:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Liberada") + SUMIFS('Órdenes de Compra'!$E$3:$E$${lastRow}, 'Órdenes de Compra'!$J$3:$J$${lastRow}, A${r}, 'Órdenes de Compra'!$K$3:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "<>Liberada")`;
    const resumenText = `A${r} & ": " & E${r} & " órdenes pendientes por " & TEXT(F${r}, "$ #,##0")`;

    const row = wsFirmantes.addRow([
      f.name,
      f.nivel,
      { formula: f1Count },
      { formula: f2Count },
      { formula: totalCount },
      { formula: montoSum },
      { formula: resumenText },
    ]);

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Segoe UI", size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };
      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      } else if (colNumber === 7) {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  });

  wsFirmantes.columns = [
    { width: 22 }, { width: 24 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 24 }, { width: 50 },
  ];

  // -------------------------------------------------------------------------
  // HOJA 6: Estadísticas (NUEVA - Pendientes, Mandadas, Liberadas)
  // -------------------------------------------------------------------------
  const wsStats = wb.addWorksheet("Estadísticas", {
    views: [{ showGridLines: true }],
  });

  wsStats.mergeCells("A1:I1");
  const bannerStats = wsStats.getCell("A1");
  bannerStats.value = "PANEL DE CONTROL: ESTADÍSTICAS OPERATIVAS (PENDIENTES, MANDADAS Y LIBERADAS)";
  bannerStats.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerStats.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerStats.alignment = { vertical: "middle", horizontal: "center" };
  wsStats.getRow(1).height = 32;

  // Tarjetas KPI (Fila 3 a 6)
  // KPI 1: PENDIENTES
  wsStats.mergeCells("B3:C3");
  const kpi1Title = wsStats.getCell("B3");
  kpi1Title.value = "⏳ PENDIENTES (SIN ENVIAR)";
  kpi1Title.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  kpi1Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
  kpi1Title.alignment = { vertical: "middle", horizontal: "center" };

  wsStats.getCell("B4").value = "Cantidad:";
  wsStats.getCell("B4").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("C4").value = { formula: `COUNTIF('Órdenes de Compra'!$G$3:$G$${lastRow}, "Pendiente")` };
  wsStats.getCell("C4").font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FF1E293B" } };
  wsStats.getCell("C4").alignment = { horizontal: "right" };

  wsStats.getCell("B5").value = "Monto Total:";
  wsStats.getCell("B5").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("C5").value = { formula: `SUMIF('Órdenes de Compra'!$G$3:$G$${lastRow}, "Pendiente", 'Órdenes de Compra'!$E$3:$E$${lastRow})` };
  wsStats.getCell("C5").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  wsStats.getCell("C5").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  wsStats.getCell("B6").value = "Ticket Promedio:";
  wsStats.getCell("B6").font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  wsStats.getCell("C6").value = { formula: `IF(C4>0, C5/C4, 0)` };
  wsStats.getCell("C6").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  // KPI 2: MANDADAS
  wsStats.mergeCells("D3:E3");
  const kpi2Title = wsStats.getCell("D3");
  kpi2Title.value = "📤 MANDADAS (EN FIRMA)";
  kpi2Title.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  kpi2Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } }; // Amber
  kpi2Title.alignment = { vertical: "middle", horizontal: "center" };

  wsStats.getCell("D4").value = "Cantidad:";
  wsStats.getCell("D4").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("E4").value = { formula: `COUNTIF('Órdenes de Compra'!$G$3:$G$${lastRow}, "Mandada")` };
  wsStats.getCell("E4").font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFB45309" } };
  wsStats.getCell("E4").alignment = { horizontal: "right" };

  wsStats.getCell("D5").value = "Monto Total:";
  wsStats.getCell("D5").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("E5").value = { formula: `SUMIF('Órdenes de Compra'!$G$3:$G$${lastRow}, "Mandada", 'Órdenes de Compra'!$E$3:$E$${lastRow})` };
  wsStats.getCell("E5").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF92400E" } };
  wsStats.getCell("E5").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  wsStats.getCell("D6").value = "Ticket Promedio:";
  wsStats.getCell("D6").font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  wsStats.getCell("E6").value = { formula: `IF(E4>0, E5/E4, 0)` };
  wsStats.getCell("E6").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  // KPI 3: LIBERADAS
  wsStats.mergeCells("F3:G3");
  const kpi3Title = wsStats.getCell("F3");
  kpi3Title.value = "✅ LIBERADAS (100% OK)";
  kpi3Title.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  kpi3Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } }; // Green
  kpi3Title.alignment = { vertical: "middle", horizontal: "center" };

  wsStats.getCell("F4").value = "Cantidad:";
  wsStats.getCell("F4").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("G4").value = { formula: `COUNTIF('Órdenes de Compra'!$G$3:$G$${lastRow}, "Liberada")` };
  wsStats.getCell("G4").font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FF166534" } };
  wsStats.getCell("G4").alignment = { horizontal: "right" };

  wsStats.getCell("F5").value = "Monto Total:";
  wsStats.getCell("F5").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("G5").value = { formula: `SUMIF('Órdenes de Compra'!$G$3:$G$${lastRow}, "Liberada", 'Órdenes de Compra'!$E$3:$E$${lastRow})` };
  wsStats.getCell("G5").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF14532D" } };
  wsStats.getCell("G5").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  wsStats.getCell("F6").value = "Ticket Promedio:";
  wsStats.getCell("F6").font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  wsStats.getCell("G6").value = { formula: `IF(G4>0, G5/G4, 0)` };
  wsStats.getCell("G6").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  // KPI 4: TOTAL OPERATIVO
  wsStats.mergeCells("H3:I3");
  const kpi4Title = wsStats.getCell("H3");
  kpi4Title.value = "📊 TOTAL OPERATIVO";
  kpi4Title.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  kpi4Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  kpi4Title.alignment = { vertical: "middle", horizontal: "center" };

  wsStats.getCell("H4").value = "Cantidad:";
  wsStats.getCell("H4").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("I4").value = { formula: `C4+E4+G4` };
  wsStats.getCell("I4").font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FF0F172A" } };
  wsStats.getCell("I4").alignment = { horizontal: "right" };

  wsStats.getCell("H5").value = "Monto Total:";
  wsStats.getCell("H5").font = { name: "Segoe UI", size: 9, bold: true };
  wsStats.getCell("I5").value = { formula: `C5+E5+G5` };
  wsStats.getCell("I5").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  wsStats.getCell("I5").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  wsStats.getCell("H6").value = "Ticket Promedio:";
  wsStats.getCell("H6").font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  wsStats.getCell("I6").value = { formula: `IF(I4>0, I5/I4, 0)` };
  wsStats.getCell("I6").numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';

  // Bordes en las tarjetas KPI
  for (let r = 3; r <= 6; r++) {
    for (let c = 2; c <= 9; c++) {
      const cell = wsStats.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };
    }
  }

  // Tabla comparativa por Empresa (Hoyts vs CMK)
  const row8 = wsStats.getRow(8);
  row8.height = 26;
  const headersComp = [
    "",
    "Empresa",
    "Pendientes (Cant)",
    "Pendientes ($)",
    "Mandadas (Cant)",
    "Mandadas ($)",
    "Liberadas (Cant)",
    "Liberadas ($)",
    "Total General ($)",
  ];
  headersComp.forEach((h, i) => {
    if (i === 0) return;
    const c = row8.getCell(i);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });

  const empresasStats = ["Hoyts", "CMK"];
  empresasStats.forEach((emp, i) => {
    const r = i + 9;
    const fPendCant = `COUNTIFS('Órdenes de Compra'!$A$3:$A$${lastRow}, "${emp}", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "Pendiente")`;
    const fPendMonto = `SUMIFS('Órdenes de Compra'!$E$3:$E$${lastRow}, 'Órdenes de Compra'!$A$3:$A$${lastRow}, "${emp}", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "Pendiente")`;
    const fMandCant = `COUNTIFS('Órdenes de Compra'!$A$3:$A$${lastRow}, "${emp}", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "Mandada")`;
    const fMandMonto = `SUMIFS('Órdenes de Compra'!$E$3:$E$${lastRow}, 'Órdenes de Compra'!$A$3:$A$${lastRow}, "${emp}", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "Mandada")`;
    const fLibCant = `COUNTIFS('Órdenes de Compra'!$A$3:$A$${lastRow}, "${emp}", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "Liberada")`;
    const fLibMonto = `SUMIFS('Órdenes de Compra'!$E$3:$E$${lastRow}, 'Órdenes de Compra'!$A$3:$A$${lastRow}, "${emp}", 'Órdenes de Compra'!$G$3:$G$${lastRow}, "Liberada")`;
    const fTotalMonto = `C${r}+E${r}+G${r}`;

    const row = wsStats.getRow(r);
    row.height = 22;
    row.getCell(1).value = emp;
    row.getCell(1).font = { name: "Segoe UI", size: 10, bold: true };
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

    row.getCell(2).value = { formula: fPendCant };
    row.getCell(3).value = { formula: fPendMonto };
    row.getCell(4).value = { formula: fMandCant };
    row.getCell(5).value = { formula: fMandMonto };
    row.getCell(6).value = { formula: fLibCant };
    row.getCell(7).value = { formula: fLibMonto };
    row.getCell(8).value = { formula: fTotalMonto };

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
        right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      };
      if (c === 3 || c === 5 || c === 7 || c === 8) {
        cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    }
  });

  // Fila Totalizadora
  const rowTot = wsStats.getRow(11);
  rowTot.height = 24;
  rowTot.getCell(1).value = "TOTALES";
  rowTot.getCell(1).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  rowTot.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  rowTot.getCell(2).value = { formula: "B9+B10" };
  rowTot.getCell(3).value = { formula: "C9+C10" };
  rowTot.getCell(4).value = { formula: "D9+D10" };
  rowTot.getCell(5).value = { formula: "E9+E10" };
  rowTot.getCell(6).value = { formula: "F9+F10" };
  rowTot.getCell(7).value = { formula: "G9+G10" };
  rowTot.getCell(8).value = { formula: "H9+H10" };

  for (let c = 1; c <= 8; c++) {
    const cell = rowTot.getCell(c);
    cell.font = { name: "Segoe UI", size: 9.5, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      bottom: { style: "double", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
      right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
    };
    if (c === 3 || c === 5 || c === 7 || c === 8) {
      cell.numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      cell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
  }

  wsStats.columns = [
    { width: 14 }, { width: 18 }, { width: 22 }, { width: 18 },
    { width: 22 }, { width: 18 }, { width: 22 }, { width: 24 }, { width: 10 },
  ];

  // -------------------------------------------------------------------------
  // HOJA 7: Guía y Macros (VBA)
  // -------------------------------------------------------------------------
  const wsGuia = wb.addWorksheet("Guía y Macros", {
    views: [{ showGridLines: true }],
  });

  wsGuia.mergeCells("A1:B1");
  const bannerG = wsGuia.getCell("A1");
  bannerG.value = "GUÍA DE USO Y MACROS AUTOMÁTICAS PARA EXCEL";
  bannerG.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerG.alignment = { vertical: "middle", horizontal: "center" };
  wsGuia.getRow(1).height = 32;

  const lineasGuia = [
    "",
    "1. CÓMO ACTIVAR LAS MACROS DE 1 CLIC EN EXCEL (PASO A PASO):",
    "Para que todos los botones funcionen en tu Excel exactamente como en la página web:",
    "1) En Excel presioná las teclas: ALT + F11 (se abre el editor de Microsoft Visual Basic).",
    "2) Andá al menú superior: Insertar -> Módulo.",
    "3) Copiá y pegá TODO el código que figura abajo en esa ventana en blanco.",
    "4) Cerrá la ventana de Visual Basic.",
    "5) Andá a Archivo -> Guardar como -> Elegí 'Libro de Excel habilitado para macros (*.xlsm)'.",
    "6) ¡Listo! Podés asignar cada macro haciendo clic derecho en cada botón -> 'Asignar macro'.",
    "",
    "2. QUÉ HACE CADA BOTÓN Y MACRO:",
    "• Botón [➕ NUEVA ORDEN DE COMPRA] (Hoja Órdenes de Compra):",
    "  Inserta una orden en la primera fila, con estado 'Pendiente' y ordenada automáticamente por N° OC.",
    "• Botón [📨 REGISTRAR ENVÍO A FIRMAR] (Hoja Enviados a Firmar):",
    "  Pasa las órdenes pegadas a estado 'Mandada' y registra a qué firmante fueron enviadas.",
    "• Botón [⚡ PROCESAR ENVIADAS A TOMÁS] (Hoja Enviados a Tomas):",
    "  Aplica la Firma 1 de Tomás automática si el monto es < $5.500.000 y la deja esperando 2da firma.",
    "• Botón [⚡ FIRMAR ÓRDENES DETECTADAS] (Hoja Pegado Masivo):",
    "  Registra la firma del firmante seleccionado y, al completar sus 2 firmas, la pasa a 'Liberada'.",
    "",
    "---------------------------------------------------------------------------------------------",
    "CÓDIGO COMPLETO DE VISUAL BASIC (VBA) - COPIAR DESDE AQUÍ:",
    "---------------------------------------------------------------------------------------------",
    "",
    "Sub NuevaOrdenCompra()",
    "    Dim wsOC As Worksheet",
    "    Dim resp As VbMsgBoxResult",
    "    Dim empresa As String, sol As String, oc As String, prov As String, montoStr As String",
    "    Dim motivo As String, pago As String, lastRow As Long",
    "    Dim maxOC As Long, nextOC As String",
    "    ",
    "    ' Identificar la hoja sin importar si tiene tilde o no",
    "    On Error Resume Next",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ThisWorkbook.Sheets(\"Ordenes de Compra\")",
    "    If wsOC Is Nothing Then Set wsOC = ActiveSheet",
    "    On Error GoTo 0",
    "    ",
    "    ' 1. Seleccionar Empresa: Solo dos opciones con botones (Hoyts o CMK)",
    "    resp = MsgBox(\"Seleccioná la Empresa para la nueva orden:\" & vbCrLf & vbCrLf & _",
    "                  \"• Clic en [SÍ] para HOYTS\" & vbCrLf & _",
    "                  \"• Clic en [NO] para CMK\", vbYesNoCancel + vbQuestion, \"Seleccionar Empresa\")",
    "    If resp = vbYes Then",
    "        empresa = \"Hoyts\"",
    "    ElseIf resp = vbNo Then",
    "        empresa = \"CMK\"",
    "    Else",
    "        Exit Sub",
    "    End If",
    "    ",
    "    ' 2. Calcular número correlativo sugerido (+1 respecto a la última OC)",
    "    maxOC = Val(wsOC.Cells(3, 3).Value)",
    "    If maxOC > 0 Then",
    "        nextOC = CStr(maxOC + 1)",
    "    Else",
    "        nextOC = \"\"",
    "    End If",
    "    ",
    "    ' 3. Pedir N° OC autocompletado (+1) pero modificable",
    "    oc = InputBox(\"Número de OC:\" & vbCrLf & \"(Autocompletado con el siguiente número, podés modificarlo):\", \"Número de OC\", nextOC)",
    "    If Trim(oc) = \"\" Then Exit Sub",
    "    ",
    "    ' 4. Datos adicionales de la orden",
    "    sol = InputBox(\"Número de Solicitud (opcional):\", \"Nueva Orden\", \"-\")",
    "    prov = InputBox(\"Proveedor / Razón Social:\", \"Nueva Orden\")",
    "    montoStr = InputBox(\"Monto en pesos ($):\", \"Nueva Orden\", \"0\")",
    "    pago = InputBox(\"Forma de Pago:\", \"Nueva Orden\", \"30DFF\")",
    "    If Trim(pago) = \"\" Then pago = \"30DFF\"",
    "    motivo = InputBox(\"Detalle / Motivo:\", \"Nueva Orden\", \"Insumos\")",
    "    ",
    "    ' 5. Insertar fila en la posición 3 (la primera fila de datos)",
    "    wsOC.Rows(3).Insert Shift:=xlDown, CopyOrigin:=xlFormatFromRightOrBelow",
    "    ",
    "    ' 6. Asignar valores (siempre se crea en estado Pendiente)",
    "    wsOC.Cells(3, 1).Value = empresa",
    "    wsOC.Cells(3, 2).Value = sol",
    "    wsOC.Cells(3, 3).Value = oc",
    "    wsOC.Cells(3, 4).Value = prov",
    "    wsOC.Cells(3, 5).Value = Val(Replace(Replace(montoStr, \".\", \"\"), \",\", \".\"))",
    "    wsOC.Cells(3, 5).NumberFormat = \"\"\"$\"\"#,##0.00;(\"\"$\"\"#,##0.00);\"\"-\"\"\"",
    "    wsOC.Cells(3, 6).Value = pago",
    "    wsOC.Cells(3, 7).Value = \"Pendiente\" ' Siempre en Pendiente",
    "    wsOC.Cells(3, 8).Value = \"\"          ' Firmante 1",
    "    wsOC.Cells(3, 9).Value = \"No\"        ' Firmado 1",
    "    wsOC.Cells(3, 10).Value = \"\"         ' Firmante 2",
    "    wsOC.Cells(3, 11).Value = \"No\"       ' Firmado 2",
    "    wsOC.Cells(3, 12).Value = \"No\"       ' Entregada",
    "    wsOC.Cells(3, 13).Value = motivo",
    "    wsOC.Cells(3, 14).Value = \"\"",
    "    wsOC.Cells(3, 15).Value = Application.UserName",
    "    wsOC.Cells(3, 16).Value = \"\"",
    "    wsOC.Cells(3, 17).Value = Format(Date, \"dd/mm/yyyy\")",
    "    ",
    "    ' 7. Copiar fórmulas de Formato Copiar y CMD (Método R1C1 relativo sin errores)",
    "    On Error Resume Next",
    "    wsOC.Cells(3, 18).FormulaR1C1 = wsOC.Cells(4, 18).FormulaR1C1",
    "    wsOC.Cells(3, 19).FormulaR1C1 = wsOC.Cells(4, 19).FormulaR1C1",
    "    On Error GoTo 0",
    "    ",
    "    ' 8. Reordenar toda la tabla por N° OC descendente (Método clásico directo)",
    "    On Error Resume Next",
    "    lastRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    If lastRow >= 3 Then",
    "        wsOC.Range(\"A2:S\" & lastRow).Sort Key1:=wsOC.Range(\"C2\"), Order1:=xlDescending, Header:=xlYes",
    "    End If",
    "    On Error GoTo 0",
    "    ",
    "    MsgBox \"¡Orden de Compra OC \" & oc & \" (\" & empresa & \") creada con éxito en estado Pendiente!\", vbInformation, \"Orden Creada\"",
    "End Sub",
    "",
    "Sub AplicarFirmasDesdePegadoMasivo()",
    "    Dim wsBatch As Worksheet, wsOC As Worksheet",
    "    Dim firmante As String, ocNum As String, rol As String, accion As String",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant",
    "    Dim cantFirmadas As Long, cantLiberadas As Long",
    "    ",
    "    Set wsBatch = ThisWorkbook.Sheets(\"Pegado Masivo (Batch)\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    firmante = Trim(wsBatch.Range(\"B2\").Value)",
    "    If firmante = \"\" Then MsgBox \"Selecciona un firmante en B2.\", vbExclamation: Exit Sub",
    "    ",
    "    lastBatchRow = wsBatch.Cells(wsBatch.Rows.Count, \"B\").End(xlUp).Row",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    cantFirmadas = 0: cantLiberadas = 0",
    "    ",
    "    For r = 5 To lastBatchRow",
    "        ocNum = Trim(wsBatch.Cells(r, 2).Value)",
    "        rol = Trim(wsBatch.Cells(r, 11).Value)",
    "        accion = Trim(wsBatch.Cells(r, 12).Value)",
    "        ",
    "        If ocNum <> \"\" And (rol = \"Firma 1\" Or rol = \"Firma 2\") Then",
    "            rowOC = Application.Match(ocNum, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If Not IsError(rowOC) Then",
    "                If rol = \"Firma 1\" Then",
    "                    wsOC.Cells(rowOC, 8).Value = firmante",
    "                    wsOC.Cells(rowOC, 9).Value = \"Sí\"",
    "                ElseIf rol = \"Firma 2\" Then",
    "                    wsOC.Cells(rowOC, 10).Value = firmante",
    "                    wsOC.Cells(rowOC, 11).Value = \"Sí\"",
    "                End If",
    "                cantFirmadas = cantFirmadas + 1",
    "                ",
    "                ' Si ya tiene ambas firmas o queda 100% liberada",
    "                If InStr(1, accion, \"100% LIBERADA\", vbTextCompare) > 0 Or (wsOC.Cells(rowOC, 9).Value = \"Sí\" And wsOC.Cells(rowOC, 11).Value = \"Sí\") Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Liberada\"",
    "                    cantLiberadas = cantLiberadas + 1",
    "                End If",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    MsgBox \"¡Firmas aplicadas!\" & vbCrLf & \"• Firmadas por \" & firmante & \": \" & cantFirmadas & vbCrLf & \"• Quedaron 100% Liberadas: \" & cantLiberadas, vbInformation, \"Éxito\"",
    "End Sub",
    "",
    "Sub ProcesarEnviadosAFirmar()",
    "    Dim wsEnv As Worksheet, wsOC As Worksheet",
    "    Dim firmante As String, ocNum As String",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant, cant As Long",
    "    ",
    "    Set wsEnv = ThisWorkbook.Sheets(\"Enviados a Firmar\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    firmante = Trim(wsEnv.Range(\"B2\").Value)",
    "    If firmante = \"\" Then MsgBox \"Selecciona un firmante en B2.\", vbExclamation: Exit Sub",
    "    ",
    "    lastBatchRow = wsEnv.Cells(wsEnv.Rows.Count, \"B\").End(xlUp).Row",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    cant = 0",
    "    ",
    "    For r = 5 To lastBatchRow",
    "        ocNum = Trim(wsEnv.Cells(r, 2).Value)",
    "        If ocNum <> \"\" Then",
    "            rowOC = Application.Match(ocNum, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If Not IsError(rowOC) Then",
    "                If wsOC.Cells(rowOC, 7).Value <> \"Liberada\" Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Mandada\"",
    "                    cant = cant + 1",
    "                End If",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    MsgBox \"¡Órdenes registradas como Enviadas a Firmar a \" & firmante & \"! Total: \" & cant, vbInformation, \"Enviadas Registradas\"",
    "End Sub",
    "",
    "Sub ProcesarEnviadosATomas()",
    "    Dim wsTom As Worksheet, wsOC As Worksheet",
    "    Dim ocNum As String, monto As Double",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant",
    "    Dim cantTotal As Long, cantAutoFirma As Long",
    "    ",
    "    Set wsTom = ThisWorkbook.Sheets(\"Enviados a Tomas\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    lastBatchRow = wsTom.Cells(wsTom.Rows.Count, \"B\").End(xlUp).Row",
    "    lastOCRow = wsOC.Cells(wsOC.Rows.Count, \"C\").End(xlUp).Row",
    "    cantTotal = 0: cantAutoFirma = 0",
    "    ",
    "    For r = 5 To lastBatchRow",
    "        ocNum = Trim(wsTom.Cells(r, 2).Value)",
    "        If ocNum <> \"\" Then",
    "            rowOC = Application.Match(ocNum, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If Not IsError(rowOC) Then",
    "                monto = Val(wsOC.Cells(rowOC, 5).Value)",
    "                If wsOC.Cells(rowOC, 7).Value <> \"Liberada\" Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Mandada\"",
    "                End If",
    "                ' Regla menor a 5.500.000: Firma 1 de Tomás es automática",
    "                If monto < 5500000 Then",
    "                    wsOC.Cells(rowOC, 8).Value = \"Tomas\"",
    "                    wsOC.Cells(rowOC, 9).Value = \"Sí\"",
    "                    cantAutoFirma = cantAutoFirma + 1",
    "                End If",
    "                cantTotal = cantTotal + 1",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    MsgBox \"¡Enviadas a Tomás procesadas!\" & vbCrLf & _",
    "           \"• Total pasadas a Mandadas: \" & cantTotal & vbCrLf & _",
    "           \"• Con Firma 1 de Tomás automática (< $5.5M): \" & cantAutoFirma & vbCrLf & _",
    "           \"• Esperando 1ra firma (>= $5.5M): \" & (cantTotal - cantAutoFirma), vbInformation, \"Tomas Procesado\"",
    "End Sub",
  ];

  lineasGuia.forEach((line) => {
    const r = wsGuia.addRow([line]);
    r.height = 18;
    const c = r.getCell(1);
    c.font = { name: "Segoe UI", size: 9.5 };
    if (line.startsWith("Sub ") || line.startsWith("    ") || line.startsWith("End Sub")) {
      c.font = { name: "Consolas", size: 9, color: { argb: "FF1E293B" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    } else if (line.startsWith("1.") || line.startsWith("2.") || line.startsWith("•") || line.startsWith("---")) {
      c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
    }
  });

  wsGuia.columns = [{ width: 110 }];

  // -------------------------------------------------------------------------
  // Descarga del archivo en el navegador
  // -------------------------------------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fechaHoy = new Date().toISOString().split("T")[0];
  const filename = `Ordenes_Compra_Control_Final_${fechaHoy}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
