import { NextResponse } from "next/server";
import { generateAdCopy } from "@/lib/ai/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const result = await generateAdCopy({
    product: String(body.product ?? "").trim(),
    audience: String(body.audience ?? "").trim() || "general shoppers",
    tone: String(body.tone ?? "").trim() || "friendly and confident",
    objective: String(body.objective ?? "").trim() || "Sales / Conversions",
  });
  return NextResponse.json(result);
}
