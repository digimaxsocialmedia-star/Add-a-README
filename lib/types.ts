// Domain types modeled loosely after the Meta (Facebook) Marketing API
// hierarchy: Campaign -> Ad Set -> Ad.

export type Objective =
  | "OUTCOME_SALES"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_LEADS"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT";

export type EntityStatus = "ACTIVE" | "PAUSED";

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  OUTCOME_SALES: "Sales / Conversions",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_LEADS: "Lead generation",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_ENGAGEMENT: "Engagement",
};

export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface DerivedMetrics extends Metrics {
  ctr: number; // click-through rate, %
  cpc: number; // cost per click
  cpm: number; // cost per 1000 impressions
  cpa: number; // cost per acquisition/conversion
  roas: number; // return on ad spend
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export type CreativeType = "IMAGE" | "VIDEO" | "CAROUSEL";

export interface Ad {
  id: string;
  name: string;
  status: EntityStatus;
  creativeType: CreativeType;
  headline: string;
  primaryText: string;
  metrics: Metrics;
}

export interface AdSet {
  id: string;
  name: string;
  status: EntityStatus;
  dailyBudget: number;
  audience: string;
  ads: Ad[];
}

export interface Campaign {
  id: string;
  name: string;
  objective: Objective;
  status: EntityStatus;
  dailyBudget: number;
  createdAt: string;
  adSets: AdSet[];
  daily: DailyPoint[];
}

/** Campaign enriched with aggregated, derived performance metrics. */
export interface CampaignWithMetrics extends Campaign {
  metrics: DerivedMetrics;
}

export interface AccountSummary {
  metrics: DerivedMetrics;
  activeCampaigns: number;
  totalCampaigns: number;
}

export interface SeriesPoint extends DailyPoint {
  roas: number;
  ctr: number;
}

// ---- Automation rules ----

export type RuleMetric = "roas" | "cpa" | "ctr" | "cpc" | "spend";
export type RuleOperator = "lt" | "gt";
export type RuleAction =
  | "PAUSE"
  | "INCREASE_BUDGET"
  | "DECREASE_BUDGET"
  | "NOTIFY";

export const METRIC_LABELS: Record<RuleMetric, string> = {
  roas: "ROAS",
  cpa: "CPA ($)",
  ctr: "CTR (%)",
  cpc: "CPC ($)",
  spend: "Spend ($)",
};

export const ACTION_LABELS: Record<RuleAction, string> = {
  PAUSE: "Pause campaign",
  INCREASE_BUDGET: "Increase budget",
  DECREASE_BUDGET: "Decrease budget",
  NOTIFY: "Send alert only",
};

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  metric: RuleMetric;
  operator: RuleOperator;
  threshold: number;
  action: RuleAction;
  adjustPct?: number; // for budget actions
  lastTriggered?: string;
}

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  campaignId: string;
  campaignName: string;
  metric: RuleMetric;
  metricValue: number;
  action: RuleAction;
  message: string;
}

// ---- AI suggestions ----

export type Severity = "high" | "medium" | "low";

export interface AiSuggestion {
  title: string;
  severity: Severity;
  category: "budget" | "targeting" | "creative" | "bidding" | "structure";
  campaignName?: string;
  rationale: string;
  recommendedAction: string;
}

export interface AiResult {
  suggestions: AiSuggestion[];
  source: "claude" | "heuristic";
  model?: string;
  note?: string;
}
