"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Download, Bell, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PerformanceChart } from "@/components/PerformanceChart";
import { RoasBadge } from "@/components/Badge";
import { derive, sumMetrics, money, pct, intNum, roasFmt } from "@/lib/format";
import type {
  Alert,
  CampaignWithMetrics,
  SeriesPoint,
  Severity,
} from "@/lib/types";

interface ReportData {
  series: SeriesPoint[];
  campaigns: CampaignWithMetrics[];
  alerts: Alert[];
  mode: "live" | "demo";
}

const WINDOWS = [7, 14, 30];

const SEV_META: Record<Severity, { icon: typeof Info; cls: string }> = {
  high: { icon: AlertOctagon, cls: "border-rose-200 bg-rose-50 text-rose-800" },
  medium: { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-800" },
  low: { icon: Info, cls: "border-sky-200 bg-sky-50 text-sky-800" },
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch("/api/report", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const series = data.series.slice(-days);
    const dateSet = new Set(series.map((s) => s.date));
    const totals = derive(sumMetrics(series));

    const rows = data.campaigns.map((c) => {
      const hasDaily = c.daily && c.daily.length > 0;
      const pts = hasDaily ? c.daily.filter((d) => dateSet.has(d.date)) : [];
      const metrics = hasDaily ? derive(sumMetrics(pts)) : c.metrics;
      return { id: c.id, name: c.name, status: c.status, metrics, windowed: hasDaily };
    });
    rows.sort((a, b) => b.metrics.spend - a.metrics.spend);
    return { series, totals, rows };
  }, [data, days]);

  function exportCsv() {
    if (!view) return;
    const header = ["Campaign", "Status", "Spend", "Revenue", "ROAS", "CTR(%)", "Conversions"];
    const lines = view.rows.map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.status,
        r.metrics.spend.toFixed(2),
        r.metrics.revenue.toFixed(2),
        r.metrics.roas.toFixed(2),
        r.metrics.ctr.toFixed(2),
        r.metrics.conversions,
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adpilot-report-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <TopBar
        title="Reports & Alerts"
        subtitle="Custom reporting windows, exports, and anomaly alerts"
        action={
          <button className="btn-ghost" onClick={exportCsv} disabled={!view}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />
      <div className="space-y-6 p-6">
        {loading || !view || !data ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
          </div>
        ) : (
          <>
            {/* Alerts */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900">
                  Alerts ({data.alerts.length})
                </h2>
              </div>
              {data.alerts.length ? (
                <div className="space-y-2">
                  {data.alerts.map((a) => {
                    const meta = SEV_META[a.severity];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={a.id}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${meta.cls}`}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">{a.title}</p>
                          <p className="opacity-90">{a.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-6 text-center text-sm text-slate-400">
                  No anomalies detected — everything looks stable.
                </div>
              )}
            </div>

            {/* Window selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Window:</span>
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setDays(w)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    days === w
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Last {w}d
                </button>
              ))}
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi label="Spend" value={money(view.totals.spend)} />
              <Kpi label="Revenue" value={money(view.totals.revenue)} />
              <Kpi label="ROAS" value={roasFmt(view.totals.roas)} />
              <Kpi label="Conversions" value={intNum(view.totals.conversions)} />
              <Kpi label="CTR" value={pct(view.totals.ctr)} />
            </div>

            {/* Chart */}
            <div className="card p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Trend ({days} days)
              </h2>
              <PerformanceChart data={view.series} />
            </div>

            {/* Per-campaign breakdown */}
            <div>
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Campaign breakdown
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3 font-medium">Campaign</th>
                        <th className="px-4 py-3 text-right font-medium">Spend</th>
                        <th className="px-4 py-3 text-right font-medium">Revenue</th>
                        <th className="px-4 py-3 text-right font-medium">ROAS</th>
                        <th className="px-4 py-3 text-right font-medium">CTR</th>
                        <th className="px-4 py-3 text-right font-medium">Conv.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {view.rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {r.name}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {money(r.metrics.spend)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {money(r.metrics.revenue)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RoasBadge roas={r.metrics.roas} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {pct(r.metrics.ctr)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {intNum(r.metrics.conversions)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {data.mode === "live" ? (
                <p className="mt-2 text-xs text-slate-400">
                  In live mode the per-campaign breakdown reflects the configured
                  reporting window; the window buttons re-window the account-level
                  trend above.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
