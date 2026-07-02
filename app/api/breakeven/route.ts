import { NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta/client";
import { getMode } from "@/lib/meta/config";
import { getStore } from "@/lib/mock/store";
import { campaignProfits, computeBreakeven } from "@/lib/breakeven/engine";

export const dynamic = "force-dynamic";

async function payload() {
  const { breakeven } = getStore();
  const campaigns = await getCampaigns();
  return {
    settings: breakeven,
    computed: computeBreakeven(breakeven),
    rows: campaignProfits(campaigns, breakeven),
    mode: getMode(),
  };
}

export async function GET() {
  return NextResponse.json(await payload());
}

export async function POST(req: Request) {
  let body: { aov?: number; cogsPct?: number; feesPct?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const s = getStore().breakeven;
  if (typeof body.aov === "number" && body.aov > 0) s.aov = Math.round(body.aov);
  if (typeof body.cogsPct === "number" && body.cogsPct >= 0 && body.cogsPct <= 100) {
    s.cogsPct = body.cogsPct;
  }
  if (typeof body.feesPct === "number" && body.feesPct >= 0 && body.feesPct <= 100) {
    s.feesPct = body.feesPct;
  }
  return NextResponse.json(await payload());
}
