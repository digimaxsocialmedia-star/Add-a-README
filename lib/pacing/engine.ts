// -----------------------------------------------------------------------------
// Budget pacing — kiểm soát ngân sách theo mục tiêu tháng.
//
// Từ chuỗi chi tiêu/doanh thu theo ngày (SeriesPoint) và mục tiêu tháng
// (MonthlyTargets), tính xem tài khoản đang chi nhanh hay chậm so với tiến độ
// tuyến tính, dự phóng cả tháng, và đề xuất ngân sách/ngày để về đúng mục tiêu.
// -----------------------------------------------------------------------------

import type { MonthlyTargets, PacingResult, PaceStatus, SeriesPoint } from "../types";

const MONTHS_VI = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/**
 * Tính tình trạng chi tiêu theo tháng dương lịch hiện tại.
 *
 * @param series  Chuỗi hiệu suất theo ngày (YYYY-MM-DD), tổng hợp toàn tài khoản.
 * @param targets Mục tiêu ngân sách + doanh thu cho cả tháng.
 * @param now     Thời điểm tham chiếu (mặc định là hôm nay).
 */
export function computePacing(
  series: SeriesPoint[],
  targets: MonthlyTargets,
  now: Date = new Date(),
): PacingResult {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`; // "YYYY-MM"

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.min(now.getDate(), daysInMonth);
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // Chỉ lấy các ngày thuộc tháng dương lịch hiện tại.
  const mtd = series.filter((p) => p.date.startsWith(prefix));
  const spendMTD = mtd.reduce((s, p) => s + p.spend, 0);
  const revenueMTD = mtd.reduce((s, p) => s + p.revenue, 0);

  const { monthlyBudget, monthlyRevenue } = targets;

  // Tiến độ tuyến tính: đến hôm nay lẽ ra đã chi bao nhiêu.
  const expectedSpendToDate = safeDiv(monthlyBudget * daysElapsed, daysInMonth);
  const avgDailySpend = safeDiv(spendMTD, daysElapsed);
  const projectedSpend = avgDailySpend * daysInMonth;

  const avgDailyRevenue = safeDiv(revenueMTD, daysElapsed);
  const projectedRevenue = avgDailyRevenue * daysInMonth;

  // Ngân sách/ngày còn lại để về đúng tổng ngân sách tháng.
  const recommendedDailyBudget =
    daysRemaining > 0
      ? Math.max(0, (monthlyBudget - spendMTD) / daysRemaining)
      : 0;

  const spendPct = safeDiv(spendMTD, monthlyBudget) * 100;
  const overUnderPct = safeDiv(projectedSpend - monthlyBudget, monthlyBudget) * 100;
  const revenuePct = safeDiv(revenueMTD, monthlyRevenue) * 100;
  const projectedRevenuePct = safeDiv(projectedRevenue, monthlyRevenue) * 100;
  const impliedRoas = safeDiv(revenueMTD, spendMTD);

  // So sánh chi thực tế với tiến độ tuyến tính (±5% coi là đúng nhịp).
  let paceStatus: PaceStatus = "on_track";
  if (expectedSpendToDate > 0) {
    if (spendMTD > expectedSpendToDate * 1.05) paceStatus = "ahead";
    else if (spendMTD < expectedSpendToDate * 0.95) paceStatus = "behind";
  }

  const warnings: string[] = [];
  if (paceStatus === "ahead") {
    warnings.push(
      `Đang chi nhanh hơn kế hoạch. Dự kiến cả tháng ~${Math.round(
        overUnderPct,
      )}% so với ngân sách — cân nhắc hạ ngân sách/ngày về ~${fmtShort(
        recommendedDailyBudget,
      )} để không vượt.`,
    );
  } else if (paceStatus === "behind") {
    warnings.push(
      `Đang chi chậm hơn kế hoạch. Có thể tăng ngân sách/ngày lên ~${fmtShort(
        recommendedDailyBudget,
      )} để dùng hết ngân sách và không bỏ lỡ doanh số.`,
    );
  }
  if (spendPct >= 100) {
    warnings.push("Đã dùng hết (hoặc vượt) ngân sách tháng.");
  } else if (spendPct >= 90 && daysRemaining > 3) {
    warnings.push(
      `Đã dùng ${Math.round(spendPct)}% ngân sách mà còn ${daysRemaining} ngày — nhiều khả năng sẽ vượt.`,
    );
  }
  if (monthlyRevenue > 0 && projectedRevenuePct < 90) {
    warnings.push(
      `Dự kiến doanh thu chỉ đạt ~${Math.round(
        projectedRevenuePct,
      )}% mục tiêu tháng — xem lại chiến dịch kém hiệu quả.`,
    );
  }

  return {
    monthLabel: `${MONTHS_VI[month]}/${year}`,
    daysInMonth,
    daysElapsed,
    daysRemaining,
    spendMTD,
    revenueMTD,
    monthlyBudget,
    monthlyRevenue,
    expectedSpendToDate,
    avgDailySpend,
    projectedSpend,
    projectedRevenue,
    recommendedDailyBudget,
    spendPct,
    overUnderPct,
    revenuePct,
    projectedRevenuePct,
    impliedRoas,
    paceStatus,
    warnings,
  };
}

// Rút gọn số tiền cho câu cảnh báo (vd 1.250.000 -> "1,25tr").
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(".", ",")}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}
