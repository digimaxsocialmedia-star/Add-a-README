// -----------------------------------------------------------------------------
// Data-source facade. Every read/write in the app goes through this module.
//
// It routes to either the real Meta Marketing API (lib/meta/graph.ts) or the
// deterministic demo store (lib/meta/mock.ts), based on whether Meta
// credentials are configured (see lib/meta/config.ts).
//
//   META_ACCESS_TOKEN + META_AD_ACCOUNT_ID set  ->  live  (graph.ts)
//   otherwise                                   ->  demo  (mock.ts)
//
// Pages, the automation engine and the AI layer only depend on the functions
// exported here, so neither mode leaks into the rest of the app.
// -----------------------------------------------------------------------------

import { getAccountLabel, getMode, isLiveMode } from "./config";
import { derive, sumMetrics } from "../format";
import { classifyAudience } from "../audiences/classify";
import type {
  AccountSummary,
  AdFatigue,
  AdRow,
  AudienceRow,
  CampaignWithMetrics,
  CreateCampaignResult,
  ManagerAdSet,
  ManagerCampaign,
  Metrics,
  NewCampaignInput,
  SeriesPoint,
} from "../types";
import * as mock from "./mock";
import * as live from "./graph";

export type { NewCampaignInput };
export { getAccountLabel, getMode, isLiveMode };

export const ACCOUNT_NAME = getAccountLabel();

export function getCampaigns(): Promise<CampaignWithMetrics[]> {
  return isLiveMode() ? live.getCampaignsLive() : mock.getCampaignsMock();
}

export function getAccountSummary(): Promise<AccountSummary> {
  return isLiveMode()
    ? live.getAccountSummaryLive()
    : mock.getAccountSummaryMock();
}

export function getDailySeries(): Promise<SeriesPoint[]> {
  return isLiveMode() ? live.getDailySeriesLive() : mock.getDailySeriesMock();
}

export function addCampaign(
  input: NewCampaignInput,
): Promise<CreateCampaignResult> {
  return isLiveMode() ? live.addCampaignLive(input) : mock.addCampaignMock(input);
}

export function duplicateCampaign(id: string): Promise<CreateCampaignResult> {
  return isLiveMode()
    ? live.duplicateCampaignLive(id)
    : mock.duplicateCampaignMock(id);
}

export function setCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  return isLiveMode()
    ? live.setCampaignStatusLive(id, status)
    : mock.setCampaignStatusMock(id, status);
}

export function updateCampaignDailyBudget(
  id: string,
  dailyBudget: number,
): Promise<void> {
  return isLiveMode()
    ? live.updateCampaignDailyBudgetLive(id, dailyBudget)
    : mock.updateCampaignDailyBudgetMock(id, dailyBudget);
}

export function getAds(): Promise<AdRow[]> {
  return isLiveMode() ? live.getAdsLive() : mock.getAdsMock();
}

export function getAdFatigue(): Promise<AdFatigue[]> {
  return isLiveMode() ? live.getAdFatigueLive() : mock.getAdFatigueMock();
}

export function setAdSetStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  return isLiveMode()
    ? live.setAdSetStatusLive(id, status)
    : mock.setAdSetStatusMock(id, status);
}

export function updateAdSetDailyBudget(
  id: string,
  dailyBudget: number,
): Promise<void> {
  return isLiveMode()
    ? live.updateAdSetDailyBudgetLive(id, dailyBudget)
    : mock.updateAdSetDailyBudgetMock(id, dailyBudget);
}

export function setAdStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  return isLiveMode()
    ? live.setAdStatusLive(id, status)
    : mock.setAdStatusMock(id, status);
}

/** Builds the 3-level Campaign → Ad set → Ad tree used by the Ads Manager,
 *  composing campaigns + ads so it works in both demo and live mode. */
export async function getManagerTree(): Promise<ManagerCampaign[]> {
  const [campaigns, ads] = await Promise.all([getCampaigns(), getAds()]);
  const adsByAdSet = new Map<string, AdRow[]>();
  for (const ad of ads) {
    const list = adsByAdSet.get(ad.adSetId) ?? [];
    list.push(ad);
    adsByAdSet.set(ad.adSetId, list);
  }
  const rawOf = (m: Metrics): Metrics => ({
    spend: m.spend,
    impressions: m.impressions,
    clicks: m.clicks,
    conversions: m.conversions,
    revenue: m.revenue,
  });
  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    objective: c.objective,
    status: c.status,
    dailyBudget: c.dailyBudget,
    metrics: c.metrics,
    adSets: c.adSets.map((as) => {
      const adRows = adsByAdSet.get(as.id) ?? [];
      const metrics = derive(sumMetrics(adRows.map((a) => rawOf(a.metrics))));
      return {
        id: as.id,
        name: as.name,
        status: as.status,
        dailyBudget: as.dailyBudget,
        audience: as.audience,
        metrics,
        ads: adRows,
      };
    }),
  }));
}

/** Gộp các nhóm quảng cáo theo tệp đối tượng, kèm hiệu suất tổng hợp. */
export async function getAudiences(): Promise<AudienceRow[]> {
  const tree = await getManagerTree();
  const byName = new Map<
    string,
    { adSets: ManagerAdSet[]; campaigns: Set<string> }
  >();
  for (const c of tree) {
    for (const as of c.adSets) {
      const e = byName.get(as.audience) ?? { adSets: [], campaigns: new Set() };
      e.adSets.push(as);
      e.campaigns.add(c.name);
      byName.set(as.audience, e);
    }
  }
  const rows: AudienceRow[] = [...byName.entries()].map(([name, e]) => ({
    name,
    type: classifyAudience(name),
    campaignCount: e.campaigns.size,
    adSetCount: e.adSets.length,
    campaigns: [...e.campaigns],
    metrics: derive(sumMetrics(e.adSets.map((a) => a.metrics))),
  }));
  return rows.sort((a, b) => b.metrics.spend - a.metrics.spend);
}
