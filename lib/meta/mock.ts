// Demo-mode implementation backing lib/meta/client.ts when Meta credentials
// are absent. Backed by the deterministic in-memory store (lib/mock/store.ts).

import { getStore, getStoreFor } from "../mock/store";
import { getActiveAccountId } from "./config";
import { derive, emptyMetrics, round2, sumMetrics } from "../format";
import { classifyFatigue } from "../fatigue/engine";
import type {
  AccountSummary,
  AdFatigue,
  AdRow,
  Campaign,
  CampaignWithMetrics,
  CreateCampaignResult,
  HourCell,
  NewCampaignInput,
  SeriesPoint,
} from "../types";

function withMetrics(c: Campaign): CampaignWithMetrics {
  return { ...c, metrics: derive(sumMetrics(c.daily)) };
}

export async function getCampaignsMock(): Promise<CampaignWithMetrics[]> {
  return getStore().campaigns.map(withMetrics);
}

export async function getAccountSummaryMock(
  accountId?: string,
): Promise<AccountSummary> {
  const campaigns = (accountId ? getStoreFor(accountId) : getStore()).campaigns;
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const metrics = derive(sumMetrics(active.flatMap((c) => c.daily)));
  return {
    metrics,
    activeCampaigns: active.length,
    totalCampaigns: campaigns.length,
  };
}

export async function getDailySeriesMock(): Promise<SeriesPoint[]> {
  const campaigns = getStore().campaigns.filter((c) => c.status === "ACTIVE");
  const byDate = new Map<string, SeriesPoint>();
  for (const c of campaigns) {
    for (const d of c.daily) {
      const cur =
        byDate.get(d.date) ??
        ({
          date: d.date,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          roas: 0,
          ctr: 0,
        } as SeriesPoint);
      cur.spend += d.spend;
      cur.impressions += d.impressions;
      cur.clicks += d.clicks;
      cur.conversions += d.conversions;
      cur.revenue += d.revenue;
      byDate.set(d.date, cur);
    }
  }
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      ...p,
      spend: Math.round(p.spend * 100) / 100,
      revenue: Math.round(p.revenue * 100) / 100,
      roas: p.spend ? p.revenue / p.spend : 0,
      ctr: p.impressions ? (p.clicks / p.impressions) * 100 : 0,
    }));
}

export async function addCampaignMock(
  input: NewCampaignInput,
): Promise<CreateCampaignResult> {
  const store = getStore();
  store.seq += 1;
  const n = store.seq;
  const today = new Date().toISOString().slice(0, 10);
  const campaign: Campaign = {
    id: `cmp_${n}`,
    name: input.name,
    objective: input.objective,
    status: "ACTIVE",
    dailyBudget: input.dailyBudget,
    createdAt: today,
    daily: [],
    adSets: [
      {
        id: `adset_${n}_1`,
        name: input.audience,
        status: "ACTIVE",
        dailyBudget: input.dailyBudget,
        audience: input.audience,
        ads: [
          {
            id: `ad_${n}_1_1`,
            name: `Quảng cáo ${
              input.creativeType === "VIDEO"
                ? "video"
                : input.creativeType === "CAROUSEL"
                  ? "carousel"
                  : "hình ảnh"
            } 1`,
            status: "ACTIVE",
            creativeType: input.creativeType,
            headline: input.headline,
            primaryText: input.primaryText,
            metrics: emptyMetrics(),
          },
        ],
      },
    ],
  };
  store.campaigns.push(campaign);
  return { campaign: withMetrics(campaign), warnings: [] };
}

export async function duplicateCampaignMock(
  id: string,
): Promise<CreateCampaignResult> {
  const store = getStore();
  const src = store.campaigns.find((c) => c.id === id);
  if (!src) {
    throw new Error("Không tìm thấy chiến dịch để nhân bản.");
  }
  store.seq += 1;
  const n = store.seq;

  // Sao chép cấu trúc (nhóm QC + quảng cáo + ngân sách + đối tượng) nhưng đặt
  // lại hiệu suất về 0 và trạng thái PAUSED — bản sao chưa từng chạy.
  const clone: Campaign = {
    id: `cmp_${n}`,
    name: `${src.name} (bản sao)`,
    objective: src.objective,
    status: "PAUSED",
    dailyBudget: src.dailyBudget,
    createdAt: new Date().toISOString().slice(0, 10),
    daily: [],
    adSets: src.adSets.map((as, asIdx) => ({
      id: `adset_${n}_${asIdx + 1}`,
      name: as.name,
      status: "PAUSED",
      dailyBudget: as.dailyBudget,
      audience: as.audience,
      ads: as.ads.map((ad, adIdx) => ({
        id: `ad_${n}_${asIdx + 1}_${adIdx + 1}`,
        name: ad.name,
        status: "PAUSED",
        creativeType: ad.creativeType,
        headline: ad.headline,
        primaryText: ad.primaryText,
        metrics: emptyMetrics(),
      })),
    })),
  };
  store.campaigns.push(clone);
  return { campaign: withMetrics(clone), warnings: [] };
}

export async function setCampaignStatusMock(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const c = getStore().campaigns.find((x) => x.id === id);
  if (c) c.status = status;
}

export async function updateCampaignDailyBudgetMock(
  id: string,
  dailyBudget: number,
): Promise<void> {
  const c = getStore().campaigns.find((x) => x.id === id);
  if (c) c.dailyBudget = Math.round(dailyBudget);
}

export async function getAdsMock(): Promise<AdRow[]> {
  const rows: AdRow[] = [];
  for (const c of getStore().campaigns) {
    for (const as of c.adSets) {
      for (const ad of as.ads) {
        rows.push({
          id: ad.id,
          name: ad.name,
          status: ad.status,
          creativeType: ad.creativeType,
          headline: ad.headline,
          primaryText: ad.primaryText,
          campaignId: c.id,
          campaignName: c.name,
          adSetId: as.id,
          objective: c.objective,
          metrics: derive(ad.metrics),
        });
      }
    }
  }
  return rows;
}

export async function setAdSetStatusMock(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  for (const c of getStore().campaigns) {
    const as = c.adSets.find((x) => x.id === id);
    if (as) {
      as.status = status;
      return;
    }
  }
}

export async function updateAdSetDailyBudgetMock(
  id: string,
  dailyBudget: number,
): Promise<void> {
  for (const c of getStore().campaigns) {
    const as = c.adSets.find((x) => x.id === id);
    if (as) {
      as.dailyBudget = Math.round(dailyBudget);
      return;
    }
  }
}

export async function setAdStatusMock(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  for (const c of getStore().campaigns) {
    for (const as of c.adSets) {
      const ad = as.ads.find((x) => x.id === id);
      if (ad) {
        ad.status = status;
        return;
      }
    }
  }
}

function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Giờ vàng (demo) --------------------------------------------------------
// Sinh hiệu suất 7×24 tất định theo nhịp sinh hoạt VN: đêm khuya yếu, trưa và
// tối 19-22h là đỉnh; cuối tuần lưu lượng cao hơn nhưng hiệu quả nhỉnh xuống.
// Tổng chi/doanh thu được neo đúng bằng số liệu 30 ngày của tài khoản.

// Trọng số lưu lượng theo giờ (0h → 23h).
const HOUR_TRAFFIC = [
  0.15, 0.1, 0.08, 0.08, 0.1, 0.15, 0.3, 0.5, 0.7, 0.85, 0.9, 1.0,
  1.05, 0.95, 0.85, 0.8, 0.85, 0.95, 1.1, 1.25, 1.35, 1.3, 1.0, 0.5,
];
// Hệ số hiệu quả (ROAS tương đối) theo giờ — đêm khuya đốt tiền kém.
const HOUR_EFF = [
  0.35, 0.3, 0.3, 0.35, 0.4, 0.5, 0.7, 0.85, 0.95, 1.0, 1.05, 1.1,
  1.0, 0.95, 0.9, 0.9, 0.95, 1.0, 1.1, 1.2, 1.25, 1.15, 0.9, 0.6,
];
const DAY_TRAFFIC = [1, 1, 1, 1, 1.05, 1.15, 1.1]; // T2 → CN
const DAY_EFF = [1, 1, 1.02, 1, 1.05, 0.95, 0.9];

export async function getHourlyCellsMock(): Promise<HourCell[]> {
  const campaigns = getStore().campaigns.filter((c) => c.status === "ACTIVE");
  const totals = sumMetrics(campaigns.flatMap((c) => c.daily));
  const rng = rngFrom(seedFromId(`${getActiveAccountId()}-hourly`));

  // Trọng số + hiệu quả từng ô (kèm nhiễu tất định ±15%).
  const raw = [] as Array<{ day: number; hour: number; w: number; eff: number }>;
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      raw.push({
        day,
        hour,
        w: HOUR_TRAFFIC[hour] * DAY_TRAFFIC[day] * (0.85 + rng() * 0.3),
        eff: HOUR_EFF[hour] * DAY_EFF[day] * (0.85 + rng() * 0.3),
      });
    }
  }
  const wSum = raw.reduce((s, c) => s + c.w, 0);
  // Chuẩn hóa doanh thu để tổng khớp đúng doanh thu thật của tài khoản.
  const revRawSum = raw.reduce((s, c) => s + c.w * c.eff, 0);
  const revScale = revRawSum > 0 ? totals.revenue / revRawSum : 0;

  return raw.map((c) => {
    const spend = (totals.spend * c.w) / wSum;
    const revenue = c.w * c.eff * revScale;
    return {
      day: c.day,
      hour: c.hour,
      spend: round2(spend),
      revenue: round2(revenue),
      conversions: Math.round(
        totals.revenue > 0 ? (totals.conversions * revenue) / totals.revenue : 0,
      ),
    };
  });
}

export async function getAdFatigueMock(): Promise<AdFatigue[]> {
  const ads = await getAdsMock();
  return ads
    .filter((a) => a.metrics.spend > 0)
    .map((a) => {
      const rng = rngFrom(seedFromId(a.id));
      const fatigued = rng() < 0.35;
      const daysRunning = 16 + Math.floor(rng() * 15); // 16-30 ngày
      const frequency = fatigued ? 3.4 + rng() * 1.8 : 1.3 + rng() * 1.3;
      const ctrChangePct = fatigued ? -(20 + rng() * 30) : -10 + rng() * 18;
      const v = classifyFatigue({ frequency, ctrChangePct, daysRunning });
      return {
        id: a.id,
        name: a.name,
        campaignName: a.campaignName,
        creativeType: a.creativeType,
        status: a.status,
        spend: a.metrics.spend,
        ctr: a.metrics.ctr,
        frequency,
        ctrChangePct,
        daysRunning,
        fatigue: v.fatigue,
        score: v.score,
        reasons: v.reasons,
        recommendation: v.recommendation,
      };
    })
    .sort((a, b) => b.score - a.score);
}
