import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { CampaignTable } from "@/components/CampaignTable";
import { getCampaigns } from "@/lib/meta/client";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();
  const sorted = [...campaigns].sort((a, b) => b.metrics.spend - a.metrics.spend);

  return (
    <>
      <TopBar
        title="Campaigns"
        subtitle={`${campaigns.length} campaigns in this ad account`}
        action={
          <Link href="/create" className="btn-primary">
            + New campaign
          </Link>
        }
      />
      <div className="p-6">
        <CampaignTable campaigns={sorted} />
      </div>
    </>
  );
}
