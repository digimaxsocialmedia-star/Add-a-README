"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Megaphone, Users, Image as ImageIcon } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { OBJECTIVE_LABELS } from "@/lib/types";
import type { Objective, CreativeType } from "@/lib/types";

const OBJECTIVES = Object.keys(OBJECTIVE_LABELS) as Objective[];
const CREATIVES: CreativeType[] = ["IMAGE", "VIDEO", "CAROUSEL"];

const STEPS = [
  { id: 1, label: "Campaign", icon: Megaphone },
  { id: 2, label: "Audience & budget", icon: Users },
  { id: 3, label: "Creative", icon: ImageIcon },
];

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_SALES" as Objective,
    dailyBudget: 50,
    audience: "",
    headline: "",
    primaryText: "",
    creativeType: "IMAGE" as CreativeType,
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canNext =
    step === 1
      ? form.name.trim().length > 0
      : step === 2
        ? form.dailyBudget > 0 && form.audience.trim().length > 0
        : true;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create campaign");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <TopBar title="Create ads" subtitle="New campaign" />
        <div className="p-6">
          <div className="card mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Campaign created
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              &ldquo;{form.name}&rdquo; is live and entering the learning phase.
              Performance data will appear as it spends.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                className="btn-ghost"
                onClick={() => {
                  setDone(false);
                  setStep(1);
                  setForm((f) => ({ ...f, name: "", audience: "", headline: "", primaryText: "" }));
                }}
              >
                Create another
              </button>
              <button className="btn-primary" onClick={() => router.push("/campaigns")}>
                View campaigns
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Create ads"
        subtitle="Build a campaign → ad set → ad in a few steps"
      />
      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          {/* Stepper */}
          <ol className="mb-6 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const complete = step > s.id;
              return (
                <li key={s.id} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      complete
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-brand-600 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {complete ? <Check className="h-4 w-4" /> : s.id}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      active ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <div className="mx-1 h-px flex-1 bg-slate-200" />
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="card p-6">
            {step === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Campaign name</label>
                  <input
                    className="input"
                    placeholder="e.g. Spring Launch — Prospecting"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Objective</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {OBJECTIVES.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => update("objective", o)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          form.objective === o
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {OBJECTIVE_LABELS[o]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Audience</label>
                  <input
                    className="input"
                    placeholder="e.g. Lookalike 1% purchasers"
                    value={form.audience}
                    onChange={(e) => update("audience", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Daily budget (USD)</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={form.dailyBudget}
                    onChange={(e) =>
                      update("dailyBudget", Number(e.target.value))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Estimated monthly spend: $
                    {(form.dailyBudget * 30).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Creative format</label>
                  <div className="flex gap-2">
                    {CREATIVES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => update("creativeType", c)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${
                          form.creativeType === c
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {c.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Headline</label>
                  <input
                    className="input"
                    placeholder="e.g. Up to 40% off — today only"
                    value={form.headline}
                    onChange={(e) => update("headline", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Primary text</label>
                  <textarea
                    className="input min-h-[90px]"
                    placeholder="Write the ad copy your audience will see…"
                    value={form.primaryText}
                    onChange={(e) => update("primaryText", e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                className="btn-ghost"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                Back
              </button>
              {step < 3 ? (
                <button
                  className="btn-primary"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    "Launch campaign"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
