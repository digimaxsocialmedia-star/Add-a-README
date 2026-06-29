import type {
  Ad,
  AdSet,
  AutomationRule,
  Campaign,
  DailyPoint,
  Metrics,
  Objective,
} from "../types";

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
}

const PROFILES: Profile[] = [
  {
    name: "Summer Sale — Retargeting",
    objective: "OUTCOME_SALES",
    dailyBudget: 120,
    status: "ACTIVE",
    cpm: 9,
    ctr: 2.6,
    cvr: 2.1,
    aov: 68,
    trendPerDay: 0.004,
    seed: 101,
    audiences: ["Website visitors 30d", "Add-to-cart 14d"],
  },
  {
    name: "Prospecting — Lookalike 1%",
    objective: "OUTCOME_SALES",
    dailyBudget: 200,
    status: "ACTIVE",
    cpm: 13,
    ctr: 1.2,
    cvr: 2.4,
    aov: 72,
    trendPerDay: 0.002,
    seed: 202,
    audiences: ["LLA 1% purchasers", "LLA 2% purchasers"],
  },
  {
    name: "Brand Awareness — Video",
    objective: "OUTCOME_AWARENESS",
    dailyBudget: 80,
    status: "ACTIVE",
    cpm: 6,
    ctr: 0.8,
    cvr: 0.8,
    aov: 55,
    trendPerDay: -0.002,
    seed: 303,
    audiences: ["Broad 18-45", "Interest: outdoors"],
  },
  {
    name: "Lead Gen — Newsletter",
    objective: "OUTCOME_LEADS",
    dailyBudget: 60,
    status: "ACTIVE",
    cpm: 8,
    ctr: 1.7,
    cvr: 7.0,
    aov: 9,
    trendPerDay: 0.001,
    seed: 404,
    audiences: ["Interest: marketing", "Engaged shoppers"],
  },
  {
    name: "Catalog — Dynamic Product Ads",
    objective: "OUTCOME_SALES",
    dailyBudget: 150,
    status: "ACTIVE",
    cpm: 11,
    ctr: 1.9,
    cvr: 2.8,
    aov: 64,
    trendPerDay: -0.01, // declining — good candidate for the AI to flag
    seed: 505,
    audiences: ["Viewed product 7d", "Broad catalog"],
  },
  {
    name: "Traffic — Blog Promo",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 40,
    status: "PAUSED",
    cpm: 5,
    ctr: 1.5,
    cvr: 1.0,
    aov: 30,
    trendPerDay: 0,
    seed: 606,
    audiences: ["Interest: SaaS", "Lookalike readers"],
  },
];

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
    points.push({
      date: isoDaysAgo(i),
      spend: round2(spend),
      impressions,
      clicks,
      conversions,
      revenue: round2(revenue),
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

const CREATIVES: Array<{ type: Ad["creativeType"]; headline: string; text: string }> = [
  { type: "IMAGE", headline: "Up to 40% off — today only", text: "Grab the styles everyone's talking about before they're gone." },
  { type: "VIDEO", headline: "See it in action", text: "30 seconds to understand why customers keep coming back." },
  { type: "CAROUSEL", headline: "Best sellers, ranked", text: "Swipe through this month's most-loved picks." },
  { type: "IMAGE", headline: "Free shipping over $50", text: "Treat yourself. We'll cover the delivery." },
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
        name: `${c.type[0]}${c.type.slice(1).toLowerCase()} ad ${adIdx + 1}`,
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
    name: "Pause unprofitable campaigns",
    enabled: true,
    metric: "roas",
    operator: "lt",
    threshold: 1,
    action: "PAUSE",
  },
  {
    id: "rule_2",
    name: "Scale winners",
    enabled: true,
    metric: "roas",
    operator: "gt",
    threshold: 3,
    action: "INCREASE_BUDGET",
    adjustPct: 20,
  },
  {
    id: "rule_3",
    name: "Rein in expensive conversions",
    enabled: true,
    metric: "cpa",
    operator: "gt",
    threshold: 45,
    action: "DECREASE_BUDGET",
    adjustPct: 15,
  },
  {
    id: "rule_4",
    name: "Alert on low CTR",
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
}

function createStore(): Store {
  return {
    campaigns: PROFILES.map((p, i) => buildCampaign(p, i)),
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    seq: PROFILES.length,
  };
}

// Persist across hot reloads / route invocations within a single server
// process. (For the demo this is fine; a real app would use a database.)
declare global {
  // eslint-disable-next-line no-var
  var __adpilotStore: Store | undefined;
}

export function getStore(): Store {
  if (!globalThis.__adpilotStore) {
    globalThis.__adpilotStore = createStore();
  }
  return globalThis.__adpilotStore;
}

// Helpers used by the data layer for newly-created campaigns.
export { genDaily, aggregate, splitMetrics, isoDaysAgo, round2, CREATIVES };
export type { Profile };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
