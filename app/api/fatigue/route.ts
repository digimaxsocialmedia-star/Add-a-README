import { NextResponse } from "next/server";
import { getStore, schedulePersist } from "@/lib/mock/store";
import { runFatigueAutopause } from "@/lib/fatigue/autopause";
import { getMode } from "@/lib/meta/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: getStore().fatigueAuto, mode: getMode() });
}

export async function POST(req: Request) {
  let body: { op?: string; enabled?: boolean; minScore?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const store = getStore();

  if (body.op === "save") {
    if (typeof body.enabled === "boolean") store.fatigueAuto.enabled = body.enabled;
    if (typeof body.minScore === "number" && body.minScore >= 25 && body.minScore <= 100) {
      store.fatigueAuto.minScore = Math.round(body.minScore);
    }
    schedulePersist();
    return NextResponse.json({ settings: store.fatigueAuto });
  }

  if (body.op === "run") {
    // Quét tay: chạy bất kể công tắc đang bật hay tắt.
    const applied = await runFatigueAutopause(true);
    return NextResponse.json({ applied, settings: store.fatigueAuto });
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
