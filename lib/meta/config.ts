// Reads Meta Marketing API configuration from the environment and decides
// whether the app runs in "live" mode (real Graph API) or "demo" mode (mock).
//
// Đa tài khoản: khai báo nhiều tài khoản qua META_AD_ACCOUNT_IDS
// ("act_1:Nhãn A,act_2:Nhãn B" — nhãn tùy chọn) hoặc một tài khoản qua
// META_AD_ACCOUNT_ID như cũ. Tài khoản ĐANG CHỌN được giữ trong bộ nhớ tiến
// trình (đổi qua API /api/accounts); mọi lời gọi Graph dùng tài khoản này.

import type { AdAccountInfo } from "../types";

export interface MetaConfig {
  accessToken: string;
  adAccountId: string; // tài khoản ĐANG CHỌN, đã chuẩn hóa tiền tố `act_`
  apiVersion: string;
  datePreset: string;
  conversionActionType?: string;
  pageId?: string;
  pixelId?: string;
  targetingCountry: string;
  /** Hệ số quy đổi đơn vị nhỏ nhất → đơn vị chính của tiền tệ tài khoản.
   *  USD/EUR = 100 (cents). VND là tiền tệ không có đơn vị lẻ → đặt = 1. */
  currencyOffset: number;
}

/** 2 tài khoản mẫu ở demo mode để trải nghiệm chuyển đổi + tổng hợp. */
const DEMO_ACCOUNTS: AdAccountInfo[] = [
  { id: "demo_acme", label: "Cửa hàng Acme — demo" },
  { id: "demo_bloom", label: "Thời trang Bloom — demo" },
];

function normalizeActId(raw: string): string {
  const id = raw.trim();
  return id.startsWith("act_") ? id : `act_${id}`;
}

/** True when enough credentials are present to talk to the real Graph API. */
export function isLiveMode(): boolean {
  return Boolean(
    process.env.META_ACCESS_TOKEN &&
      (process.env.META_AD_ACCOUNT_ID || process.env.META_AD_ACCOUNT_IDS),
  );
}

export function getMode(): "live" | "demo" {
  return isLiveMode() ? "live" : "demo";
}

/** Danh sách tài khoản quảng cáo đã cấu hình (luôn có ít nhất 1 phần tử). */
export function listAccounts(): AdAccountInfo[] {
  if (!isLiveMode()) return DEMO_ACCOUNTS;

  const multi = process.env.META_AD_ACCOUNT_IDS;
  if (multi?.trim()) {
    const parsed = multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        // "act_123:Shop Áo" → id + nhãn; nhãn tùy chọn.
        const [rawId, ...labelParts] = entry.split(":");
        const id = normalizeActId(rawId);
        const label = labelParts.join(":").trim();
        return { id, label: label || `Meta · ${id}` };
      });
    if (parsed.length) return parsed;
  }

  const id = normalizeActId(process.env.META_AD_ACCOUNT_ID!);
  return [{ id, label: `Meta · ${id}` }];
}

// Tài khoản đang chọn — global để sống qua hot reload trong một tiến trình,
// giống store demo. (Bản production thật sẽ lưu theo phiên người dùng.)
declare global {
  // eslint-disable-next-line no-var
  var __adpilotActiveAccount: string | undefined;
}

export function getActiveAccountId(): string {
  const accounts = listAccounts();
  const cur = globalThis.__adpilotActiveAccount;
  if (cur && accounts.some((a) => a.id === cur)) return cur;
  return accounts[0].id;
}

/** Đổi tài khoản đang chọn. Trả false nếu id không nằm trong danh sách. */
export function setActiveAccount(id: string): boolean {
  if (!listAccounts().some((a) => a.id === id)) return false;
  globalThis.__adpilotActiveAccount = id;
  return true;
}

/** Throws if called in demo mode — only valid when isLiveMode() is true. */
export function getMetaConfig(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken || !isLiveMode()) {
    throw new Error("Meta API is not configured (missing token or account id)");
  }
  return {
    accessToken,
    adAccountId: getActiveAccountId(),
    apiVersion: process.env.META_API_VERSION || "v23.0",
    datePreset: process.env.META_INSIGHTS_DATE_PRESET || "last_30d",
    conversionActionType: process.env.META_CONVERSION_ACTION_TYPE,
    pageId: process.env.META_PAGE_ID,
    pixelId: process.env.META_PIXEL_ID,
    targetingCountry: process.env.META_TARGETING_COUNTRY || "VN",
    // Tài khoản VND nên đặt META_CURRENCY_OFFSET=1.
    currencyOffset: Number(process.env.META_CURRENCY_OFFSET) || 100,
  };
}

/** Nhãn của tài khoản đang chọn (hiện ở TopBar, email, cảnh báo…). */
export function getAccountLabel(): string {
  const active = getActiveAccountId();
  return listAccounts().find((a) => a.id === active)?.label ?? active;
}
