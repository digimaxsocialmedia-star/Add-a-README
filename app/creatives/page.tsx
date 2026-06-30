import { Image as ImageIcon, Video, LayoutGrid, TrendingUp, TrendingDown } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AdCopyGenerator } from "@/components/AdCopyGenerator";
import { StatusBadge, RoasBadge } from "@/components/Badge";
import { getAds } from "@/lib/meta/client";
import { derive, sumMetrics, money, pct, intNum } from "@/lib/format";
import type { AdRow, CreativeType } from "@/lib/types";

export const dynamic = "force-dynamic";

const FORMAT_META: Record<
  CreativeType,
  { label: string; icon: typeof ImageIcon }
> = {
  IMAGE: { label: "Image", icon: ImageIcon },
  VIDEO: { label: "Video", icon: Video },
  CAROUSEL: { label: "Carousel", icon: LayoutGrid },
};

function rawOf(a: AdRow) {
  const m = a.metrics;
  return {
    spend: m.spend,
    impressions: m.impressions,
    clicks: m.clicks,
    conversions: m.conversions,
    revenue: m.revenue,
  };
}

function AdsTable({ ads, title, icon: Icon }: { ads: AdRow[]; title: string; icon: typeof TrendingUp }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Ad</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Spend</th>
                <th className="px-4 py-3 text-right font-medium">ROAS</th>
                <th className="px-4 py-3 text-right font-medium">CTR</th>
                <th className="px-4 py-3 text-right font-medium">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-400">
                      {FORMAT_META[a.creativeType].label} · {a.campaignName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {money(a.metrics.spend)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RoasBadge roas={a.metrics.roas} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {pct(a.metrics.ctr)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {intNum(a.metrics.conversions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default async function CreativesPage() {
  const ads = await getAds();
  const spending = ads.filter((a) => a.metrics.spend > 0);

  const byFormat = (["IMAGE", "VIDEO", "CAROUSEL"] as CreativeType[]).map((fmt) => {
    const items = spending.filter((a) => a.creativeType === fmt);
    const metrics = derive(sumMetrics(items.map(rawOf)));
    return { fmt, count: items.length, metrics };
  });

  const ranked = [...spending].sort((a, b) => b.metrics.roas - a.metrics.roas);
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-5).reverse();

  return (
    <>
      <TopBar
        title="Creative Studio"
        subtitle={`${ads.length} ads · performance by creative + AI copywriting`}
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {byFormat.map(({ fmt, count, metrics }) => {
            const meta = FORMAT_META[fmt];
            const Icon = meta.icon;
            return (
              <div key={fmt} className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{meta.label}</p>
                      <p className="text-xs text-slate-400">{count} ads</p>
                    </div>
                  </div>
                  <RoasBadge roas={metrics.roas} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Spend</p>
                    <p className="font-medium text-slate-800">{money(metrics.spend)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">CTR</p>
                    <p className="font-medium text-slate-800">{pct(metrics.ctr)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {top.length ? <AdsTable ads={top} title="Top performing ads" icon={TrendingUp} /> : null}
        {bottom.length ? (
          <AdsTable ads={bottom} title="Underperforming ads" icon={TrendingDown} />
        ) : null}

        <AdCopyGenerator />
      </div>
    </>
  );
}
