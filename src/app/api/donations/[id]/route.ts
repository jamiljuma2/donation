import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyPayHero } from '@/lib/payhero';
import { rateAllowed } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await rateAllowed(req, 'donation_status', 30, 60)) {
    return NextResponse.json({ error: 'Please wait before checking again.' }, { status: 429 });
  }

  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  const { data: donation } = await db
    .from('donations')
    .select('id,payment_status,amount,payment_reference,provider_transaction_id')
    .eq('id', id)
    .maybeSingle();
  if (!donation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (donation.payment_status === 'pending' && donation.provider_transaction_id) {
    try {
      const provider = await verifyPayHero(donation.provider_transaction_id);
      const status = String(provider.status || '').toUpperCase();
      const reference = provider.reference || provider.provider_reference || provider.third_party_reference || '';
      const referenceMatches = reference === donation.provider_transaction_id || reference === donation.payment_reference;
      const amountMatches = provider.amount === undefined || Number(provider.amount) === Number(donation.amount);
      let nextStatus: 'successful' | 'failed' | 'cancelled' | null = null;

      if (status === 'SUCCESS' && referenceMatches && amountMatches) nextStatus = 'successful';
      else if (status === 'FAILED' && referenceMatches) nextStatus = 'failed';
      else if (['CANCELLED', 'CANCELED', 'EXPIRED'].includes(status) && referenceMatches) nextStatus = 'cancelled';

      if (nextStatus) {
        const { data: updated, error } = await db
          .from('donations')
          .update({ payment_status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', donation.id)
          .eq('payment_status', 'pending')
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (updated) {
          await db.from('payment_events').insert({
            donation_id: donation.id,
            provider: 'payhero',
            event_type: 'status_reconciled_terminal',
            event_payload: { status, paymentStatus: nextStatus, providerReference: reference },
            processing_status: 'processed',
            processed_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Could not reconcile PayHero donation status:', error);
    }
  }

  const { data: latest } = await db.from('donations').select('payment_status').eq('id', id).single();
  return NextResponse.json({ status: latest?.payment_status }, { headers: { 'Cache-Control': 'no-store' } });
}
