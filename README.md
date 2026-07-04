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
- **🗂 Multi ad account** — configure several ad accounts
  (`META_AD_ACCOUNT_IDS=act_1:Label,act_2:Label` sharing one token), switch
  between them from a dropdown in the top bar, and see an all-accounts overview
  page (per-account spend/revenue/ROAS plus blended totals). Every account
  keeps its own rules, schedules, targets, breakeven settings, and change
  history. Demo mode ships two sample shops so the switcher works out of the
  box.
- **📑 Reports & Alerts** — re-windowable KPIs (7/14/30d) with
  **period-over-period comparison** (each KPI shows % change vs. the previous
  window, color-coded by whether the move is good), per-campaign breakdown,
  CSV export, and automatic anomaly alerts (spend spikes, ROAS/CTR drops,
  zero-conversion spend, account below breakeven).
- **📧 Email reports** — send a Vietnamese HTML summary (KPIs, health score,
  top campaigns, alerts) over SMTP. Preview in-app, send on demand, or point a
  cron at `GET /api/report/email` for daily/weekly delivery. Falls back to a
  preview when SMTP isn't configured.
- **🔔 Instant alerts (Telegram / Zalo)** — push anomaly alerts to your phone
  the moment they appear. Test + send on demand from the Reports page; auto-push
  when Autopilot is on; or drive `GET /api/alerts/notify` from a cron. De-dupes
  so you're not spammed with the same alert.
- **🛡️ Account Audit** — a health score (0–100 + letter grade) from automated
  checks across profitability, efficiency, structure and scaling, each with a
  concrete fix.
- **➕ Create ads** — a campaign → ad set → ad wizard (objective, audience,
  budget, creative) that launches a new campaign.
- **🎛️ Ads Manager** — a 3-level Campaign → Ad set → Ad tree with inline
  on/off toggles, inline budget editing, bulk pause/activate, and one-click
  **campaign duplication** (deep-copies ad sets + ads as a paused draft).
- **🖼️ Creative Studio** — performance by creative format, best/worst ad
  rankings, and an AI ad-copy generator (Claude, with heuristic fallback).
- **🔥 Ad fatigue** — flags creatives wearing out (rising frequency + falling
  CTR over time), scores each ad Khỏe / Bắt đầu chai / Chai nặng, and recommends
  refreshing or pausing before budget is wasted.
- **👁 AI creative scoring** — upload an ad image (optionally with its headline
  and primary text) and Claude vision grades it 0-100 across 6 fixed criteria
  (hook, text-on-image ratio, CTA, color/contrast, image quality, mobile fit)
  with concrete fix-it suggestions — before any money is spent. Falls back to a
  manual pre-flight checklist when no API key is configured.
- **🧪 A/B creative testing** — pick any two ads and get a real statistical
  answer instead of eyeballing: two-proportion z-tests on CTR and conversion
  rate, a confidence meter with 80%/95% markers, a Vietnamese verdict
  ("winner" only at ≥95% confidence, CVR outranks CTR), and a one-click
  "pause the loser" action when the result is significant.
- **👥 Audience Studio** — performance by audience (grouped from ad sets),
  audience-type classification, overlap warnings, and AI-suggested new
  audiences to test (lookalikes, interests, retargeting…).
- **📅 Budget pacing** — set a monthly spend budget and revenue target, then
  track month-to-date spend against a linear pace line: are you spending ahead,
  on track, or behind? Projects full-month spend/revenue, flags over/underspend,
  and recommends the daily budget needed to land exactly on target.
- **🧮 Breakeven** — enter your average order value, cost of goods % and fees
  %, and the app derives *your* max allowed CPA and breakeven ROAS, grades
  every campaign Lãi / Sát hòa vốn / Lỗ against those thresholds, and estimates
  net profit per campaign (revenue × margin − ad spend).
- **🕐 Dayparting** — per-campaign hour-of-day / day-of-week schedules on a
  7×24 click-and-drag grid (Vietnam time). Campaigns auto-activate inside the
  chosen hours and auto-pause outside them; presets for "golden hours 8-23h",
  office hours, etc. Applied every minute while the page is open, on the
  Autopilot tick, or via cron at `GET /api/dayparting?run=1`. Every change is
  logged to the Autopilot activity log.
- **⚡ Automation rules** — "if ROAS < 1 then pause", "if ROAS > 3 then increase
  budget 20%", etc. See pending actions and apply them in one click. Smart
  threshold suggestions are computed from your own account data.
- **🚀 Autopilot (Tự lái AI)** — automatic **budget reallocation** by performance
  (shift budget to winners, cut losers, keeping total ~constant), **scheduled
  auto-run** of rules (with per-campaign cooldowns to avoid runaway budgets), and
  an **activity log** of every autonomous action.
- **⏪ Change history + undo** — every write (status toggles, budget changes —
  whether made by you, an automation rule, dayparting, or the budget optimizer)
  is recorded at the data-layer facade with before/after values and the actor
  who caused it. One-click undo restores the previous value through the same
  facade, and the undo itself is recorded too.
- **✨ AI Insights** — Claude (`claude-opus-4-8`) audits the account and returns
  prioritized, actionable recommendations.

> The AI features (AI Insights, Creative Studio copywriting, audience ideas,
> and vision creative scoring) call Claude when `ANTHROPIC_API_KEY` is set and
> fall back to a built-in heuristic engine (or a manual checklist, for image
> scoring) otherwise, so every feature works out of the box.

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
| `APP_PASSWORD`         | No*      | Locks every page + API behind a login (30-day cookie). *Strongly recommended in live mode — the app controls real ad spend. |
| `ADPILOT_DATA_DIR`     | No       | Where app state (`state.json`) is persisted. Default `.data/`.                     |
| `ANTHROPIC_API_KEY`    | No       | Enables Claude-generated recommendations. Without it, a heuristic engine is used. |
| `META_ACCESS_TOKEN`    | No       | Set together with `META_AD_ACCOUNT_ID` (or `META_AD_ACCOUNT_IDS`) to switch to **live** Meta API mode. |
| `META_AD_ACCOUNT_ID`   | No       | Ad account id, e.g. `act_1234567890`.                                              |
| `META_AD_ACCOUNT_IDS`  | No       | Multi-account list: `act_1:Label A,act_2:Label B` (labels optional; one shared token). |
| `META_API_VERSION`     | No       | Graph API version (default `v23.0`).                                               |
| `META_INSIGHTS_DATE_PRESET` | No  | Reporting window (default `last_30d`).                                             |
| `META_CONVERSION_ACTION_TYPE` | No | Override which insights action type counts as a conversion/revenue.             |

See the "Demo mode vs. Live mode" section below for full details.

## How it's structured

```
app/
  page.tsx              Dashboard
  accounts/             Multi-account overview + switcher
  reports/              Reports & alerts
  audit/                Account audit
  campaigns/            Campaign list
  manager/              Ads Manager (3-level editor)
  create/               Create-ads wizard
  creatives/            Creative Studio + AI copywriting
  creative-score/       AI creative scoring (Claude vision, 6 criteria)
  abtest/               A/B creative testing (z-test + verdict)
  audiences/            Audience Studio + AI audience ideas
  pacing/               Budget pacing vs. monthly targets
  breakeven/            Breakeven CPA/ROAS + est. profit per campaign
  schedule/             Dayparting (7×24 hour grid per campaign)
  automation/           Automation rules
  autopilot/            Autopilot: budget optimizer + scheduled runs + log
  history/              Change history + one-click undo
  ai-insights/          AI recommendations
  error.tsx             Friendly error boundary
  api/                  Route handlers (campaigns, manager, automation,
                        optimizer, autopilot, report, ai/*)
components/             Sidebar, charts, tables, cards, generators
lib/
  types.ts              Domain model (Campaign → Ad Set → Ad, rules, AI, audit)
  meta/
    client.ts           Data-source facade (routes live ⇆ demo)
    config.ts           Reads Meta env, decides live vs demo
    graph.ts            Real Meta Marketing API implementation
    mock.ts             Demo implementation (backed by the mock store)
  mock/store.ts         Deterministic mock data, in-memory store, autopilot state
  automation/engine.ts  Rule evaluation
  automation/run.ts     Shared rule runner (manual + auto, with cooldowns)
  automation/thresholds.ts  Smart threshold suggestions from account data
  optimizer/engine.ts   Performance-weighted budget reallocation
  audit/engine.ts       Account health scoring
  alerts/engine.ts      Anomaly detection
  fatigue/engine.ts     Ad-fatigue scoring (frequency + CTR trend)
  abtest/engine.ts      Two-proportion z-tests + verdict copy
  pacing/engine.ts      Monthly budget pacing vs. targets
  breakeven/engine.ts   Breakeven thresholds + campaign profit grading
  dayparting/engine.ts  Hour-of-day schedules (VN time) → pause/activate
  history/engine.ts     Change recording (at the client.ts facade) + actor context
  history/undo.ts       One-click undo (restores the before-value)
  report/compare.ts     Period-over-period KPI comparison
  audiences/classify.ts Audience-type classification
  ai/claude.ts          Claude calls (insights + ad copy + audiences +
                        vision creative scoring) + fallbacks
  report/email.ts       HTML email report builder + SMTP sender
  notify/channels.ts    Telegram + Zalo OA senders
  alerts/notify.ts      Instant-alert runner (new-alert de-dupe)
  format.ts             Metric formatting & derivation
```

### Email reports & scheduling

Configure SMTP in `.env.local` (see `.env.example` — e.g. Gmail with an App
password). Then use the **Reports & Alerts** page to preview or send. For
automatic delivery, hit `GET /api/report/email` on a schedule:

- **Vercel Cron** — add to `vercel.json`: `{"crons":[{"path":"/api/report/email","schedule":"0 1 * * *"}]}` (daily 08:00 VN time = 01:00 UTC).
- **cron-job.org / GitHub Actions** — schedule a request to the same URL.

It emails `REPORT_EMAIL_TO`. Without SMTP configured the endpoint returns a
preview instead of sending.

### Autopilot in production

While the Autopilot page is open, a client-side timer calls
`POST /api/autopilot {op:"tick"}` on the chosen interval. To run it truly
server-side (even with no browser open), point a scheduler at that endpoint —
e.g. **Vercel Cron**, **GitHub Actions**, or **cron-job.org**. The tick is a
no-op when Autopilot is toggled off.

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
| Create ads (wizard) | Full flow — `POST /campaigns` → `/adsets` → (`/adimages` for uploaded images) → `/adcreatives` → `/ads`, all **PAUSED** |
| Duplicate a campaign | `POST /<campaign_id>/copies` `deep_copy=true&status_option=PAUSED` (deep-copies ad sets + ads, paused) |

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
- **Full ad creation (Campaign → Ad set → Creative → Ad), always PAUSED.** The
  wizard's live flow degrades gracefully: it always creates the campaign; adds
  an ad set (targeting `META_TARGETING_COUNTRY`, ages 18-65, an objective-based
  optimization goal — conversions when `META_PIXEL_ID` is set, otherwise link
  clicks); and creates the creative + ad **only when `META_PAGE_ID`, a
  destination link, and an image are all provided**. The image can be either a
  **direct file upload** (uploaded to `POST /act_<id>/adimages`, referenced by
  `image_hash`) or a plain image URL (`picture`) — an uploaded file takes
  precedence. Anything skipped or failed is reported back as a warning on the
  success screen. Nothing ever auto-spends — you review and un-pause in Ads
  Manager (or the Ads Manager page).
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

## Production hardening

- **Persistence** — app state (automation rules, autopilot settings, daypart
  schedules, monthly targets, breakeven settings, change history, activity log,
  alert de-dupe, active account) is saved to `ADPILOT_DATA_DIR/state.json`
  (default `.data/`, debounced writes, atomic rename) and restored on startup.
  Demo *campaign data* still regenerates on restart (deterministic ids, so
  restored rules/history stay consistent). On serverless hosts (Vercel) the
  filesystem is ephemeral — run on a VPS/container with a persistent disk, or
  mount `ADPILOT_DATA_DIR` on a volume.
- **Authentication** — set `APP_PASSWORD` and every page and API route requires
  login at `/login` (SHA-256 cookie, 30 days, httpOnly). Without it the app is
  open — fine for a local demo, never for live mode.
- **Mobile** — a fixed top bar with a drawer menu replaces the sidebar below
  the `lg` breakpoint, so the app is fully navigable on phones.

## Notes & limitations

- Demo campaign data regenerates on restart; app settings/history persist (see
  Production hardening above).
- Demo mode does not place real ad spend or call Meta.
