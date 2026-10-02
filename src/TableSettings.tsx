import { useRef } from 'react';
import { ArrowDown, ArrowUp, Settings2, X } from 'lucide-react';
import { COLUMN_LABELS, defaultTablePreferences, moveMetric, type TableColumn, type TablePreferences } from './tablePreferences';
type Props = { settings: TablePreferences; onChange: (value: TablePreferences) => void };
export default function TableSettings({settings,onChange}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  function toggle(column: TableColumn) { onChange({...settings,hidden:settings.hidden.includes(column) ? settings.hidden.filter(key=>key !== column) : [...settings.hidden,column]}); }
  return <>
    <button className="button secondary" onClick={() => dialog.current?.showModal()}><Settings2 size={16}/>Table settings</button>
    <dialog ref={dialog} className="table-settings-dialog" aria-labelledby="table-settings-title">
      <div className="table-settings-heading"><div><h2 id="table-settings-title">Set up your table</h2><p>Your choices are remembered on this browser.</p></div><button className="icon-button" aria-label="Close table settings" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
      <div className="table-settings-body">
        <fieldset className="table-display-options"><legend>Display</legend><label>Row size<select aria-label="Table row size" value={settings.density} onChange={event => onChange({...settings,density:event.target.value as TablePreferences['density']})}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="large">Large</option></select></label><label className="table-setting-check"><input type="checkbox" checked={settings.pinEmployee} onChange={event => onChange({...settings,pinEmployee:event.target.checked})}/>Keep employee names visible while scrolling</label></fieldset>
        <fieldset className="table-column-options"><legend>Visible columns & order</legend><p>Employee names stay before the metrics. Move the metrics closer to the name with the arrows.</p>
          <div className="table-column-row"><label><input type="checkbox" checked={!settings.hidden.includes('rank')} onChange={()=>toggle('rank')}/>Rank</label><span className="table-fixed-label">First column</span></div>
          <div className="table-column-row"><label><input type="checkbox" checked disabled/>Employee</label><span className="table-fixed-label">Always visible</span></div>
          {settings.order.map((column,index) => <div className="table-column-row" key={column}><label><input type="checkbox" checked={!settings.hidden.includes(column)} onChange={()=>toggle(column)}/>{COLUMN_LABELS[column]}</label><div><button className="topbar-icon" aria-label={`Move ${COLUMN_LABELS[column]} up`} disabled={index===0} onClick={()=>onChange({...settings,order:moveMetric(settings.order,column,-1)})}><ArrowUp size={16}/></button><button className="topbar-icon" aria-label={`Move ${COLUMN_LABELS[column]} down`} disabled={index===settings.order.length-1} onClick={()=>onChange({...settings,order:moveMetric(settings.order,column,1)})}><ArrowDown size={16}/></button></div></div>)}
        </fieldset>
        <p className="table-settings-note">This customizes the screen table. Print preview, PDF and Excel keep the complete daily report and its original column order.</p>
      </div>
      <div className="table-settings-footer"><button className="text-button" onClick={()=>onChange(defaultTablePreferences())}>Reset defaults</button><button className="button primary" onClick={()=>dialog.current?.close()}>Done</button></div>
    </dialog>
  </>;
}
