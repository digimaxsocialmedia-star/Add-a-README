import type { EntityStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: EntityStatus }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? "Active" : "Paused"}
    </span>
  );
}

export function RoasBadge({ roas }: { roas: number }) {
  const tone =
    roas >= 3
      ? "bg-emerald-50 text-emerald-700"
      : roas >= 1
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {roas.toFixed(2)}x
    </span>
  );
}
