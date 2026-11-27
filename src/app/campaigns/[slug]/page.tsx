import {notFound} from 'next/navigation';
import {getCampaign} from '@/lib/campaigns';
import {money} from '@/lib/types';
import DonationForm from '@/components/donation-form';
import CopyLink from '@/components/copy-link';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const c=await getCampaign(slug);if(!c)return{};return{title:`${c.title} | GiveHope`,description:c.short_description,openGraph:{title:c.title,description:c.short_description,images:c.cover_image_url?[c.cover_image_url]:[]},twitter:{card:'summary_large_image',title:c.title,description:c.short_description,images:c.cover_image_url?[c.cover_image_url]:[]}}}
export default async function CampaignPage({params}:{params:Promise<{slug:string}>}){
 const{slug}=await params;const c=await getCampaign(slug);if(!c)notFound();
 const pct=Math.min(100,Math.round((c.raised||0)/c.fundraising_goal*100));
 const url=`${process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000'}/campaigns/${c.slug}`;
 const mpesaEnabled=Boolean(process.env.PAYHERO_API_USERNAME&&process.env.PAYHERO_API_PASSWORD&&process.env.PAYHERO_CHANNEL_ID);
 return <main className="wrap section"><div className="campaign-layout"><div>
  {c.cover_image_url?<img className="campaign-detail-image" src={c.cover_image_url} alt=""/>:<div className="campaign-placeholder">{c.category}</div>}
  <p className="campaign-category">{c.category}</p><h1 className="campaign-detail-title">{c.title}</h1><p className="campaign-description">{c.description}</p>
  {c.beneficiary_name&&<section style={{borderTop:'1px solid var(--line)',marginTop:30,paddingTop:12}}><h2>Beneficiary</h2><p><b>{c.beneficiary_name}</b></p></section>}
  <section style={{borderTop:'1px solid var(--line)',marginTop:30,paddingTop:12}}><h2>Share</h2><div className="campaign-actions"><a className="btn light" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${c.title} ${url}`)}`}>WhatsApp</a><a className="btn light" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>Facebook</a><a className="btn light" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(c.title)}`}>X</a><CopyLink url={url}/></div></section>
 </div><aside><div className="donation-panel"><span className="eyebrow">Campaign progress</span><h2 style={{font: '500 30px Georgia,serif',margin:'12px 0 4px'}}>{money(c.raised||0)}</h2><p className="muted" style={{marginTop:0}}>raised of {money(c.fundraising_goal)}</p><div className="progress"><span style={{width:`${pct}%`}}/></div><p className="campaign-meta"><b>{pct}% funded</b>{c.deadline&&<span>Closes {new Date(c.deadline).toLocaleDateString('en-KE')}</span>}</p><div style={{borderTop:'1px solid var(--line)',marginTop:22,paddingTop:20}} id="donate"><DonationForm campaignId={c.id} campaignTitle={c.title} paymentEnabled={mpesaEnabled}/></div></div></aside></div></main>
}
