import { ACCOUNT_NAME } from "@/lib/meta/client";

export function TopBar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {action}
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {ACCOUNT_NAME}
        </div>
      </div>
    </header>
  );
}
