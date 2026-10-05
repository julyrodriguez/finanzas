import ExcelJS from "exceljs";
import { OrdenCompra } from "@/types/ordenes";
import { parseMontoToNumber } from "@/lib/approvalConfig";
import { getTimestampSeconds } from "@/lib/serverSync";

/**
 * Genera y descarga el archivo Excel Maestro definitivo ("Excel Final").
 * Diseñado con estética profesional (colores corporativos, bordes, tipografía limpia, estados con badges).
 * Incluye:
 * 1. Hoja "Órdenes de Compra": Base de datos completa con fórmulas vivas de copia y comando CMD.
 * 2. Hoja "Resumen Firmantes": Tabla viva con contadores y montos de OCs pendientes por firmante.
 * 3. Hoja "Pegado Masivo (Batch)": Panel inteligente donde pegás el mail/chat, selecciona al firmante en un dropdown,
 *    detecta si es Firma 1 o Firma 2 según el monto, ignora filas de basura y prepara la liberación.
 * 4. Hoja "Guía y Macros": Instrucciones paso a paso y código VBA para el botón de 1 clic para firmar y liberar.
 */
export async function exportFinalExcel(ordenes: OrdenCompra[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Finanzas";
  wb.created = new Date();

  const totalOrders = ordenes.length;
  const lastRow = Math.max(totalOrders + 1, 2);

  // Paleta de colores corporativa
  const COLOR_HEADER_BG = "0F172A"; // Slate 900
  const COLOR_HEADER_TXT = "FFFFFF";
  const COLOR_ACCENT_BG = "065F46"; // Emerald 800
  const COLOR_ZEBRA = "F8FAFC"; // Slate 50
  const COLOR_BORDER = "E2E8F0"; // Slate 200

  // -------------------------------------------------------------------------
  // HOJA 1: Órdenes de Compra
  // -------------------------------------------------------------------------
  const wsOrdenes = wb.addWorksheet("Órdenes de Compra", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

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

  wsOrdenes.columns = columnsOrdenes;

  // Estilo fila de cabecera
  const headerRow1 = wsOrdenes.getRow(1);
  headerRow1.height = 30;
  headerRow1.eachCell((cell, colNumber) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF" + COLOR_HEADER_TXT } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    // Columnas especiales 18 y 19 con fondo verde esmeralda
    if (colNumber >= 18) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_ACCENT_BG } };
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + COLOR_HEADER_BG } };
    }
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF09101D" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Filas de datos
  ordenes.forEach((o, idx) => {
    const rowNum = idx + 2;

    let estadoStr = "Pendiente";
    if (o.cancelada) estadoStr = "Cancelada";
    else if (o.entregada) estadoStr = "Entregada";
    else if (o.liberada) estadoStr = "Liberada";
    else if (o.mandada) estadoStr = "Mandada";

    let fechaStr = "";
    const sec = getTimestampSeconds(o.createdAt || o.fechaOC);
    if (sec > 0) {
      fechaStr = new Date(sec * 1000).toLocaleDateString("es-AR");
    }

    const numMonto = parseMontoToNumber(o.monto);

    const formulaCopiar = `IF(G${rowNum}="Liberada", "OC 0" & C${rowNum} & " - " & D${rowNum}, "OC " & C${rowNum} & " " & A${rowNum} & CHAR(10) & "Proveedor: " & D${rowNum} & CHAR(10) & "Monto: " & TEXT(E${rowNum}, "$ #,##0") & CHAR(10) & "Detalle: " & M${rowNum} & CHAR(10) & "Forma de Pago: " & F${rowNum})`;
    const formulaCMD = `"mkdir ""OC " & C${rowNum} & " " & A${rowNum} & " " & SUBSTITUTE(D${rowNum}, """", "") & """"`;

    const row = wsOrdenes.addRow({
      empresa: o.empresa || "Hoyts",
      solicitud: o.numSolicitud || "-",
      numOC: o.numOC || "",
      razonSocial: o.razonSocial || "",
      monto: numMonto,
      formaPago: o.formaPago || "30DFF",
      estado: estadoStr,
      firmante1: o.firmante1 || "",
      firmado1: o.firmado1 ? "Sí" : "No",
      firmante2: o.firmante2 || "",
      firmado2: o.firmado2 ? "Sí" : "No",
      entregada: o.entregada ? "Sí" : "No",
      motivo: o.motivo || "",
      relatedOC: o.relatedOC || "",
      creadoPor: o.creadoPor || "",
      linkSharepoint: o.linkSharepoint || "",
      fechaCreacion: fechaStr,
      formatoCopiar: { formula: formulaCopiar },
      cmdCarpetas: { formula: formulaCMD },
    });

    row.height = 22;

    // Estilos por celda
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

      // Fondo base zebra
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgRowColor } };

      // Alineaciones
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
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF166534" } };
        } else if (estadoStr === "Mandada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF92400E" } };
        } else if (estadoStr === "Entregada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF1E40AF" } };
        } else if (estadoStr === "Cancelada") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF991B1B" } };
        }
      }
    });
  });

  // Habilitar autofiltro en la tabla
  wsOrdenes.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: 19 },
  };

  // -------------------------------------------------------------------------
  // HOJA 2: Resumen Firmantes
  // -------------------------------------------------------------------------
  const wsFirmantes = wb.addWorksheet("Resumen Firmantes", {
    views: [{ showGridLines: true }],
  });

  // Banner título
  wsFirmantes.mergeCells("A1:G1");
  const bannerF = wsFirmantes.getCell("A1");
  bannerF.value = "RESUMEN Y SEGUIMIENTO DE FIRMANTES (NIVELES DE AUTORIZACIÓN)";
  bannerF.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerF.alignment = { vertical: "middle", horizontal: "center" };
  wsFirmantes.getRow(1).height = 32;

  // Cabecera de la tabla
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
    const f1Count = `COUNTIFS('Órdenes de Compra'!$H$2:$H$${lastRow}, A${r}, 'Órdenes de Compra'!$I$2:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada")`;
    const f2Count = `COUNTIFS('Órdenes de Compra'!$J$2:$J$${lastRow}, A${r}, 'Órdenes de Compra'!$K$2:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada")`;
    const totalCount = `C${r}+D${r}`;
    const montoSum = `SUMIFS('Órdenes de Compra'!$E$2:$E$${lastRow}, 'Órdenes de Compra'!$H$2:$H$${lastRow}, A${r}, 'Órdenes de Compra'!$I$2:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada") + SUMIFS('Órdenes de Compra'!$E$2:$E$${lastRow}, 'Órdenes de Compra'!$J$2:$J$${lastRow}, A${r}, 'Órdenes de Compra'!$K$2:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada")`;
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
    { width: 22 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 24 },
    { width: 50 },
  ];

  // -------------------------------------------------------------------------
  // HOJA 3: Pegado Masivo (Batch) - Rediseñada profesionalmente
  // -------------------------------------------------------------------------
  const wsBatch = wb.addWorksheet("Pegado Masivo (Batch)", {
    views: [{ showGridLines: true }],
  });

  // Título
  wsBatch.mergeCells("A1:M1");
  const bannerB = wsBatch.getCell("A1");
  bannerB.value = "PROCESO DE LIBERACIÓN Y FIRMAS POR LOTE";
  bannerB.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  bannerB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  bannerB.alignment = { vertical: "middle", horizontal: "center" };
  wsBatch.getRow(1).height = 32;

  // Panel interactivo de Selección de Firmante
  const row2 = wsBatch.getRow(2);
  row2.height = 30;

  const lblFirmante = row2.getCell(1);
  lblFirmante.value = "Firmante Seleccionado:";
  lblFirmante.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  lblFirmante.alignment = { vertical: "middle", horizontal: "right" };

  const cellFirmante = row2.getCell(2);
  cellFirmante.value = "Tomas";
  cellFirmante.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF854D0E" } };
  cellFirmante.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
  cellFirmante.border = {
    top: { style: "medium", color: { argb: "FFEAB308" } },
    bottom: { style: "medium", color: { argb: "FFEAB308" } },
    left: { style: "medium", color: { argb: "FFEAB308" } },
    right: { style: "medium", color: { argb: "FFEAB308" } },
  };
  cellFirmante.alignment = { vertical: "middle", horizontal: "center" };
  cellFirmante.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"Tomas,Victoria,Tristan,Pablo Gonzalez,Jorgelina,Pablo Mondelo,Dario,Matias,Hernan,Martin"'],
  };

  const hintFirmante = row2.getCell(3);
  hintFirmante.value = "← Hacé clic y cambiá el firmante desde la lista desplegable";
  hintFirmante.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF64748B" } };
  hintFirmante.alignment = { vertical: "middle", horizontal: "left" };

  // Botón Macro interactivo estilizado
  wsBatch.mergeCells("E2:G2");
  const btnMacro = wsBatch.getCell("E2");
  btnMacro.value = "⚡ BOTÓN: FIRMAR ÓRDENES DETECTADAS";
  btnMacro.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  btnMacro.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  btnMacro.alignment = { vertical: "middle", horizontal: "center" };
  btnMacro.border = {
    top: { style: "thin", color: { argb: "FF14532D" } },
    bottom: { style: "thin", color: { argb: "FF14532D" } },
    left: { style: "thin", color: { argb: "FF14532D" } },
    right: { style: "thin", color: { argb: "FF14532D" } },
  };

  // Instrucción rápida
  wsBatch.mergeCells("A3:M3");
  const row3 = wsBatch.getCell("A3");
  row3.value = "Pegá el texto de tu mail o chat en la Columna A (ej: 'Oc 13052 HOYTS'). La fórmula extrae SOLO el número a un espacio de 'OC ' e ignora renglones de proveedor o monto. Tip: Aplicá el filtro en la columna B '(No vacías)' para compactar la vista al instante.";
  row3.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF475569" } };
  row3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  row3.alignment = { vertical: "middle", horizontal: "left" };
  wsBatch.getRow(3).height = 24;

  // Cabeceras de la tabla
  const headerBRow = wsBatch.getRow(4);
  headerBRow.height = 28;
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

  headersBatch.forEach((h, i) => {
    const c = headerBRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    if (i === 1 || i === 10 || i === 11) {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } }; // Verde esmeralda para columnas clave
    } else {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    }
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = {
      bottom: { style: "medium", color: { argb: "FF09101D" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // 120 filas preparadas con fórmulas inteligentes
  for (let r = 5; r <= 124; r++) {
    // 1. Extrae únicamente el número que está a un espacio de 'OC ' o 'Oc ' o 'oc '.
    // Si la fila no contiene "OC ", retorna "" (cadena vacía) para no ensuciar la tabla ni ocupar filas basura!
    const fNum = `IF(ISNUMBER(SEARCH("OC ", A${r})), TRIM(MID(SUBSTITUTE(TRIM(MID(A${r}, SEARCH("OC ", A${r}) + 3, 30)), " ", REPT(" ", 30)), 1, 30)), "")`;

    // 2. ¿Existe en la base?
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"SÍ","NO"))`;

    // 3. Trae Empresa, Proveedor, Monto, Estado, Firma 1, Firma 2
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$2:$A$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$2:$D$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$2:$E$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$2:$G$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"")`;
    const fF1 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$I$2:$I$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"")`;
    const fF2 = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$K$2:$K$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"")`;

    // 4. Nivel de Monto según reglas de aprobación
    const fNivel = `IF(F${r}="","",IF(F${r}<=5000000,"Nivel 1 (<= 5M)",IF(F${r}<=18000000,"Nivel 2 (5M a 18M)",IF(F${r}<=150000000,"Nivel 3 (18M a 150M)","Nivel 4 (> 150M)"))))`;

    // 5. Detecta si el firmante seleccionado en $B$2 actúa como Firma 1 o Firma 2 para ese monto
    const fRol = `IF(OR(B${r}="",$B$2=""),"",IF(F${r}<=5000000,IF($B$2="Tomas","Firma 1",IF(OR($B$2="Victoria",$B$2="Tristan",$B$2="Pablo Gonzalez",$B$2="Jorgelina"),"Firma 2","No corresponde")),IF(F${r}<=18000000,IF($B$2="Pablo Mondelo","Firma 1",IF($B$2="Dario","Firma 2","No corresponde")),IF(F${r}<=150000000,IF(OR($B$2="Matias",$B$2="Hernan"),"Firma 1",IF($B$2="Dario","Firma 2","No corresponde")),IF(OR($B$2="Dario",$B$2="Hernan"),"Firma 1",IF($B$2="Martin","Firma 2","No corresponde"))))))`;

    // 6. Diagnóstico y Acción (detecta si ya tiene firma 1, si al firmar queda 100% liberada o pendiente)
    const fAccion = `IF(B${r}="","",IF(G${r}="Liberada","Ya está 100% Liberada",IF(K${r}="No corresponde","Firmante no habilitado para este monto",IF(K${r}="Firma 1",IF(H${r}="Sí","Ya tiene Firma 1",IF(I${r}="Sí","Aplica Firma 1 -> ¡100% LIBERADA!","Aplica Firma 1 (Pendiente F2)")),IF(K${r}="Firma 2",IF(I${r}="Sí","Ya tiene Firma 2",IF(H${r}="Sí","Aplica Firma 2 -> ¡100% LIBERADA!","Aplica Firma 2 (Pendiente F1)")),"")))))`;

    // 7. Texto para copiar de respuesta
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
    { width: 34 }, // Texto Pegado
    { width: 16 }, // N° OC
    { width: 15 }, // Existe
    { width: 12 }, // Empresa
    { width: 30 }, // Proveedor
    { width: 16 }, // Monto
    { width: 14 }, // Estado
    { width: 14 }, // Firma 1
    { width: 14 }, // Firma 2
    { width: 20 }, // Nivel
    { width: 22 }, // Rol Firmante
    { width: 32 }, // Acción
    { width: 42 }, // Texto Respuesta
  ];

  // Autofiltro para que el usuario pueda filtrar Col B "(No vacías)" con 1 clic
  wsBatch.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 124, column: 13 },
  };

  // -------------------------------------------------------------------------
  // HOJA 4: Guía y Macros (VBA)
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
    "1. CÓMO USAR EL PEGADO MASIVO (BATCH) SIN MACROS:",
    "• En la hoja 'Pegado Masivo (Batch)', seleccioná en la celda B2 el Firmante que te mandó el mail o autorización.",
    "• Pegá en la Columna A (a partir de la fila 5) el texto copiado de tu correo o chat.",
    "• Las fórmulas reconocen ÚNICAMENTE el número que está a un espacio de 'OC ' (ej: de 'Oc 13052 HOYTS' rescata '13052').",
    "• Todas las demás líneas (Proveedor, Monto, Detalle, etc.) quedan automáticamente en blanco.",
    "• TIP PARA NO OCUPAR FILAS: En la celda B4 (N° OC Detectado), hacé clic en la flechita del filtro y desmarcá '(Vacías)'. La tabla se compacta mostrando solo las órdenes reales.",
    "• En la columna K vas a ver si a ese firmante le correspondía Primera Firma o Segunda Firma según el monto.",
    "• En la columna L te dirá si queda como Firma 1, si falta Firma 2, o si queda '¡100% LIBERADA!'.",
    "",
    "2. CÓMO ACTIVAR EL BOTÓN PARA PONER LA FIRMA AUTOMÁTICAMENTE (MACRO VBA):",
    "Para que al hacer clic en un botón aplique las firmas en la hoja 'Órdenes de Compra' igual que en la web:",
    "1) En Excel presioná las teclas: ALT + F11 (se abre el editor de Visual Basic).",
    "2) Andá al menú superior: Insertar -> Módulo.",
    "3) Pegá el código que figura abajo y cerrá la ventana de Visual Basic.",
    "4) Guardá el archivo como 'Libro de Excel habilitado para macros (*.xlsm)'.",
    "5) En la hoja 'Pegado Masivo', hacé clic derecho en el botón verde -> Asignar macro -> Elegí 'AplicarFirmasDesdePegadoMasivo' -> Aceptar.",
    "",
    "--- CÓDIGO VBA PARA COPIAR Y PEGAR EN EL MÓDULO ---",
    "",
    "Sub AplicarFirmasDesdePegadoMasivo()",
    "    Dim wsBatch As Worksheet, wsOC As Worksheet",
    "    Dim firmante As String, ocNum As String, rol As String, accion As String",
    "    Dim r As Long, lastBatchRow As Long, lastOCRow As Long, rowOC As Variant",
    "    Dim cantFirmadas As Long, cantLiberadas As Long",
    "    ",
    "    Set wsBatch = ThisWorkbook.Sheets(\"Pegado Masivo (Batch)\")",
    "    Set wsOC = ThisWorkbook.Sheets(\"Órdenes de Compra\")",
    "    ",
    "    firmante = Trim(wsBatch.Range(\"B2\").Value)",
    "    If firmante = \"\" Then",
    "        MsgBox \"Por favor selecciona un firmante en la celda B2.\", vbExclamation, \"Atención\"",
    "        Exit Sub",
    "    End If",
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
    "            ' Buscar la fila de la OC en la hoja principal",
    "            rowOC = Application.Match(ocNum, wsOC.Range(\"C1:C\" & lastOCRow), 0)",
    "            If Not IsError(rowOC) Then",
    "                If rol = \"Firma 1\" Then",
    "                    wsOC.Cells(rowOC, 8).Value = firmante ' Col H: Firmante 1",
    "                    wsOC.Cells(rowOC, 9).Value = \"Sí\"    ' Col I: Firmado 1",
    "                ElseIf rol = \"Firma 2\" Then",
    "                    wsOC.Cells(rowOC, 10).Value = firmante ' Col J: Firmante 2",
    "                    wsOC.Cells(rowOC, 11).Value = \"Sí\"     ' Col K: Firmado 2",
    "                End If",
    "                cantFirmadas = cantFirmadas + 1",
    "                ",
    "                ' Verificar si ya tiene ambas firmas o queda 100% liberada",
    "                If InStr(1, accion, \"100% LIBERADA\", vbTextCompare) > 0 Or (wsOC.Cells(rowOC, 9).Value = \"Sí\" And wsOC.Cells(rowOC, 11).Value = \"Sí\") Then",
    "                    wsOC.Cells(rowOC, 7).Value = \"Liberada\" ' Col G: Estado",
    "                    cantLiberadas = cantLiberadas + 1",
    "                End If",
    "            End If",
    "        End If",
    "    Next r",
    "    ",
    "    MsgBox \"¡Proceso completado exitosamente!\" & vbCrLf & vbCrLf & _",
    "           \"• Órdenes firmadas por \" & firmante & \": \" & cantFirmadas & vbCrLf & _",
    "           \"• Órdenes que quedaron 100% Liberadas: \" & cantLiberadas, vbInformation, \"Liberación Exitosa\"",
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
    } else if (line.startsWith("1.") || line.startsWith("2.") || line.startsWith("---")) {
      c.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
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
