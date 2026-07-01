import { NextResponse } from "next/server";
import { getAudiences } from "@/lib/meta/client";
import { generateAudienceIdeas } from "@/lib/ai/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const audiences = await getAudiences();
  const result = await generateAudienceIdeas(audiences);
  return NextResponse.json(result);
}
