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

import {
  getAccountLabel,
  getActiveAccountId,
  getMode,
  isLiveMode,
  listAccounts,
} from "./config";
import { derive, sumMetrics } from "../format";
import { classifyAudience } from "../audiences/classify";
import { recordHistory } from "../history/engine";
import { getStore } from "../mock/store";
import type {
  AccountOverview,
  AccountSummary,
  AdFatigue,
  AdRow,
  AudienceRow,
  CampaignWithMetrics,
  CreateCampaignResult,
  HourCell,
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

/** Tổng quan mọi tài khoản đã cấu hình (chi tiêu, doanh thu, ROAS, số camp) —
 *  demo: đọc từng store; live: gọi insights cho từng act_… song song. */
export async function getAccountsOverview(): Promise<AccountOverview[]> {
  const activeId = getActiveAccountId();
  return Promise.all(
    listAccounts().map(async (a) => ({
      ...a,
      active: a.id === activeId,
      summary: isLiveMode()
        ? await live.getAccountSummaryLive(a.id)
        : await mock.getAccountSummaryMock(a.id),
    })),
  );
}

/** Tra cứu tên + giá trị hiện tại trong store demo — để ghi lịch sử có
 *  "giá trị trước" chính xác. Ở live mode trả undefined (không đọc thêm API). */
function demoLookup(
  id: string,
): { name: string; status: "ACTIVE" | "PAUSED"; budget?: number } | undefined {
  if (isLiveMode()) return undefined;
  for (const c of getStore().campaigns) {
    if (c.id === id) return { name: c.name, status: c.status, budget: c.dailyBudget };
    for (const as of c.adSets) {
      if (as.id === id) return { name: as.name, status: as.status, budget: as.dailyBudget };
      for (const ad of as.ads) {
        if (ad.id === id) return { name: ad.name, status: ad.status };
      }
    }
  }
  return undefined;
}

const flip = (s: "ACTIVE" | "PAUSED") => (s === "ACTIVE" ? "PAUSED" : "ACTIVE");

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

export async function addCampaign(
  input: NewCampaignInput,
): Promise<CreateCampaignResult> {
  const result = isLiveMode()
    ? await live.addCampaignLive(input)
    : await mock.addCampaignMock(input);
  recordHistory({
    action: "campaign_created",
    targetId: result.campaign.id,
    targetName: result.campaign.name,
    undoable: false,
  });
  return result;
}

export async function duplicateCampaign(id: string): Promise<CreateCampaignResult> {
  const result = isLiveMode()
    ? await live.duplicateCampaignLive(id)
    : await mock.duplicateCampaignMock(id);
  recordHistory({
    action: "campaign_duplicated",
    targetId: result.campaign.id,
    targetName: result.campaign.name,
    undoable: false,
  });
  return result;
}

export async function setCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const prev = demoLookup(id);
  if (isLiveMode()) await live.setCampaignStatusLive(id, status);
  else await mock.setCampaignStatusMock(id, status);
  recordHistory({
    action: "campaign_status",
    targetId: id,
    targetName: prev?.name,
    before: prev?.status ?? flip(status),
    after: status,
    undoable: true,
  });
}

export async function updateCampaignDailyBudget(
  id: string,
  dailyBudget: number,
): Promise<void> {
  const prev = demoLookup(id);
  if (isLiveMode()) await live.updateCampaignDailyBudgetLive(id, dailyBudget);
  else await mock.updateCampaignDailyBudgetMock(id, dailyBudget);
  recordHistory({
    action: "campaign_budget",
    targetId: id,
    targetName: prev?.name,
    before: prev?.budget != null ? String(Math.round(prev.budget)) : undefined,
    after: String(Math.round(dailyBudget)),
    undoable: prev?.budget != null,
  });
}

export function getAds(): Promise<AdRow[]> {
  return isLiveMode() ? live.getAdsLive() : mock.getAdsMock();
}

export function getAdFatigue(): Promise<AdFatigue[]> {
  return isLiveMode() ? live.getAdFatigueLive() : mock.getAdFatigueMock();
}

export function getHourlyCells(): Promise<HourCell[]> {
  return isLiveMode() ? live.getHourlyCellsLive() : mock.getHourlyCellsMock();
}

export async function setAdSetStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const prev = demoLookup(id);
  if (isLiveMode()) await live.setAdSetStatusLive(id, status);
  else await mock.setAdSetStatusMock(id, status);
  recordHistory({
    action: "adset_status",
    targetId: id,
    targetName: prev?.name,
    before: prev?.status ?? flip(status),
    after: status,
    undoable: true,
  });
}

export async function updateAdSetDailyBudget(
  id: string,
  dailyBudget: number,
): Promise<void> {
  const prev = demoLookup(id);
  if (isLiveMode()) await live.updateAdSetDailyBudgetLive(id, dailyBudget);
  else await mock.updateAdSetDailyBudgetMock(id, dailyBudget);
  recordHistory({
    action: "adset_budget",
    targetId: id,
    targetName: prev?.name,
    before: prev?.budget != null ? String(Math.round(prev.budget)) : undefined,
    after: String(Math.round(dailyBudget)),
    undoable: prev?.budget != null,
  });
}

export async function setAdStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
): Promise<void> {
  const prev = demoLookup(id);
  if (isLiveMode()) await live.setAdStatusLive(id, status);
  else await mock.setAdStatusMock(id, status);
  recordHistory({
    action: "ad_status",
    targetId: id,
    targetName: prev?.name,
    before: prev?.status ?? flip(status),
    after: status,
    undoable: true,
  });
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
