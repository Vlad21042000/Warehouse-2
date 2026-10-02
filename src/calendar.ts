import type { SupabaseClient } from '@supabase/supabase-js';
import { CLOUD_TABLE } from './cloud';
export type CalendarDay = { reports: number; lines: number };
export type CalendarScope = { userId: string; ownerView: boolean; ownerUser: string; archived: boolean };
export const localMonth = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export function moveMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
export function monthCells(month: string): (string | null)[] {
  const [year, number] = month.split('-').map(Number);
  const leading = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells: (string | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= count; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
// Fetch only month metadata, independently of the 25-card history page. RLS remains in force.
export async function loadCalendarMonth(client: SupabaseClient, month: string, scope: CalendarScope, signal: AbortSignal): Promise<Record<string, CalendarDay>> {
  const days: Record<string, CalendarDay> = {};
  for (let offset = 0; ; ) {
    if (signal.aborted) throw new Error('Calendar request cancelled.');
    let query = client.from(CLOUD_TABLE).select('report_date,total_lines', { count: 'exact' })
      .gte('report_date', `${month}-01`).lt('report_date', `${moveMonth(month, 1)}-01`)
      .order('report_date').order('id').range(offset, offset + 499).abortSignal(signal);
    query = scope.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
    if (!scope.ownerView) query = query.eq('user_id', scope.userId);
    else if (scope.ownerUser) query = query.eq('user_id', scope.ownerUser);
    const { data, error, count } = await query;
    if (error) throw error;
    for (const row of data ?? []) {
      const day = days[row.report_date] ??= { reports: 0, lines: 0 };
      day.reports++; day.lines += Number(row.total_lines);
    }
    offset += data?.length ?? 0;
    if (!data?.length || (count !== null ? offset >= count : data.length < 500)) return days;
  }
}
