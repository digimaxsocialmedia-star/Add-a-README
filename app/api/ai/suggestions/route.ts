import { NextResponse } from "next/server";
import { getCampaigns } from "@/lib/meta/client";
import { getSuggestions } from "@/lib/ai/claude";

export const dynamic = "force-dynamic";
// Claude calls can take a while with adaptive thinking — give the route room.
export const maxDuration = 60;

export async function POST() {
  const campaigns = await getCampaigns();
  const result = await getSuggestions(campaigns);
  return NextResponse.json(result);
}
