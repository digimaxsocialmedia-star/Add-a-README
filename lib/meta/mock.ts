// Demo-mode implementation backing lib/meta/client.ts when Meta credentials
// are absent. Backed by the deterministic in-memory store (lib/mock/store.ts).

import { getStore, getStoreFor } from "../mock/store";
import { derive, emptyMetrics, sumMetrics } from "../format";
import { classifyFatigue } from "../fatigue/engine";
import type {
  AccountSummary,
  AdFatigue,
  AdRow,
  Campaign,
  CampaignWithMetrics,
  CreateCampaignResult,
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
