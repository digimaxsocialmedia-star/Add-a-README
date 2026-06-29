// Live Meta (Facebook) Marketing API implementation, backing lib/meta/client.ts
// when META_ACCESS_TOKEN + META_AD_ACCOUNT_ID are set.
//
// Docs: https://developers.facebook.com/docs/marketing-api
//
// Reads:  campaigns + ad sets + insights (spend, impressions, clicks,
//         conversions, revenue) over the configured date preset.
// Writes: pause/activate a campaign, update a campaign's daily budget, and
//         create a (PAUSED) campaign shell. Writes are intentionally
//         conservative — see addCampaignLive.

import { getMetaConfig } from "./config";
import { derive } from "../format";
import type {
  AccountSummary,
  CampaignWithMetrics,
  DerivedMetrics,
  Metrics,
  NewCampaignInput,
  Objective,
  SeriesPoint,
} from "../types";

const GRAPH = "https://graph.facebook.com";

type Json = Record<string, unknown>;

function base(path: string) {
  const { apiVersion } = getMetaConfig();
  return `${GRAPH}/${apiVersion}/${path}`;
}

/** Read a response as JSON, surfacing non-JSON bodies (proxies, gateways, HTML
 *  error pages) as a clear error instead of a cryptic JSON.parse failure. */
async function readJson(res: Response): Promise<Json> {
  const text = await res.text();
  let data: Json;
  try {
    data = JSON.parse(text) as Json;
  } catch {
    throw new Error(
      `Meta Graph API returned a non-JSON response (HTTP ${res.status}): ${text
        .slice(0, 200)
        .trim()}`,
    );
  }
  if (!res.ok) throw graphError(data, res.status);
  return data;
}

async function graphGet(path: string, params: Record<string, string>): Promise<Json> {
  const { accessToken } = getMetaConfig();
  const url = new URL(base(path));
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store" });
  return readJson(res);
}

/** GET that follows `paging.next` cursors and returns the merged `data` array. */
async function graphGetAll<T = Json>(
  path: string,
  params: Record<string, string>,
  maxPages = 10,
): Promise<T[]> {
  const { accessToken } = getMetaConfig();
  const url = new URL(base(path));
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", params.limit ?? "100");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const out: T[] = [];
  let next: string | undefined = url.toString();
  let pages = 0;
  while (next && pages < maxPages) {
    const res = await fetch(next, { cache: "no-store" });
    const data = await readJson(res);
    if (Array.isArray(data.data)) out.push(...(data.data as T[]));
    next = (data.paging as Json | undefined)?.next as string | undefined;
    pages += 1;
  }
  return out;
}

async function graphPost(path: string, params: Record<string, string>): Promise<Json> {
  const { accessToken } = getMetaConfig();
  const body = new URLSearchParams({ access_token: accessToken, ...params });
  const res = await fetch(base(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  return readJson(res);
}

function graphError(data: Json, status: number): Error {
  const err = data.error as Json | undefined;
  const msg = (err?.message as string) || `HTTP ${status}`;
  const trace = err?.fbtrace_id ? ` (fbtrace_id: ${err.fbtrace_id})` : "";
  return new Error(`Meta Graph API error: ${msg}${trace}`);
}

// ---- Field mapping helpers ------------------------------------------------

const DEFAULT_CONVERSION_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
];

/** Sum the value of the first matching action type from an insights array. */
function pickActionValue(
  arr: Array<{ action_type: string; value: string }> | undefined,
  types: string[],
): number {
  if (!Array.isArray(arr)) return 0;
  for (const t of types) {
    const hit = arr.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

function conversionTypes(): string[] {
  const { conversionActionType } = getMetaConfig();
  return conversionActionType ? [conversionActionType] : DEFAULT_CONVERSION_TYPES;
}

interface InsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  date_start?: string;
}

function rowToMetrics(row: InsightRow): Metrics {
  const types = conversionTypes();
  return {
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    conversions: pickActionValue(row.actions, types),
    revenue: pickActionValue(row.action_values, types),
  };
}

/** Meta budgets are returned in minor units (e.g. cents). */
function minorToMajor(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : 0;
}

function normalizeObjective(o: string | undefined): Objective {
  switch (o) {
    case "OUTCOME_SALES":
    case "OUTCOME_TRAFFIC":
    case "OUTCOME_LEADS":
    case "OUTCOME_AWARENESS":
    case "OUTCOME_ENGAGEMENT":
      return o;
    // Legacy (pre-ODAX) objectives → closest modern equivalent.
    case "CONVERSIONS":
    case "PRODUCT_CATALOG_SALES":
      return "OUTCOME_SALES";
    case "LEAD_GENERATION":
      return "OUTCOME_LEADS";
    case "BRAND_AWARENESS":
    case "REACH":
    case "VIDEO_VIEWS":
      return "OUTCOME_AWARENESS";
    case "POST_ENGAGEMENT":
    case "PAGE_LIKES":
      return "OUTCOME_ENGAGEMENT";
    default:
      return "OUTCOME_TRAFFIC";
  }
}

const INSIGHT_FIELDS = "spend,impressions,clicks,actions,action_values";

// ---- Public (live) functions ----------------------------------------------

interface RawCampaign {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
  created_time?: string;
}

/** Fetch campaigns + campaign-level insights + ad-set counts, merged. */
export async function getCampaignsLive(): Promise<CampaignWithMetrics[]> {
  const { adAccountId, datePreset } = getMetaConfig();

  const [rawCampaigns, insightRows, adsetRows] = await Promise.all([
    graphGetAll<RawCampaign>(`${adAccountId}/campaigns`, {
      fields: "id,name,objective,status,daily_budget,created_time",
    }),
    graphGetAll<InsightRow & { campaign_id: string }>(`${adAccountId}/insights`, {
      level: "campaign",
      fields: `campaign_id,${INSIGHT_FIELDS}`,
      date_preset: datePreset,
    }),
    graphGetAll<{
      id: string;
      name?: string;
      status?: string;
      daily_budget?: string;
      campaign_id: string;
      targeting?: Json;
    }>(`${adAccountId}/adsets`, {
      fields: "id,name,status,daily_budget,campaign_id,targeting",
    }),
  ]);

  const insightsByCampaign = new Map<string, Metrics>();
  for (const row of insightRows) {
    insightsByCampaign.set(row.campaign_id, rowToMetrics(row));
  }

  const adsetsByCampaign = new Map<string, typeof adsetRows>();
  for (const a of adsetRows) {
    const list = adsetsByCampaign.get(a.campaign_id) ?? [];
    list.push(a);
    adsetsByCampaign.set(a.campaign_id, list);
  }

  return rawCampaigns.map((c) => {
    const raw =
      insightsByCampaign.get(c.id) ??
      { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    const metrics: DerivedMetrics = derive(raw);
    const adsets = adsetsByCampaign.get(c.id) ?? [];
    return {
      id: c.id,
      name: c.name ?? c.id,
      objective: normalizeObjective(c.objective),
      status: c.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      dailyBudget: minorToMajor(c.daily_budget),
      createdAt: (c.created_time ?? "").slice(0, 10),
      daily: [],
      adSets: adsets.map((a) => ({
        id: a.id,
        name: a.name ?? a.id,
        status: a.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
        dailyBudget: minorToMajor(a.daily_budget),
        audience: a.name ?? "Audience",
        ads: [],
      })),
      metrics,
    };
  });
}

export async function getCampaignLive(
  id: string,
): Promise<CampaignWithMetrics | undefined> {
  const all = await getCampaignsLive();
  return all.find((c) => c.id === id);
}

export async function getAccountSummaryLive(): Promise<AccountSummary> {
  const { adAccountId, datePreset } = getMetaConfig();
  const [rows, campaigns] = await Promise.all([
    graphGet(`${adAccountId}/insights`, {
      fields: INSIGHT_FIELDS,
      date_preset: datePreset,
    }),
    getCampaignsLive(),
  ]);
  const data = (rows.data as InsightRow[] | undefined) ?? [];
  const metrics = derive(data.length ? rowToMetrics(data[0]) : empty());
  return {
    metrics,
    activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
    totalCampaigns: campaigns.length,
  };
}

export async function getDailySeriesLive(): Promise<SeriesPoint[]> {
  const { adAccountId, datePreset } = getMetaConfig();
  const rows = await graphGetAll<InsightRow>(`${adAccountId}/insights`, {
    fields: INSIGHT_FIELDS,
    date_preset: datePreset,
    time_increment: "1",
  });

  return rows
    .map((row) => {
      const m = rowToMetrics(row);
      return {
        date: row.date_start ?? "",
        spend: round2(m.spend),
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        revenue: round2(m.revenue),
        roas: m.spend ? m.revenue / m.spend : 0,
        ctr: m.impressions ? (m.clicks / m.impressions) * 100 : 0,
      } satisfies SeriesPoint;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function setCampaignStatusLive(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  await graphPost(id, { status });
}

export async function updateCampaignDailyBudgetLive(
  id: string,
  dailyBudget: number,
): Promise<void> {
  // Campaign-level budget only applies when the campaign uses Campaign Budget
  // Optimization (CBO). Otherwise the budget lives on the ad set.
  await graphPost(id, { daily_budget: String(Math.round(dailyBudget * 100)) });
}

/**
 * Create a campaign. Intentionally creates a PAUSED campaign shell only — it
 * never starts spending and it does not auto-create ad sets/creatives/ads
 * (those need a Page, creative assets, targeting and an optimization goal).
 * Finish the build in Ads Manager, or extend this function for your account.
 */
export async function addCampaignLive(
  input: NewCampaignInput,
): Promise<CampaignWithMetrics> {
  const { adAccountId } = getMetaConfig();
  const created = await graphPost(`${adAccountId}/campaigns`, {
    name: input.name,
    objective: input.objective,
    status: "PAUSED", // safety: never auto-spend
    special_ad_categories: "[]",
  });
  const id = created.id as string;
  return {
    id,
    name: input.name,
    objective: input.objective,
    status: "PAUSED",
    dailyBudget: input.dailyBudget,
    createdAt: new Date().toISOString().slice(0, 10),
    daily: [],
    adSets: [],
    metrics: derive(empty()),
  };
}

function empty(): Metrics {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
