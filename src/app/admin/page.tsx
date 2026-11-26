import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { money } from '@/lib/types';
import AdminLogin from '@/components/admin-login';
import AdminCampaignForm from '@/components/admin-campaign-form';
import CampaignStatusControl from '@/components/campaign-status-control';
import AdminDisbursements from '@/components/admin-disbursements';
import AdminContactMessages from '@/components/admin-contact-messages';
import ReconcileDonation from '@/components/reconcile-donation';
import ManualReconcileDonation from '@/components/manual-reconcile-donation';
import AdminSignOut from '@/components/admin-sign-out';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Administrator dashboard | GiveHope',
  robots: { index: false, follow: false },
};

export default async function Admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <main className="wrap section"><div className="admin-login-panel"><div className="eyebrow">Administrator access</div><h1>Dashboard unavailable</h1><p className="muted">Configure the Supabase environment values to use the dashboard.</p></div></main>;
  }

  const session = await requireAdmin();
  if (!session) return <main className="wrap section"><div className="admin-login-panel"><div className="eyebrow">Administrator access</div><h1>Sign in</h1><p className="muted">Use your GiveHope administrator account.</p><AdminLogin/></div></main>;

  const db = supabaseAdmin();
  if (!db) return <main className="wrap section"><h1>Dashboard unavailable</h1><p className="muted">The database connection is not configured.</p></main>;

  const [donationsCount, activeCount, completedCount, pendingCount, pendingDisbursementCount, openMessagesCount, financialsResult, adjustmentsResult, campaignsResult, donationsResult] = await Promise.all([
    db.from('donations').select('*', { count: 'exact', head: true }),
    db.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    db.from('donations').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
    db.from('disbursements').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('contact_messages').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
    db.from('donations').select('amount').eq('payment_status', 'successful'),
    db.from('donation_adjustments').select('amount').in('adjustment_type', ['refund', 'chargeback']),
    db.from('campaigns').select('id,title,slug,status,category,fundraising_goal').order('created_at', { ascending: false }).limit(100),
    db.from('donations').select('id,donor_name,donor_email,amount,currency,payment_status,payment_reference,payment_provider,provider_transaction_id,created_at,campaigns(title)').order('created_at', { ascending: false }).limit(25),
  ]);

  const campaigns = campaignsResult.data || [];
  const recent = donationsResult.data || [];
  const isAdmin = session.profile.role === 'admin';
  const canManageFinance = isAdmin || session.profile.role === 'finance_admin';
  const raised = Math.max(0,
    (financialsResult.data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0)
    - (adjustmentsResult.data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0),
  );
  const metrics = [
    { label: 'Net donations', value: money(raised), note: 'Successful payments after recorded refunds' },
    { label: 'All donations', value: String(donationsCount.count || 0), note: 'Every payment attempt' },
    { label: 'Active campaigns', value: String(activeCount.count || 0), note: 'Visible to the public' },
    { label: 'Completed campaigns', value: String(completedCount.count || 0), note: 'Campaigns marked complete' },
    { label: 'Pending payments', value: String(pendingCount.count || 0), note: 'Awaiting provider confirmation' },
    { label: 'Pending disbursements', value: String(pendingDisbursementCount.count || 0), note: 'Awaiting review' },
  ];

  return (
    <main className="wrap section admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <div className="eyebrow">GiveHope · {session.profile.role.replace('_', ' ')}</div>
          <h1>Welcome, {session.profile.full_name}</h1>
          <p className="muted">Review campaign activity, payments, and requests.</p>
        </div>
        <div className="admin-header-actions">
          <Link className="btn light" href="/">View public site</Link>
          <AdminSignOut/>
        </div>
      </header>

      <nav className="admin-shortcuts" aria-label="Dashboard sections">
        <a href="#campaigns">Campaigns</a>
        <a href="#donations">Donations</a>
        {canManageFinance && <a href="#disbursements">Disbursements</a>}
        <a href="#messages">Messages <span>{openMessagesCount.count || 0}</span></a>
      </nav>

      <section aria-label="Platform summary" className="admin-metrics">
        {metrics.map((metric) => <article className="admin-metric" key={metric.label}>
          <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small>
        </article>)}
      </section>

      <section className="admin-panel" id="campaigns">
        <div className="admin-section-heading">
          <div><div className="eyebrow">Fundraising</div><h2>Campaigns</h2></div>
          <span className="muted">{campaigns.length} most recent</span>
        </div>
        {isAdmin && <details className="admin-create-campaign">
          <summary>Create campaign</summary>
          <div className="admin-create-content"><AdminCampaignForm/></div>
        </details>}
        {campaignsResult.error ? <p className="admin-alert" role="alert">Campaigns could not be loaded.</p> : campaigns.length ? (
          <div className="admin-campaign-list">
            {campaigns.map((campaign) => <article className="admin-campaign-row" key={campaign.id}>
              <div className="admin-campaign-info">
                <span className={`admin-status admin-status-${campaign.status}`}>{campaign.status}</span>
                <h3>{campaign.title}</h3>
                <p className="muted">{campaign.category} · Goal {money(Number(campaign.fundraising_goal))}</p>
              </div>
              <div className="admin-campaign-actions">
                {campaign.status === 'active' && <Link href={`/campaigns/${campaign.slug}`}>Preview</Link>}
                {isAdmin && <CampaignStatusControl id={campaign.id} status={campaign.status}/>}
              </div>
            </article>)}
          </div>
        ) : <p className="muted">No campaigns have been created yet.</p>}
      </section>

      <section className="admin-panel" id="donations">
        <div className="admin-section-heading">
          <div><div className="eyebrow">Payments</div><h2>Recent donations</h2></div>
          <span className="muted">Latest {recent.length}</span>
        </div>
        {donationsResult.error ? <p className="admin-alert" role="alert">Donation records could not be loaded.</p> : recent.length ? (
          <div className="admin-donation-list">
            {recent.map((donation) => {
              const campaign = donation.campaigns as unknown as { title: string } | null;
              return <article className="admin-donation-row" key={donation.id}>
                <div className="admin-donation-main">
                  <span className={`admin-status admin-status-${donation.payment_status}`}>{donation.payment_status}</span>
                  <strong>{money(Number(donation.amount), donation.currency)}</strong>
                  <span>{donation.donor_name}</span>
                  <small>{campaign?.title || 'Campaign'} · {new Date(donation.created_at).toLocaleString('en-KE')}</small>
                  <code>{donation.payment_reference}</code>
                </div>
                {donation.payment_status === 'pending' && donation.payment_provider === 'payhero' && <div className="admin-payment-actions">
                  <ReconcileDonation id={donation.id}/>
                  {canManageFinance && <ManualReconcileDonation id={donation.id} amount={Number(donation.amount)}/>}
                </div>}
              </article>;
            })}
          </div>
        ) : <p className="muted">No donations have been recorded yet.</p>}
      </section>

      {canManageFinance && <section className="admin-panel" id="disbursements"><AdminDisbursements campaigns={campaigns.map(({ id, title }) => ({ id, title }))}/></section>}
      <AdminContactMessages/>
    </main>
  );
}
