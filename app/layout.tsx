import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getMode } from "@/lib/meta/config";

export const metadata: Metadata = {
  title: "AdPilot — Tự động hóa quảng cáo Facebook bằng AI",
  description:
    "Tự động hóa, phân tích và tối ưu chiến dịch quảng cáo Meta (Facebook) bằng AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <div className="flex min-h-screen">
          <Sidebar mode={getMode()} />
          {/* pt-14: chừa chỗ cho thanh menu mobile cố định; desktop dùng sidebar */}
          <main className="flex-1 pt-14 lg:pl-64 lg:pt-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
