import {NextRequest,NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/supabase/server';
import {donationSchema} from '@/lib/validation';
import {initiatePayHero} from '@/lib/payhero';
import {rateAllowed} from '@/lib/rate-limit';
export async function POST(req:NextRequest){
 if(!await rateAllowed(req,'donation',5,3600))return NextResponse.json({error:'Please wait before trying again.'},{status:429});
 const db=supabaseAdmin();if(!db)return NextResponse.json({error:'Donations are not configured yet.'},{status:503});
 const parsed=donationSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Invalid donation details'},{status:400});
 const x=parsed.data;const{data:campaign}=await db.from('campaigns').select('id,status,deadline').eq('id',x.campaignId).eq('status','active').not('published_at','is',null).maybeSingle();
 if(!campaign)return NextResponse.json({error:'This campaign is not accepting donations.'},{status:404});if(campaign.deadline&&new Date(campaign.deadline)<new Date())return NextResponse.json({error:'This campaign has closed.'},{status:400});
 const ref=`DON-${crypto.randomUUID()}`;const{data:donation,error}=await db.from('donations').insert({campaign_id:campaign.id,donor_name:x.name,donor_email:x.email||null,donor_phone:x.phone,amount:x.amount,currency:'KES',payment_provider:'payhero',payment_reference:ref,payment_status:'pending',is_anonymous:x.anonymous}).select('id').single();
 if(error||!donation)return NextResponse.json({error:'Could not record this donation.'},{status:500});
 try{const provider=await initiatePayHero({amount:x.amount,phone:x.phone,reference:ref,name:x.name});await db.from('donations').update({provider_transaction_id:provider.reference||null}).eq('id',donation.id);await db.from('payment_events').insert({donation_id:donation.id,provider:'payhero',event_type:'payment_initiated',event_payload:{status:provider.status||'QUEUED'},processing_status:'processed',processed_at:new Date().toISOString()});return NextResponse.json({donationId:donation.id,status:'pending'});}
 catch{await db.from('payment_events').insert({donation_id:donation.id,provider:'payhero',event_type:'payment_initiation_unconfirmed',event_payload:{status:'unknown'},processing_status:'retry'});return NextResponse.json({donationId:donation.id,status:'pending'},{status:202});}
}
