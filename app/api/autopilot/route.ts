import { NextResponse } from "next/server";
import { getStore, addLog } from "@/lib/mock/store";
import { runAutomationRules } from "@/lib/automation/run";

export const dynamic = "force-dynamic";

function state() {
  const store = getStore();
  return { settings: store.settings, log: store.log };
}

export async function GET() {
  return NextResponse.json(state());
}

export async function POST(req: Request) {
  let body: { op?: string; enabled?: boolean; intervalMinutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const store = getStore();

  if (body.op === "toggle") {
    store.settings.enabled = !store.settings.enabled;
    addLog({
      kind: "info",
      message: store.settings.enabled
        ? "Đã BẬT chế độ Tự lái — quy tắc sẽ tự chạy định kỳ."
        : "Đã TẮT chế độ Tự lái.",
    });
    return NextResponse.json(state());
  }

  if (body.op === "setInterval" && body.intervalMinutes) {
    store.settings.intervalMinutes = Math.max(1, Number(body.intervalMinutes));
    return NextResponse.json(state());
  }

  if (body.op === "tick") {
    // Được gọi bởi bộ hẹn giờ phía client hoặc một cron bên ngoài.
    if (!store.settings.enabled) {
      return NextResponse.json({ ...state(), skipped: "Tự lái đang tắt" });
    }
    const { applied } = await runAutomationRules("auto");
    return NextResponse.json({ ...state(), applied });
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
