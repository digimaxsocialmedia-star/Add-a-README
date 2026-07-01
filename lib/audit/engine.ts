import { money, pct, roasFmt } from "../format";
import type {
  AccountSummary,
  AuditCheck,
  AuditResult,
  CampaignWithMetrics,
  CheckStatus,
} from "../types";

// Ngưỡng CPA "cao" tính theo VND.
const HIGH_CPA = 1_200_000;

// Điểm trừ theo trạng thái, áp dụng lên điểm khởi đầu 100.
const PENALTY: Record<CheckStatus, number> = { pass: 0, warn: 6, fail: 14 };

function grade(score: number): AuditResult["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function runAudit(
  campaigns: CampaignWithMetrics[],
  summary: AccountSummary,
): AuditResult {
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.metrics.spend > 0);
  const checks: AuditCheck[] = [];
  const m = summary.metrics;

  // 1. ROAS toàn tài khoản
  checks.push({
    id: "account_roas",
    title: "Tài khoản có lợi nhuận tổng thể",
    category: "profitability",
    status: m.roas >= 2 ? "pass" : m.roas >= 1 ? "warn" : "fail",
    detail: `ROAS tổng của tài khoản là ${roasFmt(m.roas)} trên ${money(
      m.spend,
    )} chi tiêu.`,
    recommendation:
      m.roas < 1
        ? "Tài khoản đang lỗ. Hãy tạm dừng các chiến dịch tệ nhất và dồn ngân sách cho chiến dịch hiệu quả."
        : m.roas < 2
          ? "Biên lợi nhuận đang mỏng — siết lại nhắm chọn và làm mới nội dung ở các chiến dịch tầm trung."
          : undefined,
  });

  // 2. Chiến dịch đang lỗ
  const losers = active.filter((c) => c.metrics.roas < 1);
  checks.push({
    id: "unprofitable",
    title: "Không có chiến dịch nào đang lỗ",
    category: "profitability",
    status: losers.length === 0 ? "pass" : losers.length > 1 ? "fail" : "warn",
    detail: losers.length
      ? `${losers.length} chiến dịch đang chạy có ROAS dưới 1.0x: ${losers
          .map((c) => `"${c.name}"`)
          .join(", ")}.`
      : "Mọi chiến dịch đang chạy và có chi tiêu đều ở mức hòa vốn trở lên.",
    recommendation: losers.length
      ? "Tạm dừng hoặc giảm ngân sách các chiến dịch dưới 1.0x trong tuần này."
      : undefined,
  });

  // 3. CTR thấp
  const lowCtr = active.filter((c) => c.metrics.ctr < 1);
  checks.push({
    id: "ctr",
    title: "Quảng cáo thu hút (CTR ≥ 1%)",
    category: "efficiency",
    status: lowCtr.length === 0 ? "pass" : lowCtr.length > 1 ? "fail" : "warn",
    detail: lowCtr.length
      ? `${lowCtr.length} chiến dịch có CTR dưới 1% — ví dụ "${lowCtr[0].name}" chỉ ${pct(
          lowCtr[0].metrics.ctr,
        )}.`
      : "Tất cả chiến dịch đang chạy đều có tỉ lệ nhấp lành mạnh.",
    recommendation: lowCtr.length
      ? "Thử các hook/thumbnail mới; tạm dừng quảng cáo có CTR thấp nhất trong mỗi nhóm yếu."
      : undefined,
  });

  // 4. CPA cao
  const pricey = active.filter(
    (c) => c.metrics.conversions > 0 && c.metrics.cpa > HIGH_CPA,
  );
  checks.push({
    id: "cpa",
    title: "Chi phí mỗi chuyển đổi trong tầm kiểm soát",
    category: "efficiency",
    status: pricey.length === 0 ? "pass" : "warn",
    detail: pricey.length
      ? `${pricey.length} chiến dịch có CPA trên ${money(HIGH_CPA)} — cao nhất là "${
          pricey.sort((a, b) => b.metrics.cpa - a.metrics.cpa)[0].name
        }" ở mức ${money(pricey[0].metrics.cpa)}.`
      : "Không có chiến dịch nào trả chi phí mỗi chuyển đổi cao bất thường.",
    recommendation: pricey.length
      ? "Chuyển sang đặt giá thầu giới hạn chi phí (cost cap) hoặc siết đối tượng ở các chiến dịch CPA cao."
      : undefined,
  });

  // 5. Tập trung chi tiêu
  const totalSpend = active.reduce((s, c) => s + c.metrics.spend, 0);
  const top = [...active].sort((a, b) => b.metrics.spend - a.metrics.spend)[0];
  const share = top && totalSpend ? top.metrics.spend / totalSpend : 0;
  checks.push({
    id: "concentration",
    title: "Chi tiêu không bị dồn quá mức",
    category: "structure",
    status: share > 0.6 ? "warn" : "pass",
    detail: top
      ? `"${top.name}" chiếm ${pct(share * 100)} tổng chi tiêu của tài khoản.`
      : "Chưa có chi tiêu đang hoạt động để đánh giá.",
    recommendation:
      share > 0.6
        ? "Hãy đa dạng hóa — để một chiến dịch gánh phần lớn ngân sách là rủi ro tập trung."
        : undefined,
  });

  // 6. Trùng lặp đối tượng
  const audienceMap = new Map<string, Set<string>>();
  for (const c of active) {
    for (const as of c.adSets) {
      const set = audienceMap.get(as.audience) ?? new Set<string>();
      set.add(c.id);
      audienceMap.set(as.audience, set);
    }
  }
  const overlaps = [...audienceMap.entries()].filter(([, ids]) => ids.size > 1);
  checks.push({
    id: "overlap",
    title: "Đối tượng không trùng giữa các chiến dịch",
    category: "structure",
    status: overlaps.length ? "warn" : "pass",
    detail: overlaps.length
      ? `${overlaps.length} đối tượng đang được nhắm bởi nhiều chiến dịch (ví dụ "${overlaps[0][0]}") — chúng có thể cạnh tranh đấu giá lẫn nhau.`
      : "Mỗi đối tượng chỉ được dùng bởi một chiến dịch.",
    recommendation: overlaps.length
      ? "Gộp các đối tượng trùng lặp hoặc thêm loại trừ để tránh tự cạnh tranh trong đấu giá."
      : undefined,
  });

  // 7. Cơ hội tăng tốc
  const winners = active.filter((c) => c.metrics.roas >= 3);
  checks.push({
    id: "scaling",
    title: "Chiến dịch hiệu quả đang được tăng tốc",
    category: "scaling",
    status: winners.length === 0 ? "warn" : "pass",
    detail: winners.length
      ? `${winners.length} chiến dịch trên 3.0x ROAS là ứng viên để tăng tốc: ${winners
          .map((c) => `"${c.name}"`)
          .join(", ")}.`
      : "Hiện chưa có chiến dịch nào vượt ngưỡng 3.0x ROAS để tăng tốc.",
    recommendation: winners.length
      ? "Tăng ngân sách ~20% mỗi vài ngày cho các chiến dịch này khi ROAS còn giữ vững."
      : "Hãy tìm chiến dịch thắng: tiếp tục thử nội dung cho tới khi một chiến dịch vượt 3.0x ROAS.",
  });

  const counts = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const score = Math.max(
    0,
    Math.round(checks.reduce((s, c) => s - PENALTY[c.status], 100)),
  );

  // Sắp xếp: lỗi trước, rồi cảnh báo, rồi đạt.
  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status]);

  return { score, grade: grade(score), checks, counts };
}
