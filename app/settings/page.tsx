"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlugZap,
  Facebook,
  Sparkles,
  Mail,
  Send,
  MessageCircle,
  Lock,
  HardDrive,
  LogOut,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import type { AdAccountInfo } from "@/lib/types";

interface Snapshot {
  mode: "live" | "demo";
  security: { passwordSet: boolean; openLiveWarning: boolean };
  persistence: { dir: string; writable: boolean; savedAt: string | null };
  meta: {
    configured: boolean;
    accounts: AdAccountInfo[];
    apiVersion: string;
    datePreset: string;
    currencyOffset: number;
    pageId: boolean;
    pixelId: boolean;
    targetingCountry: string;
  };
  claude: { configured: boolean };
  email: { configured: boolean; host: string | null; to: string | null };
  telegram: { configured: boolean; tokenSet: boolean; chatIdSet: boolean };
  zalo: { configured: boolean; tokenSet: boolean; userIdSet: boolean };
}

interface TestResult {
  ok: boolean;
  message: string;
  details?: string[];
}

function Chip({ on, onText = "Đã cấu hình", offText = "Chưa cấu hình" }: {
  on: boolean;
  onText?: string;
  offText?: string;
}) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
        on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {on ? onText : offText}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right text-slate-700">{value}</span>
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  chip,
  children,
  service,
  hint,
}: {
  icon: typeof Facebook;
  title: string;
  chip: React.ReactNode;
  children?: React.ReactNode;
  service?: string;
  hint?: string;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    if (!service) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "test", service }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, message: "Không gọi được máy chủ." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        </div>
        {chip}
      </div>
      {children ? <div className="space-y-1.5">{children}</div> : null}
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      {service ? (
        <button className="btn-ghost text-xs" onClick={runTest} disabled={testing}>
          {testing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlugZap className="h-3.5 w-3.5" />
          )}
          Kiểm tra kết nối
        </button>
      ) : null}
      {result ? (
        <div
          className={`space-y-1 rounded-lg border px-3 py-2 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <p className="flex items-start gap-1.5">
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {result.message}
          </p>
          {result.details?.map((d, i) => (
            <p key={i} className="pl-6 text-xs opacity-90">
              {d}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "logout" }),
    });
    window.location.href = "/login";
  }

  return (
    <>
      <TopBar
        title="Cài đặt & Kết nối"
        subtitle="Trạng thái cấu hình và kiểm tra từng kết nối — không sửa gì, không gửi gì"
      />
      <div className="space-y-6 p-6">
        {!s ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải trạng thái…
          </div>
        ) : (
          <>
            {s.security.openLiveWarning ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <b>App đang MỞ TỰ DO ở chế độ live</b> — ai có URL cũng điều
                  khiển được ngân sách thật. Đặt{" "}
                  <code className="rounded bg-rose-100 px-1">APP_PASSWORD</code>{" "}
                  trong .env.local ngay.
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Meta */}
              <ServiceCard
                icon={Facebook}
                title="Meta Marketing API"
                chip={
                  <Chip
                    on={s.meta.configured}
                    onText="Live"
                    offText="Demo — dữ liệu mẫu"
                  />
                }
                service="meta"
                hint={
                  s.meta.configured
                    ? undefined
                    : "Đặt META_ACCESS_TOKEN + META_AD_ACCOUNT_ID (hoặc META_AD_ACCOUNT_IDS cho nhiều tài khoản) rồi khởi động lại."
                }
              >
                <Row
                  label="Tài khoản"
                  value={s.meta.accounts.map((a) => a.label).join(" · ")}
                />
                <Row label="Phiên bản API" value={s.meta.apiVersion} />
                <Row label="Khung báo cáo" value={s.meta.datePreset} />
                <Row
                  label="Hệ số tiền tệ"
                  value={
                    s.meta.currencyOffset === 1 ? "1 (VND ✓)" : `${s.meta.currencyOffset} (USD/EUR)`
                  }
                />
                <Row
                  label="Tạo QC đầy đủ"
                  value={
                    s.meta.pageId
                      ? `Page ✓ · Pixel ${s.meta.pixelId ? "✓" : "—"} · ${s.meta.targetingCountry}`
                      : "Thiếu META_PAGE_ID (chỉ tạo được campaign + nhóm QC)"
                  }
                />
              </ServiceCard>

              {/* Claude */}
              <ServiceCard
                icon={Sparkles}
                title="Claude AI (gợi ý, viết content, chấm ảnh)"
                chip={<Chip on={s.claude.configured} />}
                service="claude"
                hint={
                  s.claude.configured
                    ? undefined
                    : "Đặt ANTHROPIC_API_KEY để AI thật; hiện đang dùng phương án dự phòng theo quy tắc."
                }
              />

              {/* Email */}
              <ServiceCard
                icon={Mail}
                title="Báo cáo qua Email (SMTP)"
                chip={<Chip on={s.email.configured} />}
                service="email"
                hint={
                  s.email.configured
                    ? undefined
                    : "Đặt SMTP_HOST, SMTP_USER, SMTP_PASS (vd Gmail + App password) và REPORT_EMAIL_TO."
                }
              >
                {s.email.host ? <Row label="Máy chủ" value={s.email.host} /> : null}
                {s.email.to ? <Row label="Gửi tới" value={s.email.to} /> : null}
              </ServiceCard>

              {/* Telegram */}
              <ServiceCard
                icon={Send}
                title="Cảnh báo Telegram"
                chip={<Chip on={s.telegram.configured} />}
                service="telegram"
                hint={
                  s.telegram.configured
                    ? "Kiểm tra chỉ xác thực bot (getMe) — không gửi tin nhắn nào."
                    : `Thiếu: ${[
                        !s.telegram.tokenSet && "TELEGRAM_BOT_TOKEN",
                        !s.telegram.chatIdSet && "TELEGRAM_CHAT_ID",
                      ]
                        .filter(Boolean)
                        .join(", ")}. Tạo bot với @BotFather.`
                }
              />

              {/* Zalo */}
              <ServiceCard
                icon={MessageCircle}
                title="Cảnh báo Zalo OA"
                chip={<Chip on={s.zalo.configured} />}
                service="zalo"
                hint={
                  s.zalo.configured
                    ? undefined
                    : `Thiếu: ${[
                        !s.zalo.tokenSet && "ZALO_OA_ACCESS_TOKEN",
                        !s.zalo.userIdSet && "ZALO_USER_ID",
                      ]
                        .filter(Boolean)
                        .join(", ")}.`
                }
              />

              {/* Bảo mật */}
              <ServiceCard
                icon={Lock}
                title="Bảo vệ ứng dụng"
                chip={
                  <Chip
                    on={s.security.passwordSet}
                    onText="Đã khóa bằng mật khẩu"
                    offText="Đang mở tự do"
                  />
                }
                hint={
                  s.security.passwordSet
                    ? "Mọi trang + API yêu cầu đăng nhập (cookie 30 ngày)."
                    : "Đặt APP_PASSWORD trong .env.local để khóa toàn bộ app — bắt buộc khi chạy live."
                }
              >
                {s.security.passwordSet ? (
                  <button className="btn-ghost text-xs" onClick={logout}>
                    <LogOut className="h-3.5 w-3.5" /> Đăng xuất thiết bị này
                  </button>
                ) : null}
              </ServiceCard>

              {/* Lưu trữ */}
              <ServiceCard
                icon={HardDrive}
                title="Lưu trữ trạng thái"
                chip={
                  <Chip
                    on={s.persistence.writable}
                    onText="Ghi được"
                    offText="Đĩa chỉ đọc — chỉ chạy trong RAM"
                  />
                }
                hint="Quy tắc, lịch chạy, mục tiêu, lịch sử… được lưu tại đây và khôi phục sau restart."
              >
                <Row label="Thư mục" value={<code className="text-xs">{s.persistence.dir}</code>} />
                <Row
                  label="Lần lưu gần nhất"
                  value={
                    s.persistence.savedAt
                      ? new Date(s.persistence.savedAt).toLocaleString("vi-VN")
                      : "Chưa có (sẽ tạo khi có thay đổi đầu tiên)"
                  }
                />
              </ServiceCard>
            </div>

            <p className="flex items-start gap-1.5 text-xs text-slate-400">
              <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Trang này chỉ đọc trạng thái và kiểm tra kết nối bằng lệnh nhẹ nhất
              (không gửi email/tin nhắn, không tốn token AI, không đổi dữ liệu).
              Muốn thay đổi cấu hình: sửa file .env.local rồi khởi động lại app.
            </p>
          </>
        )}
      </div>
    </>
  );
}
