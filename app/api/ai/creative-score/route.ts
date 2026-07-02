import { NextResponse } from "next/server";
import { scoreCreativeImage } from "@/lib/ai/claude";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { imageData?: string; headline?: string; primaryText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const imageData = (body.imageData ?? "").toString().trim();
  if (!imageData) {
    return NextResponse.json(
      { error: "Vui lòng chọn ảnh quảng cáo để chấm điểm." },
      { status: 400 },
    );
  }
  // Chặn payload quá lớn (~5MB ảnh gốc ≈ 7M ký tự base64).
  if (imageData.length > 7_000_000) {
    return NextResponse.json(
      { error: "Ảnh quá lớn (tối đa ~5MB). Hãy chọn ảnh nhỏ hơn." },
      { status: 413 },
    );
  }

  const result = await scoreCreativeImage({
    imageData,
    headline: (body.headline ?? "").toString().trim() || undefined,
    primaryText: (body.primaryText ?? "").toString().trim() || undefined,
  });
  return NextResponse.json(result);
}
