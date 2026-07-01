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
  OUTCOME_SALES: "Doanh số / Chuyển đổi",
  OUTCOME_TRAFFIC: "Lưu lượng truy cập",
  OUTCOME_LEADS: "Khách hàng tiềm năng",
  OUTCOME_AWARENESS: "Nhận diện thương hiệu",
  OUTCOME_ENGAGEMENT: "Tương tác",
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

export interface NewCampaignInput {
  name: string;
  objective: Objective;
  dailyBudget: number;
  audience: string;
  headline: string;
  primaryText: string;
  creativeType: CreativeType;
  link?: string; // URL đích cho quảng cáo (live mode)
  imageUrl?: string; // URL hình ảnh cho creative (live mode)
}

export interface CreateCampaignResult {
  campaign: CampaignWithMetrics;
  /** Các bước không hoàn tất (chỉ có ý nghĩa ở live mode). */
  warnings: string[];
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
  cpa: "CPA (đ)",
  ctr: "CTR (%)",
  cpc: "CPC (đ)",
  spend: "Chi tiêu (đ)",
};

export const ACTION_LABELS: Record<RuleAction, string> = {
  PAUSE: "Tạm dừng chiến dịch",
  INCREASE_BUDGET: "Tăng ngân sách",
  DECREASE_BUDGET: "Giảm ngân sách",
  NOTIFY: "Chỉ gửi cảnh báo",
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

// ---- Creative studio ----

/** A flat ad row with its parent context and derived metrics. */
export interface AdRow {
  id: string;
  name: string;
  status: EntityStatus;
  creativeType: CreativeType;
  headline: string;
  primaryText: string;
  campaignId: string;
  campaignName: string;
  adSetId: string;
  objective: Objective;
  metrics: DerivedMetrics;
}

export interface AdCopyVariant {
  angle: string;
  headline: string;
  primaryText: string;
}

export interface AdCopyResult {
  variants: AdCopyVariant[];
  source: "claude" | "heuristic";
  model?: string;
  note?: string;
}

// ---- Ads Manager (3-level tree) ----

export interface ManagerAd extends AdRow {}

export interface ManagerAdSet {
  id: string;
  name: string;
  status: EntityStatus;
  dailyBudget: number;
  audience: string;
  metrics: DerivedMetrics;
  ads: ManagerAd[];
}

export interface ManagerCampaign {
  id: string;
  name: string;
  objective: Objective;
  status: EntityStatus;
  dailyBudget: number;
  metrics: DerivedMetrics;
  adSets: ManagerAdSet[];
}

// ---- Account Audit ----

export type CheckStatus = "pass" | "warn" | "fail";

export interface AuditCheck {
  id: string;
  title: string;
  status: CheckStatus;
  category: "profitability" | "efficiency" | "structure" | "scaling";
  detail: string;
  recommendation?: string;
}

export interface AuditResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  checks: AuditCheck[];
  counts: { pass: number; warn: number; fail: number };
}

// ---- Alerts ----

export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

// ---- Audience Studio ----

export type AudienceType = "lookalike" | "custom" | "interest" | "broad" | "saved";

export interface AudienceRow {
  name: string;
  type: AudienceType;
  campaignCount: number;
  adSetCount: number;
  campaigns: string[];
  metrics: DerivedMetrics;
}

export interface AudienceIdea {
  name: string;
  type: AudienceType;
  size: string; // "hẹp" | "vừa" | "rộng"
  rationale: string;
}

export interface AudienceIdeaResult {
  ideas: AudienceIdea[];
  source: "claude" | "heuristic";
  model?: string;
  note?: string;
}

// ---- Autopilot: nhật ký + cài đặt + tối ưu ngân sách ----

export interface LogEntry {
  id: string;
  at: string; // ISO
  kind: "rule" | "optimizer" | "info";
  message: string;
  campaignName?: string;
}

export interface AutopilotSettings {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt?: string;
}

export interface BudgetChange {
  campaignId: string;
  campaignName: string;
  current: number;
  recommended: number;
  delta: number;
  deltaPct: number;
  reason: string;
}

export interface BudgetPlan {
  changes: BudgetChange[];
  totalBefore: number;
  totalAfter: number;
}

export type ThresholdSuggestions = Record<RuleMetric, number>;

// ---- Ad fatigue (độ "chai" nội dung) ----

export type FatigueStatus = "healthy" | "warning" | "fatigued";

export interface AdFatigue {
  id: string;
  name: string;
  campaignName: string;
  creativeType: CreativeType;
  status: EntityStatus;
  spend: number;
  ctr: number;
  frequency: number; // số lần trung bình 1 người thấy quảng cáo
  ctrChangePct: number; // CTR gần đây so với trước đó (âm = giảm)
  daysRunning: number;
  fatigue: FatigueStatus;
  score: number; // 0-100, cao = chai nặng
  reasons: string[];
  recommendation: string;
}
