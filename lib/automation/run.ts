import {
  getCampaigns,
  setCampaignStatus,
  updateCampaignDailyBudget,
} from "../meta/client";
import { evaluate } from "./engine";
import { addLog, getStore, onCooldown, setCooldown } from "../mock/store";
import type { CampaignWithMetrics } from "../types";

export const RULE_COOLDOWN_MIN = 60;
// Tăng/giảm ngân sách theo % sẽ LŨY TIẾN nếu lặp mỗi giờ (1.2^24 ≈ 79×/ngày,
// vì số liệu 30 ngày gần như không đổi giữa các lần chạy) — nên ở chế độ tự
// động, hành động ngân sách chỉ được áp tối đa 1 lần/ngày cho mỗi chiến dịch.
const BUDGET_COOLDOWN_MIN = 24 * 60;

/**
 * Đánh giá và áp dụng các quy tắc tự động.
 * - "manual": áp dụng mọi hành động khớp (người dùng bấm "Chạy quy tắc ngay").
 * - "auto":   dùng khoảng chờ (cooldown) để ngân sách không bị tăng/giảm dồn
 *             mỗi lần chạy định kỳ.
 * `snapshot`: danh sách chiến dịch đã tải sẵn (tránh gọi API lặp trong 1 tick).
 */
export async function runAutomationRules(
  mode: "manual" | "auto",
  snapshot?: CampaignWithMetrics[],
): Promise<{ applied: string[] }> {
  const store = getStore();
  const campaigns = snapshot ?? (await getCampaigns());
  const evaluations = evaluate(campaigns, store.rules);
  const applied: string[] = [];

  for (const e of evaluations) {
    const c = campaigns.find((x) => x.id === e.campaignId);
    if (!c) continue;
    const rule = store.rules.find((r) => r.id === e.ruleId);
    const pct = rule?.adjustPct ?? 0;
    const key = `${e.ruleId}:${e.campaignId}`;

    // Ở chế độ tự động, bỏ qua nếu vừa áp dụng gần đây.
    const cooldownMin =
      e.action === "INCREASE_BUDGET" || e.action === "DECREASE_BUDGET"
        ? BUDGET_COOLDOWN_MIN
        : RULE_COOLDOWN_MIN;
    if (mode === "auto" && onCooldown(key, cooldownMin)) continue;

    try {
      switch (e.action) {
        case "PAUSE":
          await setCampaignStatus(c.id, "PAUSED");
          c.status = "PAUSED"; // cập nhật snapshot cho engine chạy sau trong cùng tick
          break;
        case "INCREASE_BUDGET":
          await updateCampaignDailyBudget(
            c.id,
            Math.round(c.dailyBudget * (1 + pct / 100)),
          );
          break;
        case "DECREASE_BUDGET":
          await updateCampaignDailyBudget(
            c.id,
            Math.round(c.dailyBudget * (1 - pct / 100)),
          );
          break;
        case "NOTIFY":
          break;
      }
      if (rule) rule.lastTriggered = new Date().toISOString();
      setCooldown(key);
      applied.push(e.message);
      addLog({ kind: "rule", message: e.message, campaignName: e.campaignName });
    } catch (err) {
      applied.push(
        `Thất bại: ${e.message} — ${err instanceof Error ? err.message : "lỗi"}`,
      );
    }
  }

  store.settings.lastRunAt = new Date().toISOString();
  return { applied };
}
