"use client";

import { useState } from "react";
import {
  ScanEye,
  Loader2,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import type { CreativeScoreResult } from "@/lib/types";

function scoreColor(total: number) {
  if (total >= 75) return "text-emerald-600";
  if (total >= 50) return "text-amber-600";
  return "text-rose-600";
}

function scoreLabel(total: number) {
  if (total >= 75) return "Sẵn sàng chạy";
  if (total >= 50) return "Nên chỉnh trước khi chạy";
  return "Chưa nên chạy — cần làm lại";
}

function barColor(score: number) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-400";
  return "bg-rose-500";
}

export default function CreativeScorePage() {
  const [imageData, setImageData] = useState("");
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreativeScoreResult | null>(null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng một file
    if (!file) return;
    setError(null);
    setResult(null);
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp hình ảnh.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Ảnh quá lớn (tối đa 4MB). Hãy chọn ảnh nhỏ hơn.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function score() {
    if (!imageData) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/creative-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData,
          headline: headline || undefined,
          primaryText: primaryText || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không chấm được điểm");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi");
    } finally {
      setBusy(false);
    }
  }

  const analyzed = result && result.items.length > 0;

  return (
    <>
      <TopBar
        title="AI chấm điểm ảnh"
        subtitle="Claude nhìn ảnh quảng cáo và góp ý trước khi bạn chi tiền chạy"
      />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Cột trái: ảnh + ngữ cảnh */}
          <div className="space-y-4">
            <div className="card p-5">
              <label className="label">Ảnh quảng cáo</label>
              {imageData ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageData}
                    alt="Ảnh quảng cáo"
                    className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-500 shadow hover:text-rose-500"
                    onClick={() => {
                      setImageData("");
                      setResult(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-10 text-sm text-slate-500 hover:border-brand-400 hover:bg-slate-50">
                  <Upload className="h-6 w-6" />
                  Chọn ảnh quảng cáo từ máy (tối đa 4MB)
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickImage}
                  />
                </label>
              )}
            </div>

            <div className="card space-y-3 p-5">
              <p className="text-xs text-slate-400">
                (Tùy chọn) Thêm tiêu đề + nội dung đi kèm để AI đánh giá độ khớp
                giữa ảnh và lời quảng cáo.
              </p>
              <div>
                <label className="label">Tiêu đề</label>
                <input
                  className="input"
                  placeholder="vd: Giảm đến 40% — chỉ hôm nay"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Nội dung chính</label>
                <textarea
                  className="input min-h-[70px]"
                  placeholder="Nội dung quảng cáo sẽ hiện cùng ảnh…"
                  value={primaryText}
                  onChange={(e) => setPrimaryText(e.target.value)}
                />
              </div>
              <button
                className="btn-primary w-full"
                onClick={score}
                disabled={busy || !imageData}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang phân tích ảnh…
                  </>
                ) : (
                  <>
                    <ScanEye className="h-4 w-4" /> Chấm điểm ảnh
                  </>
                )}
              </button>
              {error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          {/* Cột phải: kết quả */}
          <div className="space-y-4">
            {!result ? (
              <div className="card flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-slate-400">
                <Sparkles className="h-8 w-8 text-slate-300" />
                Chọn ảnh rồi bấm &ldquo;Chấm điểm ảnh&rdquo; — AI sẽ chấm 6 tiêu
                chí và chỉ ra đúng chỗ cần sửa.
              </div>
            ) : (
              <>
                {result.note ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {result.note}
                  </div>
                ) : null}

                {analyzed ? (
                  <>
                    {/* Điểm tổng */}
                    <div className="card flex items-center gap-5 p-5">
                      <div className="text-center">
                        <p className={`text-4xl font-bold tabular-nums ${scoreColor(result.totalScore)}`}>
                          {result.totalScore}
                        </p>
                        <p className="text-xs text-slate-400">/ 100</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold ${scoreColor(result.totalScore)}`}>
                          {scoreLabel(result.totalScore)}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{result.verdict}</p>
                      </div>
                    </div>

                    {/* Điểm theo tiêu chí */}
                    <div className="card space-y-3 p-5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Theo tiêu chí
                      </h3>
                      {result.items.map((item) => (
                        <div key={item.criterion}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="text-sm text-slate-700">{item.criterion}</span>
                            <span className="text-sm font-semibold tabular-nums text-slate-900">
                              {item.score}/10
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${barColor(item.score)}`}
                              style={{ width: `${item.score * 10}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{item.comment}</p>
                        </div>
                      ))}
                    </div>

                    {/* Điểm mạnh */}
                    {result.strengths.length ? (
                      <div className="card p-5">
                        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Điểm mạnh
                        </h3>
                        <ul className="space-y-1 text-sm text-slate-600">
                          {result.strengths.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {/* Đề xuất chỉnh sửa / checklist */}
                {result.improvements.length ? (
                  <div className="card p-5">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {analyzed ? (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-500" /> Cần chỉnh sửa
                        </>
                      ) : (
                        <>
                          <ListChecks className="h-4 w-4 text-brand-600" /> Danh sách tự kiểm tra
                        </>
                      )}
                    </h3>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      {result.improvements.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-slate-300">{i + 1}.</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {result.source === "claude" ? (
                  <p className="text-xs text-slate-400">
                    Phân tích bởi Claude ({result.model}). Điểm mang tính tham
                    khảo — hãy kết hợp với A/B test thật để kiểm chứng.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
