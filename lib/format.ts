import type { Metrics, DerivedMetrics } from "./types";

// Toàn bộ ứng dụng hiển thị bằng tiếng Việt và đơn vị tiền VND (đồng).
const LOCALE = "vi-VN";
const CURRENCY = "VND";

const vnd = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const vndCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

const compact = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const int = new Intl.NumberFormat(LOCALE);

const dec2 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (n: number) => vnd.format(Math.round(n || 0));
export const moneyCompact = (n: number) => vndCompact.format(n || 0);
export const compactNum = (n: number) => compact.format(n || 0);
export const intNum = (n: number) => int.format(Math.round(n || 0));
export const pct = (n: number) => `${dec2.format(n || 0)}%`;
export const roasFmt = (n: number) => `${dec2.format(n || 0)}x`;

/** Định dạng ngày kiểu Việt Nam, ví dụ "5 Th6". */
export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  });

/** Bộ chỉ số rỗng (0 hết) — dùng chung thay vì lặp literal ở nhiều nơi. */
export function emptyMetrics(): Metrics {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
}

/** Cộng dồn danh sách chỉ số thô. */
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

/** Tính các chỉ số tỉ lệ từ số liệu tổng. */
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

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
