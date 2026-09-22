import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FileSpreadsheet,
  LayoutDashboard,
  LoaderCircle,
  Package,
  Printer,
  Search,
  ShieldCheck,
  Trophy,
  Upload,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import {
  ACTIVITIES,
  buildReport,
  createDemo,
  EXCLUDED_USERS,
  formatDate,
  formatDuration,
  HEADERS,
  parseRows,
  type Activity,
  type Dataset,
  type Employee,
} from "./report";
import type { ImportResult } from "./import";

const n = (value: number) => value.toLocaleString("en-CA");
const activityNames: Record<Activity, string> = {
  PICK: "Picking",
  PUT: "Putaway",
  REPLN: "Replenishment",
  RECEIPT: "Receiving",
};
const initialData = createDemo();

function EmployeeTable({
  employees,
  compact = false,
}: {
  employees: Employee[];
  compact?: boolean;
}) {
  const totals = employees.reduce(
    (acc, e) => ({
      pick: acc.pick + e.counts.PICK,
      put: acc.put + e.counts.PUT,
      repln: acc.repln + e.counts.REPLN,
      receipt: acc.receipt + e.counts.RECEIPT,
      total: acc.total + e.total,
    }),
    { pick: 0, put: 0, repln: 0, receipt: 0, total: 0 },
  );
  return (
    <table
      className={compact ? "employee-table print-table" : "employee-table"}
    >
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Employee</th>
          <th scope="col">PICK</th>
          <th scope="col">Pick time</th>
          <th scope="col">
            <abbr title="Pick lines divided by the elapsed time between first and last pick">
              L/Hr
            </abbr>
          </th>
          <th scope="col">PUT</th>
          <th scope="col">REPLN</th>
          <th scope="col">RECEIPT</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((e) => (
          <tr key={e.employee} className={`rank-${e.rank}`}>
            <td>
              <span className="rank-number">
                {e.rank === 1 && !compact ? (
                  <Trophy size={14} aria-hidden="true" />
                ) : null}
                {e.rank}
              </span>
            </td>
            <th scope="row">
              <span className="employee-name">
                {!compact && (
                  <span className="avatar" aria-hidden="true">
                    {e.employee.replace(/[^A-Z]/g, "").slice(0, 2)}
                  </span>
                )}
                {e.employee}
              </span>
            </th>
            <td>{n(e.counts.PICK)}</td>
            <td className="time-cell">{formatDuration(e.pickMinutes)}</td>
            <td>{e.rate?.toFixed(2) ?? "—"}</td>
            <td>{n(e.counts.PUT)}</td>
            <td>{n(e.counts.REPLN)}</td>
            <td>{n(e.counts.RECEIPT)}</td>
            <td className="total-cell">{n(e.total)}</td>
          </tr>
        ))}
      </tbody>
      {!!employees.length && (
        <tfoot>
          <tr>
            <td></td>
            <th scope="row">{compact ? "Team total" : "Displayed total"}</th>
            <td>{n(totals.pick)}</td>
            <td>—</td>
            <td>—</td>
            <td>{n(totals.put)}</td>
            <td>{n(totals.repln)}</td>
            <td>{n(totals.receipt)}</td>
            <td>{n(totals.total)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(initialData);
  const [date, setDate] = useState(initialData.dates.at(-1)!);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [sheet, setSheet] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<Activity | "ALL">("ALL");
  const [paper, setPaper] = useState<"Letter" | "A4">("Letter");
  const input = useRef<HTMLInputElement>(null);
  const guide = useRef<HTMLDialogElement>(null);
  const importSection = useRef<HTMLDivElement>(null);
  const report = useMemo(
    () => (dataset ? buildReport(dataset, date) : null),
    [dataset, date],
  );
  const visible = useMemo(
    () =>
      report?.employees.filter(
        (e) =>
          e.employee.toLowerCase().includes(search.toLowerCase()) &&
          (activity === "ALL" || e.counts[activity] > 0),
      ) ?? [],
    [report, search, activity],
  );
  const bestPicker = report
    ? [...report.employees].sort((a, b) => b.counts.PICK - a.counts.PICK)[0]
    : null;
  const bestReceiver = report
    ? [...report.employees].sort(
        (a, b) => b.counts.RECEIPT - a.counts.RECEIPT,
      )[0]
    : null;

  function activate(data: Dataset) {
    setDataset(data);
    setDate(data.dates.at(-1)!);
    setSearch("");
    setActivity("ALL");
    setError("");
  }
  function chooseSheet(result: ImportResult, name: string) {
    const chosen = result.sheets.find((s) => s.name === name)!;
    activate(parseRows(chosen.rows, result.source, name, result.date1904));
    setSheet(name);
  }
  async function handleFile(file?: File) {
    if (!file || busy) return;
    setError("");
    setNotice("");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("Choose an Excel (.xlsx or .xls) or CSV file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("The file is larger than 20 MB. Export a smaller date range.");
      return;
    }
    setBusy(true);
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const buffer = await file.arrayBuffer();
      const result = await new Promise<ImportResult>((resolve, reject) => {
        worker = new Worker(new URL("./import.worker.ts", import.meta.url), {
          type: "module",
        });
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "Reading this file took too long. Try a smaller Daily Activity export.",
              ),
            ),
          30000,
        );
        worker.onmessage = (event) =>
          event.data.ok
            ? resolve(event.data.result)
            : reject(new Error(event.data.error));
        worker.onerror = () =>
          reject(
            new Error(
              "Could not read this file. Try exporting it again as Excel or CSV.",
            ),
          );
        worker.postMessage({ buffer, name: file.name }, [buffer]);
      });
      let accepted = false;
      let lastError: unknown;
      for (const candidate of result.sheets) {
        try {
          chooseSheet(result, candidate.name);
          accepted = true;
          break;
        } catch (e) {
          lastError = e;
        }
      }
      if (!accepted) throw lastError;
      setImported(result);
      setNotice(`${file.name} is ready. Review your report below.`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read this file. Check the Daily Activity format.",
      );
    } finally {
      worker?.terminate();
      clearTimeout(timeout);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function download() {
    if (!dataset || !report || !report.total) return;
    setExporting(true);
    setError("");
    try {
      const { exportExcel } = await import("./export");
      await exportExcel(report, dataset, paper);
      setNotice("Excel report downloaded. It is set to print on one page.");
    } catch {
      setError("The Excel export did not finish. Please try again.");
    } finally {
      setExporting(false);
    }
  }
  function downloadTemplate() {
    const blob = new Blob([HEADERS.join(",") + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Daily_Activity_Template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function openUpload() {
    importSection.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    input.current?.click();
  }
  function clearReport() {
    setDataset(null);
    setImported(null);
    setSearch("");
    setError("");
    setNotice("Report cleared from this tab.");
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to report
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#main"
            aria-label="Warehouse Reporting home"
          >
            <span className="brand-mark">
              <Warehouse size={24} />
            </span>
            <span>
              Warehouse<span className="brand-sub">REPORTING</span>
            </span>
          </a>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            <a href="#main" className="nav-item active" aria-current="page">
              <LayoutDashboard size={19} />
              Overview
            </a>
            <button className="nav-item" onClick={openUpload}>
              <Upload size={19} />
              Import report
            </button>
            <button
              className="nav-item"
              onClick={() => guide.current?.showModal()}
            >
              <CircleHelp size={19} />
              Report guide
            </button>
          </nav>
          <div className="sidebar-bottom">
            <ShieldCheck size={24} />
            <strong>Your data stays with you</strong>
            <p>
              Reports are processed in this browser tab and cleared when you
              refresh.
            </p>
            <span className="free-label">Free to use · No account needed</span>
          </div>
          <div className="sidebar-footer">
            <span className="workspace-icon">WR</span>
            <div>
              Warehouse workspace<span>Daily operations</span>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="mobile-brand">
              <Warehouse size={22} />
              Warehouse Reporting
            </span>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span>/</span>
              <strong>Daily activity</strong>
            </div>
            <button
              className="help-button"
              onClick={() => guide.current?.showModal()}
            >
              <CircleHelp size={17} />
              <span>How it works</span>
            </button>
          </header>
          <main id="main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">OPERATIONS OVERVIEW</div>
                <h1>Daily activity</h1>
                <p>A clear view of your team’s warehouse performance.</p>
              </div>
              <div className="heading-actions">
                <button
                  className="button secondary"
                  disabled={!report?.total || busy}
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                  <span>Print report</span>
                </button>
                <button
                  className="button primary"
                  disabled={!report?.total || busy || exporting}
                  onClick={download}
                >
                  {exporting ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <ArrowDownToLine size={17} />
                  )}
                  <span>{exporting ? "Exporting…" : "Export Excel"}</span>
                </button>
              </div>
            </div>

            <div
              className={`upload-panel ${drag ? "dragging" : ""}`}
              ref={importSection}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                if (e.dataTransfer.files.length > 1)
                  setError("Import one Daily Activity file at a time.");
                else void handleFile(e.dataTransfer.files[0]);
              }}
            >
              <div className="upload-icon">
                {busy ? (
                  <LoaderCircle className="spin" size={23} />
                ) : (
                  <FileSpreadsheet size={25} />
                )}
              </div>
              <div className="upload-copy">
                <strong>
                  {busy
                    ? "Reading your activity report…"
                    : "Bring your daily report into focus"}
                </strong>
                <p>
                  Drop your Daily Activity export here{" "}
                  <span>· XLSX, XLS or CSV · Up to 20 MB</span>
                </p>
              </div>
              <button
                className="button secondary upload-button"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                <Upload size={17} />
                {busy ? "Importing…" : "Upload report"}
              </button>
              <input
                ref={input}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Upload Daily Activity report"
                onChange={(e) => void handleFile(e.target.files?.[0])}
                className="file-input"
              />
            </div>
            {error && (
              <div role="alert" className="message error">
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  <X size={18} />
                </button>
              </div>
            )}
            {notice && (
              <div role="status" className="message success">
                <Check size={17} />
                <span>{notice}</span>
                <button
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {dataset && report ? (
              <>
                <div className="report-toolbar">
                  <div className="report-meta">
                    {dataset.sample ? (
                      <span className="badge sample-badge">SAMPLE DATA</span>
                    ) : (
                      <span className="badge imported-badge">
                        <Check size={12} />
                        IMPORTED
                      </span>
                    )}
                    <span className="source-name" title={dataset.source}>
                      {dataset.sample
                        ? "Explore a sample, then upload your report"
                        : dataset.source}
                    </span>
                  </div>
                  <div className="report-controls">
                    {imported && imported.sheets.length > 1 && (
                      <label className="select-label">
                        Sheet
                        <select
                          aria-label="Worksheet"
                          value={sheet}
                          onChange={(e) => {
                            try {
                              chooseSheet(imported, e.target.value);
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Could not read worksheet.",
                              );
                            }
                          }}
                        >
                          {imported.sheets.map((s) => (
                            <option key={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="date-control">
                      <CalendarDays size={16} />
                      <select
                        aria-label="Report date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setSearch("");
                        }}
                      >
                        {dataset.dates.map((d) => (
                          <option key={d} value={d}>
                            {formatDate(d)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </label>
                  </div>
                </div>
                <section className="stats-grid" aria-label="Team summary">
                  <div className="stat-card featured">
                    <div className="stat-label">
                      Total activity lines
                      <BarChart3 size={19} />
                    </div>
                    <div className="stat-number">{n(report.total)}</div>
                    <div className="stat-description">
                      <span className="tiny-square" />
                      Across all four activities
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">
                      Active employees
                      <Users size={19} />
                    </div>
                    <div className="stat-number">
                      {n(report.employees.length)}
                      <span>people</span>
                    </div>
                    <div className="stat-description">
                      Service accounts excluded
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">
                      Picking lines
                      <Package size={19} />
                    </div>
                    <div className="stat-number">{n(report.counts.PICK)}</div>
                    <div className="stat-description">
                      <span className="metric-pill">
                        {report.total
                          ? Math.round(
                              (report.counts.PICK / report.total) * 100,
                            )
                          : 0}
                        %
                      </span>
                      of total activity
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">
                      Team picking rate
                      <span title="Picks with valid timing divided by summed employee Pick Time">
                        <CircleHelp size={16} />
                      </span>
                    </div>
                    <div className="stat-number">
                      {report.rate?.toFixed(2) ?? "—"}
                      <span>lines/hr</span>
                    </div>
                    <div className="stat-description">
                      First-to-last pick elapsed time
                    </div>
                  </div>
                </section>
                <div className="insights-grid">
                  <section className="panel activity-panel">
                    <div className="panel-heading">
                      <h2>Activity breakdown</h2>
                      <span>{n(report.total)} lines</span>
                    </div>
                    <div
                      className="mix-bar"
                      aria-label="Share of total activity"
                    >
                      {ACTIVITIES.map((a) => (
                        <span
                          key={a}
                          className={`activity-${a}`}
                          style={{ flex: report.counts[a] }}
                          title={`${activityNames[a]}: ${n(report.counts[a])} lines`}
                        />
                      ))}
                    </div>
                    <div className="activity-legend">
                      {ACTIVITIES.map((a) => (
                        <div key={a}>
                          <span className={`legend-dot activity-${a}`} />
                          <span>
                            {activityNames[a]}
                            <strong>
                              {n(report.counts[a])}
                              <small>
                                {report.total
                                  ? (
                                      (report.counts[a] / report.total) *
                                      100
                                    ).toFixed(1)
                                  : 0}
                                %
                              </small>
                            </strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="panel highlights-panel">
                    <div className="panel-heading">
                      <h2>Key highlights</h2>
                      <Trophy size={17} />
                    </div>
                    <div className="highlight-grid">
                      <div>
                        <span className="highlight-label">MOST ACTIVITY</span>
                        <strong>{report.employees[0]?.employee ?? "—"}</strong>
                        <span>
                          <b>{n(report.employees[0]?.total ?? 0)}</b> total
                          lines
                        </span>
                      </div>
                      <div>
                        <span className="highlight-label">MOST PICKS</span>
                        <strong>
                          {bestPicker?.counts.PICK ? bestPicker.employee : "—"}
                        </strong>
                        <span>
                          <b>{n(bestPicker?.counts.PICK ?? 0)}</b> pick lines
                        </span>
                      </div>
                      <div>
                        <span className="highlight-label">MOST RECEIPTS</span>
                        <strong>
                          {bestReceiver?.counts.RECEIPT
                            ? bestReceiver.employee
                            : "—"}
                        </strong>
                        <span>
                          <b>{n(bestReceiver?.counts.RECEIPT ?? 0)}</b> receipt
                          lines
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                <section
                  className="panel performance-panel"
                  aria-labelledby="performance-title"
                >
                  <div className="performance-heading">
                    <div>
                      <h2 id="performance-title">
                        Team performance{" "}
                        <span className="count-badge">
                          {report.employees.length}
                        </span>
                      </h2>
                      <p>Ranked by total activity, then picking lines.</p>
                    </div>
                    <label className="search-control">
                      <Search size={17} />
                      <input
                        type="search"
                        aria-label="Search employees"
                        placeholder="Find an employee…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <div
                    className="activity-tabs"
                    role="group"
                    aria-label="Filter employees by activity"
                  >
                    {(["ALL", ...ACTIVITIES] as const).map((a) => (
                      <button
                        key={a}
                        className={a === activity ? "selected" : ""}
                        aria-pressed={a === activity}
                        onClick={() => setActivity(a)}
                      >
                        {a === "ALL" ? "All activity" : activityNames[a]}
                      </button>
                    ))}
                  </div>
                  <div className="table-scroll">
                    <EmployeeTable employees={visible} />
                  </div>
                  {!visible.length && (
                    <div className="no-results">
                      <Search size={25} />
                      <strong>No matching employees</strong>
                      <p>Try another name or activity.</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setActivity("ALL");
                        }}
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                  <div className="table-footer">
                    <span>
                      Showing {visible.length} of {report.employees.length}{" "}
                      employees
                    </span>
                    <span>
                      <span className="key-dot gold" />
                      1st
                      <span className="key-dot orange" />
                      3rd
                      <span className="export-note">
                        Exports include the full daily report
                      </span>
                    </span>
                  </div>
                </section>
                <div className="below-report">
                  <details className="import-details">
                    <summary>Report details & calculation notes</summary>
                    <div className="detail-content">
                      <p>
                        <strong>Source:</strong> {dataset.source} ·{" "}
                        {dataset.sheet}
                      </p>
                      <p>
                        {n(dataset.audit.included)} valid lines across{" "}
                        {dataset.dates.length} date(s).{" "}
                        {n(dataset.audit.excluded)} excluded-account rows;{" "}
                        {n(dataset.audit.unsupported)} unsupported rows;{" "}
                        {n(dataset.audit.invalid)} invalid rows.
                      </p>
                      <p>
                        One row = one activity line, regardless of Qty. Blank
                        transaction types carry down. Excluded:{" "}
                        {EXCLUDED_USERS.join(", ")}.
                      </p>
                      <p>
                        Pick Time is the elapsed time between first and last
                        PICK, including breaks. One pick, zero elapsed time or
                        any missing PICK timestamp leaves time and rate blank.
                        Team rate includes only employees with valid Pick Time.
                      </p>
                      <p>
                        Dates use MM/DD/YYYY or YYYY-MM-DD. Reporting follows
                        the dates and times in your file without timezone
                        conversion.
                      </p>
                      <button className="text-button" onClick={clearReport}>
                        Clear this report
                      </button>
                    </div>
                  </details>
                  <label className="paper-control">
                    Print size
                    <select
                      value={paper}
                      onChange={(e) =>
                        setPaper(e.target.value as "Letter" | "A4")
                      }
                      aria-label="Print paper size"
                    >
                      <option value="Letter">Letter · 8.5 × 11 in</option>
                      <option value="A4">A4 · 210 × 297 mm</option>
                    </select>
                  </label>
                </div>
                {dataset.audit.missingTime > 0 && (
                  <div className="message warning">
                    {n(dataset.audit.missingTime)} imported rows have missing or
                    invalid times. Their lines are counted; affected picking
                    times and rates are left blank.
                  </div>
                )}
                {report.employees.length > 35 && (
                  <div className="message warning">
                    This report has many employees. Excel will fit all rows onto
                    one page; use a larger paper size or a smaller report for
                    more readable printing.
                  </div>
                )}
              </>
            ) : (
              <section className="empty-panel">
                <FileSpreadsheet size={44} />
                <h2>Your next report starts here</h2>
                <p>
                  Upload a Daily Activity export to see your team summary,
                  rankings and a print-ready Excel dashboard.
                </p>
                <button className="button primary" onClick={openUpload}>
                  Upload report
                  <ArrowRight size={17} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    activate(createDemo());
                    setNotice("");
                  }}
                >
                  Explore sample report
                </button>
              </section>
            )}
            <footer className="page-footer">
              <span>Warehouse Reporting</span>
              <span>
                <ShieldCheck size={14} />
                Your files never leave this browser tab.
              </span>
            </footer>
          </main>
        </div>
      </div>
      <dialog
        ref={guide}
        className="guide-dialog"
        onClick={(e) => {
          if (e.target === guide.current) guide.current?.close();
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">REPORT GUIDE</span>
            <h2>From raw activity to a clear report</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close report guide"
            onClick={() => guide.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="guide-steps">
          <div>
            <b>01</b>
            <section>
              <h3>Upload your Daily Activity export</h3>
              <p>
                Use Excel (.xlsx, .xls) or CSV. Keep the column headers. If your
                workbook has several sheets or dates, choose the one you need.
              </p>
            </section>
          </div>
          <div>
            <b>02</b>
            <section>
              <h3>Review the daily report</h3>
              <p>
                Each transaction row counts as one line. PICK, PUT, REPLN and
                RECEIPT are included. Blank transaction types inherit the type
                above. JDEJOBS, EXACTASVC and BFITZ00 are excluded.
              </p>
            </section>
          </div>
          <div>
            <b>03</b>
            <section>
              <h3>Export or print</h3>
              <p>
                Download one Excel worksheet with the team summary, highlights
                and ranked table. Letter portrait is the default, with narrow
                side margins and all rows fitted to one page. Use Print report
                to print or save a PDF.
              </p>
            </section>
          </div>
        </div>
        <div className="guide-note">
          <strong>About Pick Time</strong>
          <p>
            Last PICK timestamp minus first PICK timestamp, including breaks.
            L/Hr is PICK lines divided by that elapsed time. A single pick, zero
            span or incomplete timestamps shows a blank rate. This is an
            activity span, not active working time.
          </p>
        </div>
        <div className="template-row">
          <p>
            Need the column format?{" "}
            <span>
              Dates: MM/DD/YYYY or YYYY-MM-DD. Times: HH:MM:SS or h:mm AM/PM.
            </span>
          </p>
          <button className="button secondary" onClick={downloadTemplate}>
            <ArrowDownToLine size={16} />
            CSV template
          </button>
        </div>
      </dialog>
      {dataset && report && (
        <section
          id="print-report"
          style={
            { "--employee-count": report.employees.length } as CSSProperties
          }
        >
          <header>
            <h1>WAREHOUSE ACTIVITY DASHBOARD</h1>
            <p>
              {formatDate(report.date)} ·{" "}
              {dataset.sample ? "SAMPLE DATA · " : ""}
              {dataset.source}
            </p>
          </header>
          <div className="print-summary">
            <section>
              <h2>TEAM SUMMARY</h2>
              <p>
                Employees <b>{report.employees.length}</b>
              </p>
              <p>
                Total activity lines <b>{n(report.total)}</b>
              </p>
              <p>
                PICK / PUT{" "}
                <b>
                  {n(report.counts.PICK)} / {n(report.counts.PUT)}
                </b>
              </p>
              <p>
                REPLN / RECEIPT{" "}
                <b>
                  {n(report.counts.REPLN)} / {n(report.counts.RECEIPT)}
                </b>
              </p>
            </section>
            <section>
              <h2>KEY HIGHLIGHTS</h2>
              <p>
                Most activity <b>{report.employees[0]?.employee}</b>
              </p>
              <p>
                Most picks{" "}
                <b>{bestPicker?.counts.PICK ? bestPicker.employee : "—"}</b>
              </p>
              <p>
                Most receipts{" "}
                <b>
                  {bestReceiver?.counts.RECEIPT ? bestReceiver.employee : "—"}
                </b>
              </p>
              <p>
                Team pick rate <b>{report.rate?.toFixed(2) ?? "—"} lines/hr</b>
              </p>
            </section>
          </div>
          <EmployeeTable employees={report.employees} compact />
          <div className="print-notes">
            <h2>NOTES</h2>
            <p>
              Counts are transaction rows, not Qty. Rank: Total, then PICK,
              descending. Blank transaction types carry down.
            </p>
            <p>
              Pick Time = last PICK − first PICK, including breaks. L/Hr = PICK
              ÷ hours. Single, zero-span or incomplete timestamps leave
              time/rate blank.
            </p>
            <p>
              Excluded: {EXCLUDED_USERS.join(", ")}. Team rate uses only
              employees with valid Pick Time.
            </p>
          </div>
        </section>
      )}
      <style>{`@page { size: ${paper} portrait; margin: 0.75in 0.25in; }`}</style>
    </>
  );
}
