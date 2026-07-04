// -----------------------------------------------------------------------------
// Giờ vàng — từ hiệu suất 7 ngày × 24 giờ, tìm khung giờ hiệu quả/đốt tiền và
// TỰ ĐỀ XUẤT lưới Lịch chạy theo giờ (dayparting) dựa trên dữ liệu thay vì đoán.
//
// Nguyên tắc đề xuất (thận trọng — chỉ tắt khi có bằng chứng rõ):
//   • Ô thiếu dữ liệu (chi tiêu < 25% mức trung bình/ô) → GIỮ CHẠY, không phán.
//   • Ô có đủ chi tiêu nhưng ROAS < 60% ROAS trung bình tài khoản → TẮT.
//   • Còn lại → chạy.
// -----------------------------------------------------------------------------

import type { HourCell, HourlyAnalysis, HourStat } from "../types";

const LOW_DATA_FRACTION = 0.25; // dưới 25% chi tiêu trung bình/ô = thiếu dữ liệu
const OFF_ROAS_RATIO = 0.6; // ROAS dưới 60% trung bình tài khoản = tắt

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

export function analyzeHours(cells: HourCell[]): HourlyAnalysis {
  const totalSpend = cells.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = cells.reduce((s, c) => s + c.revenue, 0);
  const accountRoas = safeDiv(totalRevenue, totalSpend);
  const avgCellSpend = totalSpend / 168;

  // Lưới đề xuất theo từng ô.
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 1),
  );
  const savings = { spend: 0, revenue: 0, roas: 0 };
  let offCount = 0;
  for (const c of cells) {
    if (c.spend < avgCellSpend * LOW_DATA_FRACTION) continue; // thiếu dữ liệu
    const ratio = safeDiv(safeDiv(c.revenue, c.spend), accountRoas);
    if (ratio < OFF_ROAS_RATIO) {
      grid[c.day][c.hour] = 0;
      offCount += 1;
      savings.spend += c.spend;
      savings.revenue += c.revenue;
    }
  }
  savings.roas = safeDiv(savings.revenue, savings.spend);

  // Tổng hợp 24 giờ (gộp các ngày) cho biểu đồ/top.
  const hourStats: HourStat[] = Array.from({ length: 24 }, (_, hour) => {
    const hs = cells.filter((c) => c.hour === hour);
    const spend = hs.reduce((s, c) => s + c.spend, 0);
    const revenue = hs.reduce((s, c) => s + c.revenue, 0);
    return { hour, spend, revenue, roas: safeDiv(revenue, spend) };
  });

  // Chỉ xếp hạng các giờ có chi tiêu đáng kể (≥ 50% mức trung bình/giờ).
  const avgHourSpend = totalSpend / 24;
  const ranked = hourStats.filter((h) => h.spend >= avgHourSpend * 0.5);
  const bestHours = [...ranked].sort((a, b) => b.roas - a.roas).slice(0, 3);
  const worstHours = [...ranked].sort((a, b) => a.roas - b.roas).slice(0, 3);

  return {
    cells,
    totalSpend,
    accountRoas,
    grid,
    hourStats,
    bestHours,
    worstHours,
    offCount,
    savings,
  };
}
