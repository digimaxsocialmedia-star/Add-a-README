import { NextResponse } from "next/server";
import { getCampaigns, setCampaignStatus } from "@/lib/meta/client";
import { evaluate } from "@/lib/automation/engine";
import { getStore } from "@/lib/mock/store";
import type { AutomationRule } from "@/lib/types";

export const dynamic = "force-dynamic";

async function snapshot() {
  const store = getStore();
  const campaigns = await getCampaigns();
  const evaluations = evaluate(campaigns, store.rules);
  return { rules: store.rules, evaluations };
}

export async function GET() {
  return NextResponse.json(await snapshot());
}

export async function POST(req: Request) {
  let body: { op?: string; id?: string; rule?: Partial<AutomationRule> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const store = getStore();

  if (body.op === "toggle" && body.id) {
    const rule = store.rules.find((r) => r.id === body.id);
    if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    rule.enabled = !rule.enabled;
    return NextResponse.json(await snapshot());
  }

  if (body.op === "add" && body.rule) {
    const r = body.rule;
    if (!r.name || !r.metric || !r.operator || !r.action) {
      return NextResponse.json({ error: "Missing rule fields" }, { status: 400 });
    }
    const rule: AutomationRule = {
      id: `rule_${Date.now()}`,
      name: String(r.name),
      enabled: true,
      metric: r.metric,
      operator: r.operator,
      threshold: Number(r.threshold) || 0,
      action: r.action,
      adjustPct: r.adjustPct != null ? Number(r.adjustPct) : undefined,
    };
    store.rules.push(rule);
    return NextResponse.json(await snapshot());
  }

  if (body.op === "apply") {
    // Execute every pending evaluation against the store.
    const campaigns = await getCampaigns();
    const evaluations = evaluate(campaigns, store.rules);
    const applied: string[] = [];
    for (const e of evaluations) {
      const c = store.campaigns.find((x) => x.id === e.campaignId);
      if (!c) continue;
      const rule = store.rules.find((r) => r.id === e.ruleId);
      switch (e.action) {
        case "PAUSE":
          await setCampaignStatus(c.id, "PAUSED");
          break;
        case "INCREASE_BUDGET":
          c.dailyBudget = Math.round(
            c.dailyBudget * (1 + (rule?.adjustPct ?? 0) / 100),
          );
          break;
        case "DECREASE_BUDGET":
          c.dailyBudget = Math.round(
            c.dailyBudget * (1 - (rule?.adjustPct ?? 0) / 100),
          );
          break;
        case "NOTIFY":
          break;
      }
      if (rule) rule.lastTriggered = new Date().toISOString();
      applied.push(e.message);
    }
    return NextResponse.json({ applied, ...(await snapshot()) });
  }

  return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
}
