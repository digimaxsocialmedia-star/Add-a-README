"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plane, Loader2, Lock } from "lucide-react";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Đăng nhập thất bại");
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Plane className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">AdPilot</p>
          <p className="text-xs text-slate-500">Tự động hóa Meta Ads</p>
        </div>
      </div>

      <div>
        <label className="label">Mật khẩu</label>
        <input
          type="password"
          className="input"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nhập mật khẩu ứng dụng"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={busy || !password}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Đăng nhập
      </button>

      <p className="text-xs text-slate-400">
        Mật khẩu là biến <code className="rounded bg-slate-100 px-1">APP_PASSWORD</code>{" "}
        trong <code className="rounded bg-slate-100 px-1">.env.local</code>. App
        điều khiển ngân sách quảng cáo thật — luôn đặt mật khẩu khi chạy live.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    // fixed inset-0 để che cả sidebar của layout chung — trang khóa đứng độc lập.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
