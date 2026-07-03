"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { RoasBadge } from "@/components/Badge";
import { money, roasFmt } from "@/lib/format";
import type { AccountOverview } from "@/lib/types";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function switchTo(id: string) {
    setSwitching(id);
    try {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "switch", id }),
      });
      window.location.reload();
    } catch {
      setSwitching(null);
    }
  }

  const totalSpend = accounts.reduce((s, a) => s + a.summary.metrics.spend, 0);
  const totalRevenue = accounts.reduce((s, a) => s + a.summary.metrics.revenue, 0);
  const totalActive = accounts.reduce((s, a) => s + a.summary.activeCampaigns, 0);
  const totalCamps = accounts.reduce((s, a) => s + a.summary.totalCampaigns, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <>
      <TopBar
        title="Đa tài khoản"
        subtitle="Tổng hợp mọi tài khoản quảng cáo và chuyển đổi trong 1 nhấp"
      />
      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải các tài khoản…
          </div>
        ) : (
          <>
            {/* KPI gộp toàn bộ */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="card p-4">
                <p className="text-xs font-medium text-slate-500">Tổng chi tiêu (30 ngày)</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{money(totalSpend)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-medium text-slate-500">Tổng doanh thu</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{money(totalRevenue)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-medium text-slate-500">ROAS gộp</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{roasFmt(blendedRoas)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-medium text-slate-500">Chiến dịch đang chạy</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {totalActive}/{totalCamps}
                </p>
              </div>
            </div>

            {/* Bảng từng tài khoản */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-medium">Tài khoản</th>
                      <th className="px-4 py-3 text-right font-medium">Chi tiêu</th>
                      <th className="px-4 py-3 text-right font-medium">Doanh thu</th>
                      <th className="px-4 py-3 text-right font-medium">ROAS</th>
                      <th className="px-4 py-3 text-right font-medium">Camp chạy</th>
                      <th className="px-4 py-3 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map((a) => (
                      <tr key={a.id} className={a.active ? "bg-brand-50/40" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                            <div>
                              <p className="font-medium text-slate-900">{a.label}</p>
                              <p className="text-xs text-slate-400">{a.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {money(a.summary.metrics.spend)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {money(a.summary.metrics.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RoasBadge roas={a.summary.metrics.roas} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {a.summary.activeCampaigns}/{a.summary.totalCampaigns}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.active ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đang dùng
                            </span>
                          ) : (
                            <button
                              className="btn-ghost text-xs"
                              onClick={() => switchTo(a.id)}
                              disabled={switching !== null}
                            >
                              {switching === a.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              )}
                              Chuyển sang
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Mỗi tài khoản có bộ quy tắc, lịch chạy, mục tiêu tháng, điểm hòa
              vốn và lịch sử thay đổi RIÊNG. Mọi trang khác (Tổng quan, Quản lý
              QC, Tự lái AI…) làm việc trên tài khoản đang chọn — đổi nhanh bằng
              dropdown ở góc phải trên. Ở live mode, khai báo nhiều tài khoản
              qua <code className="rounded bg-slate-100 px-1">META_AD_ACCOUNT_IDS</code>{" "}
              (vd <code className="rounded bg-slate-100 px-1">act_111:Shop Áo,act_222:Shop Giày</code>)
              — dùng chung một access token có quyền trên các tài khoản đó.
            </p>
          </>
        )}
      </div>
    </>
  );
}
