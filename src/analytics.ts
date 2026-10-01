import { buildReport, emptyCounts, type Activity, type Dataset, type Report, type Transaction } from './report';

export function hourlyActivity(rows: Transaction[], activity: Activity | 'ALL' = 'ALL') {
  const hours = Array<number>(24).fill(0);
  let missing = 0;
  for (const row of rows) {
    if (activity !== 'ALL' && row.activity !== activity) continue;
    if (row.timestamp === null) missing++;
    else hours[new Date(row.timestamp).getUTCHours()]++;
  }
  return { hours, missing };
}

export function heatmapRows(rows: Transaction[], activity: Activity | 'ALL' = 'ALL') {
  const groups = new Map<string, { employee: string; hours: number[]; missing: number; total: number }>();
  for (const row of rows) {
    if (activity !== 'ALL' && row.activity !== activity) continue;
    let group = groups.get(row.employee);
    if (!group) {
      group = { employee: row.employee, hours: Array<number>(24).fill(0), missing: 0, total: 0 };
      groups.set(row.employee, group);
    }
    group.total++;
    if (row.timestamp === null) group.missing++;
    else group.hours[new Date(row.timestamp).getUTCHours()]++;
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.employee.localeCompare(b.employee));
}

export function change(current: number, previous: number) {
  return { delta: current - previous, percent: previous === 0 ? null : ((current - previous) / previous) * 100 };
}

export function compareEmployees(current: Report, previous: Report) {
  const currentMap = new Map(current.employees.map(e => [e.employee, e]));
  const previousMap = new Map(previous.employees.map(e => [e.employee, e]));
  return [...new Set([...currentMap.keys(), ...previousMap.keys()])].map(employee => {
    const now = currentMap.get(employee), before = previousMap.get(employee);
    return { employee, current: now?.total ?? 0, previous: before?.total ?? 0,
      currentCounts: now?.counts ?? emptyCounts(), previousCounts: before?.counts ?? emptyCounts(),
      ...change(now?.total ?? 0, before?.total ?? 0),
      presence: !before ? 'New in current report' : !now ? 'Only in comparison report' : 'Both reports' };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.employee.localeCompare(b.employee));
}

export function findTransactions(rows: Transaction[], query: string, field: 'ALL' | 'order' | 'item' = 'ALL') {
  const search = query.trim().toLowerCase();
  if (!search) return [];
  return rows.filter(row => (field === 'ALL' ? [row.order, row.item] : [row[field]])
    .some(value => value?.toLowerCase().includes(search)));
}

export function demoComparison(dataset: Dataset): Dataset {
  const date = '2026-09-17';
  return { ...dataset, source: 'Sample previous day', dates: [date],
    transactions: dataset.transactions.filter((_, index) => index % 5 !== 0).map(row => ({
      ...row, date, timestamp: row.timestamp === null ? null : row.timestamp - 86400000,
    })), sample: true };
}

export function previousReport(dataset: Dataset, currentDate: string) {
  const date = dataset.dates.filter(date => date < currentDate).at(-1);
  return date ? buildReport(dataset, date) : null;
}
