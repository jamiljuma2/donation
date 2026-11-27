import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import PrintReceipt from '@/components/print-receipt';
import { formatEATDateTime, money } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase/server';

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: donation } = await db
    .from('donations')
    .select('id,donor_name,amount,currency,payment_status,payment_reference,created_at,campaigns(title)')
    .eq('id', id)
    .eq('payment_status', 'successful')
    .maybeSingle();
  if (!donation) notFound();

  const campaign = donation.campaigns as unknown as { title: string } | null;

  return <main className="wrap section receipt-page" id="receipt-page">
    <article className="receipt-card" id="receipt-card">
      <div className="eyebrow">Donation receipt</div>
      <Image className="receipt-logo" src="/givehope-logo.svg" alt="GiveHope — Donate, Support, Make an Impact" width={220} height={57} priority/>
      <p className="receipt-thanks">Thank you for supporting {campaign?.title || 'this campaign'}.</p>
      <hr/>
      <dl className="receipt-details">
        <div><dt>Receipt reference</dt><dd>{donation.payment_reference}</dd></div>
        <div><dt>Donor</dt><dd>{donation.donor_name}</dd></div>
        <div><dt>Amount</dt><dd>{money(Number(donation.amount), donation.currency)}</dd></div>
        <div><dt>Payment status</dt><dd>Verified successful</dd></div>
        <div><dt>Date (EAT)</dt><dd>{formatEATDateTime(donation.created_at)}</dd></div>
      </dl>
      <p className="receipt-note">This receipt confirms a payment recorded by the platform. It is not a statement that a donation is tax deductible.</p>
    </article>
    <div className="receipt-actions"><PrintReceipt/><Link className="btn light" href="/campaigns">Back to campaigns</Link></div>
  </main>;
}
