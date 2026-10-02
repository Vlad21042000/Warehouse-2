import { Archive, CalendarDays, FileSpreadsheet } from 'lucide-react';
import type { SavedReport } from './cloud';
import { formatDate } from './report';

type Props = { reports: SavedReport[]; selected: string[]; busy: boolean; canCompare: boolean; userId: string; archived: boolean; ownerView: boolean; emails: Map<string,string>; onSelect: (id: string) => void; onOpen: (id: string) => void; onCompare: (id: string) => void; onArchive: (id: string) => void };
export default function ReportCards({ reports, selected, busy, canCompare, userId, archived, ownerView, emails, onSelect, onOpen, onCompare, onArchive }: Props) {
  return <div className="report-card-grid">{reports.map(report => <article className={`saved-report-card ${selected.includes(report.id) ? 'is-selected' : ''}`} key={report.id} aria-label={report.title}>
    <div className="saved-report-top"><span className="report-file-icon"><FileSpreadsheet size={21}/></span><label className="report-select"><input type="checkbox" aria-label={`Select ${report.title}`} checked={selected.includes(report.id)} disabled={busy || (!selected.includes(report.id) && selected.length >= 2)} onChange={() => onSelect(report.id)}/>Compare</label></div>
    <h4>{report.title}</h4><p className="saved-report-date"><CalendarDays size={14}/>{formatDate(report.report_date)}{archived && <span className="count-badge">Archived</span>}</p>
    <p className="saved-report-source" title={report.source}>{report.source}</p>{ownerView && <p className="saved-report-source">{emails.get(report.user_id) ?? report.user_id}</p>}
    <div className="saved-report-total"><strong>{report.total_lines.toLocaleString()}</strong><span>activity lines</span></div>
    <div className="saved-report-operations">{([['PICK', report.pick_lines],['RECEIPT', report.receipt_lines],['PUT', report.put_lines],['REPLN', report.repln_lines]] as const).map(([activity, value]) => <div key={activity} data-activity={activity}><span>{activity}</span><strong>{value.toLocaleString()}</strong></div>)}</div>
    <div className="saved-report-actions"><button className="button primary" disabled={busy} onClick={() => onOpen(report.id)}>Open report</button><button className="button secondary" disabled={busy || !canCompare} onClick={() => onCompare(report.id)}>Compare</button>{report.user_id === userId && <button className="text-button archive-report" disabled={busy} onClick={() => onArchive(report.id)}><Archive size={14}/>{archived ? 'Restore' : 'Archive'}</button>}</div>
  </article>)}</div>;
}
