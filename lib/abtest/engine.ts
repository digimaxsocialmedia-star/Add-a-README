// -----------------------------------------------------------------------------
// A/B test nội dung — so 2 quảng cáo bằng kiểm định z hai tỷ lệ (two-proportion
// z-test), thay vì nhìn số đoán:
//   • CTR:  lượt nhấp / lượt hiển thị
//   • CVR:  chuyển đổi / lượt nhấp
// Kết luận "thắng" chỉ khi độ tin cậy ≥ 95%; 80–95% là "đang nghiêng về";
// dưới 80% là chưa phân định (cần chạy thêm).
//
// Module này thuần tính toán (chỉ import types) nên trang client dùng trực
// tiếp, không cần gọi API cho phần so sánh.
// -----------------------------------------------------------------------------

import type { AbTestResult, AdRow, ProportionTest } from "../types";

const SIGNIFICANT_CONFIDENCE = 95; // %
const LEANING_CONFIDENCE = 80; // %

// Xấp xỉ hàm lỗi Gauss (Abramowitz–Stegun 7.1.26, sai số < 1.5e-7).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Kiểm định z hai tỷ lệ: successA/nA so với successB/nB.
 * Trả về null khi một bên không có mẫu (không kiểm định được).
 */
export function proportionTest(
  successA: number,
  nA: number,
  successB: number,
  nB: number,
): ProportionTest | null {
  if (nA <= 0 || nB <= 0) return null;
  const pA = successA / nA;
  const pB = successB / nB;
  const pooled = (successA + successB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const z = se > 0 ? (pA - pB) / se : 0;
  const pValue = 2 * (1 - normCdf(Math.abs(z)));
  const confidencePct = (1 - pValue) * 100;

  const better = pA > pB ? "A" : pB > pA ? "B" : null;
  const lo = Math.min(pA, pB);
  const liftPct = lo > 0 ? (Math.abs(pA - pB) / lo) * 100 : 0;

  return {
    rateA: pA * 100,
    rateB: pB * 100,
    liftPct,
    zScore: z,
    pValue,
    confidencePct,
    winner: confidencePct >= LEANING_CONFIDENCE ? better : null,
    significant: confidencePct >= SIGNIFICANT_CONFIDENCE && better !== null,
    sampleA: nA,
    sampleB: nB,
  };
}

function pctFmt(n: number): string {
  return `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

/** So 2 quảng cáo và viết kết luận + khuyến nghị tiếng Việt. */
export function compareAds(a: AdRow, b: AdRow): AbTestResult {
  const ctr = proportionTest(
    a.metrics.clicks,
    a.metrics.impressions,
    b.metrics.clicks,
    b.metrics.impressions,
  );
  const cvr = proportionTest(
    a.metrics.conversions,
    a.metrics.clicks,
    b.metrics.conversions,
    b.metrics.clicks,
  );

  // Ưu tiên kết luận theo CVR (gần tiền hơn), rồi mới tới CTR.
  const decisive =
    cvr?.significant ? { test: cvr, metric: "tỷ lệ chuyển đổi" }
    : ctr?.significant ? { test: ctr, metric: "CTR" }
    : null;

  if (decisive) {
    const w = decisive.test.winner as "A" | "B";
    const winAd = w === "A" ? a : b;
    const loseAd = w === "A" ? b : a;
    return {
      ctr,
      cvr,
      verdict: `Mẫu ${w} ("${winAd.name}") thắng về ${decisive.metric}: cao hơn ${pctFmt(
        decisive.test.liftPct,
      )} với độ tin cậy ${pctFmt(decisive.test.confidencePct)}.`,
      recommendation: `Dồn ngân sách cho "${winAd.name}" và tạm dừng "${loseAd.name}" — khác biệt này gần như chắc chắn không phải ngẫu nhiên.`,
      loserAdId: loseAd.id,
    };
  }

  const leaning =
    (cvr?.winner ? { test: cvr, metric: "tỷ lệ chuyển đổi" } : null) ??
    (ctr?.winner ? { test: ctr, metric: "CTR" } : null);
  if (leaning) {
    const w = leaning.test.winner as "A" | "B";
    const winAd = w === "A" ? a : b;
    return {
      ctr,
      cvr,
      verdict: `Đang nghiêng về mẫu ${w} ("${winAd.name}") theo ${leaning.metric} (độ tin cậy ${pctFmt(
        leaning.test.confidencePct,
      )}) — chưa đủ 95% để kết luận.`,
      recommendation:
        "Để cả hai chạy thêm cho đủ dữ liệu rồi kiểm tra lại; đừng vội tắt mẫu nào.",
    };
  }

  return {
    ctr,
    cvr,
    verdict: ctr
      ? `Chưa phân định — khác biệt hiện tại nhỏ so với nhiễu ngẫu nhiên (độ tin cậy CTR ${pctFmt(
          ctr.confidencePct,
        )}).`
      : "Chưa đủ dữ liệu hiển thị để kiểm định.",
    recommendation:
      "Tiếp tục chạy cả hai mẫu; kết luận sớm với dữ liệu mỏng dễ tắt nhầm mẫu tốt.",
  };
}
