// Demo-mode implementation backing lib/meta/client.ts when Meta credentials
// are absent. Backed by the deterministic in-memory store (lib/mock/store.ts).

import { getStore } from "../mock/store";
import { derive, sumMetrics } from "../format";
import type {
  AccountSummary,
  AdRow,
  Campaign,
  CampaignWithMetrics,
  NewCampaignInput,
  SeriesPoint,
} from "../types";

function withMetrics(c: Campaign): CampaignWithMetrics {
  return { ...c, metrics: derive(sumMetrics(c.daily)) };
}

export async function getCampaignsMock(): Promise<CampaignWithMetrics[]> {
  return getStore().campaigns.map(withMetrics);
}

export async function getCampaignMock(
  id: string,
): Promise<CampaignWithMetrics | undefined> {
  const c = getStore().campaigns.find((x) => x.id === id);
  return c ? withMetrics(c) : undefined;
}

export async function getAccountSummaryMock(): Promise<AccountSummary> {
  const campaigns = getStore().campaigns;
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
): Promise<CampaignWithMetrics> {
  const store = getStore();
  store.seq += 1;
  const n = store.seq;
  const today = new Date().toISOString().slice(0, 10);
  const empty = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
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
            metrics: { ...empty },
          },
        ],
      },
    ],
  };
  store.campaigns.push(campaign);
  return withMetrics(campaign);
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
