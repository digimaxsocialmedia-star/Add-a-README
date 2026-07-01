"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Pencil,
  Check,
  X,
  Pause,
  Play,
  Copy,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { RoasBadge } from "@/components/Badge";
import { money, pct } from "@/lib/format";
import type { EntityStatus, ManagerCampaign } from "@/lib/types";

type Level = "campaign" | "adset" | "ad";

function StatusToggle({
  status,
  onToggle,
  busy,
}: {
  status: EntityStatus;
  onToggle: () => void;
  busy: boolean;
}) {
  const active = status === "ACTIVE";
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      title={active ? "Tạm dừng" : "Bật chạy"}
      className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${
        active ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
          active ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function ManagerPage() {
  const [tree, setTree] = useState<ManagerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  async function load() {
    const res = await fetch("/api/manager", { cache: "no-store" });
    const data = await res.json();
    setTree(data.tree ?? []);
    setError(data.error ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function post(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      if (data.tree) setTree(data.tree);
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(id: string, name: string) {
    setError(null);
    setNotice(null);
    const data = await post({ op: "duplicate", level: "campaign", id });
    if (data?.duplicated) {
      const w: string[] = data.duplicated.warnings ?? [];
      setNotice(
        `Đã nhân bản "${name}" → "${data.duplicated.name}" (đang tạm dừng).` +
          (w.length ? ` Lưu ý: ${w.join(" ")}` : ""),
      );
    }
  }

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const flip = (status: EntityStatus): EntityStatus =>
    status === "ACTIVE" ? "PAUSED" : "ACTIVE";

  async function setStatus(level: Level, id: string, status: EntityStatus) {
    await post({ op: "status", level, id, status });
  }

  async function saveBudget(level: Level, id: string) {
    if (!editing) return;
    const value = Number(editing.value);
    setEditing(null);
    if (Number.isFinite(value) && value > 0) {
      await post({ op: "budget", level, id, dailyBudget: value });
    }
  }

  async function bulk(action: "pause" | "activate") {
    await post({ op: "bulk", level: "campaign", ids: [...selected], action });
    setSelected(new Set());
  }

  function BudgetCell({
    level,
    id,
    value,
  }: {
    level: Level;
    id: string;
    value: number;
  }) {
    const isEditing = editing?.id === id;
    if (level === "ad") {
      return <span className="text-xs text-slate-300">—</span>;
    }
    if (isEditing) {
      return (
        <span className="flex items-center justify-end gap-1">
          <input
            autoFocus
            type="number"
            className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-right text-sm"
            value={editing.value}
            onChange={(e) => setEditing({ id, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveBudget(level, id);
              if (e.key === "Escape") setEditing(null);
            }}
          />
          <button onClick={() => saveBudget(level, id)} className="text-emerald-600">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => setEditing(null)} className="text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </span>
      );
    }
    return (
      <button
        className="group inline-flex items-center justify-end gap-1 tabular-nums text-slate-700"
        onClick={() => setEditing({ id, value: String(value) })}
      >
        {money(value)}
        <Pencil className="h-3 w-3 text-slate-300 group-hover:text-slate-500" />
      </button>
    );
  }

  return (
    <>
      <TopBar
        title="Quản lý quảng cáo"
        subtitle="Sửa chiến dịch, nhóm quảng cáo và quảng cáo — bật/tắt và đổi ngân sách ngay tại chỗ"
      />
      <div className="space-y-4 p-6">
        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-emerald-500">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* Bulk action bar */}
        {selected.size > 0 ? (
          <div className="card flex items-center justify-between p-3">
            <span className="text-sm text-slate-600">
              Đã chọn {selected.size} chiến dịch
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => bulk("activate")} disabled={busy}>
                <Play className="h-4 w-4" /> Bật chạy
              </button>
              <button className="btn-ghost" onClick={() => bulk("pause")} disabled={busy}>
                <Pause className="h-4 w-4" /> Tạm dừng
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3 font-medium">Tên</th>
                    <th className="px-3 py-3 text-center font-medium">Bật/Tắt</th>
                    <th className="px-3 py-3 text-right font-medium">NS/ngày</th>
                    <th className="px-3 py-3 text-right font-medium">Chi tiêu</th>
                    <th className="px-3 py-3 text-right font-medium">ROAS</th>
                    <th className="px-3 py-3 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tree.map((c) => {
                    const cOpen = expanded.has(c.id);
                    return (
                      <RowGroup key={c.id}>
                        {/* Campaign row */}
                        <tr className="bg-white hover:bg-slate-50">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                                checked={selected.has(c.id)}
                                onChange={() => toggleSelect(c.id)}
                              />
                              <button onClick={() => toggleExpand(c.id)} className="text-slate-400">
                                {cOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <span className="font-medium text-slate-900">{c.name}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                {c.adSets.length} nhóm QC
                              </span>
                              <button
                                onClick={() => duplicate(c.id, c.name)}
                                disabled={busy}
                                title="Nhân bản chiến dịch (tạo bản sao đang tạm dừng)"
                                className="text-slate-300 transition hover:text-brand-600 disabled:opacity-50"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex justify-center">
                              <StatusToggle
                                status={c.status}
                                busy={busy}
                                onToggle={() => setStatus("campaign", c.id, flip(c.status))}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <BudgetCell level="campaign" id={c.id} value={c.dailyBudget} />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {money(c.metrics.spend)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <RoasBadge roas={c.metrics.roas} />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {pct(c.metrics.ctr)}
                          </td>
                        </tr>

                        {/* Ad set rows */}
                        {cOpen
                          ? c.adSets.map((as) => {
                              const aOpen = expanded.has(as.id);
                              return (
                                <RowGroup key={as.id}>
                                  <tr className="bg-slate-50/40 hover:bg-slate-50">
                                    <td className="py-2 pl-10 pr-3">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => toggleExpand(as.id)}
                                          className="text-slate-400"
                                        >
                                          {aOpen ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </button>
                                        <span className="text-slate-800">{as.name}</span>
                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                          {as.ads.length} quảng cáo
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="flex justify-center">
                                        <StatusToggle
                                          status={as.status}
                                          busy={busy}
                                          onToggle={() => setStatus("adset", as.id, flip(as.status))}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <BudgetCell level="adset" id={as.id} value={as.dailyBudget} />
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                                      {money(as.metrics.spend)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <RoasBadge roas={as.metrics.roas} />
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                                      {pct(as.metrics.ctr)}
                                    </td>
                                  </tr>

                                  {/* Ad rows */}
                                  {aOpen
                                    ? as.ads.map((ad) => (
                                        <tr key={ad.id} className="hover:bg-slate-50">
                                          <td className="py-2 pl-[68px] pr-3">
                                            <span className="text-slate-600">{ad.name}</span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex justify-center">
                                              <StatusToggle
                                                status={ad.status}
                                                busy={busy}
                                                onToggle={() =>
                                                  setStatus("ad", ad.id, flip(ad.status))
                                                }
                                              />
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            <span className="text-xs text-slate-300">—</span>
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                                            {money(ad.metrics.spend)}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            <RoasBadge roas={ad.metrics.roas} />
                                          </td>
                                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                                            {pct(ad.metrics.ctr)}
                                          </td>
                                        </tr>
                                      ))
                                    : null}
                                </RowGroup>
                              );
                            })
                          : null}
                      </RowGroup>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Fragment wrapper so we can return multiple <tr> from a map iteration.
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
