import { NextResponse } from "next/server";
import { addCampaign, getCampaigns } from "@/lib/meta/client";
import type { NewCampaignInput } from "@/lib/meta/client";
import type { Objective } from "@/lib/types";

export const dynamic = "force-dynamic";

const OBJECTIVES: Objective[] = [
  "OUTCOME_SALES",
  "OUTCOME_TRAFFIC",
  "OUTCOME_LEADS",
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
];

export async function GET() {
  const campaigns = await getCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  let body: Partial<NewCampaignInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim();
  const dailyBudget = Number(body.dailyBudget);
  const objective = body.objective as Objective;

  if (!name) {
    return NextResponse.json({ error: "Vui lòng nhập tên chiến dịch" }, { status: 400 });
  }
  if (!OBJECTIVES.includes(objective)) {
    return NextResponse.json({ error: "Mục tiêu không hợp lệ" }, { status: 400 });
  }
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return NextResponse.json(
      { error: "Ngân sách hằng ngày phải là số dương" },
      { status: 400 },
    );
  }

  const imageData = (body.imageData ?? "").toString().trim() || undefined;
  // Chặn payload quá lớn (~5MB ảnh gốc ≈ 7M ký tự base64).
  if (imageData && imageData.length > 7_000_000) {
    return NextResponse.json(
      { error: "Ảnh quá lớn (tối đa ~5MB). Hãy chọn ảnh nhỏ hơn." },
      { status: 413 },
    );
  }

  const result = await addCampaign({
    name,
    objective,
    dailyBudget,
    audience: (body.audience ?? "Rộng").toString().trim() || "Rộng",
    headline: (body.headline ?? "").toString().trim() || "Ưu đãi mới",
    primaryText:
      (body.primaryText ?? "").toString().trim() || "Khám phá điều mới.",
    creativeType:
      body.creativeType === "VIDEO" || body.creativeType === "CAROUSEL"
        ? body.creativeType
        : "IMAGE",
    link: (body.link ?? "").toString().trim() || undefined,
    imageUrl: (body.imageUrl ?? "").toString().trim() || undefined,
    imageData,
  });

  return NextResponse.json(result, { status: 201 });
}
