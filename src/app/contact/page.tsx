'use client';
import {useState} from 'react';

export default function Contact(){
 const[msg,setMsg]=useState('');
 async function send(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setMsg('Sending…');
  try{const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f.entries()))});
   const x=await r.json();setMsg(r.ok?'Message received.':x.error||'Could not send message.');if(r.ok)form.reset();
  }catch{setMsg('Could not send your message. Please try again.');}
 }
 return <main className="contact-page">
  <div className="contact-hero"><div className="eyebrow">GiveHope</div><h1>Contact</h1></div>
  <section className="contact-main">
   <div className="contact-heading"><h2>We’re here to help</h2></div>
   <div className="contact-grid">
    <aside className="contact-help"><div className="eyebrow">Before you write</div><h3>What can we help with?</h3><p>Ask about a campaign, a donation, or a payment status.</p><div className="contact-help-note"><b>Payment question?</b><br/>Include your donation reference. Never send your M-Pesa PIN.</div></aside>
    <form onSubmit={send} className="contact-form">
     <h3>Send a message</h3>
     <div className="contact-form-grid">
      <label className="contact-field">Full name<input className="input" name="name" autoComplete="name" required maxLength={120} placeholder="Your name"/></label>
      <label className="contact-field">Email address<input className="input" type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label>
      <label className="contact-field contact-topic">Topic <span className="muted">(optional)</span><select className="input" name="subject" defaultValue=""><option value="">Choose a topic</option><option value="Donation question">Donation</option><option value="Payment question">Payment</option><option value="Campaign question">Campaign</option><option value="Other question">Other</option></select></label>
      <label className="contact-field contact-message">Message<textarea className="input" name="message" required minLength={10} maxLength={5000} rows={6} placeholder="How can we help?"/></label>
     </div>
     <button className="btn contact-submit" disabled={msg==='Sending…'}>{msg==='Sending…'?'Sending…':'Send message'}</button>
     {msg&&<p className="contact-status" role="status">{msg}</p>}
     <p className="contact-privacy">Your details are used to respond to your message. Read our <a href="/privacy">Privacy Policy</a>.</p>
    </form>
   </div>
  </section>
 </main>;
}
