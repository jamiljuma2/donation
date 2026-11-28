import Link from 'next/link';
import {getCampaigns} from '@/lib/campaigns';
import {money} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home(){
 const campaigns=(await getCampaigns()).slice(0,4);
 const featured=campaigns[0];
 const otherCampaigns=featured?campaigns.slice(1):[];
 return <main>
  <section className="wrap hero"><div className="hero-inner"><div>
   <div className="eyebrow">Community campaigns · Kenya</div>
   <h1>Choose a campaign.<br/><span className="hero-highlight">Make a donation.</span></h1>
   <p className="hero-copy">Review a campaign’s goal and progress, then donate by M-Pesa.</p>
   <div className="hero-actions"><Link className="btn" href="/campaigns">Browse campaigns</Link></div>
   <section className="how-grid" aria-label="How to donate">
    <div className="how-item"><span className="how-number">01</span><h3>Pick a campaign</h3><p>Select the cause you want to support.</p></div>
    <div className="how-item"><span className="how-number">02</span><h3>Enter your details</h3><p>Add your name, amount, and M-Pesa number.</p></div>
    <div className="how-item"><span className="how-number">03</span><h3>Approve payment</h3><p>Confirm the M-Pesa request on your phone.</p></div>
   </section>
  </div><aside className="hero-feature">{featured?<><span className="eyebrow">Featured · {featured.category}</span>{featured.cover_image_url?<div className="hero-feature-media"><img className="hero-feature-image" src={featured.cover_image_url} alt={`${featured.title} campaign cover`}/></div>:<div className="hero-feature-placeholder">{featured.category}<br/>Campaign</div>}<h2>{featured.title}</h2><p className="muted">{featured.short_description}</p><div className="campaign-meta"><b>{money(featured.raised||0)} raised</b><span>Goal {money(featured.fundraising_goal)}</span></div><div className="progress"><span style={{width:`${Math.min(100,Math.round(((featured.raised||0)/featured.fundraising_goal)*100))}%`}}/></div><div style={{marginTop:18}}><Link className="btn light" href={`/campaigns/${featured.slug}`}>See campaign details</Link></div></>:<><span className="eyebrow">Campaigns</span><div className="hero-feature-placeholder">No active campaigns</div></>}</aside></div></section>
  <section className="wrap section"><div className="section-head"><div><div className="eyebrow">More to support</div><h2>Other active campaigns</h2></div></div>
   {otherCampaigns.length?<div className="grid">{otherCampaigns.map(c=><article className="card" key={c.id}>{c.cover_image_url?<img className="campaign-img" src={c.cover_image_url} alt=""/>:<div className="campaign-placeholder">{c.category}</div>}<div className="card-body"><span className="campaign-category">{c.category}</span><h3>{c.title}</h3><p className="muted">{c.short_description}</p><div className="campaign-meta"><b>{money(c.raised||0)} raised</b><span>of {money(c.fundraising_goal)}</span></div><div className="progress"><span style={{width:`${Math.min(100,Math.round(((c.raised||0)/c.fundraising_goal)*100))}%`}}/></div><div className="campaign-actions"><Link className="btn light" href={`/campaigns/${c.slug}`}>Details</Link><Link className="btn" href={`/campaigns/${c.slug}#donate`}>Donate</Link></div></div></article>)}</div>:!featured?<p className="muted">There are no active campaigns right now.</p>:<p className="muted">Browse all active campaigns to see more ways to give.</p>}
  </section>
 </main>;
}
