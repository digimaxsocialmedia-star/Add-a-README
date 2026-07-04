import type {
  Ad,
  AdSet,
  AutomationRule,
  AutopilotSettings,
  BreakevenSettings,
  Campaign,
  DailyPoint,
  DaypartSchedule,
  HistoryEntry,
  LogEntry,
  Metrics,
  MonthlyTargets,
  Objective,
} from "../types";
import { round2 } from "../format";
import { getActiveAccountId, listAccounts } from "../meta/config";
import {
  loadPersisted,
  savePersisted,
  type PersistedAccountState,
  type PersistedFile,
} from "../persist/file";

// -----------------------------------------------------------------------------
// Deterministic mock data generator.
//
// This stands in for the Meta Marketing API. The shape of the data mirrors the
// real Campaign -> Ad Set -> Ad hierarchy and the insights fields you'd request
// from /insights, so swapping in the real API later is mostly a data-layer job
// (see lib/meta/client.ts).
// -----------------------------------------------------------------------------

const DAYS = 30;

// Small seedable PRNG (mulberry32) so the demo data is stable across reloads.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  name: string;
  objective: Objective;
  dailyBudget: number;
  status: "ACTIVE" | "PAUSED";
  cpm: number; // cost per 1000 impressions
  ctr: number; // %
  cvr: number; // conversion rate, %
  aov: number; // average order value
  trendPerDay: number; // gentle drift in spend volume
  seed: number;
  audiences: [string, string];
  spikeLastDay?: boolean; // inject a recent spend anomaly (for the Alerts demo)
}

// Ngân sách / CPM / AOV theo VND (đồng).
const PROFILES: Profile[] = [
  {
    name: "Khuyến mãi hè — Tiếp thị lại",
    objective: "OUTCOME_SALES",
    dailyBudget: 3_000_000,
    status: "ACTIVE",
    cpm: 225_000,
    ctr: 2.6,
    cvr: 2.1,
    aov: 1_700_000,
    trendPerDay: 0.004,
    seed: 101,
    audiences: ["Khách ghé thăm web 30 ngày", "Đã thêm vào giỏ 14 ngày"],
  },
  {
    name: "Tìm khách mới — Lookalike 1%",
    objective: "OUTCOME_SALES",
    dailyBudget: 5_000_000,
    status: "ACTIVE",
    cpm: 325_000,
    ctr: 1.2,
    cvr: 2.4,
    aov: 1_800_000,
    trendPerDay: 0.002,
    seed: 202,
    audiences: ["Lookalike 1% người mua", "Lookalike 2% người mua"],
    spikeLastDay: true,
  },
  {
    name: "Nhận diện thương hiệu — Video",
    objective: "OUTCOME_AWARENESS",
    dailyBudget: 2_000_000,
    status: "ACTIVE",
    cpm: 150_000,
    ctr: 0.8,
    cvr: 0.8,
    aov: 1_375_000,
    trendPerDay: -0.002,
    seed: 303,
    audiences: ["Rộng 18-45", "Sở thích: ngoài trời"],
  },
  {
    name: "Khách tiềm năng — Bản tin",
    objective: "OUTCOME_LEADS",
    dailyBudget: 1_500_000,
    status: "ACTIVE",
    cpm: 200_000,
    ctr: 1.7,
    cvr: 7.0,
    aov: 225_000,
    trendPerDay: 0.001,
    seed: 404,
    audiences: ["Sở thích: marketing", "Người hay mua sắm"],
  },
  {
    name: "Catalog — Quảng cáo sản phẩm động",
    objective: "OUTCOME_SALES",
    dailyBudget: 3_750_000,
    status: "ACTIVE",
    cpm: 275_000,
    ctr: 1.9,
    cvr: 2.8,
    aov: 1_600_000,
    trendPerDay: -0.01, // đang đi xuống — để AI gắn cờ
    seed: 505,
    audiences: ["Đã xem sản phẩm 7 ngày", "Catalog rộng"],
  },
  {
    name: "Lưu lượng — Quảng bá blog",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 1_000_000,
    status: "PAUSED",
    cpm: 125_000,
    ctr: 1.5,
    cvr: 1.0,
    aov: 750_000,
    trendPerDay: 0,
    seed: 606,
    audiences: ["Sở thích: SaaS", "Lookalike người đọc"],
  },
];

// Tài khoản demo thứ hai ("Thời trang Bloom") — hiệu suất yếu hơn Acme hẳn,
// để trang Đa tài khoản có sự tương phản đáng xem.
const BLOOM_PROFILES: Profile[] = [
  {
    name: "BST hè — Váy đầm",
    objective: "OUTCOME_SALES",
    dailyBudget: 2_500_000,
    status: "ACTIVE",
    cpm: 190_000,
    ctr: 2.2,
    cvr: 2.8,
    aov: 650_000,
    trendPerDay: 0.003,
    seed: 711,
    audiences: ["Nữ 18-34 · thời trang", "Tiếp thị lại 30 ngày"],
  },
  {
    name: "Phụ kiện — Túi xách",
    objective: "OUTCOME_SALES",
    dailyBudget: 1_800_000,
    status: "ACTIVE",
    cpm: 240_000,
    ctr: 1.4,
    cvr: 1.5,
    aov: 900_000,
    trendPerDay: -0.004,
    seed: 822,
    audiences: ["Đã xem túi 14 ngày", "Sở thích: hàng hiệu"],
  },
  {
    name: "Tìm khách mới — Lookalike 2%",
    objective: "OUTCOME_SALES",
    dailyBudget: 3_200_000,
    status: "ACTIVE",
    cpm: 300_000,
    ctr: 1.0,
    cvr: 2.4,
    aov: 850_000,
    trendPerDay: -0.002,
    seed: 933,
    audiences: ["Lookalike 2% người mua", "Rộng nữ 18-45"],
  },
  {
    name: "Tương tác — Video lookbook",
    objective: "OUTCOME_ENGAGEMENT",
    dailyBudget: 900_000,
    status: "ACTIVE",
    cpm: 130_000,
    ctr: 0.9,
    cvr: 1.2,
    aov: 500_000,
    trendPerDay: 0.001,
    seed: 1044,
    audiences: ["Fan trang + tương tác 90 ngày", "Sở thích: lookbook"],
  },
];

/** Bộ hồ sơ chiến dịch mẫu theo tài khoản demo. */
const PROFILES_BY_ACCOUNT: Record<string, Profile[]> = {
  demo_acme: PROFILES,
  demo_bloom: BLOOM_PROFILES,
};

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function genDaily(p: Profile): DailyPoint[] {
  const rng = mulberry32(p.seed);
  const points: DailyPoint[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const dayIndex = DAYS - 1 - i;
    const trend = 1 + p.trendPerDay * (dayIndex - DAYS / 2);
    const volume = Math.max(0.3, trend);
    const spend = p.dailyBudget * (0.72 + rng() * 0.32) * volume;
    const cpm = p.cpm * (0.9 + rng() * 0.2);
    const impressions = Math.round((spend / cpm) * 1000);
    const ctr = (p.ctr * (0.82 + rng() * 0.36)) / 100;
    const clicks = Math.round(impressions * ctr);
    const cvr = (p.cvr * (0.78 + rng() * 0.44)) / 100;
    const conversions = Math.round(clicks * cvr);
    const revenue = conversions * p.aov * (0.9 + rng() * 0.2);

    // Most-recent day (i === 0): optionally inject a spend spike that doesn't
    // convert, so the Alerts engine has a realistic anomaly to surface.
    const spike = i === 0 && p.spikeLastDay;
    points.push({
      date: isoDaysAgo(i),
      spend: round2(spike ? spend * 3.2 : spend),
      impressions: spike ? Math.round(impressions * 3.2) : impressions,
      clicks: spike ? Math.round(clicks * 3.2) : clicks,
      conversions: spike ? Math.round(conversions * 0.4) : conversions,
      revenue: round2(spike ? revenue * 0.4 : revenue),
    });
  }
  return points;
}

function aggregate(daily: DailyPoint[]): Metrics {
  return daily.reduce<Metrics>(
    (a, d) => ({
      spend: a.spend + d.spend,
      impressions: a.impressions + d.impressions,
      clicks: a.clicks + d.clicks,
      conversions: a.conversions + d.conversions,
      revenue: a.revenue + d.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
}

function splitMetrics(total: Metrics, weights: number[]): Metrics[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => {
    const f = w / sum;
    return {
      spend: round2(total.spend * f),
      impressions: Math.round(total.impressions * f),
      clicks: Math.round(total.clicks * f),
      conversions: Math.round(total.conversions * f),
      revenue: round2(total.revenue * f),
    };
  });
}

const CREATIVE_TYPE_VI: Record<Ad["creativeType"], string> = {
  IMAGE: "hình ảnh",
  VIDEO: "video",
  CAROUSEL: "carousel",
};

const CREATIVES: Array<{ type: Ad["creativeType"]; headline: string; text: string }> = [
  { type: "IMAGE", headline: "Giảm đến 40% — chỉ hôm nay", text: "Sở hữu ngay những mẫu đang hot trước khi hết hàng." },
  { type: "VIDEO", headline: "Xem sản phẩm hoạt động", text: "30 giây để hiểu vì sao khách hàng luôn quay lại." },
  { type: "CAROUSEL", headline: "Bán chạy nhất, xếp hạng", text: "Lướt xem những lựa chọn được yêu thích nhất tháng này." },
  { type: "IMAGE", headline: "Miễn phí vận chuyển từ 500.000đ", text: "Tự thưởng cho mình. Chúng tôi lo phần giao hàng." },
];

function buildCampaign(p: Profile, index: number): Campaign {
  const daily = genDaily(p);
  const total = aggregate(daily);
  const adSetSplit = splitMetrics(total, [6, 4]);

  const adSets: AdSet[] = p.audiences.map((audience, asIdx) => {
    const asMetrics = adSetSplit[asIdx];
    const adSplit = splitMetrics(asMetrics, [5, 3]);
    const ads: Ad[] = adSplit.map((m, adIdx) => {
      const c = CREATIVES[(index + asIdx + adIdx) % CREATIVES.length];
      return {
        id: `ad_${index + 1}_${asIdx + 1}_${adIdx + 1}`,
        name: `Quảng cáo ${CREATIVE_TYPE_VI[c.type]} ${adIdx + 1}`,
        status: "ACTIVE",
        creativeType: c.type,
        headline: c.headline,
        primaryText: c.text,
        metrics: m,
      };
    });
    return {
      id: `adset_${index + 1}_${asIdx + 1}`,
      name: audience,
      status: "ACTIVE",
      dailyBudget: round2(p.dailyBudget / p.audiences.length),
      audience,
      ads,
    };
  });

  return {
    id: `cmp_${index + 1}`,
    name: p.name,
    objective: p.objective,
    status: p.status,
    dailyBudget: p.dailyBudget,
    createdAt: isoDaysAgo(DAYS),
    adSets,
    daily,
  };
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "rule_1",
    name: "Tạm dừng chiến dịch thua lỗ",
    enabled: true,
    metric: "roas",
    operator: "lt",
    threshold: 1,
    action: "PAUSE",
  },
  {
    id: "rule_2",
    name: "Tăng tốc chiến dịch hiệu quả",
    enabled: true,
    metric: "roas",
    operator: "gt",
    threshold: 3,
    action: "INCREASE_BUDGET",
    adjustPct: 20,
  },
  {
    id: "rule_3",
    name: "Kiểm soát chi phí chuyển đổi cao",
    enabled: true,
    metric: "cpa",
    operator: "gt",
    threshold: 1_200_000,
    action: "DECREASE_BUDGET",
    adjustPct: 15,
  },
  {
    id: "rule_4",
    name: "Cảnh báo CTR thấp",
    enabled: false,
    metric: "ctr",
    operator: "lt",
    threshold: 1,
    action: "NOTIFY",
  },
];

export interface Store {
  campaigns: Campaign[];
  rules: AutomationRule[];
  seq: number;
  settings: AutopilotSettings;
  log: LogEntry[];
  cooldowns: Record<string, string>; // "ruleId:campaignId" -> ISO timestamp
  notifiedAlerts: Record<string, string>; // id cảnh báo → ISO lần gửi gần nhất (chống trùng, có hết hạn)
  targets: MonthlyTargets; // mục tiêu ngân sách + doanh thu tháng
  schedules: Record<string, DaypartSchedule>; // lịch chạy theo giờ (campaignId → lịch)
  breakeven: BreakevenSettings; // đơn giá + cơ cấu chi phí để tính điểm hòa vốn
  history: HistoryEntry[]; // lịch sử thay đổi (mới nhất trước)
}

function createStore(accountId: string): Store {
  const profiles = PROFILES_BY_ACCOUNT[accountId] ?? PROFILES;
  return {
    campaigns: profiles.map((p, i) => buildCampaign(p, i)),
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    seq: PROFILES.length,
    settings: { enabled: false, intervalMinutes: 5 },
    log: [],
    cooldowns: {},
    notifiedAlerts: {},
    // Mặc định: ~600 triệu chi/tháng, mục tiêu doanh thu ~1,2 tỷ (ROAS ~2x).
    targets: { monthlyBudget: 600_000_000, monthlyRevenue: 1_200_000_000 },
    schedules: {},
    // Mặc định: đơn 800k, giá vốn 40%, phí 15% → biên lãi 45%.
    breakeven: { aov: 800_000, cogsPct: 40, feesPct: 15 },
    history: [],
  };
}

/** Ghi một dòng nhật ký hoạt động (giữ tối đa 60 dòng gần nhất). */
export function addLog(entry: Omit<LogEntry, "id" | "at">): void {
  const store = getStore();
  store.log.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...entry,
  });
  store.log = store.log.slice(0, 60);
  schedulePersist();
}

/** Trả về true nếu (rule,campaign) vừa được áp dụng trong `minutes` phút qua. */
export function onCooldown(key: string, minutes: number): boolean {
  const at = getStore().cooldowns[key];
  if (!at) return false;
  return Date.now() - new Date(at).getTime() < minutes * 60_000;
}

export function setCooldown(key: string): void {
  getStore().cooldowns[key] = new Date().toISOString();
  schedulePersist();
}

// Persist across hot reloads / route invocations within a single server
// process. (For the demo this is fine; a real app would use a database.)
// Mỗi TÀI KHOẢN quảng cáo có một store riêng — chiến dịch demo, quy tắc,
// lịch chạy, mục tiêu, lịch sử… đều tách bạch theo tài khoản (cả live mode:
// key là act_… nên trạng thái app không lẫn giữa các tài khoản).
declare global {
  // eslint-disable-next-line no-var
  var __adpilotStores: Record<string, Store> | undefined;
}

// ---- Lưu trữ bền vững -------------------------------------------------------
// Trạng thái ứng dụng (quy tắc, lịch, mục tiêu, lịch sử…) được nạp lại từ đĩa
// khi tạo store và ghi xuống đĩa (debounce) sau mỗi thay đổi. Chiến dịch demo
// không lưu — tự sinh lại tất định nên id (cmp_1…) vẫn khớp với lịch sử cũ.

let persisted: PersistedFile | undefined;
let persistedLoaded = false;

/** Nạp file trạng thái đúng một lần; đồng thời khôi phục tài khoản đang chọn. */
export function ensureHydrated(): void {
  if (persistedLoaded) return;
  persistedLoaded = true;
  persisted = loadPersisted();
  const savedActive = persisted?.activeAccountId;
  if (
    savedActive &&
    !globalThis.__adpilotActiveAccount &&
    listAccounts().some((a) => a.id === savedActive)
  ) {
    globalThis.__adpilotActiveAccount = savedActive;
  }
}

function appState(s: Store): PersistedAccountState {
  return {
    seq: s.seq,
    rules: s.rules,
    settings: s.settings,
    log: s.log,
    cooldowns: s.cooldowns,
    notifiedAlerts: s.notifiedAlerts,
    targets: s.targets,
    schedules: s.schedules,
    breakeven: s.breakeven,
    history: s.history,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Ghi trạng thái xuống đĩa sau 300ms (gộp nhiều thay đổi liên tiếp). */
export function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const stores = globalThis.__adpilotStores ?? {};
    const accounts: Record<string, PersistedAccountState> = {};
    for (const [id, s] of Object.entries(stores)) accounts[id] = appState(s);
    savePersisted({
      version: 1,
      savedAt: new Date().toISOString(),
      activeAccountId: globalThis.__adpilotActiveAccount,
      accounts,
    });
  }, 300);
}

export function getStoreFor(accountId: string): Store {
  ensureHydrated();
  const stores = (globalThis.__adpilotStores ??= {});
  if (!stores[accountId]) {
    const fresh = createStore(accountId);
    const saved = persisted?.accounts?.[accountId];
    if (saved) {
      // Khôi phục phần trạng thái ứng dụng; giữ campaigns demo vừa sinh.
      Object.assign(fresh, {
        ...saved,
        seq: Math.max(fresh.seq, saved.seq ?? 0),
      } satisfies PersistedAccountState);
    }
    stores[accountId] = fresh;
  }
  return stores[accountId];
}

/** Store của tài khoản ĐANG CHỌN. */
export function getStore(): Store {
  return getStoreFor(getActiveAccountId());
}

