'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {money} from '@/lib/types';
type C={id:string;title:string;slug:string;short_description:string;cover_image_url:string|null;category:string;fundraising_goal:number;raised:number};
export default function Campaigns(){
 const[items,setItems]=useState<C[]>([]),[q,setQ]=useState(''),[cat,setCat]=useState('All');
 useEffect(()=>{fetch('/api/campaigns').then(r=>r.json()).then(x=>setItems(x.campaigns||[])).catch(()=>{})},[]);
 const categories=['All',...Array.from(new Set(items.map(x=>x.category)))];
 const filtered=useMemo(()=>items.filter(c=>(cat==='All'||c.category===cat)&&c.title.toLowerCase().includes(q.toLowerCase())),[items,q,cat]);
 return <main className="wrap section"><div className="section-head"><div><div className="eyebrow">GiveHope campaign list</div><h1 className="campaign-detail-title" style={{marginBottom:8}}>Campaigns</h1><p className="muted">Review the details and progress before you contribute.</p></div></div>
  <div className="campaign-search"><input aria-label="Search campaigns" className="input" placeholder="Search by campaign name" value={q} onChange={e=>setQ(e.target.value)}/><select aria-label="Filter by category" className="input" value={cat} onChange={e=>setCat(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></div>
  {filtered.length?<div className="grid">{filtered.map(c=><article className="card" key={c.id}>{c.cover_image_url?<img className="campaign-img" src={c.cover_image_url} alt=""/>:<div className="campaign-placeholder">{c.category}</div>}<div className="card-body"><span className="campaign-category">{c.category}</span><h3>{c.title}</h3><p className="muted">{c.short_description}</p><div className="campaign-meta"><b>{money(c.raised)} raised</b><span>of {money(c.fundraising_goal)}</span></div><div className="progress"><span style={{width:`${Math.min(100,c.raised/c.fundraising_goal*100)}%`}}/></div><div className="campaign-actions"><Link className="btn light" href={`/campaigns/${c.slug}`}>Details</Link><Link className="btn" href={`/campaigns/${c.slug}#donate`}>Donate</Link></div></div></article>)}</div>:<p className="muted">{items.length?'No campaigns match those filters.':'There are no active campaigns right now.'}</p>}
 </main>
}
