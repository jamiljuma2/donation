import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { donationSchema } from '@/lib/validation';
import { initiatePayHero } from '@/lib/payhero';
import { rateAllowed } from '@/lib/rate-limit';
import { eatDateKey } from '@/lib/types';

export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Donations are not configured yet.' }, { status: 503 });

  const parsed = donationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid donation details' }, { status: 400 });
  }

  const [allowed, campaignResult] = await Promise.all([
    rateAllowed(req, 'donation', 5, 3600),
    db.from('campaigns')
      .select('id,status,deadline')
      .eq('id', parsed.data.campaignId)
      .eq('status', 'active')
      .not('published_at', 'is', null)
      .maybeSingle(),
  ]);
  if (!allowed) return NextResponse.json({ error: 'Please wait before trying again.' }, { status: 429 });

  const campaign = campaignResult.data;
  if (campaignResult.error) return NextResponse.json({ error: 'Could not check this campaign. Please try again.' }, { status: 503 });
  if (!campaign) return NextResponse.json({ error: 'This campaign is not accepting donations.' }, { status: 404 });
  if (campaign.deadline && campaign.deadline < eatDateKey()) {
    return NextResponse.json({ error: 'This campaign has closed.' }, { status: 400 });
  }

  const donationInput = parsed.data;
  const normalizedPhone = donationInput.phone.replace(/^\+?254/, '0');
  const reference = `DON-${crypto.randomUUID()}`;
  const { data: donation, error: insertError } = await db.from('donations').insert({
    campaign_id: campaign.id,
    donor_name: donationInput.name,
    donor_phone: normalizedPhone,
    amount: donationInput.amount,
    currency: 'KES',
    payment_provider: 'payhero',
    payment_reference: reference,
    payment_status: 'pending',
    is_anonymous: donationInput.anonymous,
  }).select('id').single();

  if (insertError || !donation) {
    console.error('Could not create donation record:', insertError?.message);
    return NextResponse.json({ error: 'Could not record this donation.' }, { status: 500 });
  }

  try {
    const provider = await initiatePayHero({
      amount: donationInput.amount,
      phone: normalizedPhone,
      reference,
      name: donationInput.name,
    });

    const [updateResult, eventResult] = await Promise.all([
      db.from('donations').update({ provider_transaction_id: provider.reference || null }).eq('id', donation.id),
      db.from('payment_events').insert({
        donation_id: donation.id,
        provider: 'payhero',
        event_type: 'payment_initiated',
        event_payload: { status: provider.status || 'QUEUED' },
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
      }),
    ]);

    if (updateResult.error) console.error('Could not save PayHero reference:', updateResult.error.message);
    if (eventResult.error) console.error('Could not record PayHero initiation event:', eventResult.error.message);
    return NextResponse.json({ donationId: donation.id, status: 'pending' });
  } catch (error) {
    console.error('PayHero STK push initiation failed:', error);
    await db.from('payment_events').insert({
      donation_id: donation.id,
      provider: 'payhero',
      event_type: 'payment_initiation_unconfirmed',
      event_payload: { status: 'unknown' },
      processing_status: 'retry',
    });
    return NextResponse.json({ donationId: donation.id, status: 'pending' }, { status: 202 });
  }
}
