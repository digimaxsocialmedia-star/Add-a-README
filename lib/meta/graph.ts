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
import { classifyFatigue } from "../fatigue/engine";
import type {
  AccountSummary,
  AdFatigue,
  AdRow,
  AdSet,
  CampaignWithMetrics,
  CreateCampaignResult,
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

/** Meta budgets are returned in minor units (cents for USD, đồng for VND). */
function minorToMajor(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n / getMetaConfig().currencyOffset;
}

function majorToMinor(v: number): number {
  return Math.round(v * getMetaConfig().currencyOffset);
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

export async function getAdsLive(): Promise<AdRow[]> {
  const { adAccountId, datePreset } = getMetaConfig();
  const [rawAds, insightRows, rawCampaigns] = await Promise.all([
    graphGetAll<{
      id: string;
      name?: string;
      status?: string;
      adset_id?: string;
      campaign_id?: string;
    }>(`${adAccountId}/ads`, { fields: "id,name,status,adset_id,campaign_id" }),
    graphGetAll<InsightRow & { ad_id: string }>(`${adAccountId}/insights`, {
      level: "ad",
      fields: `ad_id,${INSIGHT_FIELDS}`,
      date_preset: datePreset,
    }),
    graphGetAll<RawCampaign>(`${adAccountId}/campaigns`, {
      fields: "id,name,objective",
    }),
  ]);

  const insightsByAd = new Map<string, Metrics>();
  for (const row of insightRows) insightsByAd.set(row.ad_id, rowToMetrics(row));

  const campInfo = new Map<string, { name: string; objective: Objective }>();
  for (const c of rawCampaigns) {
    campInfo.set(c.id, {
      name: c.name ?? c.id,
      objective: normalizeObjective(c.objective),
    });
  }

  return rawAds.map((a) => {
    const info = a.campaign_id ? campInfo.get(a.campaign_id) : undefined;
    return {
      id: a.id,
      name: a.name ?? a.id,
      status: a.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      creativeType: "IMAGE", // creative format requires extra creative lookups
      headline: "",
      primaryText: "",
      campaignId: a.campaign_id ?? "",
      campaignName: info?.name ?? "",
      adSetId: a.adset_id ?? "",
      objective: info?.objective ?? "OUTCOME_TRAFFIC",
      metrics: derive(insightsByAd.get(a.id) ?? empty()),
    };
  });
}

export async function setCampaignStatusLive(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  await graphPost(id, { status });
}

export async function setAdSetStatusLive(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  await graphPost(id, { status });
}

export async function updateAdSetDailyBudgetLive(
  id: string,
  dailyBudget: number,
): Promise<void> {
  await graphPost(id, { daily_budget: String(majorToMinor(dailyBudget)) });
}

export async function setAdStatusLive(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  await graphPost(id, { status });
}

interface AdDailyInsight {
  ad_id: string;
  date_start?: string;
  ctr?: string;
  frequency?: string;
  impressions?: string;
  spend?: string;
}

export async function getAdFatigueLive(): Promise<AdFatigue[]> {
  const { adAccountId, datePreset } = getMetaConfig();
  const [rawAds, rows, rawCampaigns] = await Promise.all([
    graphGetAll<{
      id: string;
      name?: string;
      status?: string;
      campaign_id?: string;
      created_time?: string;
    }>(`${adAccountId}/ads`, {
      fields: "id,name,status,campaign_id,created_time",
    }),
    graphGetAll<AdDailyInsight>(`${adAccountId}/insights`, {
      level: "ad",
      fields: "ad_id,ctr,frequency,impressions,spend",
      date_preset: datePreset,
      time_increment: "1",
    }),
    graphGetAll<RawCampaign>(`${adAccountId}/campaigns`, { fields: "id,name" }),
  ]);

  const campName = new Map<string, string>();
  for (const c of rawCampaigns) campName.set(c.id, c.name ?? c.id);

  const byAd = new Map<string, AdDailyInsight[]>();
  for (const r of rows) {
    const list = byAd.get(r.ad_id) ?? [];
    list.push(r);
    byAd.set(r.ad_id, list);
  }

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  const out: AdFatigue[] = [];
  for (const ad of rawAds) {
    const days = (byAd.get(ad.id) ?? []).sort((a, b) =>
      (a.date_start ?? "").localeCompare(b.date_start ?? ""),
    );
    const spend = days.reduce((s, d) => s + (Number(d.spend) || 0), 0);
    if (spend <= 0) continue;

    const ctrs = days.map((d) => Number(d.ctr) || 0);
    const imprs = days.map((d) => Number(d.impressions) || 0);
    const totalImpr = imprs.reduce((a, b) => a + b, 0);
    const ctr = totalImpr
      ? days.reduce((s, d) => s + (Number(d.ctr) || 0) * (Number(d.impressions) || 0), 0) / totalImpr
      : avg(ctrs);
    const recent = days.slice(-3);
    const earlier = days.slice(0, 3);
    const ctrRecent = avg(recent.map((d) => Number(d.ctr) || 0));
    const ctrEarlier = avg(earlier.map((d) => Number(d.ctr) || 0));
    const ctrChangePct = ctrEarlier ? ((ctrRecent - ctrEarlier) / ctrEarlier) * 100 : 0;
    const frequency = avg(recent.map((d) => Number(d.frequency) || 0));
    const daysRunning = ad.created_time
      ? Math.max(
          1,
          Math.round(
            (Date.now() - new Date(ad.created_time).getTime()) / 86_400_000,
          ),
        )
      : days.length;

    const v = classifyFatigue({ frequency, ctrChangePct, daysRunning });
    out.push({
      id: ad.id,
      name: ad.name ?? ad.id,
      campaignName: ad.campaign_id ? campName.get(ad.campaign_id) ?? "" : "",
      creativeType: "IMAGE",
      status: ad.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      spend,
      ctr,
      frequency,
      ctrChangePct,
      daysRunning,
      fatigue: v.fatigue,
      score: v.score,
      reasons: v.reasons,
      recommendation: v.recommendation,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function updateCampaignDailyBudgetLive(
  id: string,
  dailyBudget: number,
): Promise<void> {
  // Campaign-level budget only applies when the campaign uses Campaign Budget
  // Optimization (CBO). Otherwise the budget lives on the ad set.
  await graphPost(id, { daily_budget: String(majorToMinor(dailyBudget)) });
}

interface AdSetOptimization {
  optimization_goal: string;
  billing_event: string;
  promoted_object?: Record<string, unknown>;
}

/** Mục tiêu tối ưu + sự kiện tính phí hợp lệ theo objective. */
function adSetOptimization(
  objective: Objective,
  pixelId?: string,
): AdSetOptimization {
  switch (objective) {
    case "OUTCOME_AWARENESS":
      return { optimization_goal: "REACH", billing_event: "IMPRESSIONS" };
    case "OUTCOME_ENGAGEMENT":
      return { optimization_goal: "POST_ENGAGEMENT", billing_event: "IMPRESSIONS" };
    case "OUTCOME_SALES":
      // Tối ưu chuyển đổi cần pixel; nếu không có, dùng LINK_CLICKS an toàn.
      if (pixelId) {
        return {
          optimization_goal: "OFFSITE_CONVERSIONS",
          billing_event: "IMPRESSIONS",
          promoted_object: { pixel_id: pixelId, custom_event_type: "PURCHASE" },
        };
      }
      return { optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS" };
    case "OUTCOME_LEADS":
    case "OUTCOME_TRAFFIC":
    default:
      return { optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS" };
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "lỗi không xác định";
}

/**
 * Tạo đầy đủ Chiến dịch → Nhóm quảng cáo → Creative → Quảng cáo, TẤT CẢ ở
 * trạng thái PAUSED (không bao giờ tự tiêu tiền). Luồng giảm dần một cách an
 * toàn: luôn tạo chiến dịch; tạo nhóm QC nếu được; chỉ tạo creative + quảng cáo
 * khi có Page (META_PAGE_ID), link đích và URL hình ảnh. Mỗi bước thiếu/lỗi
 * được ghi vào `warnings`.
 */
export async function addCampaignLive(
  input: NewCampaignInput,
): Promise<CreateCampaignResult> {
  const { adAccountId, pageId, pixelId, targetingCountry } = getMetaConfig();
  const warnings: string[] = [];

  // 1) Chiến dịch (PAUSED)
  const created = await graphPost(`${adAccountId}/campaigns`, {
    name: input.name,
    objective: input.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
  });
  const campaignId = created.id as string;

  const adSets: AdSet[] = [];
  let adSetId: string | undefined;

  // 2) Nhóm quảng cáo (PAUSED)
  try {
    const opt = adSetOptimization(input.objective, pixelId);
    const targeting = {
      geo_locations: { countries: [targetingCountry] },
      age_min: 18,
      age_max: 65,
    };
    const body: Record<string, string> = {
      name: `${input.audience || "Nhóm quảng cáo"} 1`,
      campaign_id: campaignId,
      daily_budget: String(majorToMinor(input.dailyBudget)),
      billing_event: opt.billing_event,
      optimization_goal: opt.optimization_goal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify(targeting),
      status: "PAUSED",
    };
    if (opt.promoted_object) {
      body.promoted_object = JSON.stringify(opt.promoted_object);
    }
    const adset = await graphPost(`${adAccountId}/adsets`, body);
    adSetId = adset.id as string;
    adSets.push({
      id: adSetId,
      name: body.name,
      status: "PAUSED",
      dailyBudget: input.dailyBudget,
      audience: input.audience || "Nhóm quảng cáo",
      ads: [],
    });
  } catch (err) {
    warnings.push(`Chưa tạo được nhóm quảng cáo: ${errMsg(err)}`);
  }

  // 3+4) Creative + Quảng cáo (PAUSED) — cần Page + link + ảnh
  if (adSetId) {
    if (!pageId) {
      warnings.push("Chưa tạo quảng cáo: thiếu META_PAGE_ID (ID Trang Facebook).");
    } else if (!input.link) {
      warnings.push("Chưa tạo quảng cáo: thiếu URL đích (link).");
    } else if (!input.imageUrl) {
      warnings.push("Chưa tạo quảng cáo: thiếu URL hình ảnh.");
    } else {
      try {
        const storySpec = {
          page_id: pageId,
          link_data: {
            message: input.primaryText,
            link: input.link,
            name: input.headline,
            picture: input.imageUrl,
          },
        };
        const creative = await graphPost(`${adAccountId}/adcreatives`, {
          name: `Creative — ${input.name}`,
          object_story_spec: JSON.stringify(storySpec),
        });
        const creativeId = creative.id as string;
        const ad = await graphPost(`${adAccountId}/ads`, {
          name: `Quảng cáo — ${input.name}`,
          adset_id: adSetId,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: "PAUSED",
        });
        adSets[0].ads.push({
          id: ad.id as string,
          name: `Quảng cáo — ${input.name}`,
          status: "PAUSED",
          creativeType: input.creativeType,
          headline: input.headline,
          primaryText: input.primaryText,
          metrics: empty(),
        });
      } catch (err) {
        warnings.push(`Chưa tạo được creative/quảng cáo: ${errMsg(err)}`);
      }
    }
  }

  const campaign: CampaignWithMetrics = {
    id: campaignId,
    name: input.name,
    objective: input.objective,
    status: "PAUSED",
    dailyBudget: input.dailyBudget,
    createdAt: new Date().toISOString().slice(0, 10),
    daily: [],
    adSets,
    metrics: derive(empty()),
  };
  return { campaign, warnings };
}

/**
 * Nhân bản một chiến dịch bằng endpoint `/copies` của Meta.
 *
 * `deep_copy=true` sao chép cả nhóm quảng cáo + quảng cáo con; `status_option`
 * đặt bản sao (và con của nó) về PAUSED để không bao giờ tự tiêu tiền. Sau khi
 * sao chép, đọc lại chiến dịch mới để trả về đầy đủ chỉ số/cấu trúc.
 */
export async function duplicateCampaignLive(
  id: string,
): Promise<CreateCampaignResult> {
  const warnings: string[] = [];
  const res = await graphPost(`${id}/copies`, {
    deep_copy: "true",
    status_option: "PAUSED",
    rename_options: JSON.stringify({ rename_suffix: " (bản sao)" }),
  });
  const newId = (res.copied_campaign_id as string) || (res.id as string);
  if (!newId) {
    throw new Error("Meta không trả về ID chiến dịch bản sao.");
  }

  const campaign = await getCampaignLive(newId);
  if (campaign) return { campaign, warnings };

  // Sao chép thành công nhưng chưa đọc lại được (độ trễ lập chỉ mục) — trả về
  // khung tối thiểu kèm cảnh báo.
  warnings.push(
    "Đã tạo bản sao nhưng chưa tải được chi tiết ngay — hãy làm mới sau giây lát.",
  );
  return {
    campaign: {
      id: newId,
      name: "(bản sao)",
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      dailyBudget: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      daily: [],
      adSets: [],
      metrics: derive(empty()),
    },
    warnings,
  };
}

function empty(): Metrics {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
