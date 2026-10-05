import * as XLSX from "xlsx";
import { OrdenCompra } from "@/types/ordenes";
import { parseMontoToNumber } from "@/lib/approvalConfig";
import { getTimestampSeconds } from "@/lib/serverSync";

/**
 * Genera y descarga el archivo Excel Maestro definitivo ("Excel Final").
 * Incluye:
 * 1. Hoja "Órdenes de Compra" con todas las columnas, datos históricos y fórmulas vivas (Copiar mensaje y CMD Carpetas).
 * 2. Hoja "Resumen Firmantes" con contadores, montos pendientes y textos listos para enviar a cada firmante.
 * 3. Hoja "Pegado Masivo (Batch)" para pegar correos/chats y cruzar automáticamente OCs aprobadas sin macros.
 * 4. Hoja "Instrucciones y Macros" con guía de uso y código VBA de 1 clic para portapapeles y creación de carpetas.
 */
export function exportFinalExcel(ordenes: OrdenCompra[]) {
  const wb = XLSX.utils.book_new();
  const totalOrders = ordenes.length;
  const lastRow = Math.max(totalOrders + 1, 2);

  // -------------------------------------------------------------------------
  // HOJA 1: Órdenes de Compra
  // -------------------------------------------------------------------------
  const headersOrdenes = [
    "Empresa",
    "N° Solicitud",
    "N° OC",
    "Proveedor / Razón Social",
    "Monto ($)",
    "Forma de Pago",
    "Estado",
    "Firmante 1",
    "Firmado 1",
    "Firmante 2",
    "Firmado 2",
    "Entregada",
    "Detalle / Motivo",
    "OC Relacionada",
    "Creado Por",
    "Link SharePoint / OneDrive",
    "Fecha Creación",
    "Formato Copiar (Fórmula)",
    "CMD Crear Carpetas (Fórmula)"
  ];

  const rowsOrdenes: any[][] = [headersOrdenes];

  ordenes.forEach((o, index) => {
    const rowNum = index + 2;

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

    // Fórmulas para cada fila
    // R{rowNum} = Formato Copiar
    // S{rowNum} = CMD Crear Carpetas
    const formulaCopiar = `IF(G${rowNum}="Liberada", "OC 0" & C${rowNum} & " - " & D${rowNum}, "OC " & C${rowNum} & " " & A${rowNum} & CHAR(10) & "Proveedor: " & D${rowNum} & CHAR(10) & "Monto: " & TEXT(E${rowNum}, "$ #,##0") & CHAR(10) & "Detalle: " & M${rowNum} & CHAR(10) & "Forma de Pago: " & F${rowNum})`;
    const formulaCMD = `"mkdir ""OC " & C${rowNum} & " " & A${rowNum} & " " & SUBSTITUTE(D${rowNum}, """", "") & """"`;

    rowsOrdenes.push([
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
      { f: formulaCopiar },
      { f: formulaCMD }
    ]);
  });

  const wsOrdenes = XLSX.utils.aoa_to_sheet(rowsOrdenes);

  // Ancho de columnas optimizado
  wsOrdenes["!cols"] = [
    { wch: 11 }, // Empresa
    { wch: 13 }, // Solicitud
    { wch: 12 }, // Num OC
    { wch: 32 }, // Proveedor
    { wch: 16 }, // Monto
    { wch: 14 }, // Forma de Pago
    { wch: 13 }, // Estado
    { wch: 15 }, // Firmante 1
    { wch: 11 }, // Firmado 1
    { wch: 15 }, // Firmante 2
    { wch: 11 }, // Firmado 2
    { wch: 11 }, // Entregada
    { wch: 35 }, // Detalle
    { wch: 15 }, // Relacionada
    { wch: 14 }, // Creado Por
    { wch: 30 }, // Link
    { wch: 14 }, // Fecha
    { wch: 45 }, // Formato Copiar
    { wch: 45 }  // CMD Carpetas
  ];

  XLSX.utils.book_append_sheet(wb, wsOrdenes, "Órdenes de Compra");

  // -------------------------------------------------------------------------
  // HOJA 2: Resumen Firmantes
  // -------------------------------------------------------------------------
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

  const headersFirmantes = [
    "Firmante / Responsable",
    "Nivel de Aprobación",
    "Pendientes Firma 1",
    "Pendientes Firma 2",
    "Total OCs Pendientes",
    "Monto Total Pendiente ($)",
    "Resumen para Copiar y Mandar"
  ];

  const rowsFirmantes: any[][] = [headersFirmantes];

  firmantesList.forEach((f, idx) => {
    const row = idx + 2;
    const f1Count = `COUNTIFS('Órdenes de Compra'!$H$2:$H$${lastRow}, A${row}, 'Órdenes de Compra'!$I$2:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada")`;
    const f2Count = `COUNTIFS('Órdenes de Compra'!$J$2:$J$${lastRow}, A${row}, 'Órdenes de Compra'!$K$2:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada")`;
    const totalCount = `C${row}+D${row}`;
    const montoSum = `SUMIFS('Órdenes de Compra'!$E$2:$E$${lastRow}, 'Órdenes de Compra'!$H$2:$H$${lastRow}, A${row}, 'Órdenes de Compra'!$I$2:$I$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada") + SUMIFS('Órdenes de Compra'!$E$2:$E$${lastRow}, 'Órdenes de Compra'!$J$2:$J$${lastRow}, A${row}, 'Órdenes de Compra'!$K$2:$K$${lastRow}, "No", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Cancelada", 'Órdenes de Compra'!$G$2:$G$${lastRow}, "<>Liberada")`;
    const resumenText = `A${row} & ": " & E${row} & " órdenes pendientes por " & TEXT(F${row}, "$ #,##0")`;

    rowsFirmantes.push([
      f.name,
      f.nivel,
      { f: f1Count },
      { f: f2Count },
      { f: totalCount },
      { f: montoSum },
      { f: resumenText }
    ]);
  });

  const wsFirmantes = XLSX.utils.aoa_to_sheet(rowsFirmantes);
  wsFirmantes["!cols"] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 48 }
  ];
  XLSX.utils.book_append_sheet(wb, wsFirmantes, "Resumen Firmantes");

  // -------------------------------------------------------------------------
  // HOJA 3: Pegado Masivo (Batch)
  // -------------------------------------------------------------------------
  const rowsBatch: any[][] = [
    [
      "INSTRUCCIÓN: Pegá acá abajo las líneas del mail o chat (ej: 'OC 45892' o solo el número)",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ],
    [
      "Línea Pegada (Mail o Chat)",
      "N° OC Limpio",
      "¿Existe en Base?",
      "Empresa",
      "Proveedor",
      "Monto ($)",
      "Estado Actual",
      "Formato Copiar Liberada"
    ]
  ];

  // Generar 100 filas de fórmulas listas para usar al pegar texto
  for (let r = 3; r <= 102; r++) {
    const fNum = `IF(A${r}="","",TRIM(SUBSTITUTE(SUBSTITUTE(UPPER(A${r}),"OC",""),"SOL","")))`;
    const fExiste = `IF(B${r}="","",IF(ISNUMBER(MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"SÍ","NO"))`;
    const fEmpresa = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$A$2:$A$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"-")`;
    const fProv = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$D$2:$D$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"-")`;
    const fMonto = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$E$2:$E$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"-")`;
    const fEstado = `IF(C${r}="SÍ",INDEX('Órdenes de Compra'!$G$2:$G$${lastRow},MATCH(B${r},'Órdenes de Compra'!$C$2:$C$${lastRow},0)),"-")`;
    const fLibText = `IF(C${r}="SÍ","OC 0" & B${r} & " - " & E${r},"")`;

    rowsBatch.push([
      "",
      { f: fNum },
      { f: fExiste },
      { f: fEmpresa },
      { f: fProv },
      { f: fMonto },
      { f: fEstado },
      { f: fLibText }
    ]);
  }

  const wsBatch = XLSX.utils.aoa_to_sheet(rowsBatch);
  wsBatch["!cols"] = [
    { wch: 35 },
    { wch: 15 },
    { wch: 16 },
    { wch: 12 },
    { wch: 30 },
    { wch: 16 },
    { wch: 14 },
    { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(wb, wsBatch, "Pegado Masivo (Batch)");

  // -------------------------------------------------------------------------
  // HOJA 4: Instrucciones y Macros
  // -------------------------------------------------------------------------
  const rowsGuia: any[][] = [
    ["GUÍA DE USO Y HERRAMIENTAS DE ESTE EXCEL FINAL", ""],
    ["", ""],
    ["1. CÓMO COPIAR EL FORMATO RÁPIDO PARA MAILS O TEAMS:", ""],
    ["- En la hoja 'Órdenes de Compra', andá a la columna R ('Formato Copiar').", ""],
    ["- Seleccioná la celda de la orden que querés enviar (o varias celdas a la vez) y presioná Ctrl + C.", ""],
    ["- Pegalo en Outlook, Teams o WhatsApp y saldrá ordenado con todos los renglones automáticos.", ""],
    ["- Si la orden está en estado 'Liberada', automáticamente se formatea como 'OC 0[N°] - [Proveedor]'.", ""],
    ["", ""],
    ["2. CÓMO CREAR LAS CARPETAS EN WINDOWS:", ""],
    ["- En la columna S ('CMD Crear Carpetas'), seleccioná las órdenes que quieras crear.", ""],
    ["- Copiá las celdas (Ctrl + C).", ""],
    ["- En tu computadora abrí la terminal CMD en la carpeta donde guardás las OCs.", ""],
    ["- Pegá con clic derecho o Ctrl + V y presioná Enter. Se crearán todas las carpetas juntas al instante.", ""],
    ["", ""],
    ["3. CÓMO USAR EL PEGADO MASIVO (BATCH):", ""],
    ["- En la hoja 'Pegado Masivo (Batch)', pegá en la Columna A el texto copiado de tus mails o chats.", ""],
    ["- Las fórmulas detectan el número de OC, buscan si existe en tu base y te muestran proveedor y monto.", ""],
    ["- En la columna H tenés el texto listo de 'OC 0[N°] - [Proveedor]' para copiar y avisar.", ""],
    ["", ""],
    ["4. CÓDIGO VBA OPCIONAL (PARA ACTIVAR MACROS DE 1 CLIC EN EXCEL):", ""],
    ["Si querés botones directos en Excel, presioná ALT + F11 en Excel, menú Insertar -> Módulo, y pegá este código:", ""],
    ["", ""],
    ["Sub CopiarFormatoAlPortapapeles()", ""],
    ["    Dim celda As Range, textoFinal As String, DataObj As Object", ""],
    ["    For Each celda In Selection", ""],
    ["        If Cells(celda.Row, 18).Value <> \"\" Then", ""],
    ["            textoFinal = textoFinal & Cells(celda.Row, 18).Value & vbCrLf & vbCrLf", ""],
    ["        End If", ""],
    ["    Next celda", ""],
    ["    Set DataObj = CreateObject(\"htmlfile\")", ""],
    ["    DataObj.ParentWindow.ClipboardData.SetData \"text\", textoFinal", ""],
    ["    MsgBox \"¡Copiado al portapapeles con éxito!\", vbInformation", ""],
    ["End Sub", ""],
    ["", ""],
    ["Sub CrearCarpetasWindows()", ""],
    ["    Dim celda As Range, rutaBase As String, carpeta As String", ""],
    ["    rutaBase = InputBox(\"Ingresá la ruta base donde crear las carpetas:\", \"Ruta\", \"C:\\Ordenes\")", ""],
    ["    If rutaBase = \"\" Then Exit Sub", ""],
    ["    For Each celda In Selection", ""],
    ["        carpeta = rutaBase & \"\\OC \" & Cells(celda.Row, 3).Value & \" \" & Cells(celda.Row, 1).Value & \" \" & Cells(celda.Row, 4).Value", ""],
    ["        If Dir(carpeta, vbDirectory) = \"\" Then", ""],
    ["            MkDir carpeta", ""],
    ["        End If", ""],
    ["    Next celda", ""],
    ["    MsgBox \"¡Carpetas creadas con éxito!\", vbInformation", ""],
    ["End Sub", ""]
  ];

  const wsGuia = XLSX.utils.aoa_to_sheet(rowsGuia);
  wsGuia["!cols"] = [{ wch: 80 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsGuia, "Guía y Macros");

  // Descarga del archivo
  const fechaHoy = new Date().toISOString().split("T")[0];
  const filename = `Ordenes_Compra_Control_Final_${fechaHoy}.xlsx`;
  XLSX.writeFile(wb, filename);
}
