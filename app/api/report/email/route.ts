import { NextResponse } from "next/server";
import { sendReportEmail } from "@/lib/report/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { to?: string; preview?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* body rỗng cũng được */
  }
  const to = (body.to ?? "").toString().trim() || undefined;
  const result = await sendReportEmail(to, { previewOnly: Boolean(body.preview) });
  return NextResponse.json(result);
}

// Cho phép cron gọi GET (vd Vercel Cron / cron-job.org) để gửi định kỳ.
export async function GET() {
  const result = await sendReportEmail();
  return NextResponse.json(result);
}
