"use client";

import { useEffect, useState } from "react";
import { History, Loader2, Undo2, CheckCircle2, XCircle } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { money } from "@/lib/format";
import type { HistoryActor, HistoryEntry } from "@/lib/types";

const ACTOR_META: Record<HistoryActor, { label: string; cls: string }> = {
  user: { label: "Bạn", cls: "bg-slate-100 text-slate-600" },
  rule: { label: "Quy tắc", cls: "bg-amber-50 text-amber-700" },
  daypart: { label: "Lịch chạy", cls: "bg-sky-50 text-sky-700" },
  optimizer: { label: "Tối ưu NS", cls: "bg-violet-50 text-violet-700" },
  fatigue: { label: "Chống chai", cls: "bg-orange-50 text-orange-700" },
};

function describe(e: HistoryEntry): string {
  const name = e.targetName ?? e.targetId;
  const onOff = e.after === "PAUSED" ? "Tạm dừng" : "Bật chạy";
  switch (e.action) {
    case "campaign_status":
      return `${onOff} chiến dịch "${name}"`;
    case "adset_status":
      return `${onOff} nhóm quảng cáo "${name}"`;
    case "ad_status":
      return `${onOff} quảng cáo "${name}"`;
    case "campaign_budget":
      return `Đổi ngân sách chiến dịch "${name}": ${
        e.before != null ? `${money(Number(e.before))} → ` : ""
      }${money(Number(e.after))}`;
    case "adset_budget":
      return `Đổi ngân sách nhóm QC "${name}": ${
        e.before != null ? `${money(Number(e.before))} → ` : ""
      }${money(Number(e.after))}`;
    case "campaign_created":
      return `Tạo chiến dịch mới "${name}"`;
    case "campaign_duplicated":
      return `Nhân bản chiến dịch → "${name}"`;
  }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  async function load() {
    const res = await fetch("/api/history", { cache: "no-store" });
    const d = await res.json();
    setEntries(d.entries ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function undo(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "undo", id }),
      });
      const d = await res.json();
      setNotice({ ok: Boolean(d.ok), message: d.message ?? d.error ?? "Lỗi" });
      if (d.entries) setEntries(d.entries);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <TopBar
        title="Lịch sử thay đổi"
        subtitle="Mọi thao tác ghi — của bạn và của máy — đều được ghi lại, kèm hoàn tác"
      />
      <div className="space-y-4 p-6">
        {notice ? (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              notice.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {notice.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            {notice.message}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch sử…
          </div>
        ) : entries.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-400">
            <History className="h-8 w-8 text-slate-300" />
            Chưa có thay đổi nào được ghi lại. Bật/tắt hay đổi ngân sách một
            chiến dịch (ở Quản lý quảng cáo, quy tắc, lịch chạy…) rồi quay lại đây.
          </div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {entries.map((e) => {
              const actor = ACTOR_META[e.actor];
              const undone = Boolean(e.undoneAt);
              return (
                <div key={e.id} className="flex items-center gap-3 p-3">
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${actor.cls}`}
                  >
                    {actor.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        undone ? "text-slate-400 line-through" : "text-slate-800"
                      }`}
                    >
                      {describe(e)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fmtTime(e.at)}
                      {undone ? ` · đã hoàn tác lúc ${fmtTime(e.undoneAt!)}` : ""}
                    </p>
                  </div>
                  {e.undoable && !undone ? (
                    <button
                      className="btn-ghost shrink-0 text-xs"
                      onClick={() => undo(e.id)}
                      disabled={busyId !== null}
                      title="Đưa về giá trị trước thay đổi này"
                    >
                      {busyId === e.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" />
                      )}
                      Hoàn tác
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Ghi lại 100 thay đổi gần nhất từ mọi nguồn: bạn thao tác tay, quy tắc
          tự động, lịch chạy theo giờ và tối ưu ngân sách của Tự lái AI. Hoàn
          tác sẽ ghi lại giá trị trước đó qua đúng tầng dữ liệu (demo/Meta thật)
          — và bản thân lần hoàn tác cũng được ghi thành một dòng mới. Lưu ý:
          hoàn tác đưa về giá trị tại thời điểm đó, không tính các thay đổi xảy
          ra sau; mục tạo/nhân bản chiến dịch không hoàn tác được (hãy tạm dừng
          chiến dịch nếu không dùng).
        </p>
      </div>
    </>
  );
}
