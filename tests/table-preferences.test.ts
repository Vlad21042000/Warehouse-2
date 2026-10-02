import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COLUMN_LABELS, METRIC_COLUMNS, defaultTablePreferences, moveMetric, readTablePreferences, sortEmployees, visibleColumns } from '../src/tablePreferences';
import { buildReport, createDemo, type Employee } from '../src/report';
import PrintReport from '../src/PrintReport';

test('table preferences repair invalid storage, keep names visible and complete the column order', () => {
  for (const raw of [null,'null','{bad','42']) assert.deepEqual(readTablePreferences(raw),defaultTablePreferences());
  const repaired = readTablePreferences('{"hidden":["employee","PICK","PICK","unknown"],"order":["RECEIPT","RECEIPT","unknown"],"density":"large","pinEmployee":false,"sort":{"column":"unknown","direction":"desc"}}');
  assert.deepEqual(repaired.hidden,['PICK']);
  assert.equal(repaired.order[0],'RECEIPT');
  assert.equal(new Set(repaired.order).size,METRIC_COLUMNS.length);
  assert.ok(visibleColumns(repaired).includes('employee'));
  assert.equal(repaired.sort.column,'rank');
  assert.equal(repaired.pinEmployee,false);
  assert.deepEqual(readTablePreferences(JSON.stringify(repaired)),repaired);
});
const employee = (name: string, picks: number, rank: number, system=false, rate: number | null=2): Employee => ({employee:name,counts:{PICK:picks,PUT:0,REPLN:0,RECEIPT:0},total:picks,pickMinutes:rate===null ? null : 30,rate,rank,isSystem:system});
test('every sort keeps systems below humans, preserves rank and does not mutate the daily report', () => {
  const employees = [employee('B',5,2),employee('SYS',10000,0,true),employee('A',10,1),employee('C',1,3)];
  const original = JSON.stringify(employees);
  for (const column of ['rank','employee',...METRIC_COLUMNS] as const) for (const direction of ['asc','desc'] as const) {
    const sorted = sortEmployees(employees,{column,direction});
    assert.equal(sorted.at(-1)?.employee,'SYS');
    assert.equal(sorted.find(row=>row.employee==='A')?.rank,1);
  }
  assert.deepEqual(sortEmployees(employees,{column:'PICK',direction:'desc'}).map(row=>row.employee),['A','B','C','SYS']);
  assert.equal(JSON.stringify(employees),original);
});
test('missing picking durations and rates sort last in both directions', () => {
  const employees = [employee('Missing',4,1,false,null),employee('Timed',2,2,false,3),employee('System',999,0,true,null)];
  for (const column of ['rate','pickTime'] as const) for (const direction of ['asc','desc'] as const) assert.deepEqual(sortEmployees(employees,{column,direction}).map(row=>row.employee),['Timed','Missing','System']);
});
test('moving columns is immutable, bounded and retains hidden-column positions', () => {
  const order = [...METRIC_COLUMNS];
  assert.deepEqual(moveMetric(order,'PICK',-1),order);
  assert.deepEqual(moveMetric(order,'total',1),order);
  const moved = moveMetric(order,'RECEIPT',-1);
  assert.equal(moved[4],'RECEIPT'); assert.deepEqual(order,[...METRIC_COLUMNS]);
  const settings = {...defaultTablePreferences(),order:moved,hidden:['rank','pickTime'] as const};
  assert.deepEqual(visibleColumns({...settings,hidden:[...settings.hidden]}),['employee','PICK','rate','PUT','RECEIPT','REPLN','total']);
});
test('screen customization cannot change printed columns, ranks, rows or totals', () => {
  const dataset = createDemo(); const report = buildReport(dataset,dataset.dates.at(-1)!);
  const before = renderToStaticMarkup(createElement(PrintReport,{dataset,report,paper:'Letter'}));
  const custom = readTablePreferences('{"hidden":["rank","PICK","rate","pickTime"],"order":["total","RECEIPT"],"sort":{"column":"RECEIPT","direction":"desc"},"density":"compact"}');
  sortEmployees(report.employees,custom.sort); visibleColumns(custom);
  assert.equal(renderToStaticMarkup(createElement(PrintReport,{dataset,report,paper:'Letter'})),before);
  for (const label of Object.values(COLUMN_LABELS)) assert.ok(before.includes(label));
});
