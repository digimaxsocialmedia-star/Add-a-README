import { NextResponse } from "next/server";
import {
  getManagerTree,
  setAdSetStatus,
  setAdStatus,
  setCampaignStatus,
  updateAdSetDailyBudget,
  updateCampaignDailyBudget,
} from "@/lib/meta/client";
import type { EntityStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Level = "campaign" | "adset" | "ad";

async function setStatus(level: Level, id: string, status: EntityStatus) {
  if (level === "campaign") return setCampaignStatus(id, status);
  if (level === "adset") return setAdSetStatus(id, status);
  return setAdStatus(id, status);
}

async function setBudget(level: Level, id: string, dailyBudget: number) {
  if (level === "campaign") return updateCampaignDailyBudget(id, dailyBudget);
  if (level === "adset") return updateAdSetDailyBudget(id, dailyBudget);
  throw new Error("Budget can only be set at the campaign or ad set level");
}

export async function GET() {
  try {
    const tree = await getManagerTree();
    return NextResponse.json({ tree });
  } catch (err) {
    return NextResponse.json(
      { tree: [], error: err instanceof Error ? err.message : "Failed to load" },
      { status: 200 },
    );
  }
}

export async function POST(req: Request) {
  let body: {
    op?: string;
    level?: Level;
    id?: string;
    status?: EntityStatus;
    dailyBudget?: number;
    ids?: string[];
    action?: "pause" | "activate";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const level: Level = body.level ?? "campaign";
  try {
    if (body.op === "status" && body.id && body.status) {
      await setStatus(level, body.id, body.status);
    } else if (body.op === "budget" && body.id && body.dailyBudget != null) {
      await setBudget(level, body.id, Number(body.dailyBudget));
    } else if (body.op === "bulk" && Array.isArray(body.ids) && body.action) {
      const status: EntityStatus = body.action === "pause" ? "PAUSED" : "ACTIVE";
      for (const id of body.ids) await setStatus(level, id, status);
    } else {
      return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operation failed" },
      { status: 502 },
    );
  }

  const tree = await getManagerTree();
  return NextResponse.json({ tree });
}
