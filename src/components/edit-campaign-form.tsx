'use client';

import { useState } from 'react';

type Campaign = {
  id: string;
  title: string;
  short_description: string;
  description: string;
  category: string;
  fundraising_goal: number;
  deadline: string | null;
  cover_image_url: string | null;
  beneficiary_name: string | null;
};

export default function EditCampaignForm({ campaign }: { campaign: Campaign }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setMessage('Saving…');
    try {
      const response = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, deadline: values.deadline || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save campaign.');
      window.location.assign('/admin');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to save campaign.');
      setBusy(false);
    }
  }

  return <form className="card-body" style={{ background: 'white', borderRadius: 18 }} onSubmit={save}>
    <label className="label" htmlFor="campaign-title">Title</label>
    <input className="input" id="campaign-title" name="title" defaultValue={campaign.title} required maxLength={160}/>
    <label className="label" htmlFor="campaign-summary">Summary</label>
    <textarea className="input" id="campaign-summary" name="short_description" defaultValue={campaign.short_description} required maxLength={300}/>
    <label className="label" htmlFor="campaign-description">Description</label>
    <textarea className="input" id="campaign-description" name="description" defaultValue={campaign.description} rows={8} required maxLength={10000}/>
    <label className="label" htmlFor="campaign-category">Category</label>
    <input className="input" id="campaign-category" name="category" defaultValue={campaign.category} required maxLength={80}/>
    <label className="label" htmlFor="campaign-goal">Target (KES)</label>
    <input className="input" id="campaign-goal" name="fundraising_goal" type="number" min="1" defaultValue={campaign.fundraising_goal} required/>
    <label className="label" htmlFor="campaign-deadline">Deadline</label>
    <input className="input" id="campaign-deadline" name="deadline" type="date" defaultValue={campaign.deadline || ''}/>
    <label className="label" htmlFor="campaign-image">Cover image URL</label>
    <input className="input" id="campaign-image" name="cover_image_url" type="url" defaultValue={campaign.cover_image_url || ''}/>
    <label className="label" htmlFor="beneficiary-name">Beneficiary name</label>
    <input className="input" id="beneficiary-name" name="beneficiary_name" defaultValue={campaign.beneficiary_name || ''} required maxLength={160}/>
    <button className="btn" type="submit" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
