import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "AdPilot — AI Facebook Ads automation",
  description:
    "Automate, analyze, and optimize Meta (Facebook) ad campaigns with AI — a Madgicx-style demo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:pl-64">{children}</main>
        </div>
      </body>
    </html>
  );
}
