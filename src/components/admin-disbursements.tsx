'use client';

import { useEffect, useState } from 'react';
import { formatEATDateTime } from '@/lib/types';

type Campaign = { id: string; title: string };
type Disbursement = {
  id: string;
  campaign_id: string;
  beneficiary_name: string;
  amount: number;
  purpose: string;
  status: string;
  requested_at: string;
};

export default function AdminDisbursements({ campaigns }: { campaigns: Campaign[] }) {
  const [items, setItems] = useState<Disbursement[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/disbursements', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load disbursements.');
      setItems(result.disbursements || []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load disbursements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function act(body: unknown): Promise<boolean> {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update disbursement.');
      setMessage('Disbursement updated.');
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update disbursement.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void act({
      campaignId: values.get('campaign'),
      beneficiary: values.get('beneficiary'),
      amount: values.get('amount'),
      purpose: values.get('purpose'),
    }).then((saved) => { if (saved) form.reset(); });
  }

  return <div>
    <div className="admin-section-heading">
      <div><div className="eyebrow">Finance</div><h2>Disbursements</h2></div>
      <span className="muted">Requests and approvals</span>
    </div>
    <form className="admin-disbursement-request" onSubmit={submitRequest}>
      <h3>Request a disbursement</h3>
      <label className="label" htmlFor="disbursement-campaign">Campaign</label>
      <select id="disbursement-campaign" name="campaign" className="input" required defaultValue="">
        <option value="" disabled>Select a campaign</option>
        {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
      </select>
      <label className="label" htmlFor="disbursement-beneficiary">Beneficiary</label>
      <input id="disbursement-beneficiary" className="input" name="beneficiary" required maxLength={160}/>
      <label className="label" htmlFor="disbursement-amount">Amount (KES)</label>
      <input id="disbursement-amount" className="input" type="number" min="1" step="1" name="amount" required/>
      <label className="label" htmlFor="disbursement-purpose">Purpose</label>
      <textarea id="disbursement-purpose" className="input" name="purpose" required minLength={5} maxLength={1000}/>
      <button className="btn" type="submit" style={{ marginTop: 14 }} disabled={busy || campaigns.length === 0}>{busy ? 'Saving…' : 'Submit request'}</button>
    </form>
    {message && <p className="admin-success" role="status">{message}</p>}
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {loading ? <p className="muted">Loading requests…</p> : items.length ? <div className="admin-disbursement-list">
      {items.map((item) => <article key={item.id} className="admin-disbursement-row">
        <div className="admin-disbursement-summary">
          <span className={`admin-status admin-status-${item.status}`}>{item.status}</span>
          <h3>{item.beneficiary_name} · KSh {Number(item.amount).toLocaleString('en-KE')}</h3>
          <p className="muted">{campaigns.find((campaign) => campaign.id === item.campaign_id)?.title || 'Campaign'} · {formatEATDateTime(item.requested_at)}</p>
          <p>{item.purpose}</p>
        </div>
        {item.status === 'pending' && <div className="admin-actions">
          <button className="btn" type="button" disabled={busy} onClick={() => void act({ id: item.id, action: 'approve' })}>Approve</button>
          <button className="btn light" type="button" disabled={busy} onClick={() => void act({ id: item.id, action: 'reject' })}>Reject</button>
        </div>}
        {['approved', 'processing'].includes(item.status) && <form className="admin-complete-disbursement" onSubmit={(event) => { event.preventDefault(); const reference = String(new FormData(event.currentTarget).get('reference')); void act({ id: item.id, action: 'complete', reference }); }}>
          <label className="label" htmlFor={`transfer-${item.id}`}>Confirmed transfer reference</label>
          <input id={`transfer-${item.id}`} className="input" name="reference" minLength={3} maxLength={100} required/>
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 8 }}>Mark completed</button>
        </form>}
      </article>)}
    </div> : <p className="muted">No disbursements have been requested.</p>}
  </div>;
}
