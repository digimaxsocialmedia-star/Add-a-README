"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Loader2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { money, moneyCompact, roasFmt } from "@/lib/format";
import type { EntityStatus, HourlyAnalysis } from "@/lib/types";

interface CampaignLite {
  id: string;
  name: string;
  status: EntityStatus;
}

interface Snapshot {
  analysis: HourlyAnalysis;
  campaigns: CampaignLite[];
  mode: "live" | "demo";
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Màu ô heatmap theo ROAS tương đối so với trung bình tài khoản. */
function cellClass(ratio: number, hasData: boolean): string {
  if (!hasData) return "bg-slate-100";
  if (ratio >= 1.15) return "bg-emerald-500";
  if (ratio >= 0.9) return "bg-emerald-300";
  if (ratio >= 0.6) return "bg-amber-300";
  return "bg-rose-400";
}

function hourRange(h: number) {
  return `${h}h–${h + 1}h`;
}

export default function HourlyPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("all_active");
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hourly", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function apply() {
    setApplying(true);
    setNotice(null);
    try {
      const res = await fetch("/api/hourly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "apply", campaignId: target }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Không áp dụng được");
      setNotice(
        `Đã áp lưới đề xuất (tắt ${d.offCount} khung giờ) cho: ${d.applied.join(", ")}. Lịch đã BẬT.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Đã xảy ra lỗi");
    } finally {
      setApplying(false);
    }
  }

  const a = data?.analysis;
  const avgCellSpend = a ? a.totalSpend / 168 : 0;

  return (
    <>
      <TopBar
        title="Giờ vàng"
        subtitle="Khung giờ nào ra tiền, khung giờ nào đốt tiền — dữ liệu quyết định thay bạn"
      />
      <div className="space-y-6 p-6">
        {loading || !a || !data ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang phân tích theo giờ…
          </div>
        ) : (
          <>
            {/* Top giờ tốt / tệ + tiết kiệm */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="card p-5">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Khung giờ vàng
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {a.bestHours.map((h) => (
                    <li key={h.hour} className="flex justify-between">
                      <span className="text-slate-600">{hourRange(h.hour)}</span>
                      <span className="font-medium text-emerald-600">
                        ROAS {roasFmt(h.roas)} · chi {moneyCompact(h.spend)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-5">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <TrendingDown className="h-4 w-4 text-rose-500" /> Khung giờ đốt tiền
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {a.worstHours.map((h) => (
                    <li key={h.hour} className="flex justify-between">
                      <span className="text-slate-600">{hourRange(h.hour)}</span>
                      <span className="font-medium text-rose-600">
                        ROAS {roasFmt(h.roas)} · chi {moneyCompact(h.spend)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-5">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <PiggyBank className="h-4 w-4 text-brand-600" /> Nếu tắt các ô đỏ
                </h3>
                {a.offCount > 0 ? (
                  <div className="text-sm text-slate-600">
                    <p>
                      Tắt <b>{a.offCount}</b> khung giờ kém →
                    </p>
                    <p className="mt-1">
                      Tiết kiệm <b className="text-slate-900">{money(a.savings.spend)}</b>{" "}
                      /30 ngày
                    </p>
                    <p>
                      Chỉ mất {money(a.savings.revenue)} doanh thu (ROAS{" "}
                      {roasFmt(a.savings.roas)} — dưới hẳn trung bình{" "}
                      {roasFmt(a.accountRoas)})
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Không có khung giờ nào đủ tệ để tắt — phân phối theo giờ đang ổn.
                  </p>
                )}
              </div>
            </div>

            {/* Heatmap 7×24 */}
            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Bản đồ nhiệt ROAS theo giờ (30 ngày)
                </h2>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Rất tốt
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-emerald-300" /> Tốt
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-amber-300" /> Yếu
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-rose-400" /> Đề xuất tắt
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-slate-100" /> Ít dữ liệu
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="border-separate" style={{ borderSpacing: 2 }}>
                  <thead>
                    <tr>
                      <th />
                      {Array.from({ length: 24 }, (_, h) => (
                        <th key={h} className="w-6 text-center text-[10px] font-medium text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }, (_, d) => (
                      <tr key={d}>
                        <td className="pr-2 text-right text-xs font-medium text-slate-500">
                          {DAY_LABELS[d]}
                        </td>
                        {Array.from({ length: 24 }, (_, h) => {
                          const cell = a.cells.find((c) => c.day === d && c.hour === h);
                          const spend = cell?.spend ?? 0;
                          const hasData = spend >= avgCellSpend * 0.25;
                          const roas = spend > 0 ? (cell?.revenue ?? 0) / spend : 0;
                          const ratio = a.accountRoas > 0 ? roas / a.accountRoas : 0;
                          return (
                            <td key={h}>
                              <div
                                className={`h-6 w-6 rounded-sm ${cellClass(ratio, hasData)}`}
                                title={`${DAY_LABELS[d]} ${hourRange(h)} · chi ${money(spend)} · ROAS ${roasFmt(roas)}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Áp dụng vào Lịch chạy */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Áp lưới đề xuất vào Lịch chạy theo giờ
                </h2>
              </div>
              <p className="mb-3 text-sm text-slate-500">
                Lưới đề xuất giữ chạy mọi khung giờ trừ {a.offCount} ô đỏ (đủ chi
                tiêu nhưng ROAS &lt; 60% trung bình). Áp xong, chiến dịch sẽ tự
                BẬT/TẮT theo lưới — xem lại ở trang{" "}
                <Link href="/schedule" className="text-brand-600 underline">
                  Lịch chạy theo giờ
                </Link>
                .
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="input max-w-xs"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="all_active">Tất cả chiến dịch đang chạy</option>
                  {data.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.status === "PAUSED" ? " (tạm dừng)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-primary"
                  onClick={apply}
                  disabled={applying || a.offCount === 0}
                >
                  {applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  Áp dụng lưới đề xuất
                </button>
              </div>
              {notice ? (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {notice}
                </p>
              ) : null}
            </div>

            <p className="text-xs text-slate-400">
              {data.mode === "live"
                ? "Dữ liệu từ Meta insights, breakdown theo giờ (múi giờ của tài khoản quảng cáo), 30 ngày gần nhất."
                : "Chế độ demo: dữ liệu theo giờ được mô phỏng tất định theo nhịp sinh hoạt VN (đêm khuya yếu, trưa + tối 19-22h là đỉnh)."}{" "}
              Ô ít dữ liệu được giữ chạy — chỉ tắt khi có bằng chứng rõ ràng.
            </p>
          </>
        )}
      </div>
    </>
  );
}
