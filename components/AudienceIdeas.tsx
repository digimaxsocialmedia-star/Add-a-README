"use client";

import { useState } from "react";
import { Sparkles, Loader2, Users } from "lucide-react";
import { AUDIENCE_TYPE_LABELS } from "@/lib/audiences/classify";
import type { AudienceIdeaResult, AudienceType } from "@/lib/types";

const TYPE_STYLES: Record<AudienceType, string> = {
  lookalike: "bg-violet-50 text-violet-700",
  custom: "bg-emerald-50 text-emerald-700",
  interest: "bg-sky-50 text-sky-700",
  broad: "bg-amber-50 text-amber-700",
  saved: "bg-slate-100 text-slate-600",
};

export function AudienceIdeas() {
  const [result, setResult] = useState<AudienceIdeaResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/audiences", { method: "POST" });
      setResult(await res.json());
    } catch {
      setResult({
        ideas: [],
        source: "heuristic",
        note: "Không kết nối được máy chủ. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">
            AI gợi ý tệp đối tượng mới
          </h2>
        </div>
        <button className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Đang gợi ý…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Tạo gợi ý
            </>
          )}
        </button>
      </div>

      {!result && !loading ? (
        <p className="text-sm text-slate-500">
          Nhận gợi ý các tệp đối tượng mới nên thử (Lookalike, sở thích,
          retargeting, tệp rộng…) dựa trên hiệu suất hiện tại của tài khoản.
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2">
          {result.note ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {result.note}
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              {result.source === "claude"
                ? `Gợi ý bởi ${result.model ?? "Claude"}`
                : "Gợi ý theo quy tắc"}
            </p>
          )}
          {result.ideas.map((idea, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  <Users className="mr-1.5 inline h-4 w-4 text-slate-400" />
                  {idea.name}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[idea.type]}`}
                  >
                    {AUDIENCE_TYPE_LABELS[idea.type]}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {idea.size}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{idea.rationale}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
