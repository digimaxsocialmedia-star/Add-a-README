import Link from "next/link";
import { DollarSign, TrendingUp, MousePointerClick, Target } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { CampaignTable } from "@/components/CampaignTable";
import { getAccountSummary, getCampaigns, getDailySeries } from "@/lib/meta/client";
import { money, intNum, pct, roasFmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, series, campaigns] = await Promise.all([
    getAccountSummary(),
    getDailySeries(),
    getCampaigns(),
  ]);
  const m = summary.metrics;
  const top = [...campaigns]
    .filter((c) => c.status === "ACTIVE")
    .sort((a, b) => b.metrics.roas - a.metrics.roas)
    .slice(0, 5);

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={`${summary.activeCampaigns} active of ${summary.totalCampaigns} campaigns · last 30 days`}
        action={
          <Link href="/create" className="btn-primary">
            + New campaign
          </Link>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total spend"
            value={money(m.spend)}
            sub={`${pct(m.ctr)} CTR · ${money(m.cpc)} CPC`}
            icon={DollarSign}
            accent="brand"
          />
          <StatCard
            label="Revenue"
            value={money(m.revenue)}
            sub={`${intNum(m.conversions)} conversions`}
            icon={TrendingUp}
            accent="emerald"
          />
          <StatCard
            label="ROAS"
            value={roasFmt(m.roas)}
            sub={m.roas >= 1 ? "Profitable overall" : "Below breakeven"}
            icon={Target}
            accent={m.roas >= 1 ? "emerald" : "rose"}
          />
          <StatCard
            label="Clicks"
            value={intNum(m.clicks)}
            sub={`${intNum(m.impressions)} impressions`}
            icon={MousePointerClick}
            accent="sky"
          />
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Spend, revenue & ROAS
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Spend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> ROAS
              </span>
            </div>
          </div>
          <PerformanceChart data={series} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Top campaigns by ROAS
            </h2>
            <Link
              href="/campaigns"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </Link>
          </div>
          <CampaignTable campaigns={top} />
        </div>
      </div>
    </>
  );
}
