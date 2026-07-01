import { NextResponse } from "next/server";
import {
  runAlertNotifications,
  sendTestNotification,
  resetNotified,
} from "@/lib/alerts/notify";
import { configuredChannels } from "@/lib/notify/channels";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Cho cron gọi (Vercel Cron / cron-job.org): chỉ gửi cảnh báo mới.
export async function GET() {
  return NextResponse.json(await runAlertNotifications(false));
}

export async function POST(req: Request) {
  let body: { op?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body rỗng cũng được */
  }

  switch (body.op) {
    case "status":
      return NextResponse.json({ channels: configuredChannels() });
    case "test":
      return NextResponse.json(await sendTestNotification());
    case "send":
      return NextResponse.json(await runAlertNotifications(true));
    case "run":
      return NextResponse.json(await runAlertNotifications(false));
    case "reset":
      resetNotified();
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
  }
}
