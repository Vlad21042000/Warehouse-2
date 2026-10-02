import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Archive, Cloud, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { cloud, CLOUD_TABLE, parseSnapshot, snapshotFingerprint, snapshotForDay, type SavedReport } from './cloud';
import { formatDate, type Dataset } from './report';

const columns = 'id,user_id,title,report_date,source,created_at,archived_at,total_lines,pick_lines,put_lines,receipt_lines,repln_lines';
type Profile = { user_id: string; email: string; created_at: string; verified_at: string | null; last_sign_in_at: string | null };
type Mode = 'login' | 'signup' | 'reset' | 'password';
const errorText = (error: unknown) => error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'The cloud request did not finish. Try again.';

export default function AccountHistory({ dataset, date, onOpen, onCompare, onSignOut }: { dataset: Dataset | null; date: string; onOpen: (dataset: Dataset, date: string) => void; onCompare: (dataset: Dataset, date: string) => void; onSignOut: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!cloud);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [reports, setReports] = useState<SavedReport[]>([]); const [count, setCount] = useState(0);
  const [page, setPage] = useState(0); const [archive, setArchive] = useState(false); const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false); const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [admin, setAdmin] = useState(false); const [profiles, setProfiles] = useState<Profile[]>([]); const [userCount, setUserCount] = useState(0); const [adminUser, setAdminUser] = useState('');
  const generation = useRef(0);
  const previousUser = useRef<string | null>(null);
  const owner = user?.app_metadata?.warehouse_role === 'owner';
  const ownerView = Boolean(owner && admin);

  useEffect(() => {
    if (!cloud) return;
    let active = true;
    const { data: { subscription } } = cloud.auth.onAuthStateChange((event, session) => {
      generation.current++;
      const nextUser = session?.user.id ?? null;
      if (previousUser.current && previousUser.current !== nextUser) onSignOut();
      previousUser.current = nextUser;
      setRefresh(value => value + 1);
      setReports([]); setProfiles([]); setSelected([]); setCount(0); setUserCount(0); setPage(0);
      setUser(session?.user ?? null); setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') { setMode('password'); setMessage('Choose a new password below.'); }
      if (event === 'SIGNED_OUT') { setAdmin(false); setAdminUser(''); setPassword(''); onSignOut(); }
    });
    const initialGeneration = generation.current;
    void cloud.auth.getUser().then(({ data }) => { if (active && generation.current === initialGeneration) { previousUser.current = data.user?.id ?? null; setUser(data.user); setAuthReady(true); } }).catch(() => { if (active) setAuthReady(true); });
    return () => { active = false; subscription.unsubscribe(); generation.current++; };
  }, [onSignOut]);

  useEffect(() => {
    if (!cloud || !user) return;
    let active = true;
    const version = ++generation.current;
    const client = cloud;
    setLoading(true); setError(''); setSelected([]);
    void (async () => {
      try {
        let query = client.from(CLOUD_TABLE).select(columns, { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 25, page * 25 + 24);
        query = archive ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
        if (!ownerView) query = query.eq('user_id', user.id);
        else if (adminUser) query = query.eq('user_id', adminUser);
        const result = await query;
        if (result.error) throw result.error;
        if (active && generation.current === version) { setReports((result.data ?? []) as SavedReport[]); setCount(result.count ?? 0); }
        if (ownerView) {
          const summary = await client.from('warehouse_profiles').select('user_id,email,created_at,verified_at,last_sign_in_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100);
          if (summary.error) throw summary.error;
          if (active && generation.current === version) { setProfiles(summary.data ?? []); setUserCount(summary.count ?? 0); }
        }
      } catch (error) { if (active && generation.current === version) setError(errorText(error)); }
      finally { if (active && generation.current === version) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id, ownerView, adminUser, page, archive, refresh]);

  async function authenticate(event: FormEvent) {
    event.preventDefault(); if (!cloud || busy) return;
    setBusy(true); setError(''); setMessage('');
    const redirectTo = window.location.origin + '/';
    try {
      if (mode === 'signup') {
        if (!consent) throw new Error('Accept the cloud-storage notice to register.');
        const result = await cloud.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo, data: { warehouse_notice_version: 1 } } });
        if (result.error) throw result.error;
        setMessage('Check your email to confirm your account, then sign in.'); setPassword('');
      } else if (mode === 'reset') {
        const result = await cloud.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (result.error) throw result.error;
        setMessage('If this address has an account, a password-reset link will be sent.');
      } else if (mode === 'password') {
        const result = await cloud.auth.updateUser({ password });
        if (result.error) throw result.error;
        setPassword(''); setMode('login'); setMessage('Password updated.');
      } else {
        const result = await cloud.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        setPassword(''); setMessage('Signed in. Your saved reports are available below.');
      }
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  async function action(work: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  async function loadReport(id: string) {
    if (!cloud || !user) throw new Error('Sign in first.');
    const result = await cloud.from(CLOUD_TABLE).select('payload,report_date').eq('id', id).single();
    if (result.error) throw result.error;
    return { data: parseSnapshot(result.data.payload, result.data.report_date).dataset, date: result.data.report_date as string };
  }
  async function save() {
    if (!cloud || !user || !dataset) return;
    const snapshot = snapshotForDay(dataset, date);
    const fingerprint = await snapshotFingerprint(snapshot);
    const result = await cloud.from(CLOUD_TABLE).insert({ user_id: user.id, title: title.trim() || `${dataset.sample ? 'Sample · ' : ''}${formatDate(date)}`, report_date: date, source: dataset.source, payload: snapshot, fingerprint });
    if (result.error) { if (result.error.code === '23505') throw new Error('This exact report is already saved. Check your history or archive.'); throw result.error; }
    setTitle(''); setPage(0); setArchive(false); setRefresh(value => value + 1); setMessage('Report saved to your account. It is available on your other devices after sign-in.');
  }
  async function open(id: string, comparison = false) {
    const version = generation.current;
    const loaded = await loadReport(id);
    if (version !== generation.current) return;
    if (comparison) onCompare(loaded.data, loaded.date); else onOpen(loaded.data, loaded.date);
    setMessage(comparison ? 'Saved report selected for comparison.' : 'Saved report opened in the dashboard.');
  }
  async function compareSelected() {
    if (selected.length !== 2) return;
    const version = generation.current;
    const [first, second] = await Promise.all(selected.map(loadReport));
    if (version !== generation.current) return;
    const [current, baseline] = first.date >= second.date ? [first, second] : [second, first];
    onOpen(current.data, current.date); onCompare(baseline.data, baseline.date);
    setMessage('Both saved reports loaded. View the comparison in Shift intelligence.');
  }

  return <section className="panel account-panel" id="account-history" aria-labelledby="account-title">
    <div className="analytics-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2 id="account-title"><Cloud size={20}/>Account & saved reports</h2><p>Keep selected daily reports in your account and compare them later.</p></div>{user && <button className="button secondary" disabled={busy} onClick={() => void action(async () => { const result = await cloud!.auth.signOut(); if (result.error) throw result.error; })}><LogOut size={15}/>Sign out</button>}</div>
    <p className="cloud-notice"><ShieldCheck size={15}/>Unsaved uploads stay in this tab. Reports you choose to save are stored in the cloud and can be viewed by you and the site owner. Never upload passwords, payment details or unrelated personal information.</p>
    {!cloud ? <p className="message warning">Cloud accounts are not connected yet. You can continue using the reporting dashboard.</p> : !authReady ? <p role="status">Checking your account…</p> : (!user || mode === 'password') ? <form className="account-form" onSubmit={authenticate}>
      <div className="account-tabs" role="group" aria-label="Account action">{(['login', 'signup', 'reset'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setError(''); setMessage(''); setPassword(''); }}>{value === 'login' ? 'Sign in' : value === 'signup' ? 'Register' : 'Reset password'}</button>)}</div>
      <h3>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Recover your account' : mode === 'password' ? 'Set a new password' : 'Welcome back'}</h3>
      {mode !== 'password' && <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>}
      {mode !== 'reset' && <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 12} maxLength={72} value={password} onChange={event => setPassword(event.target.value)}/>{mode !== 'login' && <small>Use at least 12 characters.</small>}</label>}
      {mode === 'signup' && <label className="consent-checkbox"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)}/>I understand that saved reports are stored in the cloud and are accessible to the site owner.</label>}
      <button className="button primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'password' ? 'Update password' : 'Sign in'}</button>
    </form> : <>
      <div className="account-identity"><UserRound size={17}/><strong>{user.email}</strong>{owner && <span className="count-badge">Site owner</span>}</div>
      <div className="analytics-controls"><label className="lookup-input">Report name<input aria-label="Saved report name" maxLength={120} placeholder="e.g. Afternoon shift" value={title} onChange={event => setTitle(event.target.value)}/></label><button className="button primary" disabled={busy || !dataset} onClick={() => void action(save)}>Save selected day</button></div>
      <div className="history-toolbar"><h3>{ownerView ? 'Owner dashboard' : 'My report history'}</h3><div>{owner && <button className="button secondary" aria-pressed={ownerView} onClick={() => { setAdmin(!admin); setPage(0); setSelected([]); setAdminUser(''); }}>{ownerView ? 'My reports' : 'Owner dashboard'}</button>}<button className="button secondary" onClick={() => { setArchive(!archive); setPage(0); }}><Archive size={14}/>{archive ? 'Active reports' : 'Archive'}</button><button className="text-button" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>Refresh</button></div></div>
      {ownerView && <div className="owner-summary"><strong>{userCount.toLocaleString()} registered users</strong><p>All account registrations, including unconfirmed emails. {profiles.length} most recent users shown.</p><label>Filter reports by user<select aria-label="Owner user filter" value={adminUser} onChange={event => { setAdminUser(event.target.value); setPage(0); }}><option value="">All users</option>{profiles.map(profile => <option key={profile.user_id} value={profile.user_id}>{profile.email}</option>)}</select></label><details className="analytics-details"><summary>Registered users</summary><div className="analytics-scroll"><table className="analytics-table"><thead><tr><th>Email</th><th>Registered</th><th>Verified</th><th>Last sign-in</th></tr></thead><tbody>{profiles.map(profile => <tr key={profile.user_id}><td>{profile.email}</td><td>{new Date(profile.created_at).toLocaleDateString()}</td><td>{profile.verified_at ? 'Yes' : 'Pending'}</td><td>{profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString() : '—'}</td></tr>)}</tbody></table></div></details></div>}
      <p className="analytics-caption">{count.toLocaleString()} {archive ? 'archived' : 'saved'} reports. Select two to compare. Archived reports can be restored.</p>
      <button className="button secondary" disabled={busy || selected.length !== 2} onClick={() => void action(compareSelected)}>Compare selected reports ({selected.length}/2)</button>
      {loading ? <p role="status">Loading report history…</p> : <div className="analytics-scroll"><table className="analytics-table history-table"><thead><tr><th>Select</th><th>Report</th><th>Date</th><th>Total</th><th>PICK</th><th>RECEIPT</th><th>PUT</th><th>REPLN</th><th>Actions</th></tr></thead><tbody>{reports.map(report => <tr key={report.id}><td><input type="checkbox" aria-label={`Select ${report.title}`} checked={selected.includes(report.id)} disabled={!selected.includes(report.id) && selected.length >= 2} onChange={() => setSelected(value => value.includes(report.id) ? value.filter(id => id !== report.id) : [...value, report.id])}/></td><th scope="row">{report.title}<small>{report.source}{ownerView && ` · ${profiles.find(profile => profile.user_id === report.user_id)?.email ?? report.user_id}`}</small></th><td>{formatDate(report.report_date)}</td>{[report.total_lines, report.pick_lines, report.receipt_lines, report.put_lines, report.repln_lines].map((value, index) => <td key={index}>{value.toLocaleString()}</td>)}<td><div className="history-actions"><button disabled={busy} onClick={() => void action(() => open(report.id))}>Open</button><button disabled={busy || !dataset} onClick={() => void action(() => open(report.id, true))}>Compare with current</button>{report.user_id === user.id && <button disabled={busy} onClick={() => void action(async () => { const result = await cloud!.from(CLOUD_TABLE).update({ archived_at: archive ? null : new Date().toISOString() }).eq('id', report.id).select('id').single(); if (result.error) throw result.error; setSelected([]); setPage(0); setRefresh(value => value + 1); setMessage(archive ? 'Report restored.' : 'Report archived. You can restore it from Archive.'); })}>{archive ? 'Restore' : 'Archive'}</button>}</div></td></tr>)}</tbody></table></div>}
      {!loading && !reports.length && <p className="analytics-empty">{archive ? 'Your archive is empty.' : 'No saved reports yet. Save a selected day above.'}</p>}
      <div className="analytics-pager"><span>Page {page + 1} of {Math.max(1, Math.ceil(count / 25))}</span><div><button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><button disabled={loading || (page + 1) * 25 >= count} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </>}
    {message && <p className="message success" role="status">{message}</p>}{error && <p className="message error" role="alert">{error}</p>}
  </section>;
}
