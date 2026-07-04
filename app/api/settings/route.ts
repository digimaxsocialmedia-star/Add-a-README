import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getMode, listAccounts } from "@/lib/meta/config";
import { loadPersisted } from "@/lib/persist/file";
import { ensureHydrated } from "@/lib/mock/store";
import {
  testClaude,
  testEmail,
  testMeta,
  testTelegram,
  testZalo,
} from "@/lib/settings/checks";

export const dynamic = "force-dynamic";

// Trạng thái cấu hình — CHỈ trả boolean/nhãn, không bao giờ trả secret.
function statusSnapshot() {
  ensureHydrated();
  const mode = getMode();
  const dataDir = process.env.ADPILOT_DATA_DIR || ".data";
  let writable = false;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
    writable = true;
  } catch {
    /* đĩa chỉ đọc */
  }
  const persisted = loadPersisted();

  return {
    mode,
    security: {
      passwordSet: Boolean(process.env.APP_PASSWORD),
      // Live mode mà không đặt mật khẩu = ai có URL cũng điều khiển được tiền thật.
      openLiveWarning: mode === "live" && !process.env.APP_PASSWORD,
    },
    persistence: {
      dir: path.resolve(dataDir),
      writable,
      savedAt: persisted?.savedAt ?? null,
    },
    meta: {
      configured: mode === "live",
      accounts: listAccounts(),
      apiVersion: process.env.META_API_VERSION || "v23.0",
      datePreset: process.env.META_INSIGHTS_DATE_PRESET || "last_30d",
      currencyOffset: Number(process.env.META_CURRENCY_OFFSET) || 100,
      pageId: Boolean(process.env.META_PAGE_ID),
      pixelId: Boolean(process.env.META_PIXEL_ID),
      targetingCountry: process.env.META_TARGETING_COUNTRY || "VN",
    },
    claude: { configured: Boolean(process.env.ANTHROPIC_API_KEY) },
    email: {
      configured: Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
      ),
      host: process.env.SMTP_HOST || null,
      to: process.env.REPORT_EMAIL_TO || null,
    },
    telegram: {
      configured: Boolean(
        process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
      ),
      tokenSet: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      chatIdSet: Boolean(process.env.TELEGRAM_CHAT_ID),
    },
    zalo: {
      configured: Boolean(
        process.env.ZALO_OA_ACCESS_TOKEN && process.env.ZALO_USER_ID,
      ),
      tokenSet: Boolean(process.env.ZALO_OA_ACCESS_TOKEN),
      userIdSet: Boolean(process.env.ZALO_USER_ID),
    },
  };
}

export async function GET() {
  return NextResponse.json(statusSnapshot());
}

const TESTS = {
  meta: testMeta,
  claude: testClaude,
  email: testEmail,
  telegram: testTelegram,
  zalo: testZalo,
} as const;

export async function POST(req: Request) {
  let body: { op?: string; service?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (body.op === "test" && body.service && body.service in TESTS) {
    const result = await TESTS[body.service as keyof typeof TESTS]();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
