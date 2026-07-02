// -----------------------------------------------------------------------------
// Điểm hòa vốn — từ đơn giá và cơ cấu chi phí CỦA BẠN, tính ra:
//   • biên lãi gộp (%) còn lại để trả cho quảng cáo
//   • CPA tối đa cho phép (= lãi gộp/đơn)
//   • ROAS hòa vốn (= 1 / biên lãi)
// rồi chấm từng chiến dịch Lãi / Sát hòa vốn / Lỗ theo ngưỡng của riêng bạn,
// kèm lãi/lỗ ròng ước tính = doanh thu × biên lãi − chi tiêu.
// -----------------------------------------------------------------------------

import type {
  BreakevenResult,
  BreakevenSettings,
  CampaignProfit,
  CampaignWithMetrics,
  ProfitVerdict,
} from "../types";

export function computeBreakeven(s: BreakevenSettings): BreakevenResult {
  const marginPct = Math.max(0, 100 - s.cogsPct - s.feesPct);
  const marginPerOrder = (s.aov * marginPct) / 100;
  const breakevenRoas = marginPct > 0 ? 100 / marginPct : 0;
  return { marginPct, marginPerOrder, breakevenRoas };
}

/** Lãi nếu ROAS vượt hòa vốn ≥10%, lỗ nếu hụt ≥10%, còn lại là sát hòa vốn. */
export function verdictFor(roas: number, breakevenRoas: number): ProfitVerdict {
  // Biên lãi ≤ 0 (giá vốn + phí ≥ 100%): không ROAS nào cứu được — mọi đồng
  // chi quảng cáo đều lỗ, không phải "sát hòa vốn".
  if (breakevenRoas <= 0) return "loss";
  if (roas >= breakevenRoas * 1.1) return "profit";
  if (roas <= breakevenRoas * 0.9) return "loss";
  return "breakeven";
}

export function campaignProfits(
  campaigns: CampaignWithMetrics[],
  settings: BreakevenSettings,
): CampaignProfit[] {
  const be = computeBreakeven(settings);
  return campaigns
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      spend: c.metrics.spend,
      revenue: c.metrics.revenue,
      roas: c.metrics.roas,
      cpa: c.metrics.cpa,
      conversions: c.metrics.conversions,
      estProfit: (c.metrics.revenue * be.marginPct) / 100 - c.metrics.spend,
      verdict: verdictFor(c.metrics.roas, be.breakevenRoas),
    }))
    .sort((a, b) => b.estProfit - a.estProfit);
}
