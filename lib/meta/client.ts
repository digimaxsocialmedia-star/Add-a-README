import { getStore } from "../mock/store";
import { derive, sumMetrics } from "../format";
import type {
  AccountSummary,
  Campaign,
  CampaignWithMetrics,
  Objective,
  SeriesPoint,
} from "../types";

// -----------------------------------------------------------------------------
// Data-source abstraction.
//
// Every read/write in the app goes through this module. Today it is backed by
// the deterministic mock store (lib/mock/store.ts). To go live against the real
// Meta Marketing API, reimplement these functions to call the Graph API
// (e.g. GET /act_<id>/campaigns, /insights) — the rest of the app does not
// change because it only depends on these signatures.
// -----------------------------------------------------------------------------

export const ACCOUNT_NAME = "Acme Store — Ad Account";

function withMetrics(c: Campaign): CampaignWithMetrics {
  return { ...c, metrics: derive(sumMetrics(c.daily)) };
}

export async function getCampaigns(): Promise<CampaignWithMetrics[]> {
  return getStore().campaigns.map(withMetrics);
}

export async function getCampaign(
  id: string,
): Promise<CampaignWithMetrics | undefined> {
  const c = getStore().campaigns.find((x) => x.id === id);
  return c ? withMetrics(c) : undefined;
}

export async function getAccountSummary(): Promise<AccountSummary> {
  const campaigns = getStore().campaigns;
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const metrics = derive(sumMetrics(active.flatMap((c) => c.daily)));
  return {
    metrics,
    activeCampaigns: active.length,
    totalCampaigns: campaigns.length,
  };
}

/** Account-wide daily series (active campaigns), oldest -> newest. */
export async function getDailySeries(): Promise<SeriesPoint[]> {
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

export interface NewCampaignInput {
  name: string;
  objective: Objective;
  dailyBudget: number;
  audience: string;
  headline: string;
  primaryText: string;
  creativeType: "IMAGE" | "VIDEO" | "CAROUSEL";
}

/**
 * Create a campaign. In the demo it's appended to the in-memory store with no
 * history yet (a freshly launched campaign still in its learning phase). The
 * real implementation would POST to /act_<id>/campaigns, /adsets, /ads.
 */
export async function addCampaign(
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
            name: `${input.creativeType[0]}${input.creativeType
              .slice(1)
              .toLowerCase()} ad 1`,
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

export async function setCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const c = getStore().campaigns.find((x) => x.id === id);
  if (c) c.status = status;
}
