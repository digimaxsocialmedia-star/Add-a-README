// -----------------------------------------------------------------------------
// Khóa cửa toàn ứng dụng. Khi đặt APP_PASSWORD trong env, mọi trang và API đều
// yêu cầu đã đăng nhập (cookie chứa SHA-256 của mật khẩu). Không đặt
// APP_PASSWORD thì app mở tự do (tiện cho demo local) — nhưng ở LIVE mode với
// tiền thật, hãy luôn đặt mật khẩu.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "adpilot_auth";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // chưa đặt mật khẩu → không khóa

  const { pathname } = req.nextUrl;
  // Các đường công khai: trang đăng nhập + API đăng nhập.
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const expected = await sha256Hex(`adpilot:${password}`);
  const got = req.cookies.get(AUTH_COOKIE)?.value;
  if (got === expected) return NextResponse.next();

  // API → 401 JSON; trang → chuyển tới /login kèm đường quay lại.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Chưa đăng nhập. Vào /login để đăng nhập." },
      { status: 401 },
    );
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(login);
}

export const config = {
  // Bỏ qua tài nguyên tĩnh của Next; còn lại (trang + API) đều qua khóa.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
