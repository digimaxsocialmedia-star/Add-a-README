// Reads Meta Marketing API configuration from the environment and decides
// whether the app runs in "live" mode (real Graph API) or "demo" mode (mock).

export interface MetaConfig {
  accessToken: string;
  adAccountId: string; // normalized with the `act_` prefix
  apiVersion: string;
  datePreset: string;
  conversionActionType?: string;
  pageId?: string;
}

/** True when enough credentials are present to talk to the real Graph API. */
export function isLiveMode(): boolean {
  return Boolean(
    process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID,
  );
}

export function getMode(): "live" | "demo" {
  return isLiveMode() ? "live" : "demo";
}

/** Throws if called in demo mode — only valid when isLiveMode() is true. */
export function getMetaConfig(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const rawAccount = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !rawAccount) {
    throw new Error("Meta API is not configured (missing token or account id)");
  }
  const adAccountId = rawAccount.startsWith("act_")
    ? rawAccount
    : `act_${rawAccount}`;
  return {
    accessToken,
    adAccountId,
    apiVersion: process.env.META_API_VERSION || "v23.0",
    datePreset: process.env.META_INSIGHTS_DATE_PRESET || "last_30d",
    conversionActionType: process.env.META_CONVERSION_ACTION_TYPE,
    pageId: process.env.META_PAGE_ID,
  };
}

export function getAccountLabel(): string {
  if (isLiveMode()) {
    const raw = process.env.META_AD_ACCOUNT_ID!;
    const id = raw.startsWith("act_") ? raw : `act_${raw}`;
    return `Meta · ${id}`;
  }
  return "Acme Store — Ad Account (demo)";
}
