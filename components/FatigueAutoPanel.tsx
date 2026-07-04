"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Play } from "lucide-react";
import type { FatigueAutoSettings } from "@/lib/types";

/** Bảng điều khiển "tự tạm dừng quảng cáo chai" trên trang Độ chai nội dung. */
export function FatigueAutoPanel() {
  const [settings, setSettings] = useState<FatigueAutoSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [applied, setApplied] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/fatigue", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => {});
  }, []);

  async function post(body: unknown) {
    const res = await fetch("/api/fatigue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function save(next: Partial<FatigueAutoSettings>) {
    if (!settings) return;
    setBusy(true);
    try {
      const d = await post({ op: "save", ...settings, ...next });
      setSettings(d.settings);
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setApplied(null);
    try {
      const d = await post({ op: "run" });
      setApplied(d.applied ?? []);
      if (d.applied?.length) {
        // Bảng phía dưới là server-render — tải lại để thấy trạng thái mới.
        setTimeout(() => window.location.reload(), 1500);
      }
    } finally {
      setRunning(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Tự tạm dừng quảng cáo chai
          </h2>
        </div>
        <button
          onClick={() => save({ enabled: !settings.enabled })}
          disabled={busy}
          className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
            settings.enabled ? "bg-brand-600" : "bg-slate-300"
          }`}
          aria-label="Bật/tắt tự tạm dừng"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
              settings.enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-600">Tự tạm dừng khi điểm chai ≥</span>
        <select
          className="input w-24"
          value={settings.minScore}
          onChange={(e) => save({ minScore: Number(e.target.value) })}
          disabled={busy}
        >
          <option value={40}>40</option>
          <option value={50}>50</option>
          <option value={60}>60</option>
          <option value={70}>70</option>
        </select>
        <button className="btn-ghost" onClick={runNow} disabled={running}>
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Quét & tạm dừng ngay
        </button>
      </div>

      {applied ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {applied.length ? (
            <>
              <p className="font-medium">Đã tạm dừng {applied.length} quảng cáo:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {applied.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          ) : (
            "Không có quảng cáo nào vượt ngưỡng (hoặc đã tạm dừng/trong thời gian chờ 24h)."
          )}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-400">
        Khi BẬT, mỗi chu kỳ Tự lái AI sẽ quét và tạm dừng quảng cáo vượt ngưỡng
        (điểm 50 = &ldquo;Chai nặng&rdquo;). Mỗi quảng cáo chỉ bị tự tạm dừng tối
        đa 1 lần/24h — bạn bật lại tay thì máy không giật tắt ngay. Mọi hành động
        ghi vào Lịch sử thay đổi và hoàn tác được.
      </p>
    </div>
  );
}
