import { read, utils } from "xlsx";
import { parseRows, type Dataset } from "./report";

export type SheetData = { name: string; rows: unknown[][] };
export type ImportResult = {
  sheets: SheetData[];
  source: string;
  date1904: boolean;
};

export function readImport(buffer: ArrayBuffer, source: string): ImportResult {
  if (!/\.(xlsx|xls|csv)$/i.test(source))
    throw new Error("Choose an Excel (.xlsx or .xls) or CSV file.");
  if (buffer.byteLength > 20 * 1024 * 1024)
    throw new Error(
      "The file is larger than 20 MB. Export a smaller date range.",
    );
  const workbook = read(buffer, {
    type: "array",
    cellDates: false,
    raw: true,
    sheetRows: 200_002,
  });
  const sheets = workbook.SheetNames.filter(
    (name) => !workbook.Workbook?.Sheets?.find((s) => s.name === name)?.Hidden,
  )
    .map((name) => ({
      name,
      rows: utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: true,
        blankrows: false,
      }),
    }))
    .filter((s) => s.rows.length);
  if (!sheets.length)
    throw new Error("This workbook is empty. Choose a Daily Activity export.");
  return { sheets, source, date1904: !!workbook.Workbook?.WBProps?.date1904 };
}
export function parseSheet(result: ImportResult, name: string): Dataset {
  const sheet = result.sheets.find((s) => s.name === name);
  if (!sheet) throw new Error("Choose a worksheet to continue.");
  return parseRows(sheet.rows, result.source, name, result.date1904);
}
