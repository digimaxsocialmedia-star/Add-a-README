import { pct } from "../format";
import type { FatigueStatus } from "../types";

export interface FatigueInputs {
  frequency: number;
  ctrChangePct: number; // âm = CTR đang giảm
  daysRunning: number;
}

export interface FatigueVerdict {
  fatigue: FatigueStatus;
  score: number;
  reasons: string[];
  recommendation: string;
}

/**
 * Chấm điểm "chai" nội dung từ 3 tín hiệu:
 *  - tần suất (frequency) cao → người xem thấy quá nhiều lần
 *  - CTR giảm dần → nội dung hết hấp dẫn
 *  - chạy đã lâu → nhiều khả năng bão hòa
 */
export function classifyFatigue(i: FatigueInputs): FatigueVerdict {
  let score = 0;
  const reasons: string[] = [];

  if (i.frequency >= 4) {
    score += 40;
    reasons.push(`Tần suất rất cao (${i.frequency.toFixed(1)} lần/người)`);
  } else if (i.frequency >= 2.5) {
    score += 20;
    reasons.push(`Tần suất khá cao (${i.frequency.toFixed(1)} lần/người)`);
  }

  if (i.ctrChangePct <= -30) {
    score += 40;
    reasons.push(`CTR giảm mạnh (${pct(i.ctrChangePct)})`);
  } else if (i.ctrChangePct <= -15) {
    score += 20;
    reasons.push(`CTR đang giảm (${pct(i.ctrChangePct)})`);
  }

  if (i.daysRunning >= 21) {
    score += 10;
    reasons.push(`Đã chạy ${i.daysRunning} ngày`);
  }

  score = Math.min(100, score);
  const fatigue: FatigueStatus =
    score >= 50 ? "fatigued" : score >= 25 ? "warning" : "healthy";

  const recommendation =
    fatigue === "fatigued"
      ? "Làm mới creative (đổi hook/hình/video) hoặc tạm dừng quảng cáo này."
      : fatigue === "warning"
        ? "Chuẩn bị biến thể mới và theo dõi thêm vài ngày."
        : "Đang tốt — tiếp tục chạy.";

  if (reasons.length === 0) reasons.push("Chưa có dấu hiệu bão hòa.");

  return { fatigue, score, reasons, recommendation };
}
