import { money, pct, roasFmt } from "../format";
import type { Alert, CampaignWithMetrics, SeriesPoint } from "../types";

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Detect anomalies from the account daily series + campaign totals. */
export function detectAlerts(
  series: SeriesPoint[],
  campaigns: CampaignWithMetrics[],
): Alert[] {
  const alerts: Alert[] = [];
  const s = [...series].sort((a, b) => a.date.localeCompare(b.date));

  if (s.length >= 8) {
    const last = s[s.length - 1];
    const prior7 = s.slice(-8, -1);
    const avgSpend = mean(prior7.map((p) => p.spend));

    if (avgSpend > 0 && last.spend > avgSpend * 1.6) {
      alerts.push({
        id: "spend_spike",
        severity: "high",
        title: "Spend spike detected",
        detail: `Yesterday's spend (${money(last.spend)}) is ${(
          last.spend / avgSpend
        ).toFixed(1)}x the prior 7-day average (${money(avgSpend)}).`,
      });
    } else if (avgSpend > 0 && last.spend < avgSpend * 0.5) {
      alerts.push({
        id: "spend_drop",
        severity: "medium",
        title: "Spend dropped sharply",
        detail: `Yesterday's spend (${money(last.spend)}) is well below the prior 7-day average (${money(
          avgSpend,
        )}) — check for delivery or budget issues.`,
      });
    }
  }

  if (s.length >= 10) {
    const recent3 = s.slice(-3);
    const prev7 = s.slice(-10, -3);
    const recentRoas = mean(recent3.map((p) => p.roas));
    const prevRoas = mean(prev7.map((p) => p.roas));
    if (prevRoas > 0 && recentRoas < prevRoas * 0.7) {
      alerts.push({
        id: "roas_drop",
        severity: "high",
        title: "ROAS is trending down",
        detail: `3-day ROAS (${roasFmt(recentRoas)}) is down from ${roasFmt(
          prevRoas,
        )} over the prior week — efficiency is slipping.`,
      });
    }

    const recentCtr = mean(recent3.map((p) => p.ctr));
    const prevCtr = mean(prev7.map((p) => p.ctr));
    if (prevCtr > 0 && recentCtr < prevCtr * 0.7) {
      alerts.push({
        id: "ctr_drop",
        severity: "medium",
        title: "CTR is declining",
        detail: `3-day CTR (${pct(recentCtr)}) has fallen from ${pct(
          prevCtr,
        )} — creative fatigue is likely.`,
      });
    }
  }

  // Spending with no conversions.
  for (const c of campaigns) {
    if (c.status === "ACTIVE" && c.metrics.spend > 50 && c.metrics.conversions === 0) {
      alerts.push({
        id: `no_conv_${c.id}`,
        severity: "high",
        title: `No conversions on "${c.name}"`,
        detail: `${money(c.metrics.spend)} spent with zero conversions — pause or fix tracking/targeting.`,
      });
    }
  }

  // Account losing money.
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.metrics.spend > 0);
  const spend = active.reduce((a, c) => a + c.metrics.spend, 0);
  const revenue = active.reduce((a, c) => a + c.metrics.revenue, 0);
  if (spend > 0 && revenue / spend < 1) {
    alerts.push({
      id: "account_unprofitable",
      severity: "high",
      title: "Account is below breakeven",
      detail: `Active campaigns returned ${roasFmt(revenue / spend)} ROAS — you're spending more than you earn.`,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
