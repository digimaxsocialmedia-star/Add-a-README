"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AdAccountInfo } from "@/lib/types";

/**
 * Dropdown đổi tài khoản quảng cáo trên TopBar. Tự fetch danh sách + tài
 * khoản đang chọn từ API (TopBar có thể render phía client, nơi env/global
 * của server không tồn tại — API mới là nguồn sự thật). Sau khi đổi, tải lại
 * trang để mọi phần đọc theo tài khoản mới.
 */
export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<AdAccountInfo[]>([]);
  const [activeId, setActiveId] = useState("");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/accounts?light=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts ?? []);
        setActiveId(d.activeId ?? "");
        setLive(d.mode === "live");
      })
      .catch(() => {});
  }, []);

  async function switchTo(id: string) {
    if (id === activeId) return;
    setBusy(true);
    try {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "switch", id }),
      });
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  if (accounts.length === 0) return null;

  const dot = (
    <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
  );

  if (accounts.length === 1) {
    return (
      <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 sm:flex">
        {dot}
        {accounts[0].label}
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-3 pr-1 text-sm text-slate-600 sm:flex">
      {dot}
      {busy ? (
        <span className="flex items-center gap-1.5 pr-2 text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang chuyển…
        </span>
      ) : (
        <select
          className="max-w-[220px] cursor-pointer border-0 bg-transparent pr-1 text-sm text-slate-700 focus:outline-none"
          value={activeId}
          onChange={(e) => switchTo(e.target.value)}
          title="Chuyển tài khoản quảng cáo"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
