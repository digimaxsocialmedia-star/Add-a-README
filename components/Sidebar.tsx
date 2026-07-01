"use client";

import Link from "next/link";
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
} from "lucide-react";

const NAV = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/reports", label: "Báo cáo & Cảnh báo", icon: FileBarChart },
  { href: "/audit", label: "Đánh giá tài khoản", icon: ShieldCheck },
  { href: "/campaigns", label: "Chiến dịch", icon: Megaphone },
  { href: "/manager", label: "Quản lý quảng cáo", icon: SlidersHorizontal },
  { href: "/create", label: "Tạo quảng cáo", icon: PlusCircle },
  { href: "/creatives", label: "Xưởng nội dung", icon: Images },
  { href: "/fatigue", label: "Độ chai nội dung", icon: Flame },
  { href: "/audiences", label: "Studio đối tượng", icon: Users },
  { href: "/pacing", label: "Kiểm soát ngân sách", icon: Gauge },
  { href: "/automation", label: "Tự động hóa", icon: Zap },
  { href: "/autopilot", label: "Tự lái AI", icon: Rocket },
  { href: "/ai-insights", label: "Gợi ý AI", icon: Sparkles },
];

export function Sidebar({ mode = "demo" }: { mode?: "live" | "demo" }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-900 text-slate-300 lg:flex">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Plane className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-semibold text-white">AdPilot</div>
          <div className="text-xs text-slate-400">Tự động hóa Meta Ads</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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

      <div className="flex items-center gap-2 border-t border-ink-700 px-6 py-4 text-xs text-slate-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            mode === "live" ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        {mode === "live" ? "Trực tiếp · Meta Marketing API" : "Demo · dữ liệu mẫu"}
      </div>
    </aside>
  );
}
