import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUTH_COOKIE = "adpilot_auth";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function tokenFor(password: string): string {
  // Phải khớp thuật toán trong middleware.ts (sha256 hex của "adpilot:<mk>").
  return createHash("sha256").update(`adpilot:${password}`).digest("hex");
}

export async function POST(req: Request) {
  let body: { op?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (body.op === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
    return res;
  }

  const configured = process.env.APP_PASSWORD;
  if (!configured) {
    return NextResponse.json({
      ok: true,
      note: "Chưa đặt APP_PASSWORD — app đang mở tự do, không cần đăng nhập.",
    });
  }
  if ((body.password ?? "") !== configured) {
    return NextResponse.json({ error: "Mật khẩu không đúng." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, tokenFor(configured), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  return res;
}
