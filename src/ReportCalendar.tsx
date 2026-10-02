import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from './report';
import { monthCells, moveMonth, type CalendarDay } from './calendar';
type Props = { month: string; days: Record<string, CalendarDay>; selectedDay: string; loading: boolean; error: string; onMonth: (month: string) => void; onDay: (day: string) => void; onRetry: () => void };
export default function ReportCalendar({ month, days, selectedDay, loading, error, onMonth, onDay, onRetry }: Props) {
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const entries = Object.values(days);
  return <section className="report-calendar" aria-label="Saved report calendar">
    <div className="calendar-heading"><div><h3>Report calendar</h3><p>Choose a highlighted day to see its reports.</p></div><button className="text-button" disabled={!selectedDay} onClick={() => onDay('')}>All dates</button></div>
    <div className="calendar-month"><button className="topbar-icon" aria-label="Previous month" onClick={() => onMonth(moveMonth(month,-1))}><ChevronLeft size={18}/></button><strong aria-live="polite">{label}</strong><button className="topbar-icon" aria-label="Next month" onClick={() => onMonth(moveMonth(month,1))}><ChevronRight size={18}/></button></div>
    <div className="calendar-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" aria-busy={loading}>{monthCells(month).map((day,index) => day ? <button key={day} className={`calendar-day${days[day] ? ' has-reports' : ''}`} disabled={loading || !!error || !days[day]} aria-label={`${formatDate(day)}, ${days[day]?.reports ?? 0} saved reports`} aria-pressed={selectedDay === day} aria-current={day === todayKey ? 'date' : undefined} onClick={() => onDay(day)}><span>{Number(day.slice(-2))}</span>{days[day] && <small>{days[day].reports}<span className="calendar-count-label"> {days[day].reports === 1 ? 'report' : 'reports'}</span></small>}</button> : <span key={`blank-${index}`} aria-hidden="true"/>)}</div>
    {loading ? <p className="calendar-summary" role="status">Loading this month…</p> : error ? <p className="message error" role="alert">{error} <button className="text-button" onClick={onRetry}>Retry</button></p> : <p className="calendar-summary">{entries.reduce((sum, day) => sum + day.reports, 0).toLocaleString()} reports · {entries.length} days · {entries.reduce((sum, day) => sum + day.lines, 0).toLocaleString()} activity lines{selectedDay && <strong>Showing {formatDate(selectedDay)}</strong>}</p>}
  </section>;
}
