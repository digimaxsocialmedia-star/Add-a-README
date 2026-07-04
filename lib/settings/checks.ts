// -----------------------------------------------------------------------------
// Kiểm tra kết nối cho trang Cài đặt — mỗi hàm thử gọi dịch vụ tương ứng bằng
// lệnh NHẸ nhất có thể (không gửi tin, không tốn token AI, không đụng dữ liệu)
// và trả về kết quả tiếng Việt dễ hiểu. Mọi lỗi mạng/cấu hình đều được bắt và
// diễn giải — không bao giờ ném lỗi ra ngoài.
// -----------------------------------------------------------------------------

import nodemailer from "nodemailer";
import Anthropic from "@anthropic-ai/sdk";
import { getMetaConfig, isLiveMode, listAccounts } from "../meta/config";
import { graphGet } from "../meta/graph";

export interface CheckResult {
  ok: boolean;
  message: string;
  details?: string[];
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "lỗi không xác định";
}

/** Đọc JSON an toàn: response không phải JSON (proxy/gateway chặn) → lỗi gọn. */
async function readJsonSafe<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `máy chủ trả về nội dung không phải JSON (HTTP ${res.status}): ${text.slice(0, 80).trim()}`,
    );
  }
}

// Trạng thái tài khoản QC theo Graph API `account_status`.
const ACCOUNT_STATUS_VI: Record<number, string> = {
  1: "đang hoạt động",
  2: "bị vô hiệu hóa",
  3: "nợ thanh toán",
  7: "đang xét duyệt",
  9: "đang trong kỳ gia hạn",
  100: "chờ đóng",
  101: "đã đóng",
};

/** Meta: token hợp lệ? Từng tài khoản QC có truy cập được không, tiền tệ gì? */
export async function testMeta(): Promise<CheckResult> {
  if (!isLiveMode()) {
    return {
      ok: false,
      message:
        "Đang ở chế độ demo — đặt META_ACCESS_TOKEN + META_AD_ACCOUNT_ID(S) trong .env.local rồi khởi động lại để nối Meta thật.",
    };
  }
  try {
    const me = await graphGet("me", { fields: "id,name" });
    const details: string[] = [];
    for (const acc of listAccounts()) {
      try {
        const info = await graphGet(acc.id, {
          fields: "name,account_status,currency,timezone_name",
        });
        const status =
          ACCOUNT_STATUS_VI[Number(info.account_status)] ??
          `mã ${info.account_status}`;
        details.push(
          `✓ ${acc.id} — "${info.name}" · ${info.currency} · ${status}`,
        );
      } catch (err) {
        details.push(`✗ ${acc.id} — không truy cập được: ${errMsg(err)}`);
      }
    }
    const { currencyOffset } = getMetaConfig();
    const vndAccounts = details.filter((d) => d.includes("· VND"));
    if (vndAccounts.length > 0 && currencyOffset !== 1) {
      details.push(
        "⚠ Tài khoản dùng VND nhưng META_CURRENCY_OFFSET chưa đặt = 1 — ngân sách sẽ hiển thị sai 100 lần.",
      );
    }
    return {
      ok: details.every((d) => !d.startsWith("✗")),
      message: `Token hợp lệ (đăng nhập với "${me.name}").`,
      details,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Token không hợp lệ hoặc không gọi được Graph API: ${errMsg(err)}`,
    };
  }
}

/** Claude: key hợp lệ? Dùng Models API (GET, không tốn token sinh chữ). */
export async function testClaude(): Promise<CheckResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message:
        "Chưa đặt ANTHROPIC_API_KEY — các tính năng AI đang dùng phương án dự phòng theo quy tắc.",
    };
  }
  try {
    const client = new Anthropic();
    const model = (await client.models.retrieve("claude-opus-4-8")) as {
      id: string;
      display_name?: string;
    };
    return {
      ok: true,
      message: `Key hợp lệ — dùng được model ${model.display_name ?? model.id}.`,
    };
  } catch (err) {
    return { ok: false, message: `Key không hợp lệ hoặc không gọi được API: ${errMsg(err)}` };
  }
}

/** SMTP: kết nối + đăng nhập được không (không gửi email nào). */
export async function testEmail(): Promise<CheckResult> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    const missing = [
      !SMTP_HOST && "SMTP_HOST",
      !SMTP_USER && "SMTP_USER",
      !SMTP_PASS && "SMTP_PASS",
    ].filter(Boolean);
    return { ok: false, message: `Chưa cấu hình SMTP — thiếu ${missing.join(", ")}.` };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 8000,
    });
    await transporter.verify();
    return {
      ok: true,
      message: `Kết nối + đăng nhập SMTP thành công (${SMTP_HOST}).`,
      details: process.env.REPORT_EMAIL_TO
        ? [`Báo cáo định kỳ sẽ gửi tới ${process.env.REPORT_EMAIL_TO}.`]
        : ["⚠ Chưa đặt REPORT_EMAIL_TO — cron gửi báo cáo sẽ không biết gửi cho ai."],
    };
  } catch (err) {
    return { ok: false, message: `Không kết nối được SMTP: ${errMsg(err)}` };
  }
}

/** Telegram: token bot hợp lệ? (getMe — không gửi tin nhắn nào). */
export async function testTelegram(): Promise<CheckResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, message: "Chưa đặt TELEGRAM_BOT_TOKEN." };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    });
    const data = await readJsonSafe<{
      ok: boolean;
      result?: { username?: string };
      description?: string;
    }>(res);
    if (!data.ok) throw new Error(data.description || "token bị từ chối");
    return {
      ok: true,
      message: `Bot hợp lệ: @${data.result?.username}.`,
      details: process.env.TELEGRAM_CHAT_ID
        ? undefined
        : ["⚠ Chưa đặt TELEGRAM_CHAT_ID — bot chưa biết gửi cảnh báo vào đâu."],
    };
  } catch (err) {
    return { ok: false, message: `Không xác thực được bot: ${errMsg(err)}` };
  }
}

/** Zalo OA: access token còn hiệu lực? */
export async function testZalo(): Promise<CheckResult> {
  const token = process.env.ZALO_OA_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, message: "Chưa đặt ZALO_OA_ACCESS_TOKEN." };
  }
  try {
    const res = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
      headers: { access_token: token },
      cache: "no-store",
    });
    const data = await readJsonSafe<{
      error: number;
      message?: string;
      data?: { name?: string };
    }>(res);
    if (data.error !== 0) throw new Error(data.message || `mã lỗi ${data.error}`);
    return {
      ok: true,
      message: `Token OA hợp lệ: "${data.data?.name}".`,
      details: process.env.ZALO_USER_ID
        ? undefined
        : ["⚠ Chưa đặt ZALO_USER_ID — chưa biết gửi cảnh báo cho ai."],
    };
  } catch (err) {
    return { ok: false, message: `Không xác thực được Zalo OA: ${errMsg(err)}` };
  }
}
