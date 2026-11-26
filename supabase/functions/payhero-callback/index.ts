import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const referenceId = new URL(request.url).searchParams.get('reference_id')?.trim();
  if (!referenceId || referenceId.length > 100) return json({ error: 'Invalid reference_id' }, 400);

  const payload = await request.json().catch(() => null);
  const response = payload?.response;
  const externalReference = String(response?.ExternalReference ?? '');
  const checkoutId = String(response?.CheckoutRequestID ?? '');
  if (!response || externalReference !== referenceId) return json({ error: 'Reference mismatch' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const username = Deno.env.get('PAYHERO_API_USERNAME');
  const password = Deno.env.get('PAYHERO_API_PASSWORD');
  if (!supabaseUrl || !serviceRoleKey || !username || !password) {
    console.error('Missing Supabase or PayHero callback secrets');
    return json({ error: 'Callback is not configured' }, 503);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: donation, error: donationError } = await db
    .from('donations')
    .select('id,amount,payment_status,payment_reference,provider_transaction_id')
    .eq('payment_reference', referenceId)
    .maybeSingle();
  if (donationError) return json({ error: 'Could not look up donation' }, 500);
  if (!donation) return json({ error: 'Unknown reference' }, 404);

  const eventReference = checkoutId || `${referenceId}:${response.ResultCode ?? response.Status ?? 'unknown'}`;
  const { data: event, error: eventError } = await db
    .from('payment_events')
    .upsert({
      donation_id: donation.id,
      provider: 'payhero',
      provider_event_reference: eventReference,
      event_type: 'callback_received',
      event_payload: {
        status: response.Status,
        amount: response.Amount,
        resultCode: response.ResultCode,
        checkoutRequestId: checkoutId,
        referenceId,
      },
      processing_status: 'received',
    }, { onConflict: 'provider_event_reference', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (eventError) return json({ error: 'Could not record callback' }, 500);
  if (!event) return json({ ok: true, duplicate: true });

  try {
    const authorization = `Basic ${btoa(`${username}:${password}`)}`;
    const verifyResponse = await fetch(
      `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(donation.provider_transaction_id || referenceId)}`,
      { headers: { Authorization: authorization, 'Content-Type': 'application/json' } },
    );
    if (!verifyResponse.ok) throw new Error('PayHero verification request failed');
    const verified = await verifyResponse.json();
    const verifiedReference = verified.reference || verified.provider_reference || verified.third_party_reference;
    const valid = String(verified.status ?? '').toUpperCase() === 'SUCCESS'
      && Number(response.Amount) === Number(donation.amount)
      && (verified.amount === undefined || Number(verified.amount) === Number(donation.amount))
      && (!verifiedReference
        || verifiedReference === donation.provider_transaction_id
        || verifiedReference === referenceId
        || verifiedReference === response.MpesaReceiptNumber);

    let nextStatus = donation.payment_status;
    if (valid) nextStatus = 'successful';
    else if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(String(verified.status ?? '').toUpperCase())) {
      nextStatus = String(verified.status).toUpperCase() === 'FAILED' ? 'failed' : 'cancelled';
    }

    if (nextStatus !== donation.payment_status && donation.payment_status === 'pending') {
      const { error } = await db.from('donations').update({
        payment_status: nextStatus,
        provider_transaction_id: donation.provider_transaction_id || verifiedReference || null,
      }).eq('id', donation.id).eq('payment_status', 'pending');
      if (error) throw error;
    }

    await db.from('payment_events').update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    }).eq('id', event.id);
    return json({ ok: true });
  } catch (error) {
    console.error('PayHero callback verification failed', error);
    await db.from('payment_events').update({
      processing_status: 'retry',
      processed_at: new Date().toISOString(),
    }).eq('id', event.id);
    return json({ ok: true, pending: true });
  }
});
