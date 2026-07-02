// -----------------------------------------------------------------------------
// Dayparting — lịch chạy theo khung giờ.
//
// Mỗi chiến dịch có thể gắn một lưới 7 ngày × 24 giờ (giờ Việt Nam). Khi lịch
// được bật, runDayparting() so trạng thái hiện tại với ô lưới của thời điểm
// hiện tại và BẬT/TẠM DỪNG chiến dịch cho khớp. Chỉ ghi khi trạng thái lệch
// nên gọi lặp lại (timer/cron) là an toàn — không đổi gì thì không làm gì.
// -----------------------------------------------------------------------------

import { getCampaigns, setCampaignStatus } from "../meta/client";
import { addLog, getStore } from "../mock/store";
import type { DaypartSchedule } from "../types";

/** Lịch luôn được hiểu theo giờ Việt Nam, bất kể server đặt ở đâu. */
export const SCHEDULE_TIMEZONE = "Asia/Ho_Chi_Minh";

export const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Ngày (0 = Thứ 2 … 6 = CN) và giờ (0-23) hiện tại theo giờ Việt Nam. */
export function nowInScheduleTz(at: Date = new Date()): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const day = WEEKDAYS.indexOf(wd);
  return {
    day: day < 0 ? 0 : day,
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0,
  };
}

/** Lưới 7×24 đồng nhất (mặc định: chạy cả tuần). */
export function fullGrid(on = true): number[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => (on ? 1 : 0)));
}

/** Ép dữ liệu bất kỳ về lưới 7×24 hợp lệ gồm 0/1. */
export function normalizeGrid(input: unknown): number[][] {
  const grid = fullGrid(false);
  if (!Array.isArray(input)) return grid;
  for (let d = 0; d < 7; d++) {
    const row = input[d];
    if (!Array.isArray(row)) continue;
    for (let h = 0; h < 24; h++) grid[d][h] = row[h] ? 1 : 0;
  }
  return grid;
}

/** Chiến dịch có được phép chạy tại (ngày, giờ) này không. */
export function isOnAt(s: DaypartSchedule, day: number, hour: number): boolean {
  return s.grid[day]?.[hour] === 1;
}

/**
 * Áp dụng mọi lịch đang bật: chiến dịch trong khung giờ → ACTIVE, ngoài khung
 * giờ → PAUSED. Trả về danh sách thông báo cho các thay đổi đã thực hiện.
 */
export async function runDayparting(): Promise<string[]> {
  const schedules = Object.values(getStore().schedules).filter((s) => s.enabled);
  if (!schedules.length) return [];

  const { day, hour } = nowInScheduleTz();
  const campaigns = await getCampaigns();
  const applied: string[] = [];

  for (const s of schedules) {
    const c = campaigns.find((x) => x.id === s.campaignId);
    if (!c) continue;
    const desired = isOnAt(s, day, hour) ? "ACTIVE" : "PAUSED";
    if (c.status === desired) continue;
    await setCampaignStatus(c.id, desired);
    const msg =
      desired === "ACTIVE"
        ? `Lịch chạy: BẬT "${c.name}" (trong khung giờ ${hour}h ${DAY_LABELS[day]}).`
        : `Lịch chạy: TẠM DỪNG "${c.name}" (ngoài khung giờ đã đặt).`;
    addLog({ kind: "daypart", message: msg, campaignName: c.name });
    applied.push(msg);
  }
  return applied;
}
