import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCalendarMonth, localMonth, monthCells, moveMonth } from '../src/calendar';
import PrintReport from '../src/PrintReport';
import ReportCalendar from '../src/ReportCalendar';
import { buildReport, createDemo } from '../src/report';

test('calendar handles leap years, year boundaries and local calendar months', () => {
  assert.equal(moveMonth('2026-12',1),'2027-01');
  assert.equal(moveMonth('2027-01',-1),'2026-12');
  assert.equal(monthCells('2028-02').filter(Boolean).length,29);
  assert.equal(monthCells('2021-02').length,28);
  assert.equal(monthCells('2026-10')[3],'2026-10-01');
  assert.equal(localMonth(new Date(2026,8,30,23,59)), '2026-09');
});
function mockClient() {
  const calls: {name: string; args: unknown[]}[][] = [];
  const client = { from: () => {
    const log: {name:string; args:unknown[]}[] = []; calls.push(log);
    const index = calls.length - 1;
    const result = { data: index === 0 ? Array.from({length:500}, () => ({report_date:'2026-09-25',total_lines:3})) : [{report_date:'2026-09-26',total_lines:7}], error:null, count:501 };
    const query: Record<string, unknown> = {then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)};
    for (const name of ['select','gte','lt','order','range','abortSignal','not','is','eq']) query[name] = (...args: unknown[]) => {log.push({name,args}); return query;};
    return query;
  }} as unknown as SupabaseClient;
  return {client,calls};
}
test('calendar paginates beyond history cards and applies private user/month/archive filters', async () => {
  const {client,calls} = mockClient();
  const days = await loadCalendarMonth(client,'2026-09',{userId:'user-a',ownerView:false,ownerUser:'user-b',archived:false},new AbortController().signal);
  assert.deepEqual(days, {'2026-09-25':{reports:500,lines:1500},'2026-09-26':{reports:1,lines:7}});
  assert.equal(calls.length,2);
  for (const call of calls) {
    assert.ok(call.some(item => item.name === 'eq' && item.args[0] === 'user_id' && item.args[1] === 'user-a'));
    assert.ok(call.some(item => item.name === 'gte' && item.args[1] === '2026-09-01'));
    assert.ok(call.some(item => item.name === 'lt' && item.args[1] === '2026-10-01'));
    assert.ok(call.some(item => item.name === 'is' && item.args[0] === 'archived_at'));
  }
  assert.deepEqual(calls[1].find(item=>item.name === 'range')?.args,[500,999]);
});
test('owner calendar respects selected account and archive; cancelled requests never load', async () => {
  const {client,calls} = mockClient();
  await loadCalendarMonth(client,'2026-09',{userId:'owner',ownerView:true,ownerUser:'user-b',archived:true},new AbortController().signal);
  assert.ok(calls[0].some(item=>item.name === 'eq' && item.args[1] === 'user-b'));
  assert.ok(calls[0].some(item=>item.name === 'not' && item.args[0] === 'archived_at'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadCalendarMonth(client,'2026-09',{userId:'owner',ownerView:true,ownerUser:'',archived:false},controller.signal));
  assert.equal(calls.length,2);
});
test('calendar exposes report counts and selected date through accessible day buttons', () => {
  const html = renderToStaticMarkup(createElement(ReportCalendar,{month:'2026-09',days:{'2026-09-25':{reports:2,lines:90}},selectedDay:'2026-09-25',loading:false,error:'',onMonth:()=>{},onDay:()=>{},onRetry:()=>{}}));
  assert.match(html,/Sep 25, 2026, 2 saved reports/);
  assert.match(html,/aria-pressed="true"/);
  assert.match(html,/2 reports · 1 days · 90 activity lines/);
});
test('shared preview/print component retains all ranked rows, totals and the chosen paper dimensions', () => {
  const dataset = createDemo(); const report = buildReport(dataset,dataset.dates.at(-1)!);
  for (const paper of ['Letter','A4'] as const) {
    const html = renderToStaticMarkup(createElement(PrintReport,{report,dataset,paper}));
    for (const employee of report.employees) assert.ok(html.includes(employee.employee));
    assert.match(html,/Team total/); assert.match(html,/SAMPLE DATA/);
    assert.ok(html.includes(paper === 'Letter' ? '--report-width:8in' : '--report-width:7.77in'));
  }
});
