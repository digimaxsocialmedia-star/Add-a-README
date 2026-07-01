// Gửi tin nhắn tức thì qua Telegram bot và/hoặc Zalo OA.
// Cấu hình qua biến môi trường:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//   ZALO_OA_ACCESS_TOKEN, ZALO_USER_ID

export type NotifyChannel = "telegram" | "zalo";

export interface ChannelResult {
  channel: NotifyChannel;
  ok: boolean;
  error?: string;
}

export function configuredChannels(): NotifyChannel[] {
  const ch: NotifyChannel[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
    ch.push("telegram");
  if (process.env.ZALO_OA_ACCESS_TOKEN && process.env.ZALO_USER_ID)
    ch.push("zalo");
  return ch;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "lỗi không xác định";
}

async function sendTelegram(text: string): Promise<ChannelResult> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || data.ok === false) {
      throw new Error(data.description || `HTTP ${res.status}`);
    }
    return { channel: "telegram", ok: true };
  } catch (err) {
    return { channel: "telegram", ok: false, error: msg(err) };
  }
}

async function sendZalo(text: string): Promise<ChannelResult> {
  try {
    const res = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: process.env.ZALO_OA_ACCESS_TOKEN!,
      },
      body: JSON.stringify({
        recipient: { user_id: process.env.ZALO_USER_ID },
        message: { text },
      }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: number;
      message?: string;
    };
    if (!res.ok || (data.error != null && data.error !== 0)) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return { channel: "zalo", ok: true };
  } catch (err) {
    return { channel: "zalo", ok: false, error: msg(err) };
  }
}

/** Gửi tới tất cả kênh đã cấu hình. */
export async function notify(text: string): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];
  for (const c of configuredChannels()) {
    results.push(c === "telegram" ? await sendTelegram(text) : await sendZalo(text));
  }
  return results;
}
