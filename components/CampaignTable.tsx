import { OBJECTIVE_LABELS } from "@/lib/types";
import type { CampaignWithMetrics } from "@/lib/types";
import { money, intNum, pct } from "@/lib/format";
import { RoasBadge, StatusBadge } from "./Badge";

export function CampaignTable({
  campaigns,
}: {
  campaigns: CampaignWithMetrics[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Budget/day</th>
              <th className="px-4 py-3 text-right font-medium">Spend</th>
              <th className="px-4 py-3 text-right font-medium">Revenue</th>
              <th className="px-4 py-3 text-right font-medium">ROAS</th>
              <th className="px-4 py-3 text-right font-medium">CTR</th>
              <th className="px-4 py-3 text-right font-medium">Conv.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-400">
                    {OBJECTIVE_LABELS[c.objective]} · {c.adSets.length} ad set
                    {c.adSets.length === 1 ? "" : "s"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {money(c.dailyBudget)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {money(c.metrics.spend)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {money(c.metrics.revenue)}
                </td>
                <td className="px-4 py-3 text-right">
                  <RoasBadge roas={c.metrics.roas} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {pct(c.metrics.ctr)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {intNum(c.metrics.conversions)}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  No campaigns yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
