'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { money, type Campaign } from '@/lib/types';

export default function CampaignBrowser({ campaigns }: { campaigns: Campaign[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', ...Array.from(new Set(campaigns.map((campaign) => campaign.category)))];
  const filtered = useMemo(() => campaigns.filter((campaign) =>
    (category === 'All' || campaign.category === category)
    && campaign.title.toLowerCase().includes(query.toLowerCase()),
  ), [campaigns, query, category]);

  return <main className="wrap section">
    <div className="section-head">
      <div><div className="eyebrow">GiveHope campaign list</div><h1 className="campaign-detail-title" style={{ marginBottom: 8 }}>Campaigns</h1><p className="muted">Review the details and progress before you contribute.</p></div>
    </div>
    <div className="campaign-search">
      <div className="campaign-search-field">
        <label className="label" htmlFor="campaign-search">Search campaigns</label>
        <input id="campaign-search" className="input" placeholder="Campaign name" value={query} onChange={(event) => setQuery(event.target.value)}/>
      </div>
      <div className="campaign-search-field">
        <label className="label" htmlFor="campaign-category">Category</label>
        <select id="campaign-category" className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </div>
    {filtered.length ? <div className="grid">
      {filtered.map((campaign) => <article className="card" key={campaign.id}>
        {campaign.cover_image_url ? <img className="campaign-img" src={campaign.cover_image_url} alt=""/> : <div className="campaign-placeholder">{campaign.category}</div>}
        <div className="card-body">
          <span className="campaign-category">{campaign.category}</span>
          <h3>{campaign.title}</h3>
          <p className="muted">{campaign.short_description}</p>
          <div className="campaign-meta"><b>{money(campaign.raised || 0)} raised</b><span>of {money(campaign.fundraising_goal)}</span></div>
          <div className="progress"><span style={{ width: `${Math.min(100, (campaign.raised || 0) / campaign.fundraising_goal * 100)}%` }}/></div>
          <div className="campaign-actions">
            <Link className="btn light" href={`/campaigns/${campaign.slug}`}>Details</Link>
            <Link className="btn" href={`/campaigns/${campaign.slug}#donate`}>Donate</Link>
          </div>
        </div>
      </article>)}
    </div> : <p className="muted">{campaigns.length ? 'No campaigns match those filters.' : 'There are no active campaigns right now.'}</p>}
  </main>;
}
