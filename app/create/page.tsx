"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Loader2,
  Megaphone,
  Users,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { CREATIVE_TYPE_LABELS, OBJECTIVE_LABELS } from "@/lib/types";
import { money } from "@/lib/format";
import type { Objective, CreativeType } from "@/lib/types";

const OBJECTIVES = Object.keys(OBJECTIVE_LABELS) as Objective[];
const CREATIVES = Object.keys(CREATIVE_TYPE_LABELS) as CreativeType[];

const STEPS = [
  { id: 1, label: "Chiến dịch", icon: Megaphone },
  { id: 2, label: "Đối tượng & ngân sách", icon: Users },
  { id: 3, label: "Nội dung", icon: ImageIcon },
];

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_SALES" as Objective,
    dailyBudget: 1_000_000,
    audience: "",
    headline: "",
    primaryText: "",
    creativeType: "IMAGE" as CreativeType,
    link: "",
    imageUrl: "",
    imageData: "",
  });

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp hình ảnh.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Ảnh quá lớn (tối đa 4MB). Hãy chọn ảnh nhỏ hơn.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("imageData", String(reader.result));
    reader.readAsDataURL(file);
  }

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
      if (!res.ok) throw new Error(data.error ?? "Không tạo được chiến dịch");
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <TopBar title="Tạo quảng cáo" subtitle="Chiến dịch mới" />
        <div className="p-6">
          <div className="card mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Đã tạo chiến dịch
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              &ldquo;{form.name}&rdquo; đã được tạo. Chiến dịch để ở trạng thái
              Tạm dừng cho an toàn — kiểm tra lại rồi bật chạy khi bạn sẵn sàng.
            </p>
            {warnings.length ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
                <p className="font-medium">Một số bước chưa hoàn tất:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-6 flex justify-center gap-3">
              <button
                className="btn-ghost"
                onClick={() => {
                  setDone(false);
                  setStep(1);
                  setWarnings([]);
                  setForm((f) => ({
                    ...f,
                    name: "",
                    audience: "",
                    headline: "",
                    primaryText: "",
                    link: "",
                    imageUrl: "",
                    imageData: "",
                  }));
                }}
              >
                Tạo cái khác
              </button>
              <button className="btn-primary" onClick={() => router.push("/campaigns")}>
                Xem chiến dịch
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
        title="Tạo quảng cáo"
        subtitle="Tạo chiến dịch → nhóm quảng cáo → quảng cáo trong vài bước"
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
                  <label className="label">Tên chiến dịch</label>
                  <input
                    className="input"
                    placeholder="vd: Ra mắt mùa xuân — Tìm khách mới"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Mục tiêu</label>
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
                  <label className="label">Đối tượng</label>
                  <input
                    className="input"
                    placeholder="vd: Lookalike 1% người mua"
                    value={form.audience}
                    onChange={(e) => update("audience", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Ngân sách hằng ngày (VND)</label>
                  <input
                    type="number"
                    min={1000}
                    step={50000}
                    className="input"
                    value={form.dailyBudget}
                    onChange={(e) =>
                      update("dailyBudget", Number(e.target.value))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Ước tính chi tiêu/tháng: {money(form.dailyBudget * 30)}
                  </p>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Định dạng nội dung</label>
                  <div className="flex gap-2">
                    {CREATIVES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => update("creativeType", c)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                          form.creativeType === c
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {CREATIVE_TYPE_LABELS[c]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Tiêu đề</label>
                  <input
                    className="input"
                    placeholder="vd: Giảm đến 40% — chỉ hôm nay"
                    value={form.headline}
                    onChange={(e) => update("headline", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Nội dung chính</label>
                  <textarea
                    className="input min-h-[90px]"
                    placeholder="Viết nội dung quảng cáo mà đối tượng sẽ thấy…"
                    value={form.primaryText}
                    onChange={(e) => update("primaryText", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Link đích (URL)</label>
                  <input
                    className="input"
                    placeholder="https://cuahang.vn/san-pham"
                    value={form.link}
                    onChange={(e) => update("link", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Hình ảnh — tải lên trực tiếp</label>
                  {form.imageData ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.imageData}
                        alt="Xem trước"
                        className="h-16 w-16 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-emerald-700">
                          Đã chọn ảnh tải lên
                        </p>
                        <p className="text-xs text-slate-400">
                          Sẽ tải thẳng lên Meta (image_hash), ưu tiên hơn URL.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-500"
                        onClick={() => update("imageData", "")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-brand-400 hover:bg-slate-50">
                      <Upload className="h-4 w-4" />
                      Chọn ảnh từ máy (tối đa 4MB)
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onPickImage}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <label className="label">…hoặc dán URL hình ảnh</label>
                  <input
                    className="input"
                    placeholder="https://cuahang.vn/anh.jpg"
                    value={form.imageUrl}
                    onChange={(e) => update("imageUrl", e.target.value)}
                    disabled={Boolean(form.imageData)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Cần Link đích + hình ảnh (tải lên hoặc URL) và META_PAGE_ID để
                    tạo quảng cáo đầy đủ ở chế độ trực tiếp. Ở chế độ demo, các
                    trường này là tùy chọn.
                  </p>
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
                Quay lại
              </button>
              {step < 3 ? (
                <button
                  className="btn-primary"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext}
                >
                  Tiếp tục
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo…
                    </>
                  ) : (
                    "Khởi chạy chiến dịch"
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
