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

export const CREATIVE_TYPE_LABELS: Record<CreativeType, string> = {
  IMAGE: "Hình ảnh",
  VIDEO: "Video",
  CAROUSEL: "Carousel",
};

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

// ---- Đa tài khoản quảng cáo ----

export interface AdAccountInfo {
  id: string; // act_… (live) hoặc demo_… (demo)
  label: string;
}

export interface AccountOverview extends AdAccountInfo {
  active: boolean; // đang là tài khoản được chọn
  summary: AccountSummary;
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
  imageData?: string; // Ảnh tải lên trực tiếp (data URL base64) — ưu tiên hơn imageUrl
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
  kind: "rule" | "optimizer" | "daypart" | "info";
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

// ---- Lịch sử thay đổi + hoàn tác ----

export type HistoryAction =
  | "campaign_status"
  | "adset_status"
  | "ad_status"
  | "campaign_budget"
  | "adset_budget"
  | "campaign_created"
  | "campaign_duplicated";

/** Ai gây ra thay đổi: người dùng, quy tắc tự động, lịch chạy giờ, hay tối ưu NS. */
export type HistoryActor = "user" | "rule" | "daypart" | "optimizer";

export interface HistoryEntry {
  id: string;
  at: string; // ISO
  action: HistoryAction;
  actor: HistoryActor;
  targetId: string;
  targetName?: string;
  /** Giá trị trước/sau — status ("ACTIVE"/"PAUSED") hoặc ngân sách (chuỗi số). */
  before?: string;
  after?: string;
  /** Có thể hoàn tác không (cần biết giá trị trước). */
  undoable: boolean;
  /** Đã hoàn tác lúc nào (nếu có). */
  undoneAt?: string;
}

// ---- AI chấm điểm ảnh creative (Claude vision) ----

export interface CreativeScoreItem {
  criterion: string; // tên tiêu chí (vd "Thông điệp & hook")
  score: number; // 0-10
  comment: string; // nhận xét ngắn cho tiêu chí này
}

export interface CreativeScoreResult {
  totalScore: number; // 0-100
  verdict: string; // nhận xét tổng thể 1-2 câu
  strengths: string[]; // điểm mạnh
  improvements: string[]; // đề xuất chỉnh sửa cụ thể
  items: CreativeScoreItem[]; // điểm theo từng tiêu chí (rỗng khi không phân tích được)
  source: "claude" | "heuristic";
  model?: string;
  note?: string;
}

// ---- A/B test nội dung (so sánh 2 quảng cáo, kết luận thống kê) ----

/** Kiểm định z 2 tỷ lệ (CTR hoặc CVR) giữa mẫu A và mẫu B. */
export interface ProportionTest {
  rateA: number; // %
  rateB: number; // %
  liftPct: number; // bên thắng hơn bên thua bao nhiêu % (tương đối)
  zScore: number;
  pValue: number; // 2 đuôi
  confidencePct: number; // (1 − pValue) × 100
  winner: "A" | "B" | null; // null: chưa phân định
  significant: boolean; // đạt ngưỡng tin cậy ≥ 95%
  sampleA: number; // cỡ mẫu (hiển thị hoặc lượt nhấp)
  sampleB: number;
}

export interface AbTestResult {
  ctr: ProportionTest | null; // null nếu thiếu dữ liệu hiển thị
  cvr: ProportionTest | null; // null nếu thiếu lượt nhấp
  verdict: string; // kết luận tiếng Việt
  recommendation: string; // hành động đề xuất
  /** Ad thua với độ tin cậy ≥95% (để nút "tạm dừng mẫu thua"), nếu có. */
  loserAdId?: string;
}

// ---- Điểm hòa vốn (breakeven) ----

export interface BreakevenSettings {
  aov: number; // giá bán trung bình mỗi đơn (đ)
  cogsPct: number; // % giá vốn hàng bán trên giá bán
  feesPct: number; // % phí khác (sàn, ship, thanh toán…) trên giá bán
}

export interface BreakevenResult {
  marginPct: number; // % lãi gộp còn lại để trả cho quảng cáo
  marginPerOrder: number; // đ lãi gộp/đơn = CPA tối đa cho phép
  breakevenRoas: number; // ROAS hòa vốn
}

export type ProfitVerdict = "profit" | "breakeven" | "loss";

export interface CampaignProfit {
  id: string;
  name: string;
  status: EntityStatus;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
  estProfit: number; // lãi/lỗ ròng ước tính = doanh thu × biên lãi − chi tiêu
  verdict: ProfitVerdict;
}

// ---- Dayparting (lịch chạy theo khung giờ) ----

export interface DaypartSchedule {
  campaignId: string;
  enabled: boolean;
  /** Lưới 7 ngày × 24 giờ (0 = Thứ 2 … 6 = Chủ nhật), 1 = được phép chạy. */
  grid: number[][];
}

// ---- Giờ vàng (phân tích hiệu suất theo khung giờ) ----

export interface HourCell {
  day: number; // 0 = Thứ 2 … 6 = Chủ nhật
  hour: number; // 0-23
  spend: number;
  revenue: number;
  conversions: number;
}

export interface HourStat {
  hour: number;
  spend: number;
  revenue: number;
  roas: number;
}

export interface HourlyAnalysis {
  cells: HourCell[]; // 168 ô (7 ngày × 24 giờ)
  totalSpend: number;
  accountRoas: number;
  /** Lưới 7×24 đề xuất cho Lịch chạy theo giờ (1 = nên chạy). */
  grid: number[][];
  hourStats: HourStat[]; // tổng hợp 24 giờ (gộp các ngày)
  bestHours: HourStat[]; // top khung giờ hiệu quả (đủ chi tiêu)
  worstHours: HourStat[]; // khung giờ đốt tiền kém nhất (đủ chi tiêu)
  offCount: number; // số ô đề xuất tắt
  /** Phần chi tiêu/doanh thu nằm trong các ô đề xuất tắt. */
  savings: { spend: number; revenue: number; roas: number };
  note?: string;
}

// ---- Budget pacing (kiểm soát ngân sách theo mục tiêu tháng) ----

export interface MonthlyTargets {
  monthlyBudget: number;
  monthlyRevenue: number;
}

export type PaceStatus = "ahead" | "on_track" | "behind";

export interface PacingResult {
  monthLabel: string;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  spendMTD: number;
  revenueMTD: number;
  monthlyBudget: number;
  monthlyRevenue: number;
  expectedSpendToDate: number; // theo tiến độ tuyến tính
  avgDailySpend: number;
  projectedSpend: number; // dự kiến cả tháng
  projectedRevenue: number;
  recommendedDailyBudget: number; // để về đúng ngân sách
  spendPct: number; // MTD / ngân sách
  overUnderPct: number; // dự kiến so với ngân sách
  revenuePct: number; // doanh thu MTD / mục tiêu
  projectedRevenuePct: number;
  impliedRoas: number;
  paceStatus: PaceStatus;
  warnings: string[];
}
