// -----------------------------------------------------------------------------
// So sánh kỳ này với kỳ trước từ chuỗi số liệu theo ngày.
//
// Với cửa sổ N ngày: kỳ này = N ngày cuối, kỳ trước = N ngày liền trước đó.
// Nếu dữ liệu không đủ 2×N ngày thì so với phần còn lại (partial) hoặc báo
// không so sánh được (none).
// -----------------------------------------------------------------------------

import { derive, sumMetrics } from "../format";
import type { DerivedMetrics, SeriesPoint } from "../types";

export type CompareAvailability = "full" | "partial" | "none";

export interface PeriodComparison {
  availability: CompareAvailability;
  /** Số ngày thực có trong kỳ trước (chỉ khác N khi partial). */
  prevDays: number;
  current: DerivedMetrics;
  previous: DerivedMetrics;
  /** % thay đổi của từng chỉ số so với kỳ trước (null nếu kỳ trước = 0). */
  deltas: Partial<Record<keyof DerivedMetrics, number | null>>;
}

const COMPARE_KEYS: (keyof DerivedMetrics)[] = [
  "spend",
  "revenue",
  "roas",
  "ctr",
  "cpc",
  "cpa",
  "conversions",
];

export function comparePeriods(
  series: SeriesPoint[],
  days: number,
): PeriodComparison {
  const current = derive(sumMetrics(series.slice(-days)));
  const prevSlice = series.slice(
    Math.max(0, series.length - 2 * days),
    Math.max(0, series.length - days),
  );
  const previous = derive(sumMetrics(prevSlice));

  const availability: CompareAvailability =
    prevSlice.length >= days ? "full" : prevSlice.length > 0 ? "partial" : "none";

  const deltas: PeriodComparison["deltas"] = {};
  // Khi kỳ trước thiếu ngày (partial), so theo trung bình/ngày để công bằng;
  // các chỉ số tỉ lệ (roas, ctr, cpc, cpa) không cần chia.
  const RATE_KEYS: (keyof DerivedMetrics)[] = ["roas", "ctr", "cpc", "cpa"];
  const curDays = Math.min(days, series.length);
  for (const k of COMPARE_KEYS) {
    let cur = current[k];
    let prev = previous[k];
    if (!RATE_KEYS.includes(k) && availability === "partial") {
      cur = curDays > 0 ? cur / curDays : 0;
      prev = prevSlice.length > 0 ? prev / prevSlice.length : 0;
    }
    deltas[k] = prev > 0 ? ((cur - prev) / prev) * 100 : null;
  }

  return { availability, prevDays: prevSlice.length, current, previous, deltas };
}
