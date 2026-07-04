import { NextResponse } from "next/server";
import { getDailySeries } from "@/lib/meta/client";
import { getMode } from "@/lib/meta/config";
import { getStore, schedulePersist } from "@/lib/mock/store";
import { computePacing } from "@/lib/pacing/engine";

export const dynamic = "force-dynamic";

async function payload() {
  const series = await getDailySeries();
  const { targets } = getStore();
  const pacing = computePacing(series, targets);
  return { targets, pacing, mode: getMode() };
}

export async function GET() {
  return NextResponse.json(await payload());
}

export async function POST(req: Request) {
  let body: { monthlyBudget?: number; monthlyRevenue?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const store = getStore();
  if (typeof body.monthlyBudget === "number" && body.monthlyBudget >= 0) {
    store.targets.monthlyBudget = Math.round(body.monthlyBudget);
  }
  if (typeof body.monthlyRevenue === "number" && body.monthlyRevenue >= 0) {
    store.targets.monthlyRevenue = Math.round(body.monthlyRevenue);
  }
  schedulePersist();
  return NextResponse.json(await payload());
}
