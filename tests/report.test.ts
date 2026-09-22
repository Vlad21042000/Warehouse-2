import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReport,
  createDemo,
  HEADERS,
  parseRows,
  parseDate,
  parseTime,
  formatDuration,
} from "../src/report";
import { readImport, parseSheet } from "../src/import";
import { createReportWorkbook } from "../src/export";
import { utils, write, read } from "xlsx";

const row = (
  type: string,
  user: string,
  time: unknown,
  date: unknown = "09/18/2026",
  qty = 999,
) => [type, "", "", "", "", "", "", "", qty, "EA", user, date, time];
const data = [
  HEADERS,
  row("PICK", "ALEX", "08:00:00"),
  row("", "ALEX", "10:00:00"),
  row("PUT", "ALEX", "11:00"),
  row("RECEIPT", "SAM", "08:00"),
  row("", "SAM", "09:00"),
  row("REPLN", "SAM", "10:00"),
  row("PICK", "JDEJOBS", "12:00"),
  row("PICK", "exactasvc", "12:00"),
  row("PUT", "BFITZ00", "12:00"),
];

test("counts rows, carries transaction types down, excludes accounts, and ranks ties by picks", () => {
  const dataset = parseRows(data, "fixture.csv", "Daily Activity");
  const report = buildReport(dataset, "2026-09-18");
  assert.equal(report.total, 6);
  assert.deepEqual(report.counts, { PICK: 2, PUT: 1, REPLN: 1, RECEIPT: 2 });
  assert.equal(dataset.audit.excluded, 3);
  assert.deepEqual(
    report.employees.map((e) => e.employee),
    ["ALEX", "SAM"],
  );
  assert.equal(report.employees[0].pickMinutes, 120);
  assert.equal(report.employees[0].rate, 1);
  assert.equal(report.employees[1].pickMinutes, null);
  assert.equal(report.rate, 1);
});

test("date filters do not mix employees or calculate a multi-day picking span", () => {
  const dataset = parseRows(
    [
      ...data,
      row("PICK", "ALEX", "08:00", "09/19/2026"),
      row("PICK", "ALEX", "08:30", "09/19/2026"),
    ],
    "multi.csv",
    "Daily",
  );
  assert.deepEqual(dataset.dates, ["2026-09-18", "2026-09-19"]);
  const report = buildReport(dataset, "2026-09-19");
  assert.equal(report.total, 2);
  assert.equal(report.employees[0].pickMinutes, 30);
  assert.equal(report.rate, 4);
});

test("single, same-time and incomplete picks have blank rates; incomplete data cannot inflate team rate", () => {
  const dataset = parseRows(
    [
      HEADERS,
      row("PICK", "ONE", "08:00"),
      row("PICK", "ZERO", "09:00"),
      row("", "ZERO", "09:00"),
      row("PICK", "MISSING", "10:00"),
      row("", "MISSING", ""),
      row("PICK", "VALID", "10:00"),
      row("", "VALID", "11:00"),
    ],
    "times.csv",
    "Daily",
  );
  const report = buildReport(dataset, "2026-09-18");
  assert.equal(dataset.audit.missingTime, 1);
  for (const e of report.employees.filter((e) => e.employee !== "VALID")) {
    assert.equal(e.pickMinutes, null);
    assert.equal(e.rate, null);
  }
  assert.equal(report.rate, 2);
  assert.equal(report.timedPicks, 2);
  assert.equal(report.counts.PICK, 7);
});

test("handles Excel serials, AM/PM, seconds and invalid calendar values without silent guessing", () => {
  assert.equal(parseDate(46283), "2026-09-18");
  assert.equal(parseDate(46283 - 1462, true), "2026-09-18");
  assert.equal(parseDate("2026-09-18"), "2026-09-18");
  assert.equal(parseDate("18-Sep-2026"), "2026-09-18");
  assert.equal(parseDate("02/30/2026"), null);
  assert.equal(parseDate("18/09/2026"), null);
  assert.equal(parseTime(0.5), 43200);
  assert.equal(parseTime("12:00 AM"), 0);
  assert.equal(parseTime("12:00 PM"), 43200);
  assert.equal(parseTime("2:30:15 PM"), 52215);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("8:99"), null);
  assert.equal(formatDuration(314.6), "5:14");
});

test("accepts title rows and repeated headers; audits invalid and unsupported rows", () => {
  const dataset = parseRows(
    [
      ["Daily Activity report"],
      [],
      ...data,
      HEADERS,
      row("SHIP", "OTHER", "10:00"),
      row("PICK", "", "10:00"),
      row("PICK", "BAD", "10:00", "garbage"),
    ],
    "fixture.csv",
    "Daily",
  );
  assert.equal(dataset.transactions.length, 6);
  assert.equal(dataset.audit.unsupported, 1);
  assert.equal(dataset.audit.invalid, 2);
  assert.equal(
    dataset.audit.sourceRows,
    dataset.audit.included +
      dataset.audit.excluded +
      dataset.audit.unsupported +
      dataset.audit.invalid,
  );
  assert.throws(
    () => parseRows([["hello", "world"]], "bad.csv", "Daily"),
    /headers/,
  );
});

test("imports actual XLSX, legacy XLS, CSV and a chosen worksheet", () => {
  for (const bookType of ["xlsx", "biff8", "csv"] as const) {
    const workbook = utils.book_new();
    utils.book_append_sheet(
      workbook,
      utils.aoa_to_sheet(data),
      "Daily Activity",
    );
    const buffer = write(workbook, { type: "array", bookType }) as ArrayBuffer;
    const input = readImport(
      buffer,
      `daily.${bookType === "biff8" ? "xls" : bookType}`,
    );
    assert.equal(
      parseSheet(input, input.sheets[0].name).transactions.length,
      6,
    );
  }
});

test("exports one styled worksheet with typed durations, formulas, totals and one-page Letter settings", async () => {
  const dataset = parseRows(data, "fixture.csv", "Daily Activity");
  const report = buildReport(dataset, "2026-09-18");
  const wb = createReportWorkbook(report, dataset);
  assert.equal(wb.worksheets.length, 1);
  const ws = wb.worksheets[0];
  assert.equal(ws.pageSetup.paperSize, 1);
  assert.equal(ws.pageSetup.orientation, "portrait");
  assert.equal(ws.pageSetup.fitToWidth, 1);
  assert.equal(ws.pageSetup.fitToHeight, 1);
  assert.equal(ws.pageSetup.margins?.left, 0.25);
  assert.equal(ws.pageSetup.margins?.top, 0.75);
  assert.equal(ws.getCell("D11").value, 120 / 1440);
  assert.equal(ws.getCell("D11").numFmt, "[h]:mm");
  assert.equal(ws.getCell("E11").result, 1);
  assert.equal(ws.getCell("I13").result, 6);
  const buffer = await wb.xlsx.writeBuffer();
  const saved = read(buffer, { type: "buffer" });
  assert.deepEqual(saved.SheetNames, ["Activity Dashboard"]);
  assert.equal(saved.Sheets["Activity Dashboard"].I13.v, 6);
  assert.equal(saved.Sheets["Activity Dashboard"].E11.v, 1);
  assert.equal(
    createReportWorkbook(report, dataset, "A4").worksheets[0].pageSetup
      .paperSize,
    9,
  );
});

test("sample is synthetic, reconciles totals, and remains a valid export", () => {
  const dataset = createDemo();
  const report = buildReport(dataset, dataset.dates[0]);
  assert.equal(dataset.sample, true);
  assert.equal(report.employees.length, 12);
  assert.equal(
    report.total,
    Object.values(report.counts).reduce((sum, v) => sum + v, 0),
  );
  assert.match(
    String(
      createReportWorkbook(report, dataset).worksheets[0].getCell("A2").value,
    ),
    /SAMPLE DATA/,
  );
});
