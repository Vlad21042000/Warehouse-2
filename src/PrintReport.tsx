import type { CSSProperties } from 'react';
import EmployeeTable from './EmployeeTable';
import { BrandMark } from './Brand';
import { BRAND_NAME } from './brand';
import { SYSTEM_USERS, formatDate, type Activity, type Dataset, type Report } from './report';
const n = (value: number) => value.toLocaleString('en-CA');
export default function PrintReport({report, dataset, paper, id}: {report: Report; dataset: Dataset; paper: 'Letter' | 'A4'; id?: string}) {
  const people = report.employees.filter(employee => !employee.isSystem);
  return (
        <section
          id={id} className="print-document"
          style={
            { "--employee-count": Math.max(1, report.employees.length), "--report-width": paper === "Letter" ? "8in" : "7.77in", "--report-height": paper === "Letter" ? "9.42in" : "10.11in" } as CSSProperties
          }
        >
          <header>
            <BrandMark className="print-logo" />
            <div>
            <h1>{BRAND_NAME.toUpperCase()}</h1>
            <p>
              Daily Activity Report ·{' '}
              {formatDate(report.date)} ·{" "}
              {dataset.sample ? "SAMPLE DATA · " : ""}
              {dataset.source}
            </p>
            </div>
          </header>
          <div className="print-summary">
            <section>
              <h2>TEAM SUMMARY</h2>
              <div className="print-team-grid">
                <div>
                  {[["Staff", people.length], ["Total", report.total], ["PICK", report.counts.PICK], ["RECEIPT", report.counts.RECEIPT], ["PUT", report.counts.PUT], ["REPLN", report.counts.REPLN]].map(([label, value]) => <p key={label}><strong>{label}</strong><b>{n(Number(value))}</b></p>)}
                </div>
                <div><p>Date <b>{report.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")}</b></p><p>Source <b>Daily Activity</b></p></div>
              </div>
            </section>
            <section>
              <h2>KEY HIGHLIGHTS</h2>
              <p>Most Total <b>{people[0] ? `${people[0].employee} (${n(people[0].total)})` : "—"}</b></p>
              {(["PICK", "RECEIPT", "PUT", "REPLN"] as Activity[]).map(activity => {
                const top = [...people].sort((a, b) => b.counts[activity] - a.counts[activity] || a.rank - b.rank)[0];
                return <p key={activity}>Most {activity === "RECEIPT" ? "Receipt" : activity}<b>{top?.counts[activity] ? `${top.employee} (${n(top.counts[activity])})` : "—"}</b></p>;
              })}
              <p>Team pick rate <b>{report.rate?.toFixed(2) ?? "—"} lines/hr</b></p>
            </section>
          </div>
          <EmployeeTable employees={report.employees} compact />
          <div className="print-notes">
            <p>System accounts included below employees: {SYSTEM_USERS.join(", ")}.</p>
            <p>Pick Time = first-to-last PICK transaction, including breaks; a single PICK has no measurable time span. Counts are lines, not Qty.</p>
          </div>
        </section>
  );
}
