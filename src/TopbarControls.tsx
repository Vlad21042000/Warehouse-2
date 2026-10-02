import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ChevronDown, LogOut, Moon, Settings2, Sun, UserRound, X } from 'lucide-react';
import { APPEARANCE_KEY, readAppearance, type Appearance } from './appearance';
import { cloud } from './cloud';

type Props = { user: User | null; onAccount: () => void; onAuth: (mode: 'signup' | 'login') => void; onError: (message: string) => void };
export default function TopbarControls({ user, onAccount, onAuth, onError }: Props) {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try { return readAppearance(localStorage.getItem(APPEARANCE_KEY)); }
    catch { return readAppearance(null); }
  });
  const settings = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = appearance.theme;
    root.dataset.background = appearance.background;
    root.style.setProperty('--warehouse-opacity', String(1 - appearance.dimming / 100));
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); } catch { /* Settings still work when storage is unavailable. */ }
  }, [appearance]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  function closeMenu() { if (menu.current) menu.current.open = false; }
  async function signOut() {
    if (!cloud || signingOut) return;
    setSigningOut(true);
    try { const { error } = await cloud.auth.signOut(); if (error) throw error; closeMenu(); }
    catch (error) { onError(error instanceof Error ? error.message : 'Could not sign out. Try again.'); }
    finally { setSigningOut(false); }
  }
  return <>
    <button className="topbar-icon" aria-label={appearance.theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => setAppearance(value => ({ ...value, theme: value.theme === 'dark' ? 'light' : 'dark' }))}>{appearance.theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
    <button className="topbar-icon" aria-label="Appearance settings" onClick={() => settings.current?.showModal()}><Settings2 size={18}/></button>
    <details className="account-menu" ref={menu} onKeyDown={event => { if (event.key === 'Escape') { closeMenu(); menu.current?.querySelector('summary')?.focus(); } }}>
      <summary aria-label="Account menu"><span className="account-avatar">{user?.email?.slice(0,2).toUpperCase() ?? <UserRound size={17}/>}</span><span className="account-menu-name">{user ? user.email?.split('@')[0] : 'Guest'}</span><ChevronDown size={14}/></summary>
      <div className="account-menu-popover">
        <div className="account-menu-identity"><strong>{user ? 'Your account' : 'Guest workspace'}</strong><small>{user?.email ?? 'Sign in to save your reports'}</small>{user?.app_metadata?.warehouse_role === 'owner' && <span className="count-badge">Site owner</span>}</div>
        {user ? <><button onClick={() => { closeMenu(); onAccount(); }}>My account & reports</button><button disabled={signingOut} onClick={() => void signOut()}><LogOut size={15}/>{signingOut ? 'Signing out…' : 'Sign out'}</button></> : <><button onClick={() => { closeMenu(); onAuth('signup'); }}>Create account</button><button onClick={() => { closeMenu(); onAuth('login'); }}>Sign in</button></>}
        <button onClick={() => { closeMenu(); settings.current?.showModal(); }}>Appearance settings</button>
      </div>
    </details>
    <dialog ref={settings} className="appearance-dialog" aria-labelledby="appearance-title">
      <div className="dialog-heading"><h2 id="appearance-title">Make it your workspace</h2><button className="icon-button" aria-label="Close appearance settings" onClick={() => settings.current?.close()}><X size={20}/></button></div>
      <p>Choose a comfortable theme and background. Your preferences are remembered on this browser.</p>
      <fieldset><legend>Theme</legend><div className="appearance-options">{(['dark','light'] as const).map(theme => <button key={theme} aria-pressed={appearance.theme === theme} onClick={() => setAppearance(value => ({ ...value, theme }))}>{theme === 'dark' ? <Moon size={20}/> : <Sun size={20}/>}<span>{theme === 'dark' ? 'Dark' : 'Light'}</span></button>)}</div></fieldset>
      <fieldset><legend>Background</legend><div className="appearance-options">{(['warehouse','plain'] as const).map(background => <button key={background} aria-pressed={appearance.background === background} onClick={() => setAppearance(value => ({ ...value, background }))}><span className={`background-preview ${background}`}/><span>{background === 'warehouse' ? 'Warehouse' : 'Plain'}</span></button>)}</div></fieldset>
      <label className="dimming-control">Background dimming <strong>{appearance.dimming}%</strong><input aria-label="Background dimming" type="range" min="20" max="90" step="5" disabled={appearance.background === 'plain'} value={appearance.dimming} onChange={event => setAppearance(value => ({ ...value, dimming: Number(event.target.value) }))}/></label>
      <button className="button primary" onClick={() => settings.current?.close()}>Done</button>
    </dialog>
  </>;
}
