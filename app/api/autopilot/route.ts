import { NextResponse } from "next/server";
import { getStore, addLog, schedulePersist } from "@/lib/mock/store";
import { getCampaigns } from "@/lib/meta/client";
import { runAutomationRules } from "@/lib/automation/run";
import { runAlertNotifications } from "@/lib/alerts/notify";
import { runDayparting } from "@/lib/dayparting/engine";
import { runFatigueAutopause } from "@/lib/fatigue/autopause";

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
    schedulePersist();
    return NextResponse.json(state());
  }

  if (body.op === "tick") {
    // Được gọi bởi bộ hẹn giờ phía client hoặc một cron bên ngoài.
    if (!store.settings.enabled) {
      return NextResponse.json({ ...state(), skipped: "Tự lái đang tắt" });
    }
    // Tải danh sách chiến dịch MỘT lần và chia sẻ cho cả 3 engine (ở live mode
    // mỗi lần tải là nhiều request Graph API). Thứ tự: lịch chạy TRƯỚC, quy
    // tắc SAU — để quy tắc hiệu suất là tiếng nói cuối cùng trong một tick
    // (lịch bật lên, quy tắc thấy xấu thì tắt ngay trong cùng tick).
    const campaigns = await getCampaigns();
    const applied: string[] = [];
    try {
      applied.push(...(await runDayparting(campaigns)));
    } catch {
      /* bỏ qua lỗi dayparting */
    }
    const rules = await runAutomationRules("auto", campaigns);
    applied.push(...rules.applied);
    // Tự tạm dừng quảng cáo "chai" (nếu người dùng bật) — không chặn tick.
    try {
      applied.push(...(await runFatigueAutopause()));
    } catch {
      /* bỏ qua lỗi quét độ chai */
    }
    // Đẩy cảnh báo mới qua Telegram/Zalo (nếu có cấu hình) — không chặn tick.
    try {
      await runAlertNotifications(false, campaigns);
    } catch {
      /* bỏ qua lỗi gửi cảnh báo */
    }
    return NextResponse.json({ ...state(), applied });
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
