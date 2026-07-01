import { Users, Layers, AlertTriangle } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { AudienceIdeas } from "@/components/AudienceIdeas";
import { RoasBadge } from "@/components/Badge";
import { getAudiences } from "@/lib/meta/client";
import { AUDIENCE_TYPE_LABELS } from "@/lib/audiences/classify";
import { money, pct, intNum, roasFmt } from "@/lib/format";
import type { AudienceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_STYLES: Record<AudienceType, string> = {
  lookalike: "bg-violet-50 text-violet-700",
  custom: "bg-emerald-50 text-emerald-700",
  interest: "bg-sky-50 text-sky-700",
  broad: "bg-amber-50 text-amber-700",
  saved: "bg-slate-100 text-slate-600",
};

export default async function AudiencesPage() {
  const audiences = await getAudiences();
  const spending = audiences.filter((a) => a.metrics.spend > 0);
  const best = [...spending].sort((a, b) => b.metrics.roas - a.metrics.roas)[0];
  const overlaps = audiences.filter((a) => a.campaignCount > 1);

  return (
    <>
      <TopBar
        title="Studio đối tượng"
        subtitle={`${audiences.length} tệp đối tượng · hiệu suất + gợi ý AI`}
      />
      <div className="space-y-6 p-6">
        {/* Tổng quan nhanh */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tổng số tệp</p>
                <p className="text-xl font-semibold text-slate-900">
                  {audiences.length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <p className="text-sm text-slate-500">Tệp hiệu quả nhất</p>
            <p className="mt-1 truncate font-medium text-slate-900">
              {best ? best.name : "—"}
            </p>
            {best ? (
              <p className="mt-0.5 text-xs text-slate-400">
                ROAS {roasFmt(best.metrics.roas)}
              </p>
            ) : null}
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tệp bị trùng</p>
                <p className="text-xl font-semibold text-slate-900">
                  {overlaps.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cảnh báo trùng lặp */}
        {overlaps.length ? (
          <div className="card border-amber-200 bg-amber-50 p-4">
            <div className="mb-1 flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="font-medium">
                {overlaps.length} tệp đang dùng ở nhiều chiến dịch
              </p>
            </div>
            <p className="text-sm text-amber-800/90">
              Các tệp này có thể cạnh tranh đấu giá lẫn nhau:{" "}
              {overlaps.map((a) => `"${a.name}"`).join(", ")}. Cân nhắc gộp lại
              hoặc thêm loại trừ.
            </p>
          </div>
        ) : null}

        {/* Bảng hiệu suất theo tệp */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Hiệu suất theo tệp đối tượng
          </h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Đối tượng</th>
                    <th className="px-4 py-3 font-medium">Loại</th>
                    <th className="px-4 py-3 text-right font-medium">Chiến dịch</th>
                    <th className="px-4 py-3 text-right font-medium">Chi tiêu</th>
                    <th className="px-4 py-3 text-right font-medium">ROAS</th>
                    <th className="px-4 py-3 text-right font-medium">CTR</th>
                    <th className="px-4 py-3 text-right font-medium">Chuyển đổi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audiences.map((a) => (
                    <tr key={a.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{a.name}</div>
                        <div className="text-xs text-slate-400">
                          {a.adSetCount} nhóm quảng cáo
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[a.type]}`}
                        >
                          {AUDIENCE_TYPE_LABELS[a.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {a.campaignCount}
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
                  {audiences.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        Chưa có tệp đối tượng nào.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AudienceIdeas />
      </div>
    </>
  );
}
