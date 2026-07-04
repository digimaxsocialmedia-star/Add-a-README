import { NextResponse } from "next/server";
import { getAccountsOverview } from "@/lib/meta/client";
import {
  getActiveAccountId,
  getMode,
  listAccounts,
  setActiveAccount,
} from "@/lib/meta/config";
import { ensureHydrated, schedulePersist } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

async function payload() {
  return {
    accounts: await getAccountsOverview(),
    activeId: getActiveAccountId(),
    mode: getMode(),
  };
}

// GET /api/accounts          → tổng quan đầy đủ (kèm chi tiêu/ROAS từng TK)
// GET /api/accounts?light=1  → chỉ danh sách + TK đang chọn (cho TopBar)
export async function GET(req: Request) {
  ensureHydrated(); // khôi phục tài khoản đang chọn từ đĩa sau khi restart
  const light = new URL(req.url).searchParams.get("light");
  if (light) {
    return NextResponse.json({
      accounts: listAccounts(),
      activeId: getActiveAccountId(),
      mode: getMode(),
    });
  }
  return NextResponse.json(await payload());
}

export async function POST(req: Request) {
  let body: { op?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (body.op === "switch" && body.id) {
    ensureHydrated();
    if (!setActiveAccount(body.id)) {
      return NextResponse.json(
        { error: "Tài khoản không nằm trong danh sách đã cấu hình." },
        { status: 400 },
      );
    }
    schedulePersist();
    return NextResponse.json(await payload());
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
