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
import type {
  AccountSummary,
  CampaignWithMetrics,
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

export function getCampaign(id: string): Promise<CampaignWithMetrics | undefined> {
  return isLiveMode() ? live.getCampaignLive(id) : mock.getCampaignMock(id);
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
): Promise<CampaignWithMetrics> {
  return isLiveMode() ? live.addCampaignLive(input) : mock.addCampaignMock(input);
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
