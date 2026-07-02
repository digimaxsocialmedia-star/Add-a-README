import { NextResponse } from "next/server";
import { getStore } from "@/lib/mock/store";
import { undoEntry } from "@/lib/history/undo";
import { getMode } from "@/lib/meta/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ entries: getStore().history, mode: getMode() });
}

export async function POST(req: Request) {
  let body: { op?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (body.op === "undo" && body.id) {
    const result = await undoEntry(body.id);
    return NextResponse.json({
      ...result,
      entries: getStore().history,
      mode: getMode(),
    });
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
