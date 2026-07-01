import { ACTION_LABELS, METRIC_LABELS } from "../types";
import { money, pct, roasFmt } from "../format";
import type {
  AutomationRule,
  CampaignWithMetrics,
  RuleEvaluation,
  RuleMetric,
} from "../types";

function metricValue(c: CampaignWithMetrics, metric: RuleMetric): number {
  switch (metric) {
    case "roas":
      return c.metrics.roas;
    case "cpa":
      return c.metrics.cpa;
    case "ctr":
      return c.metrics.ctr;
    case "cpc":
      return c.metrics.cpc;
    case "spend":
      return c.metrics.spend;
  }
}

function formatMetric(metric: RuleMetric, value: number): string {
  switch (metric) {
    case "roas":
      return roasFmt(value);
    case "ctr":
      return pct(value);
    case "cpa":
    case "cpc":
    case "spend":
      return money(value);
  }
}

function describe(
  rule: AutomationRule,
  c: CampaignWithMetrics,
  value: number,
): string {
  const v = formatMetric(rule.metric, value);
  const m = METRIC_LABELS[rule.metric];
  switch (rule.action) {
    case "PAUSE":
      return `${m} đang ở mức ${v} — tạm dừng "${c.name}" để ngừng lãng phí chi tiêu.`;
    case "INCREASE_BUDGET":
      return `${m} đang ở mức ${v} — tăng ngân sách ngày ${rule.adjustPct ?? 0}% (${money(
        c.dailyBudget,
      )} → ${money(c.dailyBudget * (1 + (rule.adjustPct ?? 0) / 100))}).`;
    case "DECREASE_BUDGET":
      return `${m} đang ở mức ${v} — giảm ngân sách ngày ${rule.adjustPct ?? 0}% (${money(
        c.dailyBudget,
      )} → ${money(c.dailyBudget * (1 - (rule.adjustPct ?? 0) / 100))}).`;
    case "NOTIFY":
      return `${m} đang ở mức ${v} — gắn cờ "${c.name}" để xem lại.`;
  }
}

function matches(rule: AutomationRule, value: number): boolean {
  return rule.operator === "lt"
    ? value < rule.threshold
    : value > rule.threshold;
}

/** Dry-run: which rules would fire against which campaigns, and why. */
export function evaluate(
  campaigns: CampaignWithMetrics[],
  rules: AutomationRule[],
): RuleEvaluation[] {
  const out: RuleEvaluation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    for (const c of campaigns) {
      // Only act on campaigns that are spending and currently active.
      if (c.status !== "ACTIVE" || c.metrics.spend <= 0) continue;
      const value = metricValue(c, rule.metric);
      if (!matches(rule, value)) continue;
      out.push({
        ruleId: rule.id,
        ruleName: rule.name,
        campaignId: c.id,
        campaignName: c.name,
        metric: rule.metric,
        metricValue: value,
        action: rule.action,
        message: describe(rule, c, value),
      });
    }
  }
  return out;
}

export { ACTION_LABELS };
