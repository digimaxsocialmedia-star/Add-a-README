import type { CampaignWithMetrics, ThresholdSuggestions } from "../types";

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function roundTo(v: number, step: number): number {
  return Math.max(step, Math.round(v / step) * step);
}

/** Gợi ý ngưỡng quy tắc dựa trên số liệu thực tế của tài khoản. */
export function suggestThresholds(
  campaigns: CampaignWithMetrics[],
): ThresholdSuggestions {
  const active = campaigns.filter(
    (c) => c.status === "ACTIVE" && c.metrics.spend > 0,
  );
  const cpas = active.filter((c) => c.metrics.conversions > 0).map((c) => c.metrics.cpa);
  const cpcs = active.map((c) => c.metrics.cpc);
  const spends = active.map((c) => c.metrics.spend);

  return {
    roas: 2, // mục tiêu ROAS phổ biến
    ctr: 1, // %
    cpa: cpas.length ? roundTo(median(cpas) * 1.2, 50_000) : 1_200_000,
    cpc: cpcs.length ? roundTo(median(cpcs) * 1.3, 1_000) : 5_000,
    spend: spends.length ? roundTo(median(spends), 1_000_000) : 10_000_000,
  };
}
