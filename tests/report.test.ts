import { change, compareEmployees, demoComparison, findTransactions, heatmapRows, hourlyActivity, previousReport } from '../src/analytics';
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

test("counts rows, carries transaction types down, includes systems below people, and ranks ties by picks", () => {
  const dataset = parseRows(data, "fixture.csv", "Daily Activity");
  const report = buildReport(dataset, "2026-09-18");
  assert.equal(report.total, 9);
  assert.deepEqual(report.counts, { PICK: 4, PUT: 2, REPLN: 1, RECEIPT: 2 });
  assert.equal(dataset.audit.excluded, 0);
  assert.deepEqual(
    report.employees.map((e) => e.employee),
    ["ALEX", "SAM", "EXACTASVC", "JDEJOBS", "BFITZ00"],
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
  assert.equal(dataset.transactions.length, 9);
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
      9,
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
  assert.equal(ws.getCell("D13").value, 120 / 1440);
  assert.equal(ws.getCell("D13").numFmt, "[h]:mm");
  assert.equal(ws.getCell("E13").result, 1);
  assert.equal(ws.getCell("I18").result, 9);
  const buffer = await wb.xlsx.writeBuffer();
  const saved = read(buffer, { type: "buffer" });
  assert.deepEqual(saved.SheetNames, ["Activity Dashboard"]);
  assert.equal(saved.Sheets["Activity Dashboard"].I18.v, 9);
  assert.equal(saved.Sheets["Activity Dashboard"].E13.v, 1);
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


test("automatically fits small and large reports on both paper sizes", () => {
  for (const count of [1, 9, 36, 80, 150, 300]) {
   for (const paper of ["Letter", "A4"] as const) {
    const rows: unknown[][] = [HEADERS];
    for (let i = 0; i < count; i++) {
      rows.push(row("PICK", `EMP${i}`, "08:00"), row("", `EMP${i}`, "09:00"));
    }
    const dataset = parseRows(rows, "layout.csv", "Daily Activity");
    const report = buildReport(dataset, "2026-09-18");
    const ws = createReportWorkbook(report, dataset, paper).worksheets[0];
    let height = 0;
    for (let r = 1; r <= 13 + count + 2; r++) height += ws.getRow(r).height ?? 21;
    assert.ok(height <= (paper === "Letter" ? 684.01 : 733.69), `Printable height exceeded for ${count} employees: ${height}`);
    assert.equal(ws.getCell("A7").value, "PICK");
    assert.equal(ws.getCell("C7").value, count * 2);
    assert.equal(ws.getCell("A10").value, "REPLN");
    assert.equal(ws.getCell("C13").value, 2);
    assert.equal(ws.pageSetup.fitToHeight, 1);
    assert.ok((ws.getCell("B13").font.size ?? 0) <= ws.getRow(13).height!);
   }
  }
});

test('retains optional order/item metadata without changing activity counts', () => {
  const values = row('PICK', 'ALEX', '08:00');
  values[1] = 'TASK-9'; values[2] = 'TRIP-4'; values[3] = 'SO-001'; values[5] = 'SKU-07'; values[6] = 'A-01'; values[7] = 'PACK';
  const dataset = parseRows([HEADERS, values], 'trace.csv', 'Daily');
  assert.equal(dataset.transactions[0].order, 'SO-001');
  assert.equal(dataset.transactions[0].item, 'SKU-07');
  assert.equal(dataset.transactions[0].from, 'A-01');
  assert.equal(dataset.transactions[0].quantity, '999');
  assert.equal(dataset.transactions[0].task, 'TASK-9');
  assert.equal(buildReport(dataset, '2026-09-18').total, 1);
  const minimal = parseRows([['Activity', 'Employee', 'Date'], ['PUT', 'SAM', '09/18/2026']], 'minimal.csv', 'Daily');
  assert.equal(minimal.transactions[0].order, '');
  assert.equal(minimal.transactions[0].timestamp, null);
});


test('hourly charts and heatmap reconcile counts including missing and midnight timestamps', () => {
  const dataset = parseRows([HEADERS, row('PICK', 'ALEX', '00:00'), row('PUT', 'ALEX', '23:59'), row('RECEIPT', 'SAM', ''), row('PICK', 'JDEJOBS', '00:00'), row('PICK', 'ALEX', '09:00', '09/19/2026')], 'hours.csv', 'Daily');
  const rows = dataset.transactions.filter(row => row.date === '2026-09-18');
  const hourly = hourlyActivity(rows);
  assert.equal(hourly.hours[0], 2); assert.equal(hourly.hours[23], 1); assert.equal(hourly.missing, 1);
  assert.equal(hourly.hours.reduce((sum, value) => sum + value, 0) + hourly.missing, 4);
  assert.equal(hourlyActivity(rows, 'RECEIPT').missing, 1);
  const heat = heatmapRows(rows);
  assert.equal(heat.find(row => row.employee === 'ALEX')?.total, 2);
  assert.equal(heat.find(row => row.employee === 'SAM')?.missing, 1);
  assert.equal(heatmapRows(rows, 'PICK').length, 2);
});

test('comparison includes employees absent on either day and handles zero baselines', () => {
  const dataset = parseRows([HEADERS, row('PICK', 'ALEX', '08:00'), row('PUT', 'SAM', '09:00'), row('PICK', 'ALEX', '08:00', '09/19/2026'), row('PICK', 'ALEX', '09:00', '09/19/2026'), row('RECEIPT', 'NEW', '10:00', '09/19/2026')], 'comparison.csv', 'Daily');
  const current = buildReport(dataset, '2026-09-19');
  const previous = previousReport(dataset, current.date)!;
  assert.equal(previous.date, '2026-09-18');
  const result = compareEmployees(current, previous);
  assert.equal(result.find(row => row.employee === 'ALEX')?.currentCounts.PICK, 2);
  assert.equal(result.find(row => row.employee === 'SAM')?.delta, -1);
  assert.equal(result.find(row => row.employee === 'NEW')?.percent, null);
  assert.equal(result.reduce((sum, row) => sum + row.delta, 0), current.total - previous.total);
  assert.deepEqual(change(3, 2), { delta: 1, percent: 50 });
  assert.deepEqual(change(0, 0), { delta: 0, percent: null });
  assert.equal(previousReport(dataset, '2026-09-18'), null);
});

test('lookup is case-insensitive, preserves duplicates, and does not match unrelated fields', () => {
  const values = row('PICK', 'ALEX', '08:00'); values[3] = 'SO-001'; values[5] = 'SKU-ABC';
  const dataset = parseRows([HEADERS, values, values], 'search.csv', 'Daily');
  assert.equal(findTransactions(dataset.transactions, ' so-001 ', 'order').length, 2);
  assert.equal(findTransactions(dataset.transactions, 'sku-a', 'item').length, 2);
  assert.equal(findTransactions(dataset.transactions, 'ALEX').length, 0);
  assert.equal(findTransactions(dataset.transactions, 'SO-001', 'item').length, 0);
  assert.equal(findTransactions(dataset.transactions, '').length, 0);
  const before = demoComparison(createDemo());
  assert.equal(before.sample, true);
  assert.ok(before.transactions.every(row => row.date === '2026-09-17' && (row.timestamp === null || new Date(row.timestamp).toISOString().startsWith('2026-09-17'))));
});


test('high-volume systems remain below people in report, heatmap, comparisons and Excel', () => {
  const rows = [HEADERS, row('PICK', 'ALEX', '08:00'), row('PICK', 'ALEX', '09:00'), row('RECEIPT', 'SAM', '10:00')];
  for (let i = 0; i < 30; i++) rows.push(row('PICK', 'JDEJOBS', i % 2 ? '10:00' : '08:00'));
  rows.push(row('PICK', 'EXACTASVC', '08:00'), row('PUT', 'BFITZ00', '10:00'));
  const dataset = parseRows(rows, 'systems.csv', 'Daily');
  const report = buildReport(dataset, '2026-09-18');
  assert.deepEqual(report.employees.map(e => e.employee), ['ALEX', 'SAM', 'JDEJOBS', 'EXACTASVC', 'BFITZ00']);
  assert.deepEqual(report.employees.map(e => e.rank), [1, 2, 0, 0, 0]);
  assert.equal(report.total, 35);
  assert.equal(report.counts.PICK, 33);
  assert.equal(report.rate, 2);
  assert.equal(report.pickMinutes, 60);
  assert.equal(report.timedPicks, 2);
  assert.deepEqual(heatmapRows(dataset.transactions).slice(0,2).map(e => e.employee), ['ALEX', 'SAM']);
  assert.ok(compareEmployees(report, buildReport(dataset, '2026-09-17')).slice(0,2).every(e => !['JDEJOBS','EXACTASVC','BFITZ00'].includes(e.employee)));
  const ws = createReportWorkbook(report, dataset).worksheets[0];
  assert.equal(ws.getCell('C5').value, 2);
  assert.equal(ws.getCell('A15').value, '—');
  assert.match(String(ws.getCell('B15').value), /JDEJOBS.*System/);
  assert.match(String(ws.getCell('H6').value ?? ws.getCell('F6').value), /ALEX/);
  assert.equal(ws.getCell('I18').result, 35);
  const onlySystems = buildReport(parseRows([HEADERS,row('PICK','JDEJOBS','08:00'),row('PICK','JDEJOBS','09:00')], 'system-only.csv','Daily'), '2026-09-18');
  assert.equal(onlySystems.employees[0].rank, 0);
  assert.equal(onlySystems.rate, null);
});
