"use client";

import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Couldn&rsquo;t load ad data
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          This usually means live mode is enabled but the Meta Marketing API
          credentials are missing, invalid, or the account is unreachable.
          Check <code className="rounded bg-slate-100 px-1">META_ACCESS_TOKEN</code>{" "}
          and{" "}
          <code className="rounded bg-slate-100 px-1">META_AD_ACCOUNT_ID</code>,
          or unset them to use demo mode.
        </p>
        {error?.message ? (
          <p className="mt-3 break-words rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">
            {error.message}
          </p>
        ) : null}
        <button className="btn-primary mx-auto mt-6" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
