"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Loader2,
  Trophy,
  Scale,
  HelpCircle,
  Pause,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { compareAds } from "@/lib/abtest/engine";
import { money, intNum, pct, roasFmt } from "@/lib/format";
import type { AdRow, ProportionTest } from "@/lib/types";

/** Thanh độ tin cậy với mốc 80% (nghiêng về) và 95% (kết luận). */
function ConfidenceBar({ t }: { t: ProportionTest }) {
  const v = Math.max(0, Math.min(100, t.confidencePct));
  const color = t.significant
    ? "bg-emerald-500"
    : t.winner
      ? "bg-amber-400"
      : "bg-slate-300";
  return (
    <div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
        <div className="absolute top-0 h-full w-px bg-slate-400" style={{ left: "80%" }} />
        <div className="absolute top-0 h-full w-px bg-slate-700" style={{ left: "95%" }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>Độ tin cậy: {t.confidencePct.toFixed(1)}%</span>
        <span>mốc 80% · 95%</span>
      </div>
    </div>
  );
}

function TestCard({
  title,
  t,
  emptyNote,
}: {
  title: string;
  t: ProportionTest | null;
  emptyNote: string;
}) {
  if (!t) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{emptyNote}</p>
      </div>
    );
  }
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {t.significant ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Mẫu {t.winner} thắng
          </span>
        ) : t.winner ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Nghiêng về {t.winner}
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            Chưa phân định
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Mẫu A</p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">
            {t.rateA.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Mẫu B</p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">
            {t.rateB.toFixed(2)}%
          </p>
        </div>
      </div>
      <div className="mt-3">
        <ConfidenceBar t={t} />
      </div>
    </div>
  );
}

export default function AbTestPage() {
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [pausing, setPausing] = useState(false);
  const [pausedMsg, setPausedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/abtest", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: AdRow[] = d.ads ?? [];
        setAds(list);
        // Mặc định: 2 quảng cáo chi tiêu lớn nhất.
        if (list.length >= 2) {
          setIdA(list[0].id);
          setIdB(list[1].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const adA = ads.find((a) => a.id === idA);
  const adB = ads.find((a) => a.id === idB);
  const result = useMemo(
    () => (adA && adB && adA.id !== adB.id ? compareAds(adA, adB) : null),
    [adA, adB],
  );
  const loser = result?.loserAdId ? ads.find((a) => a.id === result.loserAdId) : undefined;

  async function pauseLoser() {
    if (!loser) return;
    setPausing(true);
    try {
      await fetch("/api/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "status", level: "ad", id: loser.id, status: "PAUSED" }),
      });
      setAds((list) =>
        list.map((a) => (a.id === loser.id ? { ...a, status: "PAUSED" } : a)),
      );
      setPausedMsg(`Đã tạm dừng mẫu thua "${loser.name}".`);
    } finally {
      setPausing(false);
    }
  }

  const ROWS: Array<{ label: string; fmt: (a: AdRow) => string }> = [
    { label: "Hiển thị", fmt: (a) => intNum(a.metrics.impressions) },
    { label: "Lượt nhấp", fmt: (a) => intNum(a.metrics.clicks) },
    { label: "CTR", fmt: (a) => pct(a.metrics.ctr) },
    { label: "Chuyển đổi", fmt: (a) => intNum(a.metrics.conversions) },
    { label: "Chi tiêu", fmt: (a) => money(a.metrics.spend) },
    { label: "CPA", fmt: (a) => (a.metrics.conversions > 0 ? money(a.metrics.cpa) : "—") },
    { label: "ROAS", fmt: (a) => roasFmt(a.metrics.roas) },
  ];

  const VerdictIcon = result?.loserAdId ? Trophy : result?.ctr?.winner || result?.cvr?.winner ? Scale : HelpCircle;

  return (
    <>
      <TopBar
        title="A/B Test nội dung"
        subtitle="So 2 quảng cáo bằng kiểm định thống kê — hết đoán mò"
      />
      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải quảng cáo…
          </div>
        ) : ads.length < 2 ? (
          <div className="card p-6 text-center text-sm text-slate-400">
            Cần ít nhất 2 quảng cáo có dữ liệu hiển thị để so sánh.
          </div>
        ) : (
          <>
            {/* Chọn mẫu */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { label: "Mẫu A", value: idA, set: setIdA },
                  { label: "Mẫu B", value: idB, set: setIdB },
                ] as const
              ).map(({ label, value, set }) => (
                <div key={label} className="card p-4">
                  <label className="label">{label}</label>
                  <select
                    className="input"
                    value={value}
                    onChange={(e) => {
                      set(e.target.value);
                      setPausedMsg(null);
                    }}
                  >
                    {ads.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.campaignName}
                        {a.status === "PAUSED" ? " (tạm dừng)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {idA === idB ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Hãy chọn 2 quảng cáo khác nhau để so sánh.
              </div>
            ) : null}

            {result && adA && adB ? (
              <>
                {/* Kết luận */}
                <div
                  className={`card flex items-start gap-3 p-5 ${
                    result.loserAdId ? "border-emerald-200 bg-emerald-50" : ""
                  }`}
                >
                  <div
                    className={`rounded-lg p-2 ${
                      result.loserAdId
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <VerdictIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{result.verdict}</p>
                    <p className="mt-1 text-sm text-slate-600">{result.recommendation}</p>
                    {pausedMsg ? (
                      <p className="mt-2 text-sm font-medium text-emerald-700">{pausedMsg}</p>
                    ) : null}
                  </div>
                  {loser && loser.status === "ACTIVE" && !pausedMsg ? (
                    <button className="btn-primary shrink-0" onClick={pauseLoser} disabled={pausing}>
                      {pausing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                      Tạm dừng mẫu thua
                    </button>
                  ) : null}
                </div>

                {/* 2 kiểm định */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TestCard
                    title="CTR (nhấp / hiển thị)"
                    t={result.ctr}
                    emptyNote="Thiếu dữ liệu hiển thị."
                  />
                  <TestCard
                    title="Tỷ lệ chuyển đổi (chuyển đổi / nhấp)"
                    t={result.cvr}
                    emptyNote="Thiếu lượt nhấp để kiểm định chuyển đổi."
                  />
                </div>

                {/* Bảng số liệu cạnh nhau */}
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3 font-medium">Chỉ số</th>
                        <th className="px-4 py-3 text-right font-medium">
                          A · {adA.name}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          B · {adB.name}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ROWS.map((r) => (
                        <tr key={r.label} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-600">{r.label}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                            {r.fmt(adA)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                            {r.fmt(adB)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="flex items-start gap-1.5 text-xs text-slate-400">
                  <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Dùng kiểm định z hai tỷ lệ (two-proportion z-test), kết luận
                  &ldquo;thắng&rdquo; chỉ khi độ tin cậy ≥ 95%. Ưu tiên tỷ lệ
                  chuyển đổi (gần doanh thu hơn), sau đó tới CTR. So sánh công
                  bằng nhất khi 2 mẫu chạy cùng nhóm quảng cáo, cùng thời gian.
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
