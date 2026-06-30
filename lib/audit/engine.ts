import { money, pct, roasFmt } from "../format";
import type {
  AccountSummary,
  AuditCheck,
  AuditResult,
  CampaignWithMetrics,
  CheckStatus,
} from "../types";

// Weighted penalties applied to a starting score of 100.
const PENALTY: Record<CheckStatus, number> = { pass: 0, warn: 6, fail: 14 };

function grade(score: number): AuditResult["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function runAudit(
  campaigns: CampaignWithMetrics[],
  summary: AccountSummary,
): AuditResult {
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.metrics.spend > 0);
  const checks: AuditCheck[] = [];
  const m = summary.metrics;

  // 1. Account-level ROAS
  checks.push({
    id: "account_roas",
    title: "Account is profitable overall",
    category: "profitability",
    status: m.roas >= 2 ? "pass" : m.roas >= 1 ? "warn" : "fail",
    detail: `Blended account ROAS is ${roasFmt(m.roas)} across ${money(
      m.spend,
    )} spend.`,
    recommendation:
      m.roas < 1
        ? "The account is losing money. Pause the worst campaigns and shift budget to winners."
        : m.roas < 2
          ? "Margins are thin — tighten targeting and refresh creative on mid-tier campaigns."
          : undefined,
  });

  // 2. Unprofitable active campaigns
  const losers = active.filter((c) => c.metrics.roas < 1);
  checks.push({
    id: "unprofitable",
    title: "No active campaign is losing money",
    category: "profitability",
    status: losers.length === 0 ? "pass" : losers.length > 1 ? "fail" : "warn",
    detail: losers.length
      ? `${losers.length} active campaign(s) under 1.0x ROAS: ${losers
          .map((c) => `"${c.name}"`)
          .join(", ")}.`
      : "Every active, spending campaign is at or above breakeven.",
    recommendation: losers.length
      ? "Pause or cut budget on sub-1.0x campaigns this week."
      : undefined,
  });

  // 3. Low CTR
  const lowCtr = active.filter((c) => c.metrics.ctr < 1);
  checks.push({
    id: "ctr",
    title: "Creatives are engaging (CTR ≥ 1%)",
    category: "efficiency",
    status: lowCtr.length === 0 ? "pass" : lowCtr.length > 1 ? "fail" : "warn",
    detail: lowCtr.length
      ? `${lowCtr.length} campaign(s) under 1% CTR — e.g. "${lowCtr[0].name}" at ${pct(
          lowCtr[0].metrics.ctr,
        )}.`
      : "All active campaigns have a healthy click-through rate.",
    recommendation: lowCtr.length
      ? "Test new hooks/thumbnails; pause the lowest-CTR ad in each weak set."
      : undefined,
  });

  // 4. High CPA
  const pricey = active.filter((c) => c.metrics.conversions > 0 && c.metrics.cpa > 45);
  checks.push({
    id: "cpa",
    title: "Cost per conversion is under control",
    category: "efficiency",
    status: pricey.length === 0 ? "pass" : pricey.length > 1 ? "warn" : "warn",
    detail: pricey.length
      ? `${pricey.length} campaign(s) above $45 CPA — highest is "${
          pricey.sort((a, b) => b.metrics.cpa - a.metrics.cpa)[0].name
        }" at ${money(pricey[0].metrics.cpa)}.`
      : "No campaign is paying an unusually high cost per conversion.",
    recommendation: pricey.length
      ? "Switch to cost-cap bidding or tighten the audience on high-CPA campaigns."
      : undefined,
  });

  // 5. Budget concentration
  const totalSpend = active.reduce((s, c) => s + c.metrics.spend, 0);
  const top = [...active].sort((a, b) => b.metrics.spend - a.metrics.spend)[0];
  const share = top && totalSpend ? top.metrics.spend / totalSpend : 0;
  checks.push({
    id: "concentration",
    title: "Spend isn't over-concentrated",
    category: "structure",
    status: share > 0.6 ? "warn" : "pass",
    detail: top
      ? `"${top.name}" accounts for ${pct(share * 100)} of account spend.`
      : "No active spend to evaluate.",
    recommendation:
      share > 0.6
        ? "Diversify — a single campaign carrying most of the budget is a concentration risk."
        : undefined,
  });

  // 6. Audience overlap (same audience used by multiple active campaigns)
  const audienceMap = new Map<string, Set<string>>();
  for (const c of active) {
    for (const as of c.adSets) {
      const set = audienceMap.get(as.audience) ?? new Set<string>();
      set.add(c.id);
      audienceMap.set(as.audience, set);
    }
  }
  const overlaps = [...audienceMap.entries()].filter(([, ids]) => ids.size > 1);
  checks.push({
    id: "overlap",
    title: "Audiences don't overlap across campaigns",
    category: "structure",
    status: overlaps.length ? "warn" : "pass",
    detail: overlaps.length
      ? `${overlaps.length} audience(s) are targeted by more than one campaign (e.g. "${overlaps[0][0]}") — they may bid against each other.`
      : "Each audience is used by a single campaign.",
    recommendation: overlaps.length
      ? "Consolidate overlapping audiences or add exclusions to avoid internal auction competition."
      : undefined,
  });

  // 7. Scaling opportunity
  const winners = active.filter((c) => c.metrics.roas >= 3);
  checks.push({
    id: "scaling",
    title: "Winners are being scaled",
    category: "scaling",
    status: winners.length === 0 ? "warn" : "pass",
    detail: winners.length
      ? `${winners.length} campaign(s) above 3.0x ROAS are scaling candidates: ${winners
          .map((c) => `"${c.name}"`)
          .join(", ")}.`
      : "No campaign is currently above a 3.0x ROAS scaling threshold.",
    recommendation: winners.length
      ? "Increase budgets ~20% every few days on these while ROAS holds."
      : "Find a winner: keep creative-testing until a campaign clears 3.0x ROAS.",
  });

  const counts = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const score = Math.max(
    0,
    Math.round(checks.reduce((s, c) => s - PENALTY[c.status], 100)),
  );

  // Sort: failures first, then warnings, then passes.
  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status]);

  return { score, grade: grade(score), checks, counts };
}
