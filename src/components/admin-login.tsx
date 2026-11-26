'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.assign('/admin');
    } catch {
      setError('Sign-in failed. Check your email and password, then try again.');
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <label className="label" htmlFor="admin-email">Email</label>
    <input className="input" id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)}/>
    <label className="label" htmlFor="admin-password">Password</label>
    <input className="input" id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}/>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 20 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}
