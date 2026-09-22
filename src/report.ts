export const ACTIVITIES = ["PICK", "PUT", "REPLN", "RECEIPT"] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const EXCLUDED_USERS = ["JDEJOBS", "EXACTASVC", "BFITZ00"];
export const HEADERS = [
  "Transaction Type",
  "Task",
  "Trip",
  "Order No.",
  "Line No.",
  "Item Number",
  "From Location",
  "To Location",
  "Qty",
  "UOM",
  "User",
  "Date",
  "Time",
];
export type Transaction = {
  activity: Activity;
  employee: string;
  date: string;
  timestamp: number | null;
};
export type Audit = {
  sourceRows: number;
  included: number;
  excluded: number;
  unsupported: number;
  invalid: number;
  missingTime: number;
};
export type Dataset = {
  transactions: Transaction[];
  dates: string[];
  audit: Audit;
  source: string;
  sheet: string;
  sample: boolean;
};
export type Employee = {
  employee: string;
  counts: Record<Activity, number>;
  total: number;
  pickMinutes: number | null;
  rate: number | null;
  rank: number;
};
export type Report = {
  date: string;
  employees: Employee[];
  counts: Record<Activity, number>;
  total: number;
  pickMinutes: number;
  rate: number | null;
  timedPicks: number;
  hourly: number[];
};
export const emptyCounts = (): Record<Activity, number> => ({
  PICK: 0,
  PUT: 0,
  REPLN: 0,
  RECEIPT: 0,
});
const text = (v: unknown) => String(v ?? "").trim();
const normalize = (v: unknown) =>
  text(v)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
    ? d.toISOString().slice(0, 10)
    : null;
}

export function parseDate(value: unknown, date1904 = false): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const d = new Date(
      Date.UTC(1899, 11, 30) +
        (Math.floor(value) + (date1904 ? 1462 : 0)) * 86400000,
    );
    return validDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = text(value);
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) return validDate(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2}|\d{4})$/);
  if (m)
    return validDate(
      +m[3] < 100 ? 2000 + +m[3] : +m[3],
      [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(m[2].toLowerCase()) + 1,
      +m[1],
    );
  return null;
}

export function parseTime(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return (
      value.getUTCHours() * 3600 +
      value.getUTCMinutes() * 60 +
      value.getUTCSeconds()
    );
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 1
  )
    return Math.min(86399, Math.round(value * 86400));
  const m = text(value).match(
    /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i,
  );
  if (!m) return null;
  let hour = +m[1];
  if (+m[2] > 59 || +(m[3] ?? 0) > 59) return null;
  if (m[4]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (m[4].toUpperCase() === "PM" ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 3600 + +m[2] * 60 + +(m[3] ?? 0);
}

export function parseRows(
  rows: unknown[][],
  source: string,
  sheet: string,
  date1904 = false,
): Dataset {
  if (rows.length > 200_000)
    throw new Error(
      "This worksheet exceeds 200,000 rows. Export one day at a time.",
    );
  const aliases = {
    activity: ["transactiontype", "transaction", "activitytype", "activity"],
    employee: ["user", "username", "employee", "userid"],
    date: ["date", "transactiondate"],
    time: ["time", "transactiontime"],
  };
  let header = -1;
  let columns = { activity: -1, employee: -1, date: -1, time: -1 };
  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const cells = rows[i].map(normalize);
    const candidate = Object.fromEntries(
      Object.entries(aliases).map(([key, options]) => [
        key,
        cells.findIndex((v) => options.includes(v)),
      ]),
    ) as typeof columns;
    if (
      candidate.activity >= 0 &&
      candidate.employee >= 0 &&
      candidate.date >= 0
    ) {
      header = i;
      columns = candidate;
      break;
    }
  }
  if (header < 0)
    throw new Error(
      "Could not find the Daily Activity headers. Include Transaction Type, User, Date and Time. Use MM/DD/YYYY or YYYY-MM-DD dates.",
    );
  const transactions: Transaction[] = [];
  const audit: Audit = {
    sourceRows: 0,
    included: 0,
    excluded: 0,
    unsupported: 0,
    invalid: 0,
    missingTime: 0,
  };
  let currentActivity = "";
  for (const row of rows.slice(header + 1)) {
    if (row.every((v) => !text(v))) continue;
    const raw = text(row[columns.activity]).toUpperCase();
    if (aliases.activity.includes(normalize(raw))) {
      currentActivity = "";
      continue;
    }
    audit.sourceRows++;
    if (raw) currentActivity = raw;
    const employee = text(row[columns.employee]).toUpperCase();
    if (EXCLUDED_USERS.includes(employee)) {
      audit.excluded++;
      continue;
    }
    if (!(ACTIVITIES as readonly string[]).includes(currentActivity)) {
      audit.unsupported++;
      continue;
    }
    const date = parseDate(row[columns.date], date1904);
    if (!employee || /^(GRAND\s*)?TOTALS?$/.test(employee) || !date) {
      audit.invalid++;
      continue;
    }
    const time = parseTime(row[columns.time]);
    if (time === null) audit.missingTime++;
    transactions.push({
      activity: currentActivity as Activity,
      employee,
      date,
      timestamp:
        time === null ? null : Date.parse(date + "T00:00:00Z") + time * 1000,
    });
  }
  audit.included = transactions.length;
  if (!transactions.length)
    throw new Error(
      `No valid warehouse activity rows found. ${audit.excluded} excluded-account rows; ${audit.unsupported} unsupported rows; ${audit.invalid} rows missing a valid user or date.`,
    );
  return {
    transactions,
    dates: [...new Set(transactions.map((t) => t.date))].sort(),
    audit,
    source,
    sheet,
    sample: false,
  };
}

export function buildReport(dataset: Dataset, date: string): Report {
  const groups = new Map<string, Transaction[]>();
  const hourly = Array<number>(24).fill(0);
  const counts = emptyCounts();
  for (const t of dataset.transactions) {
    if (t.date !== date) continue;
    if (!groups.has(t.employee)) groups.set(t.employee, []);
    groups.get(t.employee)!.push(t);
    counts[t.activity]++;
    if (t.timestamp !== null) hourly[new Date(t.timestamp).getUTCHours()]++;
  }
  const employees = Array.from(groups, ([employee, rows]) => {
    const activityCounts = emptyCounts();
    rows.forEach((t) => activityCounts[t.activity]++);
    const picks = rows.filter((t) => t.activity === "PICK");
    let pickMinutes: number | null = null;
    if (picks.length > 1 && picks.every((t) => t.timestamp !== null)) {
      let first = Infinity,
        last = -Infinity;
      for (const t of picks) {
        first = Math.min(first, t.timestamp!);
        last = Math.max(last, t.timestamp!);
      }
      const span = (last - first) / 60000;
      if (span > 0) pickMinutes = span;
    }
    return {
      employee,
      counts: activityCounts,
      total: rows.length,
      pickMinutes,
      rate: pickMinutes === null ? null : picks.length / (pickMinutes / 60),
      rank: 0,
    };
  }).sort(
    (a, b) =>
      b.total - a.total ||
      b.counts.PICK - a.counts.PICK ||
      a.employee.localeCompare(b.employee),
  );
  employees.forEach((e, i) => {
    e.rank = i + 1;
  });
  const pickMinutes = employees.reduce(
    (sum, e) => sum + (e.pickMinutes ?? 0),
    0,
  );
  const timedPicks = employees
    .filter((e) => e.pickMinutes !== null)
    .reduce((sum, e) => sum + e.counts.PICK, 0);
  return {
    date,
    employees,
    counts,
    total: employees.reduce((sum, e) => sum + e.total, 0),
    pickMinutes,
    rate: pickMinutes > 0 ? timedPicks / (pickMinutes / 60) : null,
    timedPicks,
    hourly,
  };
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const total = Math.floor(minutes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
export function formatDate(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function createDemo(): Dataset {
  const date = "2026-09-18";
  const people = [
    ["A. CHEN", 182, 38, 12, 0, 6.1],
    ["J. MORGAN", 164, 22, 18, 0, 6.3],
    ["S. PATEL", 151, 26, 14, 0, 5.8],
    ["M. RIVERA", 138, 16, 20, 0, 5.6],
    ["D. WILSON", 124, 31, 8, 0, 5.9],
    ["K. BROOKS", 112, 24, 6, 0, 5.5],
    ["T. REED", 0, 54, 22, 61, 0],
    ["R. PARK", 98, 18, 9, 0, 5.1],
    ["L. EVANS", 85, 16, 12, 0, 4.7],
    ["N. SCOTT", 0, 43, 17, 45, 0],
    ["C. ADAMS", 74, 12, 8, 0, 4.4],
    ["E. CLARK", 0, 28, 14, 38, 0],
  ] as const;
  const rows: unknown[][] = [HEADERS];
  people.forEach(([name, pick, put, repln, receipt, hours], person) => {
    [pick, put, repln, receipt].forEach((count, a) => {
      for (let i = 0; i < count; i++) {
        const sec = Math.round(
          7 * 3600 +
            person * 140 +
            (i / Math.max(count - 1, 1)) * (hours || 6) * 3600,
        );
        rows.push([
          i === 0 ? ACTIVITIES[a] : "",
          "DEMO",
          "",
          `D${person}`,
          i + 1,
          "DEMO-ITEM",
          "A-01",
          "SHIP",
          10,
          "EA",
          name,
          date,
          `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`,
        ]);
      }
    });
  });
  return {
    ...parseRows(rows, "Sample Daily Activity", "Daily Activity"),
    sample: true,
  };
}
