import { NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta/client";
import { evaluate } from "@/lib/automation/engine";
import { runAutomationRules } from "@/lib/automation/run";
import { suggestThresholds } from "@/lib/automation/thresholds";
import { getStore } from "@/lib/mock/store";
import type { AutomationRule } from "@/lib/types";

export const dynamic = "force-dynamic";

async function snapshot() {
  const store = getStore();
  try {
    const campaigns = await getCampaigns();
    const evaluations = evaluate(campaigns, store.rules);
    return {
      rules: store.rules,
      evaluations,
      thresholds: suggestThresholds(campaigns),
    };
  } catch (err) {
    // Keep the rules UI usable even if campaign data can't be fetched.
    return {
      rules: store.rules,
      evaluations: [],
      error: err instanceof Error ? err.message : "Không tải được chiến dịch",
    };
  }
}

export async function GET() {
  return NextResponse.json(await snapshot());
}

export async function POST(req: Request) {
  let body: { op?: string; id?: string; rule?: Partial<AutomationRule> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const store = getStore();

  if (body.op === "toggle" && body.id) {
    const rule = store.rules.find((r) => r.id === body.id);
    if (!rule) return NextResponse.json({ error: "Không tìm thấy quy tắc" }, { status: 404 });
    rule.enabled = !rule.enabled;
    return NextResponse.json(await snapshot());
  }

  if (body.op === "add" && body.rule) {
    const r = body.rule;
    if (!r.name || !r.metric || !r.operator || !r.action) {
      return NextResponse.json({ error: "Thiếu thông tin quy tắc" }, { status: 400 });
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
    const { applied } = await runAutomationRules("manual");
    return NextResponse.json({ applied, ...(await snapshot()) });
  }

  return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
}
