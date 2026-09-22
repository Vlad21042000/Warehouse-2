import ExcelJS from "exceljs";
import {
  EXCLUDED_USERS,
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
  ws.columns = [6, 24, 10, 12, 10, 10, 10, 12, 11].map((width) => ({ width }));
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
    cell.alignment = { vertical: "middle", wrapText: true };
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
  ws.getRow(1).height = 39;
  merged(
    "A2:I2",
    `${formatDate(report.date)}  •  ${dataset.sample ? "SAMPLE DATA — " : ""}${dataset.source}  /  ${dataset.sheet}`,
    undefined,
    muted,
  );
  ws.getRow(2).height = 27;
  ws.getRow(3).height = 9;
  merged("A4:E4", "TEAM SUMMARY", navy, "FFFFFF", true);
  merged("F4:I4", "KEY HIGHLIGHTS", navy, "FFFFFF", true);
  const start = 11,
    end = start + report.employees.length - 1,
    totalRow = end + 1;
  merged("A5:C5", "Employees", light);
  merged("D5:E5", report.employees.length, light, navy, true);
  merged("A6:C6", "Total activity lines");
  merged(
    "D6:E6",
    { formula: `SUM(I${start}:I${end})`, result: report.total },
    undefined,
    navy,
    true,
  );
  merged("A7:C7", "PICK / PUT", light);
  merged(
    "D7:E7",
    `${report.counts.PICK} / ${report.counts.PUT}`,
    light,
    navy,
    true,
  );
  merged("A8:C8", "REPLN / RECEIPT");
  merged(
    "D8:E8",
    `${report.counts.REPLN} / ${report.counts.RECEIPT}`,
    undefined,
    navy,
    true,
  );
  const best = report.employees[0];
  const receiver = [...report.employees].sort(
    (a, b) => b.counts.RECEIPT - a.counts.RECEIPT,
  )[0];
  const picker = [...report.employees].sort(
    (a, b) => b.counts.PICK - a.counts.PICK,
  )[0];
  merged(
    "F5:I5",
    `Most activity: ${best?.employee ?? "—"} (${best?.total ?? 0})`,
    light,
  );
  merged(
    "F6:I6",
    `Most picks: ${picker?.counts.PICK ? `${picker.employee} (${picker.counts.PICK})` : "—"}`,
  );
  merged(
    "F7:I7",
    `Most receipts: ${receiver?.counts.RECEIPT ? `${receiver.employee} (${receiver.counts.RECEIPT})` : "—"}`,
    light,
  );
  merged("F8:I8", `Team pick rate: ${report.rate?.toFixed(2) ?? "—"} lines/hr`);
  ws.getRow(9).height = 10;
  ws.getRow(10).values = [
    "Rank",
    "Employee",
    "PICK",
    "Pick Time",
    "L/Hr",
    "PUT",
    "REPLN",
    "RECEIPT",
    "Total",
  ];
  ws.getRow(10).height = 26;
  ws.getRow(10).eachCell((c) => {
    c.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  const rowHeight = Math.max(
    18,
    Math.min(46, 390 / Math.max(report.employees.length, 1)),
  );
  report.employees.forEach((e, index) => {
    const r = start + index;
    const row = ws.getRow(r);
    row.values = [
      e.rank,
      e.employee,
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
        size: 11,
        bold: col === 2 || col === 9,
        color: { argb: "20334C" },
      };
      cell.alignment = {
        horizontal: col === 2 ? "left" : "center",
        vertical: "middle",
        wrapText: col === 2,
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
  total.height = 30;
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
  ws.getRow(totalRow + 1).height = 9;
  merged(`A${totalRow + 2}:I${totalRow + 2}`, "NOTES", navy, "FFFFFF", true);
  merged(
    `A${totalRow + 3}:I${totalRow + 3}`,
    "Counts are transaction rows, not quantities. Rank: Total, then PICK, descending. Blank transaction types carry down.",
    undefined,
    muted,
  );
  merged(
    `A${totalRow + 4}:I${totalRow + 4}`,
    "Pick Time = last PICK − first PICK, including breaks. Single, zero-span or incomplete timestamps leave time/rate blank. L/Hr = PICK ÷ hours.",
    undefined,
    muted,
  );
  merged(
    `A${totalRow + 5}:I${totalRow + 5}`,
    `Excluded: ${EXCLUDED_USERS.join(", ")}. Team rate uses only employees with valid Pick Time. ${dataset.sample ? "Synthetic sample — not actual employee results." : ""}`,
    undefined,
    muted,
  );
  [3, 4, 5].forEach((offset) => {
    ws.getRow(totalRow + offset).height = 27;
    ws.getCell(`A${totalRow + offset}`).font = {
      name: "Calibri",
      size: 9,
      color: { argb: muted },
    };
  });
  ws.pageSetup.printArea = `A1:I${totalRow + 5}`;
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
