import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { getAccountSummary, getCampaigns } from "@/lib/meta/client";
import { runAudit } from "@/lib/audit/engine";
import type { AuditCheck, CheckStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  CheckStatus,
  { icon: typeof CheckCircle2; color: string; ring: string; label: string }
> = {
  pass: { icon: CheckCircle2, color: "text-emerald-600", ring: "bg-emerald-50", label: "Đạt" },
  warn: { icon: AlertTriangle, color: "text-amber-600", ring: "bg-amber-50", label: "Cảnh báo" },
  fail: { icon: XCircle, color: "text-rose-600", ring: "bg-rose-50", label: "Lỗi" },
};

const CATEGORY_VI: Record<AuditCheck["category"], string> = {
  profitability: "Lợi nhuận",
  efficiency: "Hiệu quả",
  structure: "Cấu trúc",
  scaling: "Tăng tốc",
};

function scoreColor(score: number) {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#22c55e";
  if (score >= 55) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function CheckRow({ check }: { check: AuditCheck }) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className={`rounded-lg p-1.5 ${meta.ring}`}>
        <Icon className={`h-5 w-5 ${meta.color}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900">{check.title}</p>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {CATEGORY_VI[check.category]}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-slate-600">{check.detail}</p>
        {check.recommendation ? (
          <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Khắc phục: </span>
            {check.recommendation}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default async function AuditPage() {
  const [campaigns, summary] = await Promise.all([
    getCampaigns(),
    getAccountSummary(),
  ]);
  const audit = runAudit(campaigns, summary);
  const color = scoreColor(audit.score);

  return (
    <>
      <TopBar
        title="Đánh giá tài khoản"
        subtitle="Kiểm tra sức khỏe tài khoản quảng cáo tự động"
      />
      <div className="space-y-6 p-6">
        <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center">
          <div
            className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${color} ${audit.score * 3.6}deg, #e2e8f0 0deg)`,
            }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
              <span className="text-3xl font-bold text-slate-900">
                {audit.score}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-semibold text-slate-900">
                Điểm sức khỏe
              </h2>
              <span
                className="rounded-md px-2 py-0.5 text-lg font-bold text-white"
                style={{ background: color }}
              >
                {audit.grade}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dựa trên {audit.checks.length} kiểm tra tự động về lợi nhuận, hiệu
              quả, cấu trúc và khả năng tăng tốc.
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 text-sm sm:justify-start">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {audit.counts.pass} đạt
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="h-4 w-4" /> {audit.counts.warn} cảnh báo
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <XCircle className="h-4 w-4" /> {audit.counts.fail} lỗi
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {audit.checks.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </div>
      </div>
    </>
  );
}
