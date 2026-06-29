# AdPilot — AI Facebook (Meta) Ads automation

A Madgicx-style demo app for **automating, analyzing, and optimizing Meta
(Facebook) ad campaigns**. Built with Next.js + TypeScript. Runs entirely on
realistic **mock data** out of the box — no Meta account required — and uses
**Claude** for AI optimization recommendations when an API key is provided.

> Demo / educational project. The data layer is deliberately abstracted so the
> mock backend can be swapped for the real Meta Marketing API later.

## Features

- **📊 Analytics dashboard** — account-level spend, revenue, ROAS, CTR, CPC and
  conversions, with a 30-day spend/revenue/ROAS chart and a top-campaigns table.
- **➕ Create ads** — a campaign → ad set → ad wizard (objective, audience,
  budget, creative) that launches a new campaign.
- **⚡ Automation rules** — "if ROAS < 1 then pause", "if ROAS > 3 then increase
  budget 20%", etc. See pending actions and apply them in one click.
- **✨ AI Insights** — Claude (`claude-opus-4-8`) audits the account and returns
  prioritized, actionable recommendations. Falls back to a built-in heuristic
  optimizer when no API key is set, so the feature always works.

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

| Variable            | Required | Purpose                                                                 |
| ------------------- | -------- | ----------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | No       | Enables Claude-generated recommendations. Without it, a heuristic engine is used. |

## How it's structured

```
app/
  page.tsx              Dashboard
  campaigns/            Campaign list
  create/               Create-ads wizard
  automation/           Automation rules
  ai-insights/          AI recommendations
  api/                  Route handlers (campaigns, automation, ai/suggestions)
components/             Sidebar, charts, tables, cards
lib/
  types.ts              Domain model (Campaign → Ad Set → Ad, rules, AI)
  meta/client.ts        Data-source abstraction  ← swap for the real Meta API here
  mock/store.ts         Deterministic mock data + in-memory store
  automation/engine.ts  Rule evaluation
  ai/claude.ts          Claude call + heuristic fallback
  format.ts             Metric formatting & derivation
```

## Going live against the real Meta Marketing API

Everything reads/writes through `lib/meta/client.ts`. To connect the real API:

1. Create a Meta app, complete business verification, and get a long-lived
   access token with `ads_read` / `ads_management` permissions.
2. Reimplement the functions in `lib/meta/client.ts` to call the Graph API
   (`GET /act_<id>/campaigns`, `/insights`, `POST /act_<id>/campaigns`, …)
   using the env vars in `.env.example`.

The UI, automation engine, and AI layer don't change — they only depend on the
functions exported from that one module.

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
