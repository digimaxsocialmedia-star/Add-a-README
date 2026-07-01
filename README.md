# AdPilot — AI Facebook (Meta) Ads automation

A Madgicx-style demo app for **automating, analyzing, and optimizing Meta
(Facebook) ad campaigns**. Built with Next.js + TypeScript. Runs entirely on
realistic **mock data** out of the box — no Meta account required — and uses
**Claude** for AI optimization recommendations when an API key is provided.

> Demo / educational project. The data layer is deliberately abstracted so the
> mock backend can be swapped for the real Meta Marketing API later.

> 🇻🇳 **Giao diện tiếng Việt, tiền tệ VND (đồng).** Ứng dụng đã được Việt hóa
> toàn bộ và dùng đồng Việt Nam. AI (gợi ý tối ưu + viết nội dung quảng cáo) trả
> lời bằng tiếng Việt. Tài khoản Meta dùng VND: đặt `META_CURRENCY_OFFSET=1`
> (xem phần "Demo mode vs. Live mode" bên dưới).

## Features

- **📊 Analytics dashboard** — account-level spend, revenue, ROAS, CTR, CPC and
  conversions, with a 30-day spend/revenue/ROAS chart and a top-campaigns table.
- **📑 Reports & Alerts** — re-windowable KPIs (7/14/30d), per-campaign
  breakdown, CSV export, and automatic anomaly alerts (spend spikes, ROAS/CTR
  drops, zero-conversion spend, account below breakeven).
- **🛡️ Account Audit** — a health score (0–100 + letter grade) from automated
  checks across profitability, efficiency, structure and scaling, each with a
  concrete fix.
- **➕ Create ads** — a campaign → ad set → ad wizard (objective, audience,
  budget, creative) that launches a new campaign.
- **🎛️ Ads Manager** — a 3-level Campaign → Ad set → Ad tree with inline
  on/off toggles, inline budget editing, and bulk pause/activate.
- **🖼️ Creative Studio** — performance by creative format, best/worst ad
  rankings, and an AI ad-copy generator (Claude, with heuristic fallback).
- **⚡ Automation rules** — "if ROAS < 1 then pause", "if ROAS > 3 then increase
  budget 20%", etc. See pending actions and apply them in one click.
- **✨ AI Insights** — Claude (`claude-opus-4-8`) audits the account and returns
  prioritized, actionable recommendations.

> The two AI features (AI Insights, Creative Studio copywriting) call Claude when
> `ANTHROPIC_API_KEY` is set and fall back to a built-in heuristic engine
> otherwise, so every feature works out of the box.

## Tech stack

- [Next.js](https://nextjs.org/) 15 (App Router) + React + TypeScript
- Tailwind CSS, Recharts, lucide-react
- [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) for the AI feature

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — add ANTHROPIC_API_KEY for real AI
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable               | Required | Purpose                                                                           |
| ---------------------- | -------- | --------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | No       | Enables Claude-generated recommendations. Without it, a heuristic engine is used. |
| `META_ACCESS_TOKEN`    | No       | Set together with `META_AD_ACCOUNT_ID` to switch to **live** Meta API mode.        |
| `META_AD_ACCOUNT_ID`   | No       | Ad account id, e.g. `act_1234567890`.                                              |
| `META_API_VERSION`     | No       | Graph API version (default `v23.0`).                                               |
| `META_INSIGHTS_DATE_PRESET` | No  | Reporting window (default `last_30d`).                                             |
| `META_CONVERSION_ACTION_TYPE` | No | Override which insights action type counts as a conversion/revenue.             |

See the "Demo mode vs. Live mode" section below for full details.

## How it's structured

```
app/
  page.tsx              Dashboard
  reports/              Reports & alerts
  audit/                Account audit
  campaigns/            Campaign list
  manager/              Ads Manager (3-level editor)
  create/               Create-ads wizard
  creatives/            Creative Studio + AI copywriting
  automation/           Automation rules
  ai-insights/          AI recommendations
  error.tsx             Friendly error boundary
  api/                  Route handlers (campaigns, manager, automation,
                        report, ai/suggestions, ai/ad-copy)
components/             Sidebar, charts, tables, cards, ad-copy generator
lib/
  types.ts              Domain model (Campaign → Ad Set → Ad, rules, AI, audit)
  meta/
    client.ts           Data-source facade (routes live ⇆ demo)
    config.ts           Reads Meta env, decides live vs demo
    graph.ts            Real Meta Marketing API implementation
    mock.ts             Demo implementation (backed by the mock store)
  mock/store.ts         Deterministic mock data + in-memory store
  automation/engine.ts  Rule evaluation
  audit/engine.ts       Account health scoring
  alerts/engine.ts      Anomaly detection
  ai/claude.ts          Claude calls (insights + ad copy) + heuristic fallbacks
  format.ts             Metric formatting & derivation
```

## Demo mode vs. Live mode (real Meta Marketing API)

The app picks a data source automatically:

| Condition | Mode | Backed by |
| --- | --- | --- |
| `META_ACCESS_TOKEN` **and** `META_AD_ACCOUNT_ID` are set | **Live** | `lib/meta/graph.ts` (real Graph API) |
| otherwise | **Demo** | `lib/mock/store.ts` (mock data) |

`lib/meta/client.ts` is the router; `lib/meta/config.ts` reads the env. Pages,
the automation engine, and the AI layer only depend on `client.ts`, so neither
mode leaks into the rest of the app. The sidebar/top bar show which mode is active.

### Enabling live mode

1. Create a Meta app with **Marketing API** access and complete **business
   verification** (this is a Meta-side process that can take several days).
2. Generate a **long-lived access token** with `ads_read` (and `ads_management`
   if you want the automation "Run rules now" writes to apply on Meta).
3. Find your ad account id (`act_XXXXXXXXXX`).
4. Set the variables in `.env.local`:

   ```bash
   META_ACCESS_TOKEN=EAAB...                 # long-lived token
   META_AD_ACCOUNT_ID=act_1234567890
   META_API_VERSION=v23.0                    # optional
   META_INSIGHTS_DATE_PRESET=last_30d        # optional
   META_CONVERSION_ACTION_TYPE=              # optional (see below)
   ```

### What live mode does

**Reads** (Graph API):

| App function | Graph call |
| --- | --- |
| Campaign list + metrics | `GET /act_<id>/campaigns` + `GET /act_<id>/insights?level=campaign` + `GET /act_<id>/adsets` |
| Account summary | `GET /act_<id>/insights` |
| Daily chart series | `GET /act_<id>/insights?time_increment=1` |

**Writes** (only when you click "Run rules now" on the Automation page, requires
`ads_management`):

| Action | Graph call |
| --- | --- |
| Pause a campaign | `POST /<campaign_id>` `status=PAUSED` |
| Change daily budget | `POST /<campaign_id>` `daily_budget=<cents>` |
| Create a campaign (wizard) | `POST /act_<id>/campaigns` (always **PAUSED**) |

### Field mapping & caveats

- **Conversions / revenue** come from the insights `actions` / `action_values`
  arrays. By default the app looks for `purchase`, then `omni_purchase`, then
  `offsite_conversion.fb_pixel_purchase`. If your numbers look off, set
  `META_CONVERSION_ACTION_TYPE` to the exact action type your pixel/CAPI emits.
- **Giao diện tiếng Việt, tiền tệ VND (đồng).** Toàn bộ UI đã Việt hóa và hiển
  thị bằng VND. Nếu tài khoản Meta của bạn dùng VND, đặt
  `META_CURRENCY_OFFSET=1` (VND không có đơn vị lẻ) để ngân sách hiển thị đúng.
  Đổi ngôn ngữ/tiền tệ tại `lib/format.ts` (`LOCALE`, `CURRENCY`).
- **Budget writes** target the **campaign** `daily_budget`, which only applies
  when the campaign uses Campaign Budget Optimization (CBO); otherwise budget
  lives on the ad set.
- **Campaign creation is deliberately conservative**: the wizard creates a
  **PAUSED** campaign shell only (no spend). Ad sets, targeting, creatives, and
  ads need a Page + creative assets — finish those in Ads Manager, or extend
  `addCampaignLive()` in `lib/meta/graph.ts`.
- Misconfiguration (bad token, blocked egress, unreachable account) surfaces a
  clear error in the UI; the rest of the app keeps working.

## Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `npm run dev`      | Start the dev server         |
| `npm run build`    | Production build             |
| `npm start`        | Run the production build     |
| `npm run lint`     | Lint                         |
| `npm run typecheck`| TypeScript type-check        |

## Notes & limitations

- Mock data lives in memory and resets when the server restarts.
- This is a demo: it does not place real ad spend or call Meta.
