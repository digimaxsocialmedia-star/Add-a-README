"use client";

import { useEffect, useState } from "react";
import {
  Calculator,
  Loader2,
  Save,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { money, roasFmt, intNum } from "@/lib/format";
import type {
  BreakevenResult,
  BreakevenSettings,
  CampaignProfit,
  ProfitVerdict,
} from "@/lib/types";

interface Snapshot {
  settings: BreakevenSettings;
  computed: BreakevenResult;
  rows: CampaignProfit[];
  mode: "live" | "demo";
}

const VERDICT_META: Record<
  ProfitVerdict,
  { label: string; cls: string; icon: typeof TrendingUp }
> = {
  profit: { label: "Có lãi", cls: "bg-emerald-50 text-emerald-700", icon: TrendingUp },
  breakeven: { label: "Sát hòa vốn", cls: "bg-amber-50 text-amber-700", icon: Minus },
  loss: { label: "Đang lỗ", cls: "bg-rose-50 text-rose-700", icon: TrendingDown },
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function BreakevenPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aov, setAov] = useState("");
  const [cogs, setCogs] = useState("");
  const [fees, setFees] = useState("");

  function sync(snap: Snapshot) {
    setData(snap);
    setAov(String(snap.settings.aov));
    setCogs(String(snap.settings.cogsPct));
    setFees(String(snap.settings.feesPct));
  }

  useEffect(() => {
    fetch("/api/breakeven", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        sync(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/breakeven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aov: Number(aov) || 0,
          cogsPct: Number(cogs) || 0,
          feesPct: Number(fees) || 0,
        }),
      });
      sync(await res.json());
    } finally {
      setSaving(false);
    }
  }

  const be = data?.computed;
  const totalProfit = data ? data.rows.reduce((s, r) => s + r.estProfit, 0) : 0;

  return (
    <>
      <TopBar
        title="Điểm hòa vốn"
        subtitle="CPA tối đa & ROAS hòa vốn theo cơ cấu chi phí của bạn"
      />
      <div className="space-y-6 p-6">
        {loading || !data || !be ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        ) : (
          <>
            {/* Cơ cấu chi phí */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Cơ cấu chi phí của bạn
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                <div>
                  <label className="label">Giá bán TB/đơn (đ)</label>
                  <input
                    type="number"
                    className="input"
                    value={aov}
                    onChange={(e) => setAov(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">{money(Number(aov) || 0)}</p>
                </div>
                <div>
                  <label className="label">Giá vốn (% giá bán)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    value={cogs}
                    onChange={(e) => setCogs(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Phí khác (%): sàn, ship…</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                  />
                </div>
                <button className="btn-primary w-full" onClick={save} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Lưu & tính lại
                </button>
              </div>
            </div>

            {/* Ngưỡng hòa vốn */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Biên lãi gộp"
                value={`${be.marginPct.toFixed(0)}%`}
                hint="Phần còn lại để trả cho quảng cáo"
              />
              <Stat
                label="CPA tối đa cho phép"
                value={money(be.marginPerOrder)}
                hint="Chi cho 1 chuyển đổi vượt mức này là lỗ"
              />
              <Stat
                label="ROAS hòa vốn"
                value={roasFmt(be.breakevenRoas)}
                hint="ROAS dưới mức này là lỗ tiền"
              />
              <div className="card p-5">
                <p className="text-sm text-slate-500">Lãi/lỗ ròng ước tính (30 ngày)</p>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {money(totalProfit)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  = doanh thu × biên lãi − chi tiêu quảng cáo
                </p>
              </div>
            </div>

            {/* Bảng chiến dịch */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-medium">Chiến dịch</th>
                      <th className="px-4 py-3 font-medium">Đánh giá</th>
                      <th className="px-4 py-3 text-right font-medium">ROAS (hòa vốn {roasFmt(be.breakevenRoas)})</th>
                      <th className="px-4 py-3 text-right font-medium">CPA (tối đa {money(be.marginPerOrder)})</th>
                      <th className="px-4 py-3 text-right font-medium">Chi tiêu</th>
                      <th className="px-4 py-3 text-right font-medium">Lãi/lỗ ước tính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((r) => {
                      const meta = VERDICT_META[r.verdict];
                      const Icon = meta.icon;
                      const cpaOver = r.cpa > be.marginPerOrder && r.conversions > 0;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{r.name}</div>
                            <div className="text-xs text-slate-400">
                              {r.status === "ACTIVE" ? "Đang chạy" : "Tạm dừng"} ·{" "}
                              {intNum(r.conversions)} chuyển đổi
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${meta.cls}`}
                            >
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-medium ${
                              r.roas >= be.breakevenRoas ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {roasFmt(r.roas)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums ${
                              cpaOver ? "text-rose-600" : "text-slate-700"
                            }`}
                          >
                            {r.conversions > 0 ? money(r.cpa) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {money(r.spend)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-medium ${
                              r.estProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {money(r.estProfit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Ngưỡng tính theo số liệu CỦA BẠN thay vì ngưỡng chung: biên lãi ={" "}
              100% − giá vốn − phí; ROAS hòa vốn = 1 ÷ biên lãi; CPA tối đa = giá
              bán × biên lãi. Lãi/lỗ ước tính giả định biên lãi như nhau giữa các
              chiến dịch — nếu mỗi chiến dịch bán sản phẩm biên lãi khác nhau, coi
              đây là con số tham khảo.
            </p>
          </>
        )}
      </div>
    </>
  );
}
