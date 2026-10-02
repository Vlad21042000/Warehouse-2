import { Trophy } from "lucide-react";
import { formatDuration, type Employee } from "./report";
const n = (value: number) => value.toLocaleString("en-CA");
export default function EmployeeTable({
  employees,
  compact = false,
  onEmployee,
}: {
  employees: Employee[];
  compact?: boolean;
  onEmployee?: (employee: string) => void;
}) {
  const totals = employees.reduce(
    (acc, e) => ({
      pick: acc.pick + e.counts.PICK,
      put: acc.put + e.counts.PUT,
      repln: acc.repln + e.counts.REPLN,
      receipt: acc.receipt + e.counts.RECEIPT,
      total: acc.total + e.total,
    }),
    { pick: 0, put: 0, repln: 0, receipt: 0, total: 0 },
  );
  return (
    <table
      className={compact ? "employee-table print-table" : "employee-table"}
    >
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Employee</th>
          <th scope="col">PICK</th>
          <th scope="col">Pick time</th>
          <th scope="col">
            <abbr title="Pick lines divided by the elapsed time between first and last pick">
              L/Hr
            </abbr>
          </th>
          <th scope="col">PUT</th>
          <th scope="col">REPLN</th>
          <th scope="col">RECEIPT</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((e, index) => (
          <tr key={e.employee} className={`rank-${e.rank}${e.isSystem ? " system-account" : ""}${e.isSystem && !employees[index - 1]?.isSystem ? " system-first" : ""}`}>
            <td>
              <span className="rank-number">
                {e.rank === 1 && !compact ? (
                  <Trophy size={14} aria-hidden="true" />
                ) : null}
                {e.isSystem ? "—" : e.rank}
              </span>
            </td>
            <th scope="row">
              <span className="employee-name">
                {!compact && (
                  <span className="avatar" aria-hidden="true">
                    {e.employee.replace(/[^A-Z]/g, "").slice(0, 2)}
                  </span>
                )}
                {onEmployee && !compact ? <button className="employee-link" onClick={() => onEmployee(e.employee)} aria-label={`View ${e.employee} activity`}>{e.employee}</button> : e.employee}
                {e.isSystem && <span className="system-account-label"> (System)</span>}
              </span>
            </th>
            <td>{n(e.counts.PICK)}</td>
            <td className="time-cell">{formatDuration(e.pickMinutes)}</td>
            <td>{e.rate?.toFixed(2) ?? "—"}</td>
            <td>{n(e.counts.PUT)}</td>
            <td>{n(e.counts.REPLN)}</td>
            <td>{n(e.counts.RECEIPT)}</td>
            <td className="total-cell">{n(e.total)}</td>
          </tr>
        ))}
      </tbody>
      {!!employees.length && (
        <tfoot>
          <tr>
            <td></td>
            <th scope="row">{compact ? "Team total" : "Displayed total"}</th>
            <td>{n(totals.pick)}</td>
            <td>—</td>
            <td>—</td>
            <td>{n(totals.put)}</td>
            <td>{n(totals.repln)}</td>
            <td>{n(totals.receipt)}</td>
            <td>{n(totals.total)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

