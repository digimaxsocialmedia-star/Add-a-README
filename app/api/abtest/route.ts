import { NextResponse } from "next/server";
import { getAds } from "@/lib/meta/client";
import { getMode } from "@/lib/meta/config";

export const dynamic = "force-dynamic";

// Danh sách quảng cáo có dữ liệu để so sánh A/B (phần kiểm định chạy ở client
// vì lib/abtest/engine.ts thuần tính toán).
export async function GET() {
  const ads = (await getAds())
    .filter((a) => a.metrics.impressions > 0)
    .sort((a, b) => b.metrics.spend - a.metrics.spend);
  return NextResponse.json({ ads, mode: getMode() });
}
