"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Gauge,
  Save,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { money, moneyCompact, pct, roasFmt } from "@/lib/format";
import type { MonthlyTargets, PacingResult, PaceStatus } from "@/lib/types";

interface Snapshot {
  targets: MonthlyTargets;
  pacing: PacingResult;
  mode: "live" | "demo";
}

const PACE_META: Record<
  PaceStatus,
  { label: string; cls: string; icon: typeof TrendingUp }
> = {
  ahead: {
    label: "Chi nhanh hơn kế hoạch",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    icon: TrendingUp,
  },
  on_track: {
    label: "Đúng tiến độ",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Minus,
  },
  behind: {
    label: "Chi chậm hơn kế hoạch",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: TrendingDown,
  },
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** Thanh tiến độ chi tiêu MTD so với ngân sách, kèm mốc “tiến độ tuyến tính”. */
function SpendBar({ p }: { p: PacingResult }) {
  const spendPct = Math.min(100, p.spendPct);
  const expectedPct =
    p.monthlyBudget > 0
      ? Math.min(100, (p.expectedSpendToDate / p.monthlyBudget) * 100)
      : 0;
  const over = p.spendPct > (p.expectedSpendToDate / p.monthlyBudget) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600">
          Đã chi {money(p.spendMTD)} / {money(p.monthlyBudget)}
        </span>
        <span className="font-medium text-slate-700">
          {pct(p.spendPct)}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            over ? "bg-rose-500" : "bg-brand-600"
          }`}
          style={{ width: `${spendPct}%` }}
        />
        {/* mốc tiến độ nên-đạt tới hôm nay */}
        <div
          className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5 bg-slate-900"
          style={{ left: `${expectedPct}%` }}
          title="Tiến độ tuyến tính đến hôm nay"
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Vạch đen = mức nên chi đến hôm nay ({money(p.expectedSpendToDate)}).
      </p>
    </div>
  );
}

export default function PacingPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState("");
  const [revenue, setRevenue] = useState("");

  async function load() {
    const res = await fetch("/api/pacing", { cache: "no-store" });
    const snap: Snapshot = await res.json();
    setData(snap);
    setBudget(String(snap.targets.monthlyBudget));
    setRevenue(String(snap.targets.monthlyRevenue));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/pacing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyBudget: Number(budget) || 0,
        monthlyRevenue: Number(revenue) || 0,
      }),
    });
    const snap: Snapshot = await res.json();
    setData(snap);
    setBudget(String(snap.targets.monthlyBudget));
    setRevenue(String(snap.targets.monthlyRevenue));
    setSaving(false);
  }

  const p = data?.pacing;
  const paceMeta = p ? PACE_META[p.paceStatus] : null;
  const PaceIcon = paceMeta?.icon ?? Minus;

  return (
    <>
      <TopBar
        title="Kiểm soát ngân sách"
        subtitle="Bám sát mục tiêu chi tiêu & doanh thu theo tháng"
      />

      <div className="space-y-6 p-6">
        {loading || !p ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dữ liệu…
          </div>
        ) : (
          <>
            {/* Mục tiêu tháng */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Mục tiêu {p.monthLabel}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <div>
                  <label className="label">Ngân sách chi cả tháng (đ)</label>
                  <input
                    type="number"
                    className="input"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {money(Number(budget) || 0)}
                  </p>
                </div>
                <div>
                  <label className="label">Mục tiêu doanh thu cả tháng (đ)</label>
                  <input
                    type="number"
                    className="input"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {money(Number(revenue) || 0)}
                  </p>
                </div>
                <div>
                  <button
                    className="btn-primary w-full"
                    onClick={save}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Lưu mục tiêu
                  </button>
                </div>
              </div>
            </div>

            {/* Trạng thái nhịp chi + thời gian còn lại */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${paceMeta?.cls}`}
              >
                <PaceIcon className="h-4 w-4" />
                {paceMeta?.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Ngày {p.daysElapsed}/{p.daysInMonth} · còn {p.daysRemaining} ngày
              </span>
            </div>

            {/* Thanh tiến độ ngân sách */}
            <div className="card p-5">
              <SpendBar p={p} />
            </div>

            {/* KPI chi tiêu */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Chi trung bình/ngày"
                value={money(p.avgDailySpend)}
                hint={`Trong ${p.daysElapsed} ngày đã qua`}
              />
              <Stat
                label="Dự kiến chi cả tháng"
                value={money(p.projectedSpend)}
                hint={`${p.overUnderPct >= 0 ? "+" : ""}${pct(
                  p.overUnderPct,
                )} so với ngân sách`}
              />
              <Stat
                label="Đề xuất ngân sách/ngày"
                value={money(p.recommendedDailyBudget)}
                hint="Để về đúng ngân sách tháng"
              />
              <Stat
                label="ROAS hiện tại"
                value={roasFmt(p.impliedRoas)}
                hint={`Doanh thu ${moneyCompact(p.revenueMTD)}`}
              />
            </div>

            {/* Doanh thu so với mục tiêu */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Doanh thu so với mục tiêu
                </h2>
              </div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {money(p.revenueMTD)} / {money(p.monthlyRevenue)}
                </span>
                <span className="font-medium text-slate-700">
                  {pct(p.revenuePct)}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, p.revenuePct)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Dự kiến cả tháng: {money(p.projectedRevenue)} (
                {pct(p.projectedRevenuePct)} mục tiêu).
              </p>
            </div>

            {/* Cảnh báo */}
            {p.warnings.length ? (
              <div className="space-y-2">
                {p.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Ngân sách đang bám sát kế hoạch — không có cảnh báo.
              </div>
            )}

            <p className="text-xs text-slate-400">
              Số liệu tính theo tháng dương lịch hiện tại từ chuỗi chi tiêu/doanh
              thu hằng ngày. &ldquo;Tiến độ tuyến tính&rdquo; giả định chi đều mỗi
              ngày; vượt vạch đen nghĩa là đang chi nhanh hơn kế hoạch.
            </p>
          </>
        )}
      </div>
    </>
  );
}
