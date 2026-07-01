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
          <main className="flex-1 lg:pl-64">{children}</main>
        </div>
      </body>
    </html>
  );
}
