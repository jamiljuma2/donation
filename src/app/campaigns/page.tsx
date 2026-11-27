import CampaignBrowser from '@/components/campaign-browser';
import { getCampaigns } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();
  return <CampaignBrowser campaigns={campaigns}/>;
}
