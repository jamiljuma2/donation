create extension if not exists pgcrypto;
create type public.admin_role as enum ('admin','finance_admin');
create type public.campaign_status as enum ('draft','active','completed','closed','suspended');
create type public.payment_status as enum ('pending','successful','failed','cancelled','refunded','reversed');
create type public.disbursement_status as enum ('pending','approved','rejected','processing','completed','failed','cancelled');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text not null,email text not null unique,role public.admin_role not null default 'admin',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.campaigns(id uuid primary key default gen_random_uuid(),title text not null,slug text not null unique,short_description text not null,description text not null,cover_image_url text,category text not null,fundraising_goal numeric(12,2) not null check(fundraising_goal>0),currency char(3) not null default 'KES' check(currency='KES'),deadline date,beneficiary_name text,beneficiary_description text,status public.campaign_status not null default 'draft',published_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(status<>'active' or published_at is not null));
create index campaigns_public_idx on public.campaigns(status,published_at desc);
create table public.donations(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.campaigns(id),donor_name text not null,donor_email text,donor_phone text,amount numeric(12,2) not null check(amount between 50 and 150000),currency char(3) not null default 'KES' check(currency='KES'),payment_provider text not null,payment_reference text not null unique,provider_transaction_id text unique,payment_status public.payment_status not null default 'pending',is_anonymous boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index donations_campaign_status_idx on public.donations(campaign_id,payment_status);
create table public.payment_events(id uuid primary key default gen_random_uuid(),donation_id uuid not null references public.donations(id),provider text not null,provider_event_reference text unique,event_type text not null,event_payload jsonb not null default '{}'::jsonb,processing_status text not null default 'received' check(processing_status in ('received','processed','retry','rejected')),received_at timestamptz not null default now(),processed_at timestamptz);
create table public.disbursements(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.campaigns(id),beneficiary_name text not null,amount numeric(12,2) not null check(amount>0),currency char(3) not null default 'KES',purpose text not null,supporting_document_url text,status public.disbursement_status not null default 'pending',requested_by uuid not null references public.profiles(id),approved_by uuid references public.profiles(id),transfer_reference text,requested_at timestamptz not null default now(),approved_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(approved_by is null or approved_by<>requested_by),check(status<>'completed' or (transfer_reference is not null and completed_at is not null)));
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(),admin_id uuid not null references public.profiles(id),action text not null,entity_type text not null,entity_id uuid,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table public.contact_messages(id uuid primary key default gen_random_uuid(),name text not null,email text not null,subject text not null,message text not null,status text not null default 'new' check(status in ('new','read','resolved')),created_at timestamptz not null default now());
create table public.donation_adjustments(id uuid primary key default gen_random_uuid(),donation_id uuid not null references public.donations(id),adjustment_type text not null check(adjustment_type in ('refund','chargeback','fee')),amount numeric(12,2) not null check(amount>0),reference text,notes text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index donation_adjustments_donation_idx on public.donation_adjustments(donation_id);
create table public.api_rate_limits(key_hash text primary key,window_started_at timestamptz not null,request_count integer not null check(request_count>0));
alter table public.api_rate_limits enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid()); $$;
create or replace function public.is_finance_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','finance_admin')); $$;
alter table public.profiles enable row level security;alter table public.campaigns enable row level security;alter table public.donations enable row level security;alter table public.payment_events enable row level security;alter table public.disbursements enable row level security;alter table public.admin_audit_logs enable row level security;alter table public.contact_messages enable row level security;alter table public.donation_adjustments enable row level security;
create policy "public read active published campaigns" on public.campaigns for select using(status='active' and published_at is not null);
create policy "admins manage campaigns" on public.campaigns for all using(public.is_admin()) with check(public.is_admin());
create policy "admins read profiles" on public.profiles for select using(public.is_admin());
create policy "admins read donations" on public.donations for select using(public.is_admin());
create policy "admins read payment events" on public.payment_events for select using(public.is_admin());
create policy "admins read disbursements" on public.disbursements for select using(public.is_admin());
create policy "admins write disbursements" on public.disbursements for insert with check(public.is_admin());
create policy "admins update disbursements" on public.disbursements for update using(public.is_admin()) with check(public.is_admin());
create policy "admins read audit" on public.admin_audit_logs for select using(public.is_admin());
create policy "admins write audit" on public.admin_audit_logs for insert with check(public.is_admin());
create policy "admins manage contact" on public.contact_messages for all using(public.is_admin()) with check(public.is_admin());
create policy "admins manage adjustments" on public.donation_adjustments for all using(public.is_admin()) with check(public.is_admin());
-- Totals are calculated from settled donations less recorded refunds/reversals; no client supplied totals are stored.
create or replace view public.campaign_financials as select c.id campaign_id,greatest(0,coalesce((select sum(d.amount) from public.donations d where d.campaign_id=c.id and d.payment_status='successful'),0)-coalesce((select sum(a.amount) from public.donation_adjustments a join public.donations d on d.id=a.donation_id where d.campaign_id=c.id and a.adjustment_type in ('refund','chargeback')),0)) raised from public.campaigns c where c.status='active' and c.published_at is not null;
create or replace function public.create_initial_admin(user_id uuid,admin_name text,admin_email text) returns void language plpgsql security definer set search_path=public as $$ begin if exists(select 1 from public.profiles) then raise exception 'An administrator profile already exists'; end if; insert into public.profiles(id,full_name,email,role) values(user_id,admin_name,admin_email,'admin'); end $$;
revoke all on function public.create_initial_admin(uuid,text,text) from public,anon,authenticated;
grant select on public.campaign_financials to anon,authenticated;
grant select on public.campaigns to anon,authenticated;
grant select on public.profiles,public.donations,public.payment_events,public.disbursements,public.admin_audit_logs,public.contact_messages,public.donation_adjustments to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('campaign-covers','campaign-covers',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "admins upload campaign covers" on storage.objects for insert to authenticated with check(bucket_id='campaign-covers' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy "admins update campaign covers" on storage.objects for update to authenticated using(bucket_id='campaign-covers' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy "public read campaign covers" on storage.objects for select to anon,authenticated using(bucket_id='campaign-covers');

create or replace function public.admin_request_disbursement(p_campaign uuid,p_beneficiary text,p_amount numeric,p_purpose text) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; available numeric;
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_amount<=0 then raise exception 'Amount must be positive'; end if;
 perform pg_advisory_xact_lock(hashtext(p_campaign::text));
 select coalesce((select sum(amount) from public.donations where campaign_id=p_campaign and payment_status='successful'),0)
 -coalesce((select sum(amount) from public.donation_adjustments a join public.donations d on d.id=a.donation_id where d.campaign_id=p_campaign and a.adjustment_type in ('refund','chargeback','fee')),0)
 -coalesce((select sum(amount) from public.disbursements where campaign_id=p_campaign and status in ('pending','approved','processing','completed')),0) into available;
 if p_amount>available then raise exception 'Insufficient available funds'; end if;
 insert into public.disbursements(campaign_id,beneficiary_name,amount,purpose,requested_by) values(p_campaign,p_beneficiary,p_amount,p_purpose,auth.uid()) returning id into new_id;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details) values(auth.uid(),'disbursement_requested','disbursement',new_id,jsonb_build_object('campaign_id',p_campaign,'amount',p_amount));
 return new_id;
end $$;
create or replace function public.admin_approve_disbursement(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare row_data public.disbursements;
begin
 if not public.is_finance_admin() then raise exception 'Not authorized'; end if;
 select * into row_data from public.disbursements where id=p_id for update;
 if not found or row_data.status<>'pending' then raise exception 'Disbursement is not pending'; end if;
 if row_data.requested_by=auth.uid() then raise exception 'Requester cannot approve their own disbursement'; end if;
 update public.disbursements set status=case when p_approve then 'approved'::public.disbursement_status else 'rejected'::public.disbursement_status end,approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_id;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details) values(auth.uid(),case when p_approve then 'disbursement_approved' else 'disbursement_rejected' end,'disbursement',p_id,'{}');
end $$;
create or replace function public.admin_complete_disbursement(p_id uuid,p_reference text) returns void language plpgsql security definer set search_path=public as $$
declare row_data public.disbursements;
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 if length(trim(p_reference))<3 then raise exception 'Transfer reference is required'; end if;
 select * into row_data from public.disbursements where id=p_id for update;
 if not found or row_data.status not in ('approved','processing') then raise exception 'Disbursement is not approved'; end if;
 update public.disbursements set status='completed',transfer_reference=trim(p_reference),completed_at=now(),updated_at=now() where id=p_id;
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details) values(auth.uid(),'disbursement_completed','disbursement',p_id,jsonb_build_object('transfer_reference',trim(p_reference)));
end $$;
create or replace function public.admin_reconcile_donation(p_id uuid,p_amount numeric,p_provider_reference text,p_mpesa_receipt text) returns void language plpgsql security definer set search_path=public as $$
declare row_data public.donations;
begin
 if not public.is_finance_admin() then raise exception 'Not authorized'; end if;
 if length(trim(p_provider_reference))<3 or length(trim(p_mpesa_receipt))<3 then raise exception 'Provider and M-Pesa references are required'; end if;
 select * into row_data from public.donations where id=p_id for update;
 if not found or row_data.payment_status<>'pending' then raise exception 'Donation is not pending'; end if;
 if p_amount<>row_data.amount then raise exception 'Reconciled amount does not match the donation'; end if;
 update public.donations set payment_status='successful',provider_transaction_id=trim(p_provider_reference),updated_at=now() where id=p_id;
 insert into public.payment_events(donation_id,provider,provider_event_reference,event_type,event_payload,processing_status,processed_at) values(p_id,row_data.payment_provider,'manual:'||trim(p_mpesa_receipt),'manual_reconciliation',jsonb_build_object('amount',p_amount,'providerReference',trim(p_provider_reference),'mpesaReceipt',trim(p_mpesa_receipt)), 'processed',now());
 insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,details) values(auth.uid(),'donation_manually_reconciled','donation',p_id,jsonb_build_object('amount',p_amount,'provider_reference',trim(p_provider_reference),'mpesa_receipt',trim(p_mpesa_receipt)));
end $$;
grant execute on function public.admin_request_disbursement(uuid,text,numeric,text) to authenticated;
grant execute on function public.admin_approve_disbursement(uuid,boolean) to authenticated;
grant execute on function public.admin_complete_disbursement(uuid,text) to authenticated;
grant execute on function public.admin_reconcile_donation(uuid,numeric,text,text) to authenticated;
create or replace function public.consume_rate_limit(p_key_hash text,p_max integer,p_window_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
 insert into public.api_rate_limits(key_hash,window_started_at,request_count) values(p_key_hash,now(),1)
 on conflict(key_hash) do update set window_started_at=case when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<now() then now() else public.api_rate_limits.window_started_at end,request_count=case when public.api_rate_limits.window_started_at+make_interval(secs=>p_window_seconds)<now() then 1 else public.api_rate_limits.request_count+1 end;
 select request_count<=p_max into allowed from public.api_rate_limits where key_hash=p_key_hash;
 return allowed;
end $$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
