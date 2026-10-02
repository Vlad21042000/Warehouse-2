import ExcelJS from "exceljs";
import {
  SYSTEM_USERS,
  formatDate,
  type Dataset,
  type Report,
} from "./report";

export function createReportWorkbook(
  report: Report,
  dataset: Dataset,
  paper: "Letter" | "A4" = "Letter",
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Warehouse Reporting";
  wb.created = new Date();
  const ws = wb.addWorksheet("Activity Dashboard", {
    properties: { defaultRowHeight: 21 },
    views: [{ showGridLines: false }],
    // OOXML paper code 1 is US Letter; ExcelJS omits it from its TypeScript enum.
    pageSetup: {
      paperSize: (paper === "Letter" ? 1 : 9) as ExcelJS.PaperSize,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.75,
        bottom: 0.75,
        header: 0.2,
        footer: 0.2,
      },
    },
  });
  const navy = "163D68",
    light = "EDF3FA",
    muted = "566780";
  ws.columns = [5, 23, 9, 11, 11, 8, 9, 11, 10].map((width) => ({ width }));
  const merged = (
    range: string,
    value: string | number | ExcelJS.CellFormulaValue,
    fill?: string,
    color = navy,
    bold = false,
  ) => {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
    cell.font = { name: "Calibri", size: 11, color: { argb: color }, bold };
    cell.alignment = { vertical: "middle", wrapText: true, horizontal: typeof value === "number" ? "center" : "left" };
    if (fill)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    return cell;
  };
  merged("A1:I1", "WAREHOUSE ACTIVITY DASHBOARD", navy, "FFFFFF", true).font = {
    name: "Calibri",
    size: 19,
    bold: true,
    color: { argb: "FFFFFF" },
  };
  ws.getRow(1).height = 30;
  merged("A2:I2", `All transaction types · ${dataset.sample ? "SAMPLE DATA · " : ""}${dataset.sheet} · ${formatDate(report.date)}`, navy, "FFFFFF");
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;
  merged("A4:E4", "TEAM SUMMARY", navy, "FFFFFF", true);
  merged("F4:I4", "KEY HIGHLIGHTS", navy, "FFFFFF", true);
  const people = report.employees.filter(e => !e.isSystem);
  const start = 13, end = start + report.employees.length - 1, totalRow = end + 1;
  const summary: [string, number][] = [
    ["Staff", people.length], ["Total", report.total],
    ["PICK", report.counts.PICK], ["RECEIPT", report.counts.RECEIPT],
    ["PUT", report.counts.PUT], ["REPLN", report.counts.REPLN],
  ];
  const topActivity = (activity: "PICK" | "PUT" | "REPLN" | "RECEIPT") => {
    const top = [...people].sort((a, b) => b.counts[activity] - a.counts[activity] || a.rank - b.rank)[0];
    return top?.counts[activity] ? `${top.employee} (${top.counts[activity]})` : "—";
  };
  const highlights = [
    ["Most Total", people[0] ? `${people[0].employee} (${people[0].total})` : "—"],
    ["Most PICK", topActivity("PICK")], ["Most Receipt", topActivity("RECEIPT")],
    ["Most PUT", topActivity("PUT")], ["Most REPLN", topActivity("REPLN")],
    ["Team pick rate", `${report.rate?.toFixed(2) ?? "—"} lines/hr`],
  ];
  summary.forEach(([label, value], index) => {
    const r = 5 + index;
    merged(`A${r}:B${r}`, label, index % 2 ? light : undefined, navy, true);
    merged(`C${r}:C${r}`, value, index % 2 ? light : undefined, navy, true);
    if (index === 0) { merged(`D${r}:D${r}`, "Date"); merged(`E${r}:E${r}`, report.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")); }
    if (index === 1) { merged(`D${r}:D${r}`, "Source"); merged(`E${r}:E${r}`, "Daily Activity").font = {name: "Calibri", size: 8, color: {argb: navy}}; }
    merged(`F${r}:G${r}`, highlights[index][0]);
    merged(`H${r}:I${r}`, highlights[index][1], undefined, navy, true);
    ws.getRow(r).height = 17;
  });
  ws.getRow(4).height = 18;
  ws.getRow(11).height = 8;
  ws.getRow(12).values = ["Rank", "Employee", "PICK", "Pick Time", "L/Hr", "PUT", "REPLN", "RECEIPT", "Total"];
  ws.getRow(12).height = 20;
  ws.getRow(12).eachCell((c) => {
    c.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  // Allocate the remaining printable height to rows, including short reports.
  const availableHeight = (paper === "Letter" ? 11 : 11.69) * 72 - 108;
  const rowHeight = (availableHeight - 258) / Math.max(report.employees.length, 1);
  report.employees.forEach((e, index) => {
    const r = start + index;
    const row = ws.getRow(r);
    row.values = [
      e.isSystem ? "—" : e.rank,
      e.isSystem ? `${e.employee} (System)` : e.employee,
      e.counts.PICK,
      e.pickMinutes === null ? null : e.pickMinutes / 1440,
      {
        formula: `IF(AND(ISNUMBER(D${r}),D${r}>0),C${r}/(D${r}*24),"")`,
        result: e.rate ?? "",
      },
      e.counts.PUT,
      e.counts.REPLN,
      e.counts.RECEIPT,
      { formula: `SUM(C${r},F${r}:H${r})`, result: e.total },
    ];
    row.height = rowHeight;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = {
        name: "Calibri",
        size: Math.min(10, rowHeight * 0.7),
        bold: col === 2 || col === 9,
        color: { argb: "20334C" },
      };
      cell.alignment = {
        horizontal: col === 2 ? "left" : "center",
        vertical: "middle",
        wrapText: false,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            e.rank === 1
              ? "FFF1B8"
              : e.rank === 3
                ? "FFE0BD"
                : index % 2 === 0
                  ? "FFFFFF"
                  : "F3F6FA",
        },
      };
      cell.border = { bottom: { style: "hair", color: { argb: "DEE5EE" } } };
      cell.numFmt = col === 4 ? "[h]:mm" : col === 5 ? "0.00" : "#,##0";
    });
  });
  const total = ws.getRow(totalRow);
  total.values = [
    "",
    "TEAM TOTAL",
    { formula: `SUM(C${start}:C${end})`, result: report.counts.PICK },
    { formula: `SUM(D${start}:D${end})`, result: report.pickMinutes / 1440 },
    {
      formula: `IF(D${totalRow}>0,SUMIF(D${start}:D${end},">0",C${start}:C${end})/(D${totalRow}*24),"")`,
      result: report.rate ?? "",
    },
    { formula: `SUM(F${start}:F${end})`, result: report.counts.PUT },
    { formula: `SUM(G${start}:G${end})`, result: report.counts.REPLN },
    { formula: `SUM(H${start}:H${end})`, result: report.counts.RECEIPT },
    { formula: `SUM(I${start}:I${end})`, result: report.total },
  ];
  total.height = 20;
  total.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    cell.alignment = {
      vertical: "middle",
      horizontal: col === 2 ? "left" : "center",
    };
    cell.numFmt = col === 4 ? "[h]:mm" : col === 5 ? "0.00" : "#,##0";
  });
  ws.getRow(totalRow + 1).height = 6;
  merged(`A${totalRow + 2}:I${totalRow + 2}`, `Systems included below employees: ${SYSTEM_USERS.join(", ")}${dataset.sample ? " · Synthetic sample" : ""}`, undefined, muted);
  merged(`A${totalRow + 3}:I${totalRow + 3}`, "Pick Time = first-to-last PICK transaction, including breaks. A single PICK has no measurable time span. Counts are lines, not Qty.", undefined, muted);
  [2, 3].forEach(offset => {
    ws.getRow(totalRow + offset).height = 15;
    ws.getCell(`A${totalRow + offset}`).font = {name: "Calibri", size: 8, color: {argb: muted}};
  });
  ws.pageSetup.printArea = `A1:I${totalRow + 3}`;
  return wb;
}

export async function exportExcel(
  report: Report,
  dataset: Dataset,
  paper: "Letter" | "A4",
) {
  const buffer = await createReportWorkbook(
    report,
    dataset,
    paper,
  ).xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const [year, month, day] = report.date.split("-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `Warehouse_Activity_Dashboard_${month}-${day}-${year}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
