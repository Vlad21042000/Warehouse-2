import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createDemo } from '../src/report';
import { parseSnapshot, snapshotForDay, snapshotFingerprint } from '../src/cloud';

test('saved snapshots preserve one day and reject corrupt transactions', async () => {
  const demo = createDemo();
  const day = demo.dates[0];
  const snapshot = snapshotForDay(demo, day);
  assert.equal(snapshot.dataset.transactions.length, demo.transactions.filter(row => row.date === day).length);
  assert.deepEqual(snapshot.dataset.dates, [day]);
  assert.equal(await snapshotFingerprint(snapshot), await snapshotFingerprint(parseSnapshot(snapshot, day)));
  assert.throws(() => snapshotForDay(demo, '2026-99-99'), /valid report date/);
  const corrupt = structuredClone(snapshot);
  corrupt.dataset.transactions[0].timestamp = Date.parse(day + 'T00:00:00Z') - 1;
  assert.throws(() => parseSnapshot(corrupt, day), /invalid transactions/);
  corrupt.dataset.transactions[0].timestamp = null;
  corrupt.dataset.transactions[0].employee = 'JDEJOBS';
  assert.throws(() => parseSnapshot(corrupt, day), /invalid transactions/);
});

test('Postgres enforces account isolation and trusted owner read access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), email_confirmed_at timestamptz, last_sign_in_at timestamptz);
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.jwt(), auth.uid() to authenticated, anon;
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())', [a,'a@example.test',b,'b@example.test']);
    async function identity(id: string, extra: object = {}) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:id,...extra})]);
      await db.exec('set role authenticated');
    }
    async function count(table: string) {
      return (await db.query<{n:number}>(`select count(*)::int as n from public.${table}`)).rows[0].n;
    }
    const demo = createDemo(); const day = demo.dates[0];
    const snapshot = snapshotForDay(demo, day);
    const fingerprint = await snapshotFingerprint(snapshot);
    const insert = 'insert into public.warehouse_reports(user_id,title,report_date,source,fingerprint,payload) values($1,$2,$3,$4,$5,$6) returning id,total_lines,pick_lines';
    const values = (id: string) => [id,'Daily report',day,demo.source,fingerprint,JSON.stringify(snapshot)];
    await identity(a);
    const saved = (await db.query<{id:string;total_lines:number;pick_lines:number}>(insert, values(a))).rows[0];
    assert.equal(saved.total_lines, snapshot.dataset.transactions.length);
    assert.equal(saved.pick_lines, snapshot.dataset.transactions.filter(row => row.activity === 'PICK').length);
    assert.equal(await count('warehouse_profiles'), 1);
    await assert.rejects(db.query(insert, values(b)), /row-level security/);
    await identity(b, {user_metadata:{warehouse_role:'owner'}});
    assert.equal(await count('warehouse_reports'), 0);
    assert.equal(await count('warehouse_profiles'), 1);
    assert.equal((await db.query('update public.warehouse_reports set archived_at=now() where id=$1 returning id',[saved.id])).rows.length, 0);
    await db.query(insert, values(b));
    await assert.rejects(db.exec("update public.warehouse_profiles set email='changed@example.test'"), /permission denied/);
    await assert.rejects(db.exec('select public.warehouse_sync_profile()'), /permission denied/);
    await identity(a, {app_metadata:{warehouse_role:'owner'}});
    assert.equal(await count('warehouse_profiles'), 2);
    assert.equal(await count('warehouse_reports'), 2);
    assert.equal((await db.query('update public.warehouse_reports set archived_at=now() where user_id=$1 returning id',[b])).rows.length, 0);
    await db.query('update public.warehouse_reports set archived_at=now() where id=$1',[saved.id]);
    await db.query('update public.warehouse_reports set archived_at=null where id=$1',[saved.id]);
    await assert.rejects(db.exec('delete from public.warehouse_reports'), /permission denied/);
    const corrupt = structuredClone(snapshot); corrupt.dataset.transactions[0].employee = 'JDEJOBS';
    await assert.rejects(db.query(insert,[a,'Bad report',day,demo.source,'a'.repeat(64),JSON.stringify(corrupt)]), /check constraint/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select * from public.warehouse_reports'), /permission denied/);
  } finally { await db.close(); }
});
