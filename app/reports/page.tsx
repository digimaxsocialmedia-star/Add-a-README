"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Download,
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  Mail,
  Send,
  BellRing,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PerformanceChart } from "@/components/PerformanceChart";
import { RoasBadge } from "@/components/Badge";
import { derive, sumMetrics, money, pct, intNum, roasFmt } from "@/lib/format";
import { comparePeriods } from "@/lib/report/compare";
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

interface EmailResult {
  sent: boolean;
  subject: string;
  to?: string;
  preview?: string;
  note?: string;
  error?: string;
}

interface NotifyResult {
  channels: string[];
  results?: { channel: string; ok: boolean; error?: string }[];
  newAlerts?: Alert[];
  note?: string;
  test?: boolean;
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
  const [emailTo, setEmailTo] = useState("");
  const [emailBusy, setEmailBusy] = useState<null | "preview" | "send">(null);
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);
  const [alertChannels, setAlertChannels] = useState<string[]>([]);
  const [alertBusy, setAlertBusy] = useState<null | "test" | "send">(null);
  const [alertResult, setAlertResult] = useState<NotifyResult | null>(null);

  useEffect(() => {
    fetch("/api/alerts/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "status" }),
    })
      .then((r) => r.json())
      .then((d) => setAlertChannels(d.channels ?? []))
      .catch(() => {});
  }, []);

  async function alertAction(op: "test" | "send") {
    setAlertBusy(op);
    try {
      const res = await fetch("/api/alerts/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op }),
      });
      setAlertResult(await res.json());
    } catch {
      setAlertResult({ channels: alertChannels, note: "Không kết nối được máy chủ." });
    } finally {
      setAlertBusy(null);
    }
  }

  async function emailAction(preview: boolean) {
    setEmailBusy(preview ? "preview" : "send");
    try {
      const res = await fetch("/api/report/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo || undefined, preview }),
      });
      setEmailResult(await res.json());
    } catch {
      setEmailResult({
        sent: false,
        subject: "",
        error: "Không kết nối được máy chủ.",
      });
    } finally {
      setEmailBusy(null);
    }
  }

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
    const compare = comparePeriods(data.series, days);

    const rows = data.campaigns.map((c) => {
      const hasDaily = c.daily && c.daily.length > 0;
      const pts = hasDaily ? c.daily.filter((d) => dateSet.has(d.date)) : [];
      const metrics = hasDaily ? derive(sumMetrics(pts)) : c.metrics;
      return { id: c.id, name: c.name, status: c.status, metrics, windowed: hasDaily };
    });
    rows.sort((a, b) => b.metrics.spend - a.metrics.spend);
    return { series, totals, rows, compare };
  }, [data, days]);

  function exportCsv() {
    if (!view) return;
    const header = ["Chiến dịch", "Trạng thái", "Chi tiêu", "Doanh thu", "ROAS", "CTR(%)", "Chuyển đổi"];
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
        title="Báo cáo & Cảnh báo"
        subtitle="Tùy chọn khoảng thời gian, xuất file và cảnh báo bất thường"
        action={
          <button className="btn-ghost" onClick={exportCsv} disabled={!view}>
            <Download className="h-4 w-4" /> Xuất CSV
          </button>
        }
      />
      <div className="space-y-6 p-6">
        {loading || !view || !data ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải báo cáo…
          </div>
        ) : (
          <>
            {/* Alerts */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900">
                  Cảnh báo ({data.alerts.length})
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
                  Không phát hiện bất thường — mọi thứ đang ổn định.
                </div>
              )}
            </div>

            {/* Cảnh báo tức thì */}
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Cảnh báo tức thì (Telegram / Zalo)
                </h2>
              </div>
              <p className="mb-3 text-sm text-slate-500">
                Nhận cảnh báo bất thường ngay trên điện thoại.{" "}
                {alertChannels.length
                  ? `Kênh đã bật: ${alertChannels.join(", ")}.`
                  : "Chưa cấu hình kênh — thêm TELEGRAM_BOT_TOKEN/CHAT_ID hoặc ZALO_OA_ACCESS_TOKEN/USER_ID."}{" "}
                Tự động đẩy khi bật Tự lái, hoặc trỏ cron tới{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">
                  /api/alerts/notify
                </code>
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-ghost"
                  onClick={() => alertAction("test")}
                  disabled={alertBusy !== null}
                >
                  {alertBusy === "test" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Gửi thử
                </button>
                <button
                  className="btn-primary"
                  onClick={() => alertAction("send")}
                  disabled={alertBusy !== null}
                >
                  {alertBusy === "send" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BellRing className="h-4 w-4" />
                  )}
                  Gửi cảnh báo hiện tại
                </button>
              </div>
              {alertResult ? (
                <div className="mt-3 text-sm">
                  {alertResult.note ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                      {alertResult.note}
                    </div>
                  ) : null}
                  {alertResult.results?.length ? (
                    <ul className="mt-2 space-y-1">
                      {alertResult.results.map((r, i) => (
                        <li
                          key={i}
                          className={r.ok ? "text-emerald-700" : "text-rose-700"}
                        >
                          {r.ok ? "✓" : "✗"} {r.channel}
                          {r.error ? `: ${r.error}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!alertResult.test && alertResult.newAlerts?.length ? (
                    <p className="mt-1 text-slate-500">
                      Đã xử lý {alertResult.newAlerts.length} cảnh báo.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Window selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Khoảng:</span>
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
                  {w} ngày
                </button>
              ))}
            </div>

            {/* KPI row — kèm so sánh với kỳ liền trước */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi
                label="Chi tiêu"
                value={money(view.totals.spend)}
                delta={view.compare.deltas.spend}
                goodWhenUp={null}
              />
              <Kpi
                label="Doanh thu"
                value={money(view.totals.revenue)}
                delta={view.compare.deltas.revenue}
                goodWhenUp={true}
              />
              <Kpi
                label="ROAS"
                value={roasFmt(view.totals.roas)}
                delta={view.compare.deltas.roas}
                goodWhenUp={true}
              />
              <Kpi
                label="Chuyển đổi"
                value={intNum(view.totals.conversions)}
                delta={view.compare.deltas.conversions}
                goodWhenUp={true}
              />
              <Kpi
                label="CTR"
                value={pct(view.totals.ctr)}
                delta={view.compare.deltas.ctr}
                goodWhenUp={true}
              />
            </div>
            {view.compare.availability !== "none" ? (
              <p className="-mt-3 text-xs text-slate-400">
                % so với {days} ngày liền trước
                {view.compare.availability === "partial"
                  ? ` (kỳ trước chỉ có ${view.compare.prevDays} ngày dữ liệu — so theo trung bình/ngày)`
                  : ""}
                . Kỳ trước: chi {money(view.compare.previous.spend)} · ROAS{" "}
                {roasFmt(view.compare.previous.roas)}.
              </p>
            ) : (
              <p className="-mt-3 text-xs text-slate-400">
                Chưa đủ dữ liệu kỳ trước để so sánh (cần hơn {days} ngày lịch sử).
              </p>
            )}

            {/* Chart */}
            <div className="card p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Xu hướng ({days} ngày)
              </h2>
              <PerformanceChart data={view.series} />
            </div>

            {/* Per-campaign breakdown */}
            <div>
              <h2 className="mb-3 text-base font-semibold text-slate-900">
                Chi tiết theo chiến dịch
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3 font-medium">Chiến dịch</th>
                        <th className="px-4 py-3 text-right font-medium">Chi tiêu</th>
                        <th className="px-4 py-3 text-right font-medium">Doanh thu</th>
                        <th className="px-4 py-3 text-right font-medium">ROAS</th>
                        <th className="px-4 py-3 text-right font-medium">CTR</th>
                        <th className="px-4 py-3 text-right font-medium">Chuyển đổi</th>
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
                  Ở chế độ trực tiếp, chi tiết theo chiến dịch phản ánh khoảng
                  thời gian báo cáo đã cấu hình; các nút khoảng thời gian sẽ áp
                  dụng lại cho biểu đồ xu hướng tổng ở trên.
                </p>
              ) : null}
            </div>

            {/* Báo cáo qua email */}
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Báo cáo qua email
                </h2>
              </div>
              <p className="mb-3 text-sm text-slate-500">
                Gửi bản tóm tắt 30 ngày (KPI, top chiến dịch, cảnh báo, điểm sức
                khỏe) tới email. Để gửi tự động định kỳ, trỏ một cron tới{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">
                  /api/report/email
                </code>
                .
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label className="label">Email nhận</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="ban@congty.vn"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>
                <button
                  className="btn-ghost"
                  onClick={() => emailAction(true)}
                  disabled={emailBusy !== null}
                >
                  {emailBusy === "preview" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Xem trước
                </button>
                <button
                  className="btn-primary"
                  onClick={() => emailAction(false)}
                  disabled={emailBusy !== null}
                >
                  {emailBusy === "send" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Gửi ngay
                </button>
              </div>

              {emailResult ? (
                <div className="mt-3">
                  {emailResult.sent ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      ✓ Đã gửi báo cáo tới {emailResult.to}
                    </div>
                  ) : emailResult.error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {emailResult.error}
                    </div>
                  ) : emailResult.note ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {emailResult.note}
                    </div>
                  ) : null}
                  {emailResult.preview ? (
                    <iframe
                      title="Xem trước email"
                      srcDoc={emailResult.preview}
                      className="mt-3 h-[520px] w-full rounded-lg border border-slate-200 bg-white"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  delta,
  goodWhenUp,
}: {
  label: string;
  value: string;
  /** % thay đổi so với kỳ trước; null/undefined = không so sánh được. */
  delta?: number | null;
  /** true: tăng là tốt · false: giảm là tốt · null: trung tính. */
  goodWhenUp?: boolean | null;
}) {
  let badge: React.ReactNode = null;
  if (delta != null && Number.isFinite(delta)) {
    const up = delta >= 0;
    const cls =
      goodWhenUp == null
        ? "bg-slate-100 text-slate-600"
        : up === goodWhenUp
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700";
    badge = (
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${cls}`}>
        {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="text-xl font-semibold text-slate-900">{value}</p>
        {badge}
      </div>
    </div>
  );
}
