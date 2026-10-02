import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, BarChart3, Clock3, Search, Upload, X } from 'lucide-react';
import { ACTIVITIES, buildReport, formatDate, formatDuration, parseRows, type Activity, type Dataset, type Report, type Transaction } from './report';
import { change, compareEmployees, demoComparison, findTransactions, heatmapRows, hourlyActivity, previousReport } from './analytics';
import type { ImportResult } from './import';

const n = (v: number) => v.toLocaleString('en-CA');
const signed = (v: number) => `${v > 0 ? '+' : ''}${n(v)}`;
const time = (v: number | null) => v === null ? 'Unknown' : new Date(v).toISOString().slice(11, 19);
const hours = Array.from({ length: 24 }, (_, hour) => hour);
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const percent = (v: number | null) => v === null ? 'No percentage baseline' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

function Pager({ page, total, size, onChange, unit = 'lines' }: { page: number; total: number; size: number; onChange: (page: number) => void; unit?: string }) {
  const count = Math.max(1, Math.ceil(total / size));
  return <div className="analytics-pager"><span>{n(total)} {unit} · Page {page + 1} of {count}</span><div><button disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</button><button disabled={page + 1 >= count} onClick={() => onChange(page + 1)}>Next</button></div></div>;
}

function TransactionTable({ rows }: { rows: Transaction[] }) {
  return <div className="analytics-scroll"><table className="analytics-table"><thead><tr>{['Time', 'Employee', 'Activity', 'Order', 'Item', 'Qty / UOM', 'From → To', 'Task / Trip'].map(v => <th key={v} scope="col">{v}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{time(row.timestamp)}</td><th scope="row">{row.employee}</th><td><span className={`operation-badge activity-${row.activity}`}>{row.activity}</span></td><td>{row.order || '—'}</td><td>{row.item || '—'}</td><td>{[row.quantity, row.uom].filter(Boolean).join(' ') || '—'}</td><td>{row.from || '—'} → {row.to || '—'}</td><td>{[row.task, row.trip].filter(Boolean).join(' / ') || '—'}</td></tr>)}</tbody></table></div>;
}

function HourChart({ current, baseline }: { current: number[]; baseline?: number[] }) {
  const max = Math.max(1, ...current, ...(baseline ?? []));
  return <><div className="hour-chart" role="img" aria-label="Activity lines by hour. Current report in blue, comparison in gold. Exact counts follow below."><svg viewBox="0 0 840 180" aria-hidden="true">{[0, 0.5, 1].map(fraction => <g key={fraction}><line x1="36" x2="838" y1={145 - fraction * 120} y2={145 - fraction * 120} stroke="#e7edf5"/><text x="2" y={149 - fraction * 120} fill="#718096" fontSize="10">{Number((max * fraction).toFixed(1))}</text></g>)}{current.map((value, hour) => <g key={hour}><rect x={40 + hour * 33} y={145 - value / max * 120} width={baseline ? 11 : 22} height={value / max * 120} rx="2" fill="#245f96"/>{baseline && <rect x={53 + hour * 33} y={145 - baseline[hour] / max * 120} width="11" height={baseline[hour] / max * 120} rx="2" fill="#cbaa64"/>}<text x={44 + hour * 33} y="165" fontSize="10" fill="#718096">{String(hour).padStart(2, '0')}</text></g>)}</svg></div><details className="analytics-details"><summary>Exact hourly counts</summary><div className="analytics-scroll"><table className="analytics-table"><thead><tr><th>Report</th>{hours.map(hour => <th key={hour}>{hourLabel(hour)}</th>)}</tr></thead><tbody><tr><th>Current</th>{current.map((value, hour) => <td key={hour}>{n(value)}</td>)}</tr>{baseline && <tr><th>Comparison</th>{baseline.map((value, hour) => <td key={hour}>{n(value)}</td>)}</tr>}</tbody></table></div></details></>;
}

export default function Insights({ dataset, report, savedComparison, selectedEmployee, onEmployee }: { dataset: Dataset; report: Report; savedComparison?: { dataset: Dataset; date: string } | null; selectedEmployee: string | null; onEmployee: (employee: string | null) => void }) {
  const [comparison, setComparison] = useState<Dataset | null>(() => dataset.sample ? demoComparison(dataset) : null);
  const [comparisonImport, setComparisonImport] = useState<ImportResult | null>(null);
  const [comparisonDate, setComparisonDate] = useState('');
  const [comparisonSheet, setComparisonSheet] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importError, setImportError] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cellFocus = useRef<{ employee: string; hour: string; activity: Activity | 'ALL' } | null>(null);
  const [heatActivity, setHeatActivity] = useState<Activity | 'ALL'>('ALL');
  const [heatQuery, setHeatQuery] = useState('');
  const [heatPage, setHeatPage] = useState(0);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [field, setField] = useState<'ALL' | 'order' | 'item'>('ALL');
  const [lookupPage, setLookupPage] = useState(0);
  const [profileActivity, setProfileActivity] = useState<Activity | 'ALL'>('ALL');
  const [profileHour, setProfileHour] = useState('ALL');
  const [timelinePage, setTimelinePage] = useState(0);
  const [comparisonQuery, setComparisonQuery] = useState('');
  const [employeeComparisonPage, setEmployeeComparisonPage] = useState(0);
  const [localBaselineDate, setLocalBaselineDate] = useState('');

  const rows = useMemo(() => dataset.transactions.filter(row => row.date === report.date), [dataset, report.date]);
  const baseline = useMemo(() => comparison ? buildReport(comparison, comparisonDate || comparison.dates.at(-1)!) : localBaselineDate ? buildReport(dataset, localBaselineDate) : previousReport(dataset, report.date), [comparison, comparisonDate, dataset, report.date, localBaselineDate]);
  const baselineDataset = comparison ?? dataset;
  const baselineRows = useMemo(() => baseline ? baselineDataset.transactions.filter(row => row.date === baseline.date) : [], [baselineDataset, baseline]);
  const currentHourly = useMemo(() => hourlyActivity(rows), [rows]);
  const baselineHourly = useMemo(() => hourlyActivity(baselineRows), [baselineRows]);
  const comparisonRows = useMemo(() => baseline ? compareEmployees(report, baseline) : [], [report, baseline]);
  const filteredComparison = useMemo(() => comparisonRows.filter(row => row.employee.toLowerCase().includes(comparisonQuery.toLowerCase())), [comparisonRows, comparisonQuery]);
  const heatRows = useMemo(() => heatmapRows(rows, heatActivity), [rows, heatActivity]);
  const filteredHeat = useMemo(() => heatRows.filter(row => row.employee.toLowerCase().includes(heatQuery.toLowerCase())), [heatRows, heatQuery]);
  const heatMax = useMemo(() => { let max = 1; for (const row of heatRows) for (const count of row.hours) max = Math.max(max, count); return max; }, [heatRows]);
  const matches = useMemo(() => findTransactions(rows, deferredQuery, field), [rows, deferredQuery, field]);
  const profile = report.employees.find(row => row.employee === selectedEmployee);
  const employeeRows = useMemo(() => rows.filter(row => row.employee === selectedEmployee), [rows, selectedEmployee]);
  const profileHourly = useMemo(() => hourlyActivity(employeeRows), [employeeRows]);
  const timeline = useMemo(() => employeeRows.filter(row => (profileActivity === 'ALL' || row.activity === profileActivity) && (profileHour === 'ALL' || (row.timestamp !== null && new Date(row.timestamp).getUTCHours() === Number(profileHour)))).sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity)), [employeeRows, profileActivity, profileHour]);
  const employeeHistory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of dataset.transactions) if (row.employee === selectedEmployee) totals.set(row.date, (totals.get(row.date) ?? 0) + 1);
    return [...totals.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [dataset, selectedEmployee]);

  useEffect(() => {
    if (!savedComparison) return;
    setComparison(savedComparison.dataset); setComparisonDate(savedComparison.date);
    setComparisonImport(null); setComparisonSheet(savedComparison.dataset.sheet);
    setImportError(''); setEmployeeComparisonPage(0);
  }, [savedComparison]);

  useEffect(() => () => { workerRef.current?.terminate(); clearTimeout(timeoutRef.current); }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedEmployee && dialog && !dialog.open) dialog.showModal();
    if (!selectedEmployee && dialog?.open) dialog.close();
  }, [selectedEmployee]);
  useEffect(() => { const focus = cellFocus.current; setTimelinePage(0); setProfileActivity(focus?.employee === selectedEmployee ? focus.activity : 'ALL'); setProfileHour(focus?.employee === selectedEmployee ? focus.hour : 'ALL'); cellFocus.current = null; }, [selectedEmployee, report.date]);
  useEffect(() => { setHeatPage(0); setLookupPage(0); setEmployeeComparisonPage(0); }, [report.date]);

  async function uploadComparison(file?: File) {
    if (!file || uploading) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size > 20 * 1024 * 1024) { setImportError('Choose an Excel or CSV file up to 20 MB.'); return; }
    setImportError(''); setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await new Promise<ImportResult>((resolve, reject) => {
        const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        timeoutRef.current = setTimeout(() => reject(new Error('Reading took too long. Try a smaller report.')), 30000);
        worker.onmessage = event => event.data.ok ? resolve(event.data.result) : reject(new Error(event.data.error));
        worker.onerror = () => reject(new Error('Could not read this comparison file.'));
        worker.postMessage({ buffer, name: file.name }, [buffer]);
      });
      let accepted: Dataset | undefined; let lastError: unknown;
      for (const sheet of result.sheets) {
        try { accepted = parseRows(sheet.rows, result.source, sheet.name, result.date1904); break; } catch (error) { lastError = error; }
      }
      if (!accepted) throw lastError;
      setComparison(accepted); setComparisonImport(result); setComparisonSheet(accepted.sheet); setComparisonDate(accepted.dates.at(-1)!); setEmployeeComparisonPage(0);
    } catch (error) { setImportError(error instanceof Error ? error.message : 'No valid activity in this file.'); }
    finally { workerRef.current?.terminate(); workerRef.current = null; clearTimeout(timeoutRef.current); setUploading(false); }
  }
  function chooseComparisonSheet(name: string) {
    if (!comparisonImport) return;
    try {
      const sheet = comparisonImport.sheets.find(sheet => sheet.name === name)!;
      const data = parseRows(sheet.rows, comparisonImport.source, name, comparisonImport.date1904);
      setComparison(data); setComparisonSheet(name); setComparisonDate(data.dates.at(-1)!); setImportError(''); setEmployeeComparisonPage(0);
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Invalid worksheet.'); }
  }
  const delta = baseline ? change(report.total, baseline.total) : null;
  const profileTimes = employeeRows.filter(row => row.timestamp !== null).map(row => row.timestamp!);
  let first: number | null = null, last: number | null = null;
  for (const stamp of profileTimes) { first = first === null ? stamp : Math.min(first, stamp); last = last === null ? stamp : Math.max(last, stamp); }
  const lookupCounts = matches.reduce((counts, row) => { counts[row.activity]++; return counts; }, { PICK: 0, PUT: 0, RECEIPT: 0, REPLN: 0 });

  return <section className="shift-insights" id="shift-insights" aria-labelledby="shift-insights-title">
    <div className="analytics-title"><div><span className="eyebrow">EXPLORE YOUR SHIFT</span><h2 id="shift-insights-title">Shift intelligence</h2><p>Compare reports, follow activity and trace orders.</p></div><BarChart3 size={28}/></div>
    <section className="panel analytics-panel" aria-labelledby="comparison-title">
      <div className="analytics-heading"><div><h3 id="comparison-title">Compare reports</h3><p>Current: {formatDate(report.date)} · {dataset.source}</p></div><label className="button secondary upload-comparison"><Upload size={15}/>{uploading ? 'Reading…' : 'Upload comparison'}<input type="file" accept=".xlsx,.xls,.csv" aria-label="Upload comparison report" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; void uploadComparison(file); e.target.value = ''; }}/></label></div>
      <div className="analytics-controls">{comparisonImport && comparisonImport.sheets.length > 1 && <label>Comparison worksheet<select aria-label="Comparison worksheet" value={comparisonSheet} onChange={e => chooseComparisonSheet(e.target.value)}>{comparisonImport.sheets.map(sheet => <option key={sheet.name}>{sheet.name}</option>)}</select></label>}
        {(comparison || dataset.dates.length > 1) && <label>Comparison date<select aria-label="Comparison date" value={baseline?.date ?? ''} onChange={e => { comparison ? setComparisonDate(e.target.value) : setLocalBaselineDate(e.target.value); setEmployeeComparisonPage(0); }}><option value="" disabled>Select date</option>{baselineDataset.dates.map(date => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label>}
        {comparison && <button className="text-button" onClick={() => { setComparison(null); setComparisonImport(null); setComparisonDate(''); setLocalBaselineDate(''); }}>Remove comparison</button>}
        <span className="analytics-caption">{baseline ? `${formatDate(baseline.date)} · ${baselineDataset.source}${baselineDataset.sample ? ' · SAMPLE DATA' : ''}` : 'Upload another day, or import a file containing multiple dates.'}</span>
      </div>
      {importError && <p className="message error" role="alert">{importError}</p>}
      {baseline && delta && <><div className="comparison-summary" role="status">{delta.delta === 0 ? 'Both reports have the same total activity.' : `Current report has ${n(Math.abs(delta.delta))} ${delta.delta > 0 ? 'more' : 'fewer'} activity lines${delta.percent === null ? '' : ` (${Math.abs(delta.percent).toFixed(1)}%)`}.`} <span>Volume comparison; workloads and staffing may differ.</span></div>
        {baseline.date === report.date && <p className="analytics-caption">Both selections use the same calendar date. Compare sources rather than consecutive days.</p>}
        {dataset.sample !== baselineDataset.sample && <p className="message warning">You are comparing sample data with an imported report.</p>}
        <div className="comparison-metrics">{(['Total', ...ACTIVITIES] as const).map(activity => { const current = activity === 'Total' ? report.total : report.counts[activity]; const before = activity === 'Total' ? baseline.total : baseline.counts[activity]; const result = change(current, before); return <div key={activity}><span>{activity}</span><strong>{n(current)}</strong><small>vs {n(before)}</small><b className={result.delta > 0 ? 'delta-up' : result.delta < 0 ? 'delta-down' : ''}>{signed(result.delta)} · {percent(result.percent)}</b></div>; })}</div>
        <details className="analytics-details"><summary>Employee comparison · {comparisonRows.length} employees</summary><input className="analytics-search" aria-label="Search comparison employees" placeholder="Find an employee…" value={comparisonQuery} onChange={e => { setComparisonQuery(e.target.value); setEmployeeComparisonPage(0); }}/><div className="analytics-scroll"><table className="analytics-table"><thead><tr><th>Employee</th><th>Current total</th><th>Comparison total</th><th>Change</th>{ACTIVITIES.map(activity => <th key={activity}>{activity} change</th>)}<th>Presence</th></tr></thead><tbody>{filteredComparison.slice(employeeComparisonPage * 25, (employeeComparisonPage + 1) * 25).map(row => <tr key={row.employee}><th scope="row"><button className="employee-link" onClick={() => onEmployee(row.employee)}>{row.employee}</button></th><td>{n(row.current)}</td><td>{n(row.previous)}</td><td>{signed(row.delta)}</td>{ACTIVITIES.map(activity => <td key={activity}>{signed(row.currentCounts[activity] - row.previousCounts[activity])}</td>)}<td>{row.presence}</td></tr>)}</tbody></table></div><Pager page={employeeComparisonPage} total={filteredComparison.length} unit="employees" size={25} onChange={setEmployeeComparisonPage}/></details>
      </>}
    </section>
    <section className="panel analytics-panel" aria-labelledby="hour-title"><div className="analytics-heading"><div><h3 id="hour-title">Activity by hour</h3><p>All operations · {formatDate(report.date)} · source-file time</p></div><div className="chart-key"><span><i className="key-current"/>Current</span>{baseline && <span><i className="key-baseline"/>Comparison</span>}</div></div><HourChart current={currentHourly.hours} baseline={baseline ? baselineHourly.hours : undefined}/><p className="analytics-caption">{n(currentHourly.missing)} current lines without time{baseline ? `; ${n(baselineHourly.missing)} comparison lines without time` : ''}. These count in totals but cannot be placed on the chart.</p></section>
    <section className="panel analytics-panel" aria-labelledby="heat-title"><div className="analytics-heading"><div><h3 id="heat-title">Shift heatmap</h3><p>Lines per employee per hour. Select an employee or a cell to explore their day.</p></div></div><div className="analytics-controls"><label>Activity<select aria-label="Heatmap activity" value={heatActivity} onChange={e => { setHeatActivity(e.target.value as Activity | 'ALL'); setHeatPage(0); }}><option value="ALL">All operations</option>{ACTIVITIES.map(activity => <option key={activity}>{activity}</option>)}</select></label><label>Employee<input type="search" aria-label="Search heatmap employees" placeholder="Find an employee…" value={heatQuery} onChange={e => { setHeatQuery(e.target.value); setHeatPage(0); }}/></label><span className="heat-legend">Fewer <i/> More · max {n(heatMax)} lines/hour</span></div><div className="analytics-scroll"><table className="heat-table"><thead><tr><th scope="col">Employee</th>{hours.map(hour => <th key={hour} scope="col">{String(hour).padStart(2, '0')}</th>)}<th scope="col">No time</th><th scope="col">Total</th></tr></thead><tbody>{filteredHeat.slice(heatPage * 25, (heatPage + 1) * 25).map(row => <tr key={row.employee}><th scope="row"><button className="employee-link" onClick={() => onEmployee(row.employee)}>{row.employee}<ArrowUpRight size={12}/></button></th>{row.hours.map((count, hour) => <td key={hour}><button className="heat-cell" style={{ background: count ? `rgba(36,95,150,${0.13 + count / heatMax * 0.85})` : '#f2f5f9', color: count / heatMax > 0.5 ? '#fff' : '#24456a' } as CSSProperties} aria-label={`${row.employee}, ${hourLabel(hour)}, ${count} ${heatActivity === 'ALL' ? 'activity' : heatActivity} lines`} title={`${hourLabel(hour)} · ${count} lines`} onClick={() => { cellFocus.current = { employee: row.employee, hour: String(hour), activity: heatActivity }; onEmployee(row.employee); setProfileHour(String(hour)); setProfileActivity(heatActivity); setTimelinePage(0); }}>{count || '·'}</button></td>)}<td>{n(row.missing)}</td><td>{n(row.total)}</td></tr>)}</tbody></table></div>{!filteredHeat.length && <p className="analytics-empty">No employees match these filters.</p>}<Pager page={heatPage} total={filteredHeat.length} unit="employees" size={25} onChange={setHeatPage}/><p className="analytics-caption">Gaps mean no recorded operations for this filter, not proof of idle time.</p></section>
    <section className="panel analytics-panel" aria-labelledby="lookup-title"><div className="analytics-heading"><div><h3 id="lookup-title">Order & item lookup</h3><p>Trace operations within the selected day. Enter a full or partial identifier.</p></div><Search size={20}/></div><div className="analytics-controls"><label>Search in<select aria-label="Lookup field" value={field} onChange={e => { setField(e.target.value as typeof field); setLookupPage(0); }}><option value="ALL">Orders and items</option><option value="order">Order number</option><option value="item">Item number</option></select></label><label className="lookup-input">Order or item<input type="search" aria-label="Search orders or items" placeholder="e.g. D0 or DEMO-ITEM" value={query} onChange={e => { setQuery(e.target.value); setLookupPage(0); }}/></label></div>{!rows.some(row => row.order || row.item) && <p className="message warning">Order and item identifiers are not available in this report. Include Order No. and Item Number in your source export.</p>}{query.trim() ? <><div className="lookup-summary">{n(matches.length)} matching lines · {ACTIVITIES.map(activity => `${activity}: ${n(lookupCounts[activity])}`).join(' · ')}</div>{matches.length ? <TransactionTable rows={matches.slice(lookupPage * 25, (lookupPage + 1) * 25)}/> : <p className="analytics-empty">No orders or items match this search on {formatDate(report.date)}.</p>}<Pager page={lookupPage} total={matches.length} size={25} onChange={setLookupPage}/></> : <p className="analytics-empty">Search an order or item to see who handled it, when and where.</p>}</section>
    <dialog ref={dialogRef} className="employee-dialog" aria-labelledby="profile-title" onCancel={() => onEmployee(null)} onClose={() => onEmployee(null)}><div className="profile-header"><div><span className="eyebrow">EMPLOYEE ACTIVITY</span><h2 id="profile-title">{selectedEmployee}</h2><p>{formatDate(report.date)} · {dataset.source}</p></div><button aria-label="Close employee details" className="icon-button" onClick={() => onEmployee(null)}><X size={20}/></button></div><div className="profile-body">{profile ? <><div className="profile-metrics"><div><span>Total lines</span><strong>{n(profile.total)}</strong></div><div><span>PICK lines</span><strong>{n(profile.counts.PICK)}</strong></div><div><span>Pick span</span><strong>{formatDuration(profile.pickMinutes)}</strong></div><div><span>Lines / hour</span><strong>{profile.rate?.toFixed(2) ?? '—'}</strong></div></div><p className="analytics-caption"><Clock3 size={13}/> First recorded operation: {time(first)} · Last: {time(last)} · {n(profileHourly.missing)} lines without time. Pick span includes breaks.</p><HourChart current={profileHourly.hours}/></> : <p className="analytics-empty">No recorded activity for this employee in the current report on this date.</p>}<details className="analytics-details"><summary>History in current file · {employeeHistory.length} days</summary>{employeeHistory.length ? <table className="analytics-table"><thead><tr><th>Date</th><th>Total lines</th></tr></thead><tbody>{employeeHistory.map(([date, total]) => <tr key={date}><td>{formatDate(date)}</td><td>{n(total)}</td></tr>)}</tbody></table> : <p>No history for this employee in the current file.</p>}</details><h3 className="timeline-title">Operation timeline</h3><div className="analytics-controls"><label>Activity<select aria-label="Employee timeline activity" value={profileActivity} onChange={e => { setProfileActivity(e.target.value as Activity | 'ALL'); setTimelinePage(0); }}><option value="ALL">All operations</option>{ACTIVITIES.map(activity => <option key={activity}>{activity}</option>)}</select></label><label>Hour<select aria-label="Employee timeline hour" value={profileHour} onChange={e => { setProfileHour(e.target.value); setTimelinePage(0); }}><option value="ALL">All hours</option>{hours.map(hour => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label></div>{timeline.length ? <TransactionTable rows={timeline.slice(timelinePage * 25, (timelinePage + 1) * 25)}/> : <p className="analytics-empty">No operations for this selection.</p>}<Pager page={timelinePage} total={timeline.length} size={25} onChange={setTimelinePage}/><p className="analytics-caption">Operations are sorted by source time. Unknown times appear last. Duplicate source rows remain separate lines.</p></div></dialog>
  </section>;
}
