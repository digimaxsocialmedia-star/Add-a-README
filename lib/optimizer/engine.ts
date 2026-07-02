import { getCampaigns, updateCampaignDailyBudget } from "../meta/client";
import { addLog } from "../mock/store";
import { runAsActor } from "../history/engine";
import { money, roasFmt } from "../format";
import type { BudgetChange, BudgetPlan, CampaignWithMetrics } from "../types";

// Không đổi ngân sách một chiến dịch quá ±35% mỗi lần để tránh biến động sốc.
const MAX_STEP = 0.35;
// Làm tròn ngân sách đến bội số 50.000đ cho gọn.
const ROUND_TO = 50_000;

function roundBudget(v: number): number {
  return Math.max(ROUND_TO, Math.round(v / ROUND_TO) * ROUND_TO);
}

/**
 * Phân bổ lại tổng ngân sách của các chiến dịch đang chạy theo hiệu suất:
 * chiến dịch ROAS cao được tăng, ROAS thấp bị giảm — giữ tổng ngân sách gần
 * như không đổi (chỉ tái phân bổ, không tăng tổng chi).
 */
export function planBudget(campaigns: CampaignWithMetrics[]): BudgetPlan {
  const active = campaigns.filter(
    (c) => c.status === "ACTIVE" && c.metrics.spend > 0,
  );
  const total = active.reduce((s, c) => s + c.dailyBudget, 0);
  if (active.length === 0 || total === 0) {
    return { changes: [], totalBefore: 0, totalAfter: 0 };
  }

  // Điểm số theo ROAS (có sàn để tệ nhất vẫn giữ chút ngân sách).
  const score = (c: CampaignWithMetrics) => Math.max(0.15, c.metrics.roas);
  const scoreSum = active.reduce((s, c) => s + score(c), 0);

  // Phân bổ lý tưởng theo điểm, rồi kẹp mức thay đổi ±MAX_STEP.
  const capped = active.map((c) => {
    const ideal = (total * score(c)) / scoreSum;
    const maxUp = c.dailyBudget * (1 + MAX_STEP);
    const maxDown = c.dailyBudget * (1 - MAX_STEP);
    return { c, rec: Math.min(maxUp, Math.max(maxDown, ideal)) };
  });

  // Chuẩn hóa lại để tổng bằng ngân sách ban đầu.
  const capSum = capped.reduce((s, x) => s + x.rec, 0);
  const changes: BudgetChange[] = capped.map(({ c, rec }) => {
    const recommended = roundBudget((rec * total) / capSum);
    const delta = recommended - c.dailyBudget;
    const deltaPct = c.dailyBudget ? (delta / c.dailyBudget) * 100 : 0;
    const r = c.metrics.roas;
    const reason =
      r >= 3
        ? `ROAS ${roasFmt(r)} rất tốt — tăng ngân sách để mở rộng.`
        : r >= 1.5
          ? `ROAS ${roasFmt(r)} ổn — giữ hoặc tăng nhẹ.`
          : r >= 1
            ? `ROAS ${roasFmt(r)} mỏng — điều chỉnh thận trọng.`
            : `ROAS ${roasFmt(r)} dưới hòa vốn — giảm để cắt lỗ.`;
    return {
      campaignId: c.id,
      campaignName: c.name,
      current: c.dailyBudget,
      recommended,
      delta,
      deltaPct,
      reason,
    };
  });

  const totalAfter = changes.reduce((s, x) => s + x.recommended, 0);
  return {
    changes: changes.sort((a, b) => b.delta - a.delta),
    totalBefore: total,
    totalAfter,
  };
}

/** Tính lại kế hoạch từ dữ liệu hiện tại (dry-run). */
export async function getBudgetPlan(): Promise<BudgetPlan> {
  return planBudget(await getCampaigns());
}

/** Áp dụng kế hoạch: ghi ngân sách mới qua tầng dữ liệu + ghi nhật ký. */
export async function applyBudgetPlan(): Promise<{
  applied: string[];
  plan: BudgetPlan;
}> {
  const plan = planBudget(await getCampaigns());
  const applied: string[] = [];
  for (const ch of plan.changes) {
    if (ch.recommended === ch.current) continue;
    await runAsActor("optimizer", () =>
      updateCampaignDailyBudget(ch.campaignId, ch.recommended),
    );
    const msg = `Tối ưu ngân sách "${ch.campaignName}": ${money(
      ch.current,
    )} → ${money(ch.recommended)} (${ch.delta >= 0 ? "+" : ""}${ch.deltaPct.toFixed(0)}%)`;
    applied.push(msg);
    addLog({ kind: "optimizer", message: msg, campaignName: ch.campaignName });
  }
  // Kế hoạch sau khi áp dụng (mọi thay đổi giờ đã bằng 0).
  return { applied, plan: await getBudgetPlan() };
}
