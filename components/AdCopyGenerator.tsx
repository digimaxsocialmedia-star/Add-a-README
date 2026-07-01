"use client";

import { useState } from "react";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import type { AdCopyResult } from "@/lib/types";

const TONES = [
  "thân thiện và tự tin",
  "mạnh mẽ và súc tích",
  "cao cấp và tinh tế",
  "vui tươi và dí dỏm",
  "khẩn trương và trực diện",
];

const OBJECTIVES = [
  "Doanh số / Chuyển đổi",
  "Lưu lượng truy cập",
  "Khách hàng tiềm năng",
  "Nhận diện thương hiệu",
  "Tương tác",
];

export function AdCopyGenerator() {
  const [form, setForm] = useState({
    product: "",
    audience: "",
    tone: TONES[0],
    objective: OBJECTIVES[0],
  });
  const [result, setResult] = useState<AdCopyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setResult(await res.json());
    } catch {
      setResult({
        variants: [],
        source: "heuristic",
        note: "Không kết nối được máy chủ. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }

  function copy(i: number, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900">
          Trình tạo nội dung quảng cáo AI
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Sản phẩm / ưu đãi</label>
          <input
            className="input"
            placeholder="vd: gói cà phê cold-brew hữu cơ giao hàng tháng"
            value={form.product}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Đối tượng</label>
          <input
            className="input"
            placeholder="vd: dân văn phòng bận rộn 25-40 tuổi"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Giọng điệu</label>
          <select
            className="input"
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Mục tiêu</label>
          <select
            className="input"
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
          >
            {OBJECTIVES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            className="btn-primary w-full"
            onClick={generate}
            disabled={loading || !form.product.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang viết…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Tạo nội dung
              </>
            )}
          </button>
        </div>
      </div>

      {result ? (
        <div className="mt-4 space-y-2">
          {result.note ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {result.note}
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              {result.source === "claude"
                ? `Viết bởi ${result.model ?? "Claude"}`
                : "Mẫu có sẵn"}
            </p>
          )}
          {result.variants.map((v, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {v.angle}
                </span>
                <button
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
                  onClick={() => copy(i, `${v.headline}\n\n${v.primaryText}`)}
                >
                  {copied === i ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Chép
                    </>
                  )}
                </button>
              </div>
              <p className="font-semibold text-slate-900">{v.headline}</p>
              <p className="text-sm text-slate-600">{v.primaryText}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
