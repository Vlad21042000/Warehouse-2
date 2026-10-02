import type { Employee } from './report';
export const TABLE_KEY = 'warehouse-table-v1';
export const METRIC_COLUMNS = ['PICK', 'pickTime', 'rate', 'PUT', 'REPLN', 'RECEIPT', 'total'] as const;
export type MetricColumn = typeof METRIC_COLUMNS[number];
export type TableColumn = 'rank' | 'employee' | MetricColumn;
export type TablePreferences = {hidden: TableColumn[]; order: MetricColumn[]; density: 'comfortable' | 'compact' | 'large'; pinEmployee: boolean; sort: {column: TableColumn; direction: 'asc' | 'desc'}};
export const COLUMN_LABELS: Record<TableColumn,string> = {rank:'Rank',employee:'Employee',PICK:'PICK',pickTime:'Pick time',rate:'L/Hr',PUT:'PUT',REPLN:'REPLN',RECEIPT:'RECEIPT',total:'Total'};
const allColumns = ['rank','employee',...METRIC_COLUMNS] as const;
export const defaultTablePreferences = (): TablePreferences => ({hidden:[],order:[...METRIC_COLUMNS],density:'comfortable',pinEmployee:true,sort:{column:'rank',direction:'asc'}});
export function readTablePreferences(raw: string | null): TablePreferences {
  const defaults = defaultTablePreferences();
  try {
    const value = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object') return defaults;
    const order = Array.isArray(value.order) ? value.order.filter((key: unknown): key is MetricColumn => METRIC_COLUMNS.includes(key as MetricColumn)) : [];
    return {
      hidden: Array.isArray(value.hidden) ? [...new Set<TableColumn>(value.hidden.filter((key: unknown) => key !== 'employee' && allColumns.includes(key as TableColumn)))] : [],
      order: [...new Set<MetricColumn>([...order,...METRIC_COLUMNS])],
      density: value.density === 'compact' || value.density === 'large' ? value.density : defaults.density,
      pinEmployee: typeof value.pinEmployee === 'boolean' ? value.pinEmployee : defaults.pinEmployee,
      sort: {column: allColumns.includes(value.sort?.column) ? value.sort.column : 'rank',direction:value.sort?.direction === 'desc' ? 'desc' : 'asc'},
    };
  } catch { return defaults; }
}
export const visibleColumns = (settings: TablePreferences): TableColumn[] => (['rank','employee',...settings.order] as TableColumn[]).filter(key => !settings.hidden.includes(key) || key === 'employee');
export function columnValue(employee: Employee, column: TableColumn): string | number | null {
  if (column === 'employee') return employee.employee;
  if (column === 'rank') return employee.rank;
  if (column === 'total') return employee.total;
  if (column === 'pickTime') return employee.pickMinutes;
  if (column === 'rate') return employee.rate;
  return employee.counts[column];
}
export function sortEmployees(employees: Employee[], sort: TablePreferences['sort']): Employee[] {
  return [...employees].sort((a,b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    const av = columnValue(a,sort.column), bv = columnValue(b,sort.column);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const difference = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av ?? 0) - Number(bv ?? 0);
    return (sort.direction === 'asc' ? difference : -difference) || a.rank - b.rank || a.employee.localeCompare(b.employee);
  });
}
export function moveMetric(order: MetricColumn[], key: MetricColumn, direction: -1 | 1): MetricColumn[] {
  const next = [...order], index = next.indexOf(key), target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index],next[target]] = [next[target],next[index]];
  return next;
}
