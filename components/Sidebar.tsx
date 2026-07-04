"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  PlusCircle,
  Zap,
  Sparkles,
  Plane,
  FileBarChart,
  ShieldCheck,
  SlidersHorizontal,
  Images,
  Users,
  Rocket,
  Flame,
  Gauge,
  CalendarClock,
  Calculator,
  FlaskConical,
  ScanEye,
  History,
  Building2,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/accounts", label: "Đa tài khoản", icon: Building2 },
  { href: "/reports", label: "Báo cáo & Cảnh báo", icon: FileBarChart },
  { href: "/audit", label: "Đánh giá tài khoản", icon: ShieldCheck },
  { href: "/campaigns", label: "Chiến dịch", icon: Megaphone },
  { href: "/manager", label: "Quản lý quảng cáo", icon: SlidersHorizontal },
  { href: "/create", label: "Tạo quảng cáo", icon: PlusCircle },
  { href: "/creatives", label: "Xưởng nội dung", icon: Images },
  { href: "/creative-score", label: "AI chấm điểm ảnh", icon: ScanEye },
  { href: "/fatigue", label: "Độ chai nội dung", icon: Flame },
  { href: "/abtest", label: "A/B Test nội dung", icon: FlaskConical },
  { href: "/audiences", label: "Studio đối tượng", icon: Users },
  { href: "/pacing", label: "Kiểm soát ngân sách", icon: Gauge },
  { href: "/breakeven", label: "Điểm hòa vốn", icon: Calculator },
  { href: "/schedule", label: "Lịch chạy theo giờ", icon: CalendarClock },
  { href: "/automation", label: "Tự động hóa", icon: Zap },
  { href: "/autopilot", label: "Tự lái AI", icon: Rocket },
  { href: "/history", label: "Lịch sử thay đổi", icon: History },
  { href: "/ai-insights", label: "Gợi ý AI", icon: Sparkles },
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Plane className="h-5 w-5" />
      </div>
      <div>
        <div className="text-base font-semibold text-white">AdPilot</div>
        <div className="text-xs text-slate-400">Tự động hóa Meta Ads</div>
      </div>
    </div>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-600 text-white"
                : "text-slate-300 hover:bg-ink-700 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ModeFooter({ mode }: { mode: "live" | "demo" }) {
  return (
    <div className="flex items-center gap-2 border-t border-ink-700 px-6 py-4 text-xs text-slate-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          mode === "live" ? "bg-emerald-400" : "bg-amber-400"
        }`}
      />
      {mode === "live" ? "Trực tiếp · Meta Marketing API" : "Demo · dữ liệu mẫu"}
    </div>
  );
}

export function Sidebar({ mode = "demo" }: { mode?: "live" | "demo" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: sidebar cố định bên trái */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-900 text-slate-300 lg:flex">
        <div className="px-6 py-5">
          <Logo />
        </div>
        <NavLinks pathname={pathname} />
        <ModeFooter mode={mode} />
      </aside>

      {/* Mobile: thanh trên cùng cố định với nút menu */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-ink-900 px-4 lg:hidden">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-ink-700 hover:text-white"
          aria-label="Mở menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile: ngăn kéo điều hướng */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink-900 text-slate-300 shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-300 hover:bg-ink-700 hover:text-white"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <ModeFooter mode={mode} />
          </div>
        </div>
      ) : null}
    </>
  );
}
