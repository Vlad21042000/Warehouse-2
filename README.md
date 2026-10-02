# Warehouse Reporting

A browser-based Daily Activity dashboard for warehouse teams. Import an Excel or CSV export, review the team summary and ranked employee activity, then download a one-sheet Excel report or print it.

## Features

- Excel `.xlsx`, legacy `.xls`, and `.csv` imports, up to 20 MB and 200,000 rows per worksheet.
- Worksheet selection and daily date selection; the latest available date opens first.
- PICK, PUT, REPLN, RECEIPT, total lines, Pick Time, and lines per hour.
- Search and activity filters; exports always include the entire selected day's report.
- One-sheet A:I Excel dashboard with blue headers, team summary, key highlights, gold first place, orange third place, and calculation notes.
- Letter portrait by default (0.75 in top/bottom, 0.25 in sides), fitted to one Excel page. A4 is also available.
- Mobile layout, keyboard access, print view, synthetic sample report, and downloadable CSV header template.
- Optional email accounts and private cloud report history. Unsaved uploads remain in tab memory; selected days can be saved to Supabase and opened on other devices. Registration discloses that the site owner can view saved reports. Fonts and app dependencies are served with the site.

## Shift intelligence

- Compare a second Excel/CSV report or choose another date in the current file. Select comparison worksheets and dates independently. Volume differences are shown for the team and all employees, including those present in only one report; zero baselines have no percentage change.
- Hourly activity charts and a paginated employee heatmap use source-file time. Missing timestamps are shown separately and retained in totals. Select a heatmap cell or employee to open their operation timeline and available history within the current file.
- Search orders and items on the selected day, including time, employee, operation, Qty/UOM, locations and task/trip metadata. Optional columns may be absent; missing identifiers are reported, never inferred. Duplicate source rows stay separate.
- Comparison imports stay in tab memory. Sample comparison data is explicitly labelled. Analytics are excluded from the one-page printed and Excel daily report.

## Input format

The Daily Activity export uses these columns:

```text
Transaction Type,Task,Trip,Order No.,Line No.,Item Number,From Location,To Location,Qty,UOM,User,Date,Time
```

Headers may appear within the first 100 rows. Columns are found by header name, so their order can change. Repeated header rows are ignored. Dates support Excel serials, `MM/DD/YYYY`, `YYYY-MM-DD`, and `DD-MMM-YYYY`; numeric slash dates are interpreted as month/day/year. Times support Excel time fractions, `HH:MM[:SS]`, or 12-hour times with AM/PM. Date and time values are treated as the local calendar values in the source; there is no timezone conversion. Report days follow the source date, including overnight shifts split across calendar dates.

## Calculation rules

1. Each valid transaction row counts as one line. **Qty is never summed for activity counts.** Duplicate source rows are counted as supplied; the app does not silently remove them.
2. Blank Transaction Type cells carry down the last explicit type. Only PICK, PUT, REPLN and RECEIPT count. Unsupported types and invalid rows are shown in the import audit.
3. JDEJOBS, EXACTASVC and BFITZ00 are excluded from every metric. User matching is case-insensitive.
4. Every employee with any included activity is retained, including employees with no PICK rows.
5. Ranking is Total descending, PICK descending, then employee identifier ascending for deterministic ties.
6. Pick Time is the latest PICK timestamp minus the earliest PICK timestamp for that employee and selected day. It includes breaks and other gaps; it is **not active work time**. One pick, zero elapsed time, or any missing PICK timestamp leaves Pick Time and L/Hr blank.
7. L/Hr is PICK lines divided by elapsed Pick Time in hours. Rates display two decimals; duration displays `[h]:mm` without rounding the underlying calculation.
8. Team pick rate uses only picks from employees with valid Pick Time, divided by their summed Pick Time. Employees with missing timing never inflate this rate.

Excel exports contain typed durations, cached formulas for employee totals and rates, and aggregate total formulas. The report is a snapshot of the selected day's imported data; re-import changed raw data to generate a new report.

## Development

Use Node.js 24 (or Node.js 22.12+) and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Tests cover row counting, carry-down rules, exclusions, tie ranking, dates, missing timestamps, daily filtering, XLSX/XLS/CSV parsing, and Excel formulas/page settings. `.github/workflows/ci.yml` runs the same checks for pushes and pull requests.

## Vercel deployment

Import `Vlad21042000/Warehouse-2` into Vercel with the **Vite** preset. The root directory is the repository root. The build command is `npm run build` and the output directory is `dist`; these are declared in `vercel.json`. The guest dashboard needs no backend. Cloud accounts require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Production, a dedicated Supabase project, verified email delivery and the schema in supabase/schema.sql. See supabase/SETUP.md. Never expose service-role or SMTP credentials in Vite variables. Use `main` for production deployments.

The SheetJS dependency is pinned to the official 0.20.3 distribution, and the lockfile pins all other dependencies. Excel export loads on demand, and file parsing runs in a Web Worker to keep the UI responsive.

## Scope

This application processes exported files. It does not connect to JD Edwards, Exacta or OneGlass, and it synchronizes only the daily snapshots a signed-in user explicitly saves. Browser printing depends on the print dialog's paper, scale and header/footer settings. Excel explicitly fits the complete report to one page; very large employee lists will therefore print smaller.


## Accounts and history

Register with a verified email, sign in, save a selected day, reopen it, or select two saved reports for comparison. Exact duplicate snapshots are rejected. Archive and restore are available for your own reports. Account history pages contain 25 reports. Owner access is granted through trusted Auth app_metadata to the agreed verified account; the owner dashboard lists users and can view their reports. Passwords and tokens are never included. Local Postgres tests verify RLS account isolation, forged metadata denial and owner read-only access.
