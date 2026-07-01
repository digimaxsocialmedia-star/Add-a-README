"use client";

import { useEffect, useState } from "react";
import { Loader2, Zap, Play, Plus } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import {
  ACTION_LABELS,
  METRIC_LABELS,
} from "@/lib/types";
import type {
  AutomationRule,
  RuleAction,
  RuleEvaluation,
  RuleMetric,
  RuleOperator,
} from "@/lib/types";

interface Snapshot {
  rules: AutomationRule[];
  evaluations: RuleEvaluation[];
  applied?: string[];
  thresholds?: Record<RuleMetric, number>;
}

const METRICS = Object.keys(METRIC_LABELS) as RuleMetric[];
const ACTIONS = Object.keys(ACTION_LABELS) as RuleAction[];

export default function AutomationPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState<string[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [draft, setDraft] = useState({
    name: "",
    metric: "roas" as RuleMetric,
    operator: "lt" as RuleOperator,
    threshold: 1,
    action: "PAUSE" as RuleAction,
    adjustPct: 20,
  });

  async function load() {
    const res = await fetch("/api/automation", { cache: "no-store" });
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function post(body: unknown) {
    const res = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function toggle(id: string) {
    setData(await post({ op: "toggle", id }));
  }

  async function apply() {
    setApplying(true);
    const result: Snapshot = await post({ op: "apply" });
    setData(result);
    setAppliedMsg(result.applied ?? []);
    setApplying(false);
  }

  async function addRule() {
    const needsPct =
      draft.action === "INCREASE_BUDGET" || draft.action === "DECREASE_BUDGET";
    const result = await post({
      op: "add",
      rule: {
        name: draft.name || `${METRIC_LABELS[draft.metric]} rule`,
        metric: draft.metric,
        operator: draft.operator,
        threshold: draft.threshold,
        action: draft.action,
        adjustPct: needsPct ? draft.adjustPct : undefined,
      },
    });
    setData(result);
    setShowForm(false);
    setDraft({ ...draft, name: "" });
  }

  const needsPct =
    draft.action === "INCREASE_BUDGET" || draft.action === "DECREASE_BUDGET";

  return (
    <>
      <TopBar
        title="Tự động hóa"
        subtitle="Các quy tắc theo dõi hiệu suất và hành động tự động"
        action={
          <button
            className="btn-primary"
            onClick={apply}
            disabled={applying || !data?.evaluations.length}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Chạy quy tắc ngay
          </button>
        }
      />

      <div className="space-y-6 p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải quy tắc…
          </div>
        ) : (
          <>
            {appliedMsg ? (
              <div className="card border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-medium">
                  Đã áp dụng {appliedMsg.length} hành động:
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {appliedMsg.length ? (
                    appliedMsg.map((m, i) => <li key={i}>{m}</li>)
                  ) : (
                    <li>Không có gì khớp — tài khoản của bạn đang trong ngưỡng.</li>
                  )}
                </ul>
              </div>
            ) : null}

            {/* Pending actions */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900">
                  Hành động đang chờ ({data?.evaluations.length ?? 0})
                </h2>
              </div>
              {data?.evaluations.length ? (
                <div className="space-y-2">
                  {data.evaluations.map((e, i) => (
                    <div
                      key={`${e.ruleId}-${e.campaignId}-${i}`}
                      className="card flex items-start gap-3 p-4"
                    >
                      <span className="mt-0.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {ACTION_LABELS[e.action]}
                      </span>
                      <div>
                        <p className="text-sm text-slate-800">{e.message}</p>
                        <p className="text-xs text-slate-400">
                          Kích hoạt bởi quy tắc: {e.ruleName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card p-6 text-center text-sm text-slate-400">
                  Hiện chưa có quy tắc nào được kích hoạt.
                </div>
              )}
            </div>

            {/* Rules */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Quy tắc</h2>
                <button
                  className="btn-ghost"
                  onClick={() => setShowForm((s) => !s)}
                >
                  <Plus className="h-4 w-4" /> Quy tắc mới
                </button>
              </div>

              {showForm ? (
                <div className="card mb-3 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label">Tên quy tắc</label>
                      <input
                        className="input"
                        placeholder="vd: Tạm dừng tìm khách mới yếu"
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Khi</label>
                      <select
                        className="input"
                        value={draft.metric}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            metric: e.target.value as RuleMetric,
                          })
                        }
                      >
                        {METRICS.map((m) => (
                          <option key={m} value={m}>
                            {METRIC_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-28">
                        <label className="label">Ở mức</label>
                        <select
                          className="input"
                          value={draft.operator}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              operator: e.target.value as RuleOperator,
                            })
                          }
                        >
                          <option value="lt">dưới</option>
                          <option value="gt">trên</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="label">Giá trị</label>
                        <input
                          type="number"
                          className="input"
                          value={draft.threshold}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              threshold: Number(e.target.value),
                            })
                          }
                        />
                        {data?.thresholds ? (
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-brand-600 hover:underline"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                threshold: data.thresholds![draft.metric],
                              })
                            }
                          >
                            Gợi ý:{" "}
                            {data.thresholds[draft.metric].toLocaleString("vi-VN")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="label">Thì</label>
                      <select
                        className="input"
                        value={draft.action}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            action: e.target.value as RuleAction,
                          })
                        }
                      >
                        {ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {ACTION_LABELS[a]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {needsPct ? (
                      <div>
                        <label className="label">Điều chỉnh (%)</label>
                        <input
                          type="number"
                          className="input"
                          value={draft.adjustPct}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              adjustPct: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      className="btn-ghost"
                      onClick={() => setShowForm(false)}
                    >
                      Hủy
                    </button>
                    <button className="btn-primary" onClick={addRule}>
                      Thêm quy tắc
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                {data?.rules.map((r) => (
                  <div
                    key={r.id}
                    className="card flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="text-sm text-slate-500">
                        Nếu {METRIC_LABELS[r.metric]}{" "}
                        {r.operator === "lt" ? "dưới" : "trên"}{" "}
                        {r.threshold.toLocaleString("vi-VN")} → {ACTION_LABELS[r.action]}
                        {r.adjustPct ? ` ${r.adjustPct}%` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => toggle(r.id)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        r.enabled ? "bg-brand-600" : "bg-slate-300"
                      }`}
                      aria-label="Bật/tắt quy tắc"
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                          r.enabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
