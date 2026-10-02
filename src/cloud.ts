import { createClient } from '@supabase/supabase-js';
import { ACTIVITIES, type Dataset, type Transaction } from './report';

const env = import.meta.env ?? {};
export const cloud = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'warehouse-auth-v1' },
    }) : null;
export const CLOUD_TABLE = 'warehouse_reports';
export type SavedReport = {
  id: string; user_id: string; title: string; report_date: string; source: string;
  created_at: string; archived_at: string | null; total_lines: number;
  pick_lines: number; put_lines: number; receipt_lines: number; repln_lines: number;
};
export type CloudSnapshot = { version: 1; dataset: Dataset };
const optionalFields = ['order', 'item', 'task', 'trip', 'from', 'to', 'quantity', 'uom'] as const;
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

// Save one selected day, retaining its operations for charts, timelines and lookup.
export function snapshotForDay(dataset: Dataset, date: string): CloudSnapshot {
  if (!validDate(date)) throw new Error('Choose a valid report date.');
  const rows = dataset.transactions.filter(row => row.date === date);
  if (!rows.length) throw new Error('There are no activity lines on this date.');
  const snapshot: CloudSnapshot = { version: 1, dataset: {
    transactions: rows, dates: [date], source: dataset.source, sheet: dataset.sheet, sample: dataset.sample,
    audit: { sourceRows: rows.length, included: rows.length, excluded: 0, unsupported: 0, invalid: 0, missingTime: rows.filter(row => row.timestamp === null).length },
  } };
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_SNAPSHOT_BYTES) throw new Error('This day exceeds the 10 MB cloud limit. Save a smaller report.');
  return parseSnapshot(snapshot, date);
}

export function parseSnapshot(value: unknown, date: string): CloudSnapshot {
  if (!validDate(date) || !value || typeof value !== 'object') throw new Error('Invalid saved report.');
  const input = value as Partial<CloudSnapshot>;
  const data = input.dataset;
  if (input.version !== 1 || !data || !Array.isArray(data.transactions) || !data.transactions.length || data.transactions.length > 200000 || typeof data.source !== 'string' || data.source.length > 500 || typeof data.sheet !== 'string' || data.sheet.length > 200 || typeof data.sample !== 'boolean') throw new Error('This saved report is not supported.');
  const start = Date.parse(date + 'T00:00:00Z');
  const rows: Transaction[] = data.transactions.map(raw => {
    if (!raw || typeof raw !== 'object' || !(ACTIVITIES as readonly string[]).includes(raw.activity) || typeof raw.employee !== 'string' || !raw.employee.trim() || raw.employee.length > 200 || raw.date !== date || (raw.timestamp !== null && (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp) || raw.timestamp < start || raw.timestamp >= start + 86400000))) throw new Error('The saved report contains invalid transactions.');
    const row: Transaction = { activity: raw.activity, employee: raw.employee, date, timestamp: raw.timestamp };
    for (const field of optionalFields) {
      if (raw[field] !== undefined && (typeof raw[field] !== 'string' || raw[field]!.length > 1000)) throw new Error('Invalid saved transaction details.');
      if (raw[field] !== undefined) row[field] = raw[field];
    }
    return row;
  });
  return { version: 1, dataset: { transactions: rows, source: data.source, sheet: data.sheet, sample: data.sample, dates: [date], audit: { sourceRows: rows.length, included: rows.length, excluded: 0, unsupported: 0, invalid: 0, missingTime: rows.filter(row => row.timestamp === null).length } } };
}

export async function snapshotFingerprint(snapshot: CloudSnapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
