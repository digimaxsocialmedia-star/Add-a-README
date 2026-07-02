import { Flame, HeartPulse, AlertTriangle, Ban } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { getAdFatigue } from "@/lib/meta/client";
import { pct } from "@/lib/format";
import { CREATIVE_TYPE_LABELS } from "@/lib/types";
import type { AdFatigue, FatigueStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  FatigueStatus,
  { label: string; cls: string; icon: typeof HeartPulse }
> = {
  healthy: { label: "Khỏe", cls: "bg-emerald-50 text-emerald-700", icon: HeartPulse },
  warning: { label: "Bắt đầu chai", cls: "bg-amber-50 text-amber-700", icon: AlertTriangle },
  fatigued: { label: "Chai nặng", cls: "bg-rose-50 text-rose-700", icon: Ban },
};

function freqColor(f: number) {
  return f >= 4 ? "text-rose-600" : f >= 2.5 ? "text-amber-600" : "text-slate-700";
}

function Row({ a }: { a: AdFatigue }) {
  const meta = STATUS_META[a.fatigue];
  const down = a.ctrChangePct < 0;
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{a.name}</div>
        <div className="text-xs text-slate-400">
          {CREATIVE_TYPE_LABELS[a.creativeType]} · {a.campaignName}
        </div>
        <div className="mt-1 text-xs text-slate-500">{a.reasons.join(" · ")}</div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${meta.cls}`}
        >
          {meta.label}
        </span>
        <div className="mt-1 text-xs text-slate-400">Điểm chai: {a.score}</div>
      </td>
      <td className={`px-4 py-3 text-right tabular-nums font-medium ${freqColor(a.frequency)}`}>
        {a.frequency.toFixed(1)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <div className="text-slate-700">{pct(a.ctr)}</div>
        <div className={`text-xs ${down ? "text-rose-600" : "text-emerald-600"}`}>
          {down ? "▼" : "▲"} {pct(Math.abs(a.ctrChangePct))}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
        {a.daysRunning}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{a.recommendation}</td>
    </tr>
  );
}

export default async function FatiguePage() {
  const ads = await getAdFatigue();
  const counts = ads.reduce(
    (acc, a) => ({ ...acc, [a.fatigue]: acc[a.fatigue] + 1 }),
    { healthy: 0, warning: 0, fatigued: 0 } as Record<FatigueStatus, number>,
  );

  return (
    <>
      <TopBar
        title="Độ chai nội dung"
        subtitle={`${ads.length} quảng cáo · phát hiện creative đang bão hòa`}
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-3 p-5">
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Chai nặng</p>
              <p className="text-xl font-semibold text-slate-900">{counts.fatigued}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-5">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Bắt đầu chai</p>
              <p className="text-xl font-semibold text-slate-900">{counts.warning}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-5">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Khỏe</p>
              <p className="text-xl font-semibold text-slate-900">{counts.healthy}</p>
            </div>
          </div>
        </div>

        {counts.fatigued > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <Flame className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {counts.fatigued} quảng cáo đang chai nặng (tần suất cao + CTR giảm)
              — hãy làm mới creative hoặc tạm dừng để tránh lãng phí ngân sách.
            </span>
          </div>
        ) : null}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Quảng cáo</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-medium">Tần suất</th>
                  <th className="px-4 py-3 text-right font-medium">CTR (xu hướng)</th>
                  <th className="px-4 py-3 text-right font-medium">Ngày chạy</th>
                  <th className="px-4 py-3 font-medium">Khuyến nghị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ads.map((a) => (
                  <Row key={a.id} a={a} />
                ))}
                {ads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                      Chưa có dữ liệu quảng cáo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Tần suất = số lần trung bình một người thấy quảng cáo. Tần suất cao kèm
          CTR giảm là dấu hiệu nội dung đã &ldquo;chai&rdquo;.
        </p>
      </div>
    </>
  );
}
