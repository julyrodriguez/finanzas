import * as XLSX from "xlsx";

/**
 * Exports data objects to an Excel (.xlsx) file and triggers a browser download.
 * @param data Array of records/objects to export
 * @param filename File name (without extension)
 * @param sheetName Name of the sheet inside the workbook
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName: string = "Datos"
) {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}
