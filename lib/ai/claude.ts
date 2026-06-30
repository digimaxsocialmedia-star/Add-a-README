import Anthropic from "@anthropic-ai/sdk";
import { OBJECTIVE_LABELS } from "../types";
import { money, pct, roasFmt } from "../format";
import type {
  AdCopyResult,
  AdCopyVariant,
  AiResult,
  AiSuggestion,
  CampaignWithMetrics,
} from "../types";

// Per the project's Claude integration: use the latest Opus model.
const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `You are a senior Meta (Facebook) Ads strategist embedded in an ad-automation tool.
You receive a snapshot of an ad account's campaigns with aggregated 30-day performance.
Produce concrete, prioritized optimization recommendations a media buyer can act on today.

Guidelines:
- Be specific and reference the campaign by name and the metric that justifies the action.
- Prefer high-leverage moves: reallocating budget from low-ROAS to high-ROAS campaigns,
  scaling winners gradually, fixing creative/CTR problems, tightening or broadening audiences.
- ROAS below ~1.0 is losing money; ROAS above ~3.0 is a scaling candidate.
- CTR below ~1.0% usually signals a creative or targeting problem.
- Keep each rationale to 1-2 sentences. recommendedAction must be a single imperative step.
- Return between 3 and 6 suggestions, ordered most impactful first.`;

function buildAccountTable(campaigns: CampaignWithMetrics[]): string {
  const rows = campaigns.map((c) => {
    const m = c.metrics;
    return [
      `- ${c.name} [${OBJECTIVE_LABELS[c.objective]}, ${c.status}]`,
      `daily budget ${money(c.dailyBudget)}`,
      `spend ${money(m.spend)}`,
      `revenue ${money(m.revenue)}`,
      `ROAS ${roasFmt(m.roas)}`,
      `CTR ${pct(m.ctr)}`,
      `CPC ${money(m.cpc)}`,
      `CPA ${m.conversions ? money(m.cpa) : "n/a"}`,
      `conversions ${m.conversions}`,
    ].join(" | ");
  });
  return rows.join("\n");
}

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          category: {
            type: "string",
            enum: ["budget", "targeting", "creative", "bidding", "structure"],
          },
          campaignName: { type: "string" },
          rationale: { type: "string" },
          recommendedAction: { type: "string" },
        },
        required: ["title", "severity", "category", "rationale", "recommendedAction"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

export async function getSuggestions(
  campaigns: CampaignWithMetrics[],
): Promise<AiResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...heuristicSuggestions(campaigns),
      source: "heuristic",
      note: "Set ANTHROPIC_API_KEY to generate recommendations with Claude. Showing rule-based analysis.",
    };
  }

  try {
    const client = new Anthropic();
    const userPrompt = `Here is the current ad account snapshot (last 30 days):\n\n${buildAccountTable(
      campaigns,
    )}\n\nReturn prioritized optimization recommendations.`;

    // Adaptive thinking + structured JSON output. Passed as `any` so the build
    // doesn't couple to a specific SDK type version for these newer fields.
    const params = {
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: SUGGESTION_SCHEMA },
      },
      messages: [{ role: "user", content: userPrompt }],
    };

    const response = (await client.messages.create(params as never)) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = response.content.find(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (!textBlock?.text) throw new Error("No text block in response");

    const parsed = JSON.parse(textBlock.text) as { suggestions: AiSuggestion[] };
    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      throw new Error("Empty suggestions");
    }
    return { suggestions: parsed.suggestions, source: "claude", model: MODEL };
  } catch (err) {
    // Network/parse/availability issues should never break the demo.
    return {
      ...heuristicSuggestions(campaigns),
      source: "heuristic",
      note: `Claude call failed (${
        err instanceof Error ? err.message : "unknown error"
      }). Showing rule-based analysis.`,
    };
  }
}

// -----------------------------------------------------------------------------
// Heuristic fallback — a deterministic mini "optimizer" so the feature is
// useful even without an API key.
// -----------------------------------------------------------------------------
export function heuristicSuggestions(
  campaigns: CampaignWithMetrics[],
): { suggestions: AiSuggestion[] } {
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.metrics.spend > 0);
  const suggestions: AiSuggestion[] = [];

  const losers = active.filter((c) => c.metrics.roas < 1);
  const winners = active.filter((c) => c.metrics.roas >= 3);

  for (const c of [...active].sort((a, b) => a.metrics.roas - b.metrics.roas)) {
    if (c.metrics.roas < 1) {
      suggestions.push({
        title: `Stop the bleed on "${c.name}"`,
        severity: "high",
        category: "budget",
        campaignName: c.name,
        rationale: `ROAS is ${roasFmt(c.metrics.roas)} on ${money(
          c.metrics.spend,
        )} spend — this campaign is losing money.`,
        recommendedAction:
          "Pause it (or cut budget 50%) and redirect spend to your best ROAS campaign.",
      });
    }
  }

  for (const c of [...winners].sort((a, b) => b.metrics.roas - a.metrics.roas)) {
    suggestions.push({
      title: `Scale "${c.name}"`,
      severity: "high",
      category: "budget",
      campaignName: c.name,
      rationale: `ROAS is ${roasFmt(c.metrics.roas)} — well above target. There's room to spend more profitably.`,
      recommendedAction: `Increase daily budget ~20% (to ${money(
        c.dailyBudget * 1.2,
      )}) and monitor for 3 days.`,
    });
  }

  for (const c of active) {
    if (c.metrics.ctr < 1) {
      suggestions.push({
        title: `Refresh creative on "${c.name}"`,
        severity: "medium",
        category: "creative",
        campaignName: c.name,
        rationale: `CTR is only ${pct(
          c.metrics.ctr,
        )} — the audience isn't engaging with the current creative.`,
        recommendedAction:
          "Test 2-3 new hooks/thumbnails and pause the lowest-CTR ad in the set.",
      });
    }
  }

  if (losers.length && winners.length) {
    suggestions.push({
      title: "Reallocate budget toward what's working",
      severity: "high",
      category: "structure",
      rationale: `${losers.length} campaign(s) are below 1.0x ROAS while ${winners.length} are above 3.0x. The account mix is leaking profit.`,
      recommendedAction: `Shift budget from ${losers
        .map((c) => `"${c.name}"`)
        .join(", ")} into ${winners.map((c) => `"${c.name}"`).join(", ")}.`,
    });
  }

  // High CPA flag.
  const pricey = active
    .filter((c) => c.metrics.conversions > 0 && c.metrics.cpa > 45)
    .sort((a, b) => b.metrics.cpa - a.metrics.cpa)[0];
  if (pricey) {
    suggestions.push({
      title: `High cost per conversion on "${pricey.name}"`,
      severity: "medium",
      category: "bidding",
      campaignName: pricey.name,
      rationale: `CPA is ${money(
        pricey.metrics.cpa,
      )} — above a healthy threshold for this account.`,
      recommendedAction:
        "Tighten the audience or switch to a cost-cap bid strategy to control CPA.",
    });
  }

  const ranked = suggestions
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 6);

  if (ranked.length === 0) {
    ranked.push({
      title: "Account is healthy — keep testing",
      severity: "low",
      category: "creative",
      rationale: "No campaign is currently losing money or under-performing on CTR.",
      recommendedAction:
        "Keep a steady creative-testing cadence and gradually scale your top ROAS campaign.",
    });
  }
  return { suggestions: ranked };
}

function severityRank(s: AiSuggestion["severity"]): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

// -----------------------------------------------------------------------------
// AI ad copy generator (Creative Studio)
// -----------------------------------------------------------------------------

export interface AdCopyInput {
  product: string;
  audience: string;
  tone: string;
  objective: string;
}

const AD_COPY_SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string" },
          headline: { type: "string" },
          primaryText: { type: "string" },
        },
        required: ["angle", "headline", "primaryText"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
} as const;

export async function generateAdCopy(input: AdCopyInput): Promise<AdCopyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...heuristicAdCopy(input),
      source: "heuristic",
      note: "Set ANTHROPIC_API_KEY to write copy with Claude. Showing templated variants.",
    };
  }
  try {
    const client = new Anthropic();
    const system = `You are a direct-response copywriter for Meta (Facebook/Instagram) ads.
Write scroll-stopping ad copy that drives the stated objective. For each variant use a
distinct angle (e.g. problem/solution, social proof, urgency/scarcity, benefit-led,
curiosity). Headlines must be under ~40 characters; primary text 1-3 short sentences with
a clear call to action. No fabricated statistics or unverifiable claims.`;
    const user = `Product/offer: ${input.product}
Target audience: ${input.audience}
Tone: ${input.tone}
Campaign objective: ${input.objective}

Write 4 ad copy variants.`;

    const params = {
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system,
      output_config: { format: { type: "json_schema", schema: AD_COPY_SCHEMA } },
      messages: [{ role: "user", content: user }],
    };
    const response = (await client.messages.create(params as never)) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = response.content.find(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (!textBlock?.text) throw new Error("No text block in response");
    const parsed = JSON.parse(textBlock.text) as { variants: AdCopyVariant[] };
    if (!Array.isArray(parsed.variants) || parsed.variants.length === 0) {
      throw new Error("Empty variants");
    }
    return { variants: parsed.variants, source: "claude", model: MODEL };
  } catch (err) {
    return {
      ...heuristicAdCopy(input),
      source: "heuristic",
      note: `Claude call failed (${
        err instanceof Error ? err.message : "unknown error"
      }). Showing templated variants.`,
    };
  }
}

function heuristicAdCopy(input: AdCopyInput): { variants: AdCopyVariant[] } {
  const p = input.product.trim() || "our product";
  const a = input.audience.trim() || "you";
  const variants: AdCopyVariant[] = [
    {
      angle: "Benefit-led",
      headline: `Meet ${truncate(p, 28)}`,
      primaryText: `Made for ${a}. ${capitalize(p)} that just works — see why people are switching. Shop now →`,
    },
    {
      angle: "Problem / solution",
      headline: "Tired of the hassle?",
      primaryText: `${capitalize(a)} deserve better. ${capitalize(
        p,
      )} fixes it in minutes, not hours. Try it today.`,
    },
    {
      angle: "Social proof",
      headline: "Loved by thousands",
      primaryText: `Join the ${a} who made the switch to ${p}. Real results, zero regret. Get yours →`,
    },
    {
      angle: "Urgency / scarcity",
      headline: "Limited-time offer",
      primaryText: `Don't miss out — ${p} at our best price yet. Offer ends soon. Claim it now.`,
    },
  ];
  return { variants };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
