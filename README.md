# GiveHope

A single Next.js application for public campaign browsing, guest M-Pesa donations, and administrator managed campaigns and disbursements.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase PostgreSQL, Auth, Storage, and Row Level Security
- PayHero M-Pesa STK Push (server-to-server)

## Local development

1. Install Node.js 20 or newer and dependencies:

   ```sh
   npm install
   cp .env.example .env.local
   ```

2. Create a Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Never expose or commit the service-role key.

3. Apply `supabase/migrations/0001_initial.sql` using the Supabase SQL Editor or Supabase CLI. The migration creates the tables, RLS policies, public financial summary, private contact/payment tables, campaign image bucket, and finance RPC functions.

4. Create the first administrator:
   - In Supabase Authentication, invite/create the administrator account and require a strong password plus MFA in project authentication settings.
   - In SQL Editor, insert the matching auth user into `public.profiles` (only for the first admin):

     ```sql
     insert into public.profiles(id, full_name, email, role)
     select id, 'Platform Administrator', email, 'admin'
     from auth.users where email = 'admin@example.org';
     ```

     To add a finance operator, repeat with `role='finance_admin'`. Protect profile changes with reviewed database access. The application's service-role key is never sent to browsers.

5. Start the site:

   ```sh
   npm run dev
   ```

   Public site: `http://localhost:3000`; administrator area: `/admin`.

## Demo campaigns

`supabase/dev_seed.sql` contains clearly labelled demonstration campaigns and must only be applied to a development project. It does not create successful donations or fabricate payment totals. Do not apply it to production.

## PayHero M-Pesa setup

The integration follows the official PayHero developer documentation for its Basic Auth credentials and payment endpoints:

- [PayHero API overview](https://docs.payhero.co.ke/)
- [Initiate M-Pesa STK Push](https://docs.payhero.co.ke/docs/post-initiate-mpesa-stk-push-request)
- [Payment callback structure](https://docs.payhero.co.ke/docs/payment-callback)
- [Transaction status lookup](https://docs.payhero.co.ke/docs/get-transaction-status)

Set these server-side variables:

```env
PAYHERO_API_USERNAME=
PAYHERO_API_PASSWORD=
PAYHERO_CHANNEL_ID=
PAYHERO_CALLBACK_URL=https://your-project-ref.supabase.co/functions/v1/payhero-callback
```

The callback URL should point to the deployed Supabase `payhero-callback` Edge Function over public HTTPS. Each payment request adds its donation `payment_reference` as the `reference_id` query parameter. The function matches that value against PayHero's `ExternalReference`, verifies the transaction with PayHero's transaction-status endpoint, and checks the amount before recording success. Callbacks are idempotent. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function. Set `PAYHERO_API_USERNAME` and `PAYHERO_API_PASSWORD` as function secrets, then deploy with JWT verification disabled for the provider callback.

Run controlled end-to-end tests with PayHero test credits or an approved test channel before accepting live donations. Confirm with PayHero that pooled donation collection and onward beneficiary disbursement are permitted for your merchant arrangement. PayHero credentials are not required for the app to build, but without them donations remain unavailable. International cards are not enabled.

## Supabase storage and security

The migration creates a public `campaign-covers` bucket for published campaign cover images, limited to JPG/PNG/WebP and 5 MB uploads. Authenticated admins may upload under their own user folder. Do not put private beneficiary documents in this public bucket. A separate private bucket and signed URL workflow should be configured before storing confidential documents.

The service-role key is used only by server routes. Public campaign totals come from an aggregate view that does not expose donor records. Donations and payment events have no public read policy. All financial status transitions are server initiated; disbursement request and approval RPCs check the authenticated admin and prevent self approval.

## Deployment

Deploy the Next.js application to Vercel or another Node.js hosting platform. Configure all variables from `.env.example` in the host's server environment; never add secrets to `NEXT_PUBLIC_*`. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin and configure the callback URL to `https://<your-domain>/api/payhero/callback`. Configure Cloudflare DNS/proxy and HTTPS, restrict the Supabase service-role secret to the deployment, and enable Supabase Auth MFA for staff. Re-run the controlled test flow after the production callback becomes reachable.

## Operational notes

- Donation limits are enforced server-side (KES 50–150,000 per transaction).
- The site records contact messages in Supabase. Configure a mailbox/provider separately before advertising a response-time promise; outbound email/receipt delivery is not configured in this starter.
- Receipts are available to print/save as PDF after a verified successful payment. Pending and failed payments do not get receipts.
- The admin dashboard supports campaign creation/status changes, donation overview, requests, approvals, and recorded disbursement completion. It does not initiate payouts; staff must verify an actual transfer before recording its reference.
- Legal pages have editable starter copy in `src/app/{privacy,terms,donation-policy,refund-policy,faq}/page.tsx`. Review and update these pages for your real operating model and obtain appropriate Kenyan legal, tax, payment and data-protection advice before launch.
- No campaign application form, international card processor, outbound email, or automated beneficiary payout is enabled.

## Checks

Use `npm run build` for a production compile. Test the full lifecycle in a dedicated Supabase/PayHero test account: create and publish a campaign; trigger pending, success, and failure callbacks; replay callback events; verify correct totals and receipt gating; confirm RLS and admin/finance separation; create a disbursement request and test self-approval rejection; and verify the completed transfer reference and audit entry. Do not test against live donors or payouts.
