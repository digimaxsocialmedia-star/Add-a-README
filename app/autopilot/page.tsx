"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Rocket,
  Loader2,
  Play,
  Wand2,
  ArrowRight,
  Clock,
  ScrollText,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { money } from "@/lib/format";
import type {
  AutopilotSettings,
  BudgetPlan,
  LogEntry,
} from "@/lib/types";

const INTERVALS = [1, 5, 15, 60];

const KIND_META: Record<LogEntry["kind"], { label: string; cls: string }> = {
  rule: { label: "Quy tắc", cls: "bg-amber-50 text-amber-700" },
  optimizer: { label: "Tối ưu NS", cls: "bg-violet-50 text-violet-700" },
  info: { label: "Hệ thống", cls: "bg-slate-100 text-slate-600" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AutopilotPage() {
  const [settings, setSettings] = useState<AutopilotSettings | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [applying, setApplying] = useState(false);
  const [ticking, setTicking] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    const res = await fetch("/api/autopilot", { cache: "no-store" });
    const d = await res.json();
    setSettings(d.settings);
    setLog(d.log ?? []);
  }, []);

  const loadPlan = useCallback(async () => {
    const res = await fetch("/api/optimizer", { cache: "no-store" });
    const d = await res.json();
    setPlan(d.plan ?? null);
  }, []);

  useEffect(() => {
    loadState();
    loadPlan();
  }, [loadState, loadPlan]);

  const tick = useCallback(async () => {
    setTicking(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "tick" }),
      });
      const d = await res.json();
      setSettings(d.settings);
      setLog(d.log ?? []);
      await loadPlan();
    } finally {
      setTicking(false);
    }
  }, [loadPlan]);

  // Bộ hẹn giờ phía client: khi Tự lái bật, gọi tick định kỳ.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (settings?.enabled) {
      timer.current = setInterval(
        tick,
        Math.max(1, settings.intervalMinutes) * 60_000,
      );
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [settings?.enabled, settings?.intervalMinutes, tick]);

  async function post(body: unknown) {
    const res = await fetch("/api/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setSettings(d.settings);
    setLog(d.log ?? []);
  }

  async function applyOptimizer() {
    setApplying(true);
    try {
      const res = await fetch("/api/optimizer", { method: "POST" });
      const d = await res.json();
      if (d.plan) setPlan(d.plan);
      await loadState();
    } finally {
      setApplying(false);
    }
  }

  const enabled = settings?.enabled ?? false;
  const changes = plan?.changes.filter((c) => c.recommended !== c.current) ?? [];

  return (
    <>
      <TopBar
        title="Tự lái AI"
        subtitle="Tối ưu ngân sách tự động, chạy quy tắc theo lịch và nhật ký hoạt động"
      />
      <div className="space-y-6 p-6">
        {/* Điều khiển Tự lái */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                }`}
              >
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  Chế độ Tự lái {enabled ? "đang BẬT" : "đang TẮT"}
                </p>
                <p className="text-sm text-slate-500">
                  {enabled
                    ? `Tự chạy quy tắc mỗi ${settings?.intervalMinutes} phút`
                    : "Bật để tự động áp dụng quy tắc theo lịch"}
                  {settings?.lastRunAt
                    ? ` · Lần chạy gần nhất: ${fmtTime(settings.lastRunAt)}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="btn-ghost"
                onClick={tick}
                disabled={ticking || !enabled}
                title={enabled ? "Chạy một lượt ngay" : "Bật Tự lái để chạy"}
              >
                {ticking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Chạy ngay
              </button>
              <button
                onClick={() => post({ op: "toggle" })}
                className={`relative h-7 w-12 rounded-full transition ${
                  enabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
                aria-label="Bật/tắt Tự lái"
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    enabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">Tần suất:</span>
            {INTERVALS.map((m) => (
              <button
                key={m}
                onClick={() => post({ op: "setInterval", intervalMinutes: m })}
                className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
                  settings?.intervalMinutes === m
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m < 60 ? `${m} phút` : "1 giờ"}
              </button>
            ))}
          </div>
        </div>

        {/* Tối ưu ngân sách */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-500" />
              <h2 className="text-base font-semibold text-slate-900">
                Tối ưu ngân sách tự động
              </h2>
            </div>
            <button
              className="btn-primary"
              onClick={applyOptimizer}
              disabled={applying || changes.length === 0}
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Áp dụng tối ưu
            </button>
          </div>

          {plan ? (
            <>
              <p className="mb-3 text-sm text-slate-500">
                Phân bổ lại tổng ngân sách {money(plan.totalBefore)}/ngày theo
                hiệu suất — dồn cho chiến dịch hiệu quả, giảm chiến dịch yếu. Tổng
                gần như không đổi.
              </p>
              {changes.length ? (
                <div className="space-y-2">
                  {plan.changes.map((c) => {
                    const up = c.delta > 0;
                    const same = c.recommended === c.current;
                    return (
                      <div key={c.campaignId} className="card flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">
                            {c.campaignName}
                          </p>
                          <p className="text-xs text-slate-500">{c.reason}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <span className="text-slate-500">{money(c.current)}</span>
                          <ArrowRight className="h-4 w-4 text-slate-300" />
                          <span className="font-semibold text-slate-900">
                            {money(c.recommended)}
                          </span>
                          <span
                            className={`w-14 text-right font-medium ${
                              same
                                ? "text-slate-400"
                                : up
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                            }`}
                          >
                            {same
                              ? "—"
                              : `${up ? "+" : ""}${c.deltaPct.toFixed(0)}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-6 text-center text-sm text-slate-400">
                  Ngân sách đã được phân bổ tối ưu — không cần thay đổi.
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tính toán…
            </div>
          )}
        </div>

        {/* Nhật ký hoạt động */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">
              Nhật ký hoạt động
            </h2>
          </div>
          {log.length ? (
            <div className="card divide-y divide-slate-100">
              {log.map((e) => {
                const meta = KIND_META[e.kind];
                return (
                  <div key={e.id} className="flex items-start gap-3 p-3">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${meta.cls}`}
                    >
                      {meta.label}
                    </span>
                    <p className="flex-1 text-sm text-slate-700">{e.message}</p>
                    <span className="shrink-0 text-xs text-slate-400">
                      {fmtTime(e.at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card p-6 text-center text-sm text-slate-400">
              Chưa có hoạt động nào. Bật Tự lái hoặc bấm &ldquo;Áp dụng tối
              ưu&rdquo; để bắt đầu.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
