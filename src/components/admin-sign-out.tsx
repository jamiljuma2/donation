'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.assign('/admin');
    } catch {
      setError('Could not sign out. Please try again.');
      setBusy(false);
    }
  }

  return <div className="admin-signout-wrap">
    <button className="btn light" type="button" disabled={busy} onClick={() => void signOut()}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
    {error && <span className="admin-inline-status" role="alert">{error}</span>}
  </div>;
}
