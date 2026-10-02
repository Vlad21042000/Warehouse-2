import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Trophy } from 'lucide-react';
import { formatDuration, type Employee } from './report';
import TableSettings from './TableSettings';
import { COLUMN_LABELS, METRIC_COLUMNS, TABLE_KEY, columnValue, readTablePreferences, sortEmployees, visibleColumns, type TableColumn, type TablePreferences } from './tablePreferences';
const n = (value: number) => value.toLocaleString('en-CA');
export default function ReportTable({employees,onEmployee}: {employees: Employee[]; onEmployee: (employee: string)=>void}) {
  const [settings,setSettings] = useState<TablePreferences>(()=>{try {return readTablePreferences(localStorage.getItem(TABLE_KEY));} catch {return readTablePreferences(null);}});
  useEffect(()=>{try {localStorage.setItem(TABLE_KEY,JSON.stringify(settings));} catch { /* Display choices still work without browser storage. */ }},[settings]);
  const columns = visibleColumns(settings);
  const sorted = useMemo(()=>sortEmployees(employees,settings.sort),[employees,settings.sort]);
  const totals = employees.reduce((sum,employee)=>{for(const key of ['PICK','PUT','REPLN','RECEIPT'] as const) sum[key]+=employee.counts[key]; sum.total+=employee.total; return sum;},{PICK:0,PUT:0,REPLN:0,RECEIPT:0,total:0});
  function changeSort(column: TableColumn) {setSettings(value=>({...value,sort:{column,direction:value.sort.column===column ? value.sort.direction==='asc' ? 'desc' : 'asc' : column==='employee' || column==='rank' ? 'asc' : 'desc'}}));}
  function cell(employee: Employee, column: TableColumn) {
    if (column === 'rank') return <span className="rank-number">{employee.rank===1 && !employee.isSystem && <Trophy size={14} aria-hidden="true"/>}{employee.isSystem ? '—' : employee.rank}</span>;
    if (column === 'employee') return <span className="employee-name"><span className="avatar" aria-hidden="true">{employee.employee.replace(/[^A-Z]/g,'').slice(0,2)}</span><button className="employee-link" onClick={()=>onEmployee(employee.employee)} aria-label={`View ${employee.employee} activity`}>{employee.employee}</button>{employee.isSystem && <span className="system-account-label">(System)</span>}</span>;
    if (column === 'pickTime') return formatDuration(employee.pickMinutes);
    if (column === 'rate') return employee.rate?.toFixed(2) ?? '—';
    return n(Number(columnValue(employee,column)));
  }
  function footer(column: TableColumn) {return column==='employee' ? 'Displayed total' : column==='rank' ? '' : column==='rate' || column==='pickTime' ? '—' : n(totals[column]);}
  return <>
    <div className="table-custom-toolbar"><label>Sort by<select aria-label="Sort table by" value={settings.sort.column} onChange={event=>changeSort(event.target.value as TableColumn)}>{(['rank','employee',...METRIC_COLUMNS] as TableColumn[]).map(key=><option key={key} value={key}>{COLUMN_LABELS[key]}</option>)}</select></label><button className="topbar-icon" aria-label={settings.sort.direction==='asc' ? 'Sort descending' : 'Sort ascending'} onClick={()=>setSettings(value=>({...value,sort:{...value.sort,direction:value.sort.direction==='asc' ? 'desc' : 'asc'}}))}>{settings.sort.direction==='asc' ? <ArrowUp size={17}/> : <ArrowDown size={17}/>}</button><TableSettings settings={settings} onChange={setSettings}/></div>
    <div className="table-scroll report-table-scroll" tabIndex={0} role="region" aria-label="Employee activity table" aria-describedby="screen-table-help">
      <table className={`employee-table screen-table density-${settings.density}${settings.pinEmployee ? ' pin-employee' : ''}${columns.includes('rank') ? ' show-rank' : ''}`}>
        <caption className="visually-hidden">Daily employee activity. Systems are listed after people. Rank is based on total daily activity.</caption>
        <thead><tr>{columns.map(column=><th key={column} scope="col" data-column={column} aria-sort={settings.sort.column===column ? settings.sort.direction==='asc' ? 'ascending' : 'descending' : undefined}><button className="column-sort-button" onClick={()=>changeSort(column)} aria-label={`Sort by ${COLUMN_LABELS[column]}`}>{column==='rate' ? <abbr title="Pick lines divided by elapsed time between first and last pick">L/Hr</abbr> : COLUMN_LABELS[column]}{settings.sort.column===column ? settings.sort.direction==='asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/> : <ArrowUpDown size={12}/>}</button></th>)}</tr></thead>
        <tbody>{sorted.map((employee,index)=><tr key={employee.employee} className={`rank-${employee.rank}${employee.isSystem ? ' system-account' : ''}${employee.isSystem && !sorted[index-1]?.isSystem ? ' system-first' : ''}`}>
          {columns.map(column=>column==='employee' ? <th key={column} scope="row" data-column={column}>{cell(employee,column)}</th> : <td key={column} data-column={column}>{cell(employee,column)}</td>)}
        </tr>)}</tbody>
        {!!employees.length && <tfoot><tr>{columns.map(column=>column==='employee' ? <th key={column} scope="row" data-column={column}>{footer(column)}</th> : <td key={column} data-column={column}>{footer(column)}</td>)}</tr></tfoot>}
      </table>
    </div>
    <p id="screen-table-help" className="table-sort-note">Click a column heading to sort. Rank stays based on daily totals; system accounts stay at the bottom.</p>
  </>;
}
