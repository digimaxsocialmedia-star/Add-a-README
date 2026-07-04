// -----------------------------------------------------------------------------
// Tự tạm dừng quảng cáo "chai" — khép vòng PHÁT HIỆN (lib/fatigue/engine) →
// HÀNH ĐỘNG: quảng cáo đang chạy có điểm chai ≥ ngưỡng sẽ bị tạm dừng tự động,
// ghi nhật ký + lịch sử (actor "fatigue", hoàn tác được như mọi thay đổi khác).
//
// Chốt an toàn: mỗi quảng cáo chỉ bị tự tạm dừng tối đa 1 lần/24h — nếu bạn
// chủ động bật lại, máy sẽ không giật tắt ngay trong ngày.
// -----------------------------------------------------------------------------

import { getAdFatigue, setAdStatus } from "../meta/client";
import { addLog, getStore, onCooldown, setCooldown } from "../mock/store";
import { runAsActor } from "../history/engine";

const REPAUSE_COOLDOWN_MIN = 24 * 60;

/**
 * Quét và tạm dừng quảng cáo chai.
 * - force=false (autopilot định kỳ): chỉ chạy khi người dùng đã BẬT tính năng.
 * - force=true  (bấm "Quét ngay"): chạy bất kể công tắc.
 */
export async function runFatigueAutopause(force = false): Promise<string[]> {
  const cfg = getStore().fatigueAuto;
  if (!force && !cfg.enabled) return [];

  const ads = await getAdFatigue();
  const applied: string[] = [];
  for (const ad of ads) {
    if (ad.status !== "ACTIVE") continue;
    if (ad.score < cfg.minScore) continue;
    const key = `fatigue:${ad.id}`;
    if (onCooldown(key, REPAUSE_COOLDOWN_MIN)) continue;

    await runAsActor("fatigue", () => setAdStatus(ad.id, "PAUSED"));
    setCooldown(key);
    const msg = `Chống chai: TẠM DỪNG "${ad.name}" (điểm chai ${ad.score} ≥ ${cfg.minScore} — ${ad.reasons.join("; ")}).`;
    addLog({ kind: "fatigue", message: msg, campaignName: ad.campaignName });
    applied.push(msg);
  }
  return applied;
}
