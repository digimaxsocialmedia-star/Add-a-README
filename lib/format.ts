import type { Metrics, DerivedMetrics } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const int = new Intl.NumberFormat("en-US");

export const money = (n: number) => usd.format(n || 0);
export const money0 = (n: number) => usd0.format(n || 0);
export const compactNum = (n: number) => compact.format(n || 0);
export const intNum = (n: number) => int.format(Math.round(n || 0));
export const pct = (n: number) => `${(n || 0).toFixed(2)}%`;
export const roasFmt = (n: number) => `${(n || 0).toFixed(2)}x`;

/** Sum a list of raw metric objects. */
export function sumMetrics(items: Metrics[]): Metrics {
  return items.reduce<Metrics>(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      revenue: acc.revenue + m.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
}

/** Compute rate-based metrics from raw totals. */
export function derive(m: Metrics): DerivedMetrics {
  const ctr = m.impressions ? (m.clicks / m.impressions) * 100 : 0;
  const cpc = m.clicks ? m.spend / m.clicks : 0;
  const cpm = m.impressions ? (m.spend / m.impressions) * 1000 : 0;
  const cpa = m.conversions ? m.spend / m.conversions : 0;
  const roas = m.spend ? m.revenue / m.spend : 0;
  return {
    ...m,
    spend: round2(m.spend),
    revenue: round2(m.revenue),
    ctr,
    cpc,
    cpm,
    cpa,
    roas,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
