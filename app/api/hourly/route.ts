import { NextResponse } from "next/server";
import { getCampaigns, getHourlyCells } from "@/lib/meta/client";
import { getMode } from "@/lib/meta/config";
import { getStore, schedulePersist } from "@/lib/mock/store";
import { analyzeHours } from "@/lib/hourly/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const [cells, campaigns] = await Promise.all([getHourlyCells(), getCampaigns()]);
  const analysis = analyzeHours(cells);
  return NextResponse.json({
    analysis,
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    mode: getMode(),
  });
}

// POST {op:"apply", campaignId: "cmp_1" | "all_active"} — ghi lưới đề xuất vào
// Lịch chạy theo giờ của (các) chiến dịch, bật sẵn.
export async function POST(req: Request) {
  let body: { op?: string; campaignId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  if (body.op !== "apply" || !body.campaignId) {
    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
  }

  const [cells, campaigns] = await Promise.all([getHourlyCells(), getCampaigns()]);
  const analysis = analyzeHours(cells);

  const targets =
    body.campaignId === "all_active"
      ? campaigns.filter((c) => c.status === "ACTIVE")
      : campaigns.filter((c) => c.id === body.campaignId);
  if (targets.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy chiến dịch." }, { status: 404 });
  }

  const store = getStore();
  for (const c of targets) {
    store.schedules[c.id] = {
      campaignId: c.id,
      enabled: true,
      grid: analysis.grid.map((r) => [...r]),
    };
  }
  schedulePersist();

  return NextResponse.json({
    applied: targets.map((c) => c.name),
    offCount: analysis.offCount,
  });
}
