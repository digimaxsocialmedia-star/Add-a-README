"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import type { AiResult, AiSuggestion, Severity } from "@/lib/types";

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-sky-50 text-sky-700 border-sky-200",
};

const CATEGORY_LABELS: Record<AiSuggestion["category"], string> = {
  budget: "Ngân sách",
  targeting: "Nhắm chọn",
  creative: "Nội dung",
  bidding: "Đặt giá thầu",
  structure: "Cấu trúc",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  high: "Ưu tiên cao",
  medium: "Ưu tiên trung bình",
  low: "Ưu tiên thấp",
};

export default function AiInsightsPage() {
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggestions", { method: "POST" });
      setResult(await res.json());
    } catch {
      setResult({
        suggestions: [],
        source: "heuristic",
        note: "Không kết nối được máy chủ. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar
        title="Gợi ý AI"
        subtitle="Claude phân tích tài khoản và gợi ý việc nên làm tiếp theo"
        action={
          <button className="btn-primary" onClick={generate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang phân tích…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Tạo khuyến nghị
              </>
            )}
          </button>
        }
      />

      <div className="space-y-4 p-6">
        {!result && !loading ? (
          <div className="card p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Để AI rà soát tài khoản quảng cáo của bạn
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Nhận danh sách tối ưu theo thứ tự ưu tiên — nên tăng tốc chỗ nào,
              tạm dừng chỗ nào, và làm mới nội dung nào — dựa trên hiệu suất 30
              ngày gần nhất.
            </p>
            <button className="btn-primary mx-auto mt-6" onClick={generate}>
              <Sparkles className="h-4 w-4" /> Tạo khuyến nghị
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="card flex items-center gap-3 p-6 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            Đang rà soát chiến dịch và soạn khuyến nghị…
          </div>
        ) : null}

        {result ? (
          <>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{result.suggestions.length} khuyến nghị</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {result.source === "claude"
                  ? `Tạo bởi ${result.model ?? "Claude"}`
                  : "Phân tích theo quy tắc"}
              </span>
            </div>

            {result.note ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{result.note}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {result.suggestions.map((s, i) => (
                <div key={i} className="card flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[s.severity]}`}
                    >
                      {SEVERITY_LABELS[s.severity]}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {CATEGORY_LABELS[s.category]}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {s.title}
                  </h3>
                  {s.campaignName ? (
                    <p className="text-xs text-slate-400">{s.campaignName}</p>
                  ) : null}
                  <p className="text-sm text-slate-600">{s.rationale}</p>
                  <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Hành động: </span>
                    {s.recommendedAction}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
