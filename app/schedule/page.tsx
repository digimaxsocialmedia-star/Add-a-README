"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Loader2,
  Save,
  Play,
  Trash2,
  Sun,
  Briefcase,
  Grid3X3,
  Eraser,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import type { DaypartSchedule, EntityStatus } from "@/lib/types";

interface CampaignLite {
  id: string;
  name: string;
  status: EntityStatus;
}

interface Snapshot {
  campaigns: CampaignLite[];
  schedules: Record<string, DaypartSchedule>;
  now: { day: number; hour: number };
  applied: string[];
  mode: "live" | "demo";
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

function fullGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 1));
}

/** Giờ vàng bán hàng VN: 8h–23h mỗi ngày. */
function goldenGrid(): number[][] {
  return Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 23 ? 1 : 0)),
  );
}

/** Giờ hành chính: T2–T6, 8h–18h. */
function officeGrid(): number[][] {
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => (d <= 4 && h >= 8 && h <= 18 ? 1 : 0)),
  );
}

export default function SchedulePage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [grid, setGrid] = useState<number[][]>(emptyGrid());
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState<string[] | null>(null);
  // Trạng thái "quét" chuột: đang vẽ giá trị 0 hay 1
  const [paint, setPaint] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/dayparting", { cache: "no-store" });
    const snap: Snapshot = await res.json();
    setData(snap);
    if (!selected && snap.campaigns.length) {
      pick(snap.campaigns[0].id, snap);
    }
    setLoading(false);
  }

  function pick(campaignId: string, snap?: Snapshot) {
    const s = (snap ?? data)?.schedules[campaignId];
    setSelected(campaignId);
    setGrid(s ? s.grid.map((r) => [...r]) : emptyGrid());
    setEnabled(s ? s.enabled : true);
    setNotice(null);
  }

  useEffect(() => {
    load();
    const up = () => setPaint(null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trong khi mở trang, tự áp dụng lịch mỗi 60 giây. Chạy cả khi tab ở nền —
  // người dùng chủ đích để tab mở cho lịch hoạt động (xem ghi chú cuối trang).
  useEffect(() => {
    const t = setInterval(() => post({ op: "tick" }, true), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(body: unknown, silent = false) {
    if (!silent) setBusy(true);
    try {
      const res = await fetch("/api/dayparting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const snap: Snapshot = await res.json();
      setData(snap);
      return snap;
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function save() {
    await post({ op: "save", campaignId: selected, grid, enabled });
    setNotice(["Đã lưu lịch chạy."]);
  }

  async function removeSchedule() {
    await post({ op: "delete", campaignId: selected });
    setGrid(emptyGrid());
    setNotice(["Đã xóa lịch — chiến dịch không còn bị điều khiển theo giờ."]);
  }

  async function applyNow() {
    const snap = await post({ op: "tick" });
    setNotice(
      snap.applied.length
        ? snap.applied
        : ["Không có gì để đổi — các chiến dịch đã đúng trạng thái theo lịch."],
    );
  }

  function setCell(d: number, h: number, v: number) {
    setGrid((g) => {
      if (g[d][h] === v) return g;
      const n = g.map((r) => [...r]);
      n[d][h] = v;
      return n;
    });
  }

  const onCount = grid.flat().filter(Boolean).length;
  const schedule = data?.schedules[selected];
  const scheduledCount = data
    ? Object.values(data.schedules).filter((s) => s.enabled).length
    : 0;

  return (
    <>
      <TopBar
        title="Lịch chạy theo giờ"
        subtitle="Tự bật/tắt chiến dịch theo khung giờ vàng (giờ Việt Nam)"
        action={
          <button className="btn-primary" onClick={applyNow} disabled={busy || !scheduledCount}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Áp dụng ngay
          </button>
        }
      />
      <div className="space-y-6 p-6">
        {loading || !data ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        ) : (
          <>
            {notice ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice.map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
              </div>
            ) : null}

            {/* Chọn chiến dịch */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">Chiến dịch</h2>
                <span className="text-xs text-slate-400">
                  ({scheduledCount} chiến dịch đang theo lịch)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <select
                  className="input"
                  value={selected}
                  onChange={(e) => pick(e.target.value)}
                >
                  {data.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {data.schedules[c.id]?.enabled ? " · 🕐 theo lịch" : ""}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Bật lịch cho chiến dịch này
                </label>
              </div>
            </div>

            {/* Lưới 7×24 */}
            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  Nhấp hoặc kéo chuột để chọn khung giờ <b>được chạy</b> ({onCount}/168 giờ)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost text-xs" onClick={() => setGrid(goldenGrid())}>
                    <Sun className="h-3.5 w-3.5" /> Giờ vàng 8-23h
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setGrid(officeGrid())}>
                    <Briefcase className="h-3.5 w-3.5" /> Giờ hành chính
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setGrid(fullGrid())}>
                    <Grid3X3 className="h-3.5 w-3.5" /> Cả tuần
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setGrid(emptyGrid())}>
                    <Eraser className="h-3.5 w-3.5" /> Xóa hết
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="select-none border-separate" style={{ borderSpacing: 2 }}>
                  <thead>
                    <tr>
                      <th className="pr-2 text-right text-[10px] font-medium text-slate-400" />
                      {Array.from({ length: 24 }, (_, h) => (
                        <th
                          key={h}
                          className={`w-6 text-center text-[10px] font-medium ${
                            data.now.hour === h ? "text-brand-600" : "text-slate-400"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, d) => (
                      <tr key={d}>
                        <td
                          className={`pr-2 text-right text-xs font-medium ${
                            data.now.day === d ? "text-brand-600" : "text-slate-500"
                          }`}
                        >
                          {DAY_LABELS[d]}
                        </td>
                        {row.map((v, h) => {
                          const isNow = data.now.day === d && data.now.hour === h;
                          return (
                            <td key={h}>
                              <button
                                type="button"
                                aria-label={`${DAY_LABELS[d]} ${h}h`}
                                onMouseDown={() => {
                                  const nv = v ? 0 : 1;
                                  setPaint(nv);
                                  setCell(d, h, nv);
                                }}
                                onMouseEnter={() => {
                                  if (paint !== null) setCell(d, h, paint);
                                }}
                                className={`block h-6 w-6 rounded-sm transition ${
                                  v ? "bg-brand-600 hover:bg-brand-500" : "bg-slate-100 hover:bg-slate-200"
                                } ${isNow ? "ring-2 ring-amber-400" : ""}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Ô viền vàng = thời điểm hiện tại ({DAY_LABELS[data.now.day]},{" "}
                {data.now.hour}h — giờ Việt Nam).
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  className="btn-ghost text-rose-600"
                  onClick={removeSchedule}
                  disabled={busy || !schedule}
                >
                  <Trash2 className="h-4 w-4" /> Xóa lịch
                </button>
                <button className="btn-primary" onClick={save} disabled={busy || !selected}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu lịch chạy
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Khi lịch được bật, chiến dịch sẽ tự BẬT trong khung giờ đã chọn và
              TẠM DỪNG ngoài khung giờ — kể cả khi bạn bật/tắt tay, lần kiểm tra
              kế tiếp sẽ đưa về đúng lịch. Lịch được kiểm tra mỗi phút khi mở
              trang này, theo chu kỳ Tự lái AI (nếu đang bật), hoặc qua cron gọi{" "}
              <code className="rounded bg-slate-100 px-1">GET /api/dayparting?run=1</code>.
              Mọi thay đổi đều ghi vào nhật ký ở trang Tự lái AI.
            </p>
          </>
        )}
      </div>
    </>
  );
}
