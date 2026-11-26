'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CampaignStatusControl({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(next: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update campaign.');
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update campaign.');
      setBusy(false);
    }
  }

  return <div className="admin-status-control">
    <select disabled={busy} aria-label="Campaign status" className="input" value={status} onChange={(event) => void change(event.target.value)}>
      {['draft', 'active', 'closed', 'completed', 'suspended'].map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    <Link className="btn light" href={`/admin/campaigns/${id}/edit`}>Edit</Link>
    {error && <span className="admin-inline-status" role="alert">{error}</span>}
  </div>;
}
