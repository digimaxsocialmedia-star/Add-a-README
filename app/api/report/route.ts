import { NextResponse } from "next/server";
import { getCampaigns, getDailySeries } from "@/lib/meta/client";
import { getMode } from "@/lib/meta/config";
import { detectAlerts } from "@/lib/alerts/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const [series, campaigns] = await Promise.all([
    getDailySeries(),
    getCampaigns(),
  ]);
  const alerts = detectAlerts(series, campaigns);
  return NextResponse.json({ series, campaigns, alerts, mode: getMode() });
}
