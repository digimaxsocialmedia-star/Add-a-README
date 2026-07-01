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
        title="Tổng quan"
        subtitle={`${summary.activeCampaigns}/${summary.totalCampaigns} chiến dịch đang chạy · 30 ngày gần nhất`}
        action={
          <Link href="/create" className="btn-primary">
            + Chiến dịch mới
          </Link>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tổng chi tiêu"
            value={money(m.spend)}
            sub={`CTR ${pct(m.ctr)} · CPC ${money(m.cpc)}`}
            icon={DollarSign}
            accent="brand"
          />
          <StatCard
            label="Doanh thu"
            value={money(m.revenue)}
            sub={`${intNum(m.conversions)} chuyển đổi`}
            icon={TrendingUp}
            accent="emerald"
          />
          <StatCard
            label="ROAS"
            value={roasFmt(m.roas)}
            sub={m.roas >= 1 ? "Có lãi tổng thể" : "Dưới điểm hòa vốn"}
            icon={Target}
            accent={m.roas >= 1 ? "emerald" : "rose"}
          />
          <StatCard
            label="Lượt nhấp"
            value={intNum(m.clicks)}
            sub={`${intNum(m.impressions)} lượt hiển thị`}
            icon={MousePointerClick}
            accent="sky"
          />
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Chi tiêu, doanh thu & ROAS
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Chi tiêu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Doanh thu
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
              Chiến dịch ROAS cao nhất
            </h2>
            <Link
              href="/campaigns"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Xem tất cả →
            </Link>
          </div>
          <CampaignTable campaigns={top} />
        </div>
      </div>
    </>
  );
}
