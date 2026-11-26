import{NextRequest,NextResponse}from'next/server';import{z}from'zod';import{requireAdmin,getUserClient}from'@/lib/supabase/auth';import{supabaseAdmin}from'@/lib/supabase/server';import{verifyPayHero}from'@/lib/payhero';
const input=z.object({donationId:z.string().uuid(),amount:z.coerce.number().positive(),providerReference:z.string().trim().min(3).max(100),mpesaReceipt:z.string().trim().min(3).max(100)});
const verifyInput=z.object({mode:z.literal('verify'),donationId:z.string().uuid()});
export async function POST(req:NextRequest){
 const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>null);const verify=verifyInput.safeParse(body);
 if(verify.success){
  const db=supabaseAdmin();if(!db)return NextResponse.json({error:'Payments are unavailable.'},{status:503});
  const{data:d}=await db.from('donations').select('id,amount,payment_reference,provider_transaction_id,payment_status').eq('id',verify.data.donationId).maybeSingle();
  if(!d)return NextResponse.json({error:'Donation not found.'},{status:404});
  if(d.payment_status!=='pending')return NextResponse.json({status:d.payment_status});
  if(!d.provider_transaction_id)return NextResponse.json({error:'This payment has no PayHero transaction reference yet.'},{status:400});
  try{
   const result=await verifyPayHero(d.provider_transaction_id);const providerReference=result.reference||result.provider_reference||result.third_party_reference||null;
   const matches=!providerReference||providerReference===d.provider_transaction_id||providerReference===d.payment_reference;
   const amountMatches=result.amount===undefined||Number(result.amount)===Number(d.amount);
   const providerStatus=String(result.status||'').toUpperCase();
   let status=d.payment_status;
   if(providerStatus==='SUCCESS'&&matches&&amountMatches)status='successful';
   else if(['FAILED','CANCELLED','EXPIRED'].includes(providerStatus))status=providerStatus==='FAILED'?'failed':'cancelled';
   if(status!==d.payment_status){
    const{error}=await db.from('donations').update({payment_status:status,updated_at:new Date().toISOString()}).eq('id',d.id).eq('payment_status','pending');
    if(error)return NextResponse.json({error:'Could not update the payment record.'},{status:500});
   }
   await db.from('payment_events').insert({donation_id:d.id,provider:'payhero',event_type:'admin_status_reconciliation',event_payload:{status:providerStatus,providerReference},processing_status:'processed',processed_at:new Date().toISOString()});
   return NextResponse.json({status});
  }catch{return NextResponse.json({error:'PayHero could not verify this payment right now.'},{status:502})}
 }
 const parsed=input.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Enter the checked amount, PayHero reference, and M-Pesa receipt.'},{status:400});
 const v=parsed.data;const db=await getUserClient();const{error}=await db.rpc('admin_reconcile_donation',{p_id:v.donationId,p_amount:v.amount,p_provider_reference:v.providerReference,p_mpesa_receipt:v.mpesaReceipt});
 if(error)return NextResponse.json({error:error.message.includes('not match')?'The amount does not match the pending donation.':'Could not reconcile this donation.'},{status:400});
 return NextResponse.json({ok:true});
}
