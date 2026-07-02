import { NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta/client";
import { getMode } from "@/lib/meta/config";
import { getStore } from "@/lib/mock/store";
import {
  normalizeGrid,
  nowInScheduleTz,
  runDayparting,
} from "@/lib/dayparting/engine";

export const dynamic = "force-dynamic";

async function state(applied: string[] = []) {
  const campaigns = (await getCampaigns()).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
  }));
  return {
    campaigns,
    schedules: getStore().schedules,
    now: nowInScheduleTz(),
    applied,
    mode: getMode(),
  };
}

// GET /api/dayparting        → trạng thái
// GET /api/dayparting?run=1  → áp dụng lịch ngay (dùng cho cron bên ngoài)
export async function GET(req: Request) {
  const run = new URL(req.url).searchParams.get("run");
  const applied = run ? await runDayparting() : [];
  return NextResponse.json(await state(applied));
}

export async function POST(req: Request) {
  let body: {
    op?: string;
    campaignId?: string;
    grid?: unknown;
    enabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const store = getStore();

  if (body.op === "save" && body.campaignId) {
    store.schedules[body.campaignId] = {
      campaignId: body.campaignId,
      enabled: body.enabled !== false,
      grid: normalizeGrid(body.grid),
    };
    return NextResponse.json(await state());
  }

  if (body.op === "toggle" && body.campaignId) {
    const s = store.schedules[body.campaignId];
    if (s) s.enabled = !s.enabled;
    return NextResponse.json(await state());
  }

  if (body.op === "delete" && body.campaignId) {
    delete store.schedules[body.campaignId];
    return NextResponse.json(await state());
  }

  if (body.op === "tick") {
    const applied = await runDayparting();
    return NextResponse.json(await state(applied));
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
