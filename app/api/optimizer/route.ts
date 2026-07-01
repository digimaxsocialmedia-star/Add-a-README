import { NextResponse } from "next/server";
import { applyBudgetPlan, getBudgetPlan } from "@/lib/optimizer/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ plan: await getBudgetPlan() });
  } catch (err) {
    return NextResponse.json(
      { plan: { changes: [], totalBefore: 0, totalAfter: 0 }, error: err instanceof Error ? err.message : "Lỗi" },
      { status: 200 },
    );
  }
}

export async function POST() {
  try {
    const { applied, plan } = await applyBudgetPlan();
    return NextResponse.json({ applied, plan });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không áp dụng được" },
      { status: 502 },
    );
  }
}
