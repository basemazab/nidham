"use client";

// ============================================================================
// OnboardClient — multi-step employee self-onboarding wizard
// ============================================================================
//
// Five steps + progress bar. Each step submits the relevant subset of
// fields to saveOnboardingStep() so the user can leave + come back
// without losing their progress (the form is re-prefilled from the DB
// on next page load).
//
// State management is dead simple — one big object held in useState +
// per-field setters. No reducer, no context, no Zod — the page is
// linear and small enough that explicit setters are clearer than a
// state library.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveOnboardingStep, completeOnboarding } from "./actions";

type Initial = {
  employee_id: string;
  full_name: string;
  date_of_birth: string;
  national_id: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account_number: string;
  avatar_url: string;
  job_title: string;
  department: string;
  hire_date: string;
};

const STEPS = [
  { id: 1, label: "ترحيب", emoji: "👋" },
  { id: 2, label: "بياناتك الشخصية", emoji: "🪪" },
  { id: 3, label: "للتواصل", emoji: "📱" },
  { id: 4, label: "حساب البنك", emoji: "🏦" },
  { id: 5, label: "صورة شخصية", emoji: "📸" },
  { id: 6, label: "تأكيد", emoji: "✓" },
];

export function OnboardClient({ initial }: { initial: Initial }) {
  const [step, setStep] = useState(determineStartStep(initial));
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isDone =
    !!data.full_name &&
    !!data.national_id &&
    !!data.phone &&
    !!data.bank_name &&
    !!data.bank_account_number;

  // Compute progress: how many key fields are filled
  const filledCount = [
    data.full_name,
    data.date_of_birth,
    data.national_id,
    data.phone,
    data.email,
    data.bank_name,
    data.bank_account_number,
    data.avatar_url,
  ].filter(Boolean).length;
  const progressPct = Math.round((filledCount / 8) * 100);

  const saveStep = async (subset: Partial<Initial>) => {
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(subset)) {
        fd.append(k, v ?? "");
      }
      await saveOnboardingStep(fd);
    } catch (e) {
      // Server action redirected; let it through. Network/runtime errors
      // surface in the toast below.
      const msg = e instanceof Error ? e.message : "حصل عطل بسيط";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const next = async (subset: Partial<Initial>) => {
    await saveStep(subset);
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const back = () => setStep((s) => Math.max(s - 1, 1));

  // Avatar upload (client-side direct to Supabase storage)
  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${data.employee_id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("employee-files")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage
        .from("employee-files")
        .getPublicUrl(path);
      const url = pub?.publicUrl ?? "";
      setData((d) => ({ ...d, avatar_url: url }));
      await saveStep({ avatar_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل رفع الصورة");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-4 font-cairo">
      <div className="max-w-2xl mx-auto pt-6">
        {/* Header + progress */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center shadow-lg">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">
            أهلاً بيك في نِظام
          </h1>
          <p className="text-sm text-slate-500">
            خطوة بخطوة، هنكمّل ملفك الوظيفي
          </p>
        </div>

        {/* Steps indicator */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-5">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
            <span>خطوة {step} من {STEPS.length}</span>
            <span className="font-bold text-emerald-700">
              {progressPct}% مكتمل
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-cyan to-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`text-[10px] text-center flex-1 ${
                  s.id === step
                    ? "text-brand-cyan-dark font-bold"
                    : s.id < step
                      ? "text-emerald-700"
                      : "text-slate-400"
                }`}
              >
                <div
                  className={`w-7 h-7 mx-auto mb-1 rounded-full flex items-center justify-center text-xs ${
                    s.id === step
                      ? "bg-brand-cyan-dark text-white"
                      : s.id < step
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.id < step ? "✓" : s.emoji}
                </div>
                <div className="truncate px-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Step body */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          {step === 1 && (
            <Step1Welcome
              data={data}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <Step2Personal
              data={data}
              setData={setData}
              onNext={() =>
                next({
                  full_name: data.full_name,
                  date_of_birth: data.date_of_birth,
                  national_id: data.national_id,
                })
              }
              onBack={back}
              busy={busy}
            />
          )}

          {step === 3 && (
            <Step3Contact
              data={data}
              setData={setData}
              onNext={() =>
                next({
                  phone: data.phone,
                  email: data.email,
                })
              }
              onBack={back}
              busy={busy}
            />
          )}

          {step === 4 && (
            <Step4Bank
              data={data}
              setData={setData}
              onNext={() =>
                next({
                  bank_name: data.bank_name,
                  bank_account_number: data.bank_account_number,
                })
              }
              onBack={back}
              busy={busy}
            />
          )}

          {step === 5 && (
            <Step5Photo
              data={data}
              onUpload={uploadAvatar}
              uploading={uploadingAvatar}
              onNext={() => setStep(6)}
              onBack={back}
              onSkip={() => setStep(6)}
            />
          )}

          {step === 6 && (
            <Step6Review
              data={data}
              isDone={isDone}
              completeAction={completeOnboarding}
              onBack={back}
            />
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          🔐 بياناتك محفوظة بتشفير AES — مفيش حد بيشوفها غير HR في شركتك
        </p>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step start logic — if some fields are already filled, jump ahead
// ─────────────────────────────────────────────────────────────────────
function determineStartStep(d: Initial): number {
  if (!d.full_name || !d.national_id) return 2;
  if (!d.phone || !d.email) return 3;
  if (!d.bank_name || !d.bank_account_number) return 4;
  if (!d.avatar_url) return 5;
  return 6;
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — Welcome
// ─────────────────────────────────────────────────────────────────────
function Step1Welcome({
  data,
  onNext,
}: {
  data: Initial;
  onNext: () => void;
}) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">👋</div>
      <h2 className="text-2xl font-black text-slate-800 mb-3">
        أهلاً يا {data.full_name?.split(" ")[0] || "صديقي"}!
      </h2>
      <p className="text-sm text-slate-600 leading-relaxed mb-6 max-w-md mx-auto">
        أهلاً بيك في فريق الشركة. خلال ٣ دقايق هتكمّل بياناتك الشخصية
        (الرقم القومي، البنك، صورتك) وبعدها هتقدر تستخدم النظام بالكامل
        من موبايلك.
      </p>

      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-right mb-6">
        <div className="text-xs font-bold text-cyan-800 mb-2">
          ✦ هتعمل ايه من النظام بعد ما تخلّص:
        </div>
        <ul className="text-xs text-slate-700 space-y-1.5">
          <li>📍 تسجيل حضور بـ GPS + سيلفي</li>
          <li>📱 سؤال البوت عن إجازاتك ومرتبك على WhatsApp</li>
          <li>🏖 تقديم طلبات إجازة وسلفة</li>
          <li>📜 استلام شهادات + قسائم مرتبات</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-md transition active:scale-95"
      >
        يلا نبدأ ←
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — Personal info
// ─────────────────────────────────────────────────────────────────────
function Step2Personal({
  data,
  setData,
  onNext,
  onBack,
  busy,
}: {
  data: Initial;
  setData: (fn: (d: Initial) => Initial) => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  // Validate national ID = 14 digits (Egyptian format)
  const ninValid = /^\d{14}$/.test(data.national_id.trim());
  const canNext = data.full_name.trim().length >= 3 && ninValid;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 mb-1">
        🪪 بياناتك الشخصية
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        دي الحاجات اللي HR محتاجها للتأمينات والمرتبات
      </p>

      <div className="space-y-4">
        <Field
          label="الاسم بالكامل *"
          name="full_name"
          value={data.full_name}
          onChange={(v) => setData((d) => ({ ...d, full_name: v }))}
          placeholder="زي ما هو مكتوب في بطاقتك"
        />

        <Field
          label="تاريخ الميلاد"
          name="date_of_birth"
          type="date"
          value={data.date_of_birth}
          onChange={(v) => setData((d) => ({ ...d, date_of_birth: v }))}
        />

        <div>
          <Field
            label="الرقم القومي *"
            name="national_id"
            value={data.national_id}
            onChange={(v) => setData((d) => ({ ...d, national_id: v.replace(/\D/g, "").slice(0, 14) }))}
            placeholder="١٤ رقم بالظبط"
            ltr
            mono
          />
          {data.national_id && !ninValid && (
            <p className="text-xs text-rose-600 mt-1">
              ⚠ الرقم القومي لازم ١٤ رقم
            </p>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            🔐 الرقم القومي بيتشفّر تلقائياً قبل التخزين
          </p>
        </div>
      </div>

      <NavButtons
        canNext={canNext}
        busy={busy}
        onNext={onNext}
        onBack={onBack}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 3 — Contact
// ─────────────────────────────────────────────────────────────────────
function Step3Contact({
  data,
  setData,
  onNext,
  onBack,
  busy,
}: {
  data: Initial;
  setData: (fn: (d: Initial) => Initial) => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const phoneValid = /^(\+?20|0)?1[0125]\d{8}$/.test(
    data.phone.replace(/\s/g, ""),
  );
  const emailValid = !data.email || /.+@.+\..+/.test(data.email);
  const canNext = phoneValid && emailValid;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 mb-1">📱 طرق التواصل</h2>
      <p className="text-sm text-slate-500 mb-5">
        علشان البوت يقدر يبعت لك ردود WhatsApp + إشعارات الإجازات
      </p>

      <div className="space-y-4">
        <div>
          <Field
            label="رقم الموبايل *"
            name="phone"
            value={data.phone}
            onChange={(v) => setData((d) => ({ ...d, phone: v }))}
            placeholder="01XXXXXXXXX"
            ltr
            mono
          />
          {data.phone && !phoneValid && (
            <p className="text-xs text-rose-600 mt-1">
              ⚠ رقم موبايل مصري غير صحيح
            </p>
          )}
        </div>

        <div>
          <Field
            label="الإيميل (اختياري)"
            name="email"
            value={data.email}
            onChange={(v) => setData((d) => ({ ...d, email: v }))}
            placeholder="you@example.com"
            ltr
          />
          {data.email && !emailValid && (
            <p className="text-xs text-rose-600 mt-1">⚠ صيغة إيميل غلط</p>
          )}
        </div>
      </div>

      <NavButtons
        canNext={canNext}
        busy={busy}
        onNext={onNext}
        onBack={onBack}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 4 — Bank
// ─────────────────────────────────────────────────────────────────────
const EGYPTIAN_BANKS = [
  "البنك الأهلي المصري",
  "بنك مصر",
  "البنك التجاري الدولي CIB",
  "QNB الأهلي",
  "بنك القاهرة",
  "بنك الإسكندرية",
  "HSBC مصر",
  "البنك العربي الأفريقي",
  "بنك فيصل الإسلامي",
  "بنك أبو ظبي التجاري ADCB",
  "Banque Misr",
  "أخرى",
];

function Step4Bank({
  data,
  setData,
  onNext,
  onBack,
  busy,
}: {
  data: Initial;
  setData: (fn: (d: Initial) => Initial) => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const accountValid = data.bank_account_number.replace(/\D/g, "").length >= 10;
  const canNext = data.bank_name.length > 0 && accountValid;

  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 mb-1">🏦 حساب البنك</h2>
      <p className="text-sm text-slate-500 mb-5">
        المرتب هيتحوّل على الحساب ده. مش هتدفع أي رسوم.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            البنك *
          </label>
          <select
            value={data.bank_name}
            onChange={(e) =>
              setData((d) => ({ ...d, bank_name: e.target.value }))
            }
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
          >
            <option value="">— اختار البنك —</option>
            {EGYPTIAN_BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="رقم الحساب (IBAN) *"
          name="bank_account_number"
          value={data.bank_account_number}
          onChange={(v) =>
            setData((d) => ({ ...d, bank_account_number: v.toUpperCase() }))
          }
          placeholder="EG... أو الرقم بدون مسافات"
          ltr
          mono
        />

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
          🔐 رقم الحساب بيتشفّر بـ AES-256 — مفيش حد بيقدر يقراه إلا
          الـ payroll module لما يحوّل المرتب.
        </div>
      </div>

      <NavButtons
        canNext={canNext}
        busy={busy}
        onNext={onNext}
        onBack={onBack}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 5 — Profile photo
// ─────────────────────────────────────────────────────────────────────
function Step5Photo({
  data,
  onUpload,
  uploading,
  onNext,
  onBack,
  onSkip,
}: {
  data: Initial;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const fileInputRef = (input: HTMLInputElement | null) => {
    if (input) input.value = "";
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 mb-1">📸 صورتك</h2>
      <p className="text-sm text-slate-500 mb-5">
        صورة شخصية واضحة — هتظهر في ملفك وفي شهاداتك. اختيارية.
      </p>

      <div className="flex flex-col items-center gap-4 mb-6">
        {/* Avatar preview */}
        <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
          {data.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatar_url}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl text-slate-300">👤</span>
          )}
        </div>

        {/* Upload button */}
        <label className="inline-block">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          <span
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition ${
              uploading
                ? "bg-slate-200 text-slate-500"
                : "bg-brand-cyan text-white hover:bg-brand-cyan-dark"
            }`}
          >
            {uploading ? "⏳ جاري الرفع..." : "📷 اختار صورة"}
          </span>
        </label>

        <p className="text-[10px] text-slate-400 text-center">
          الحد الأقصى ١٠ MB · JPG/PNG/WebP
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
        >
          ← رجوع
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 px-5 py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-sm transition"
        >
          خطّيها لاحقاً
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow transition"
        >
          التالي ←
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 6 — Review + confirm
// ─────────────────────────────────────────────────────────────────────
function Step6Review({
  data,
  isDone,
  completeAction,
  onBack,
}: {
  data: Initial;
  isDone: boolean;
  // Server action passed directly so the <form action={...}> hook
  // routes the submission to the server rather than running on the client.
  completeAction: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 mb-1">
        ✓ تأكيد البيانات
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        راجع البيانات قبل التأكيد. تقدر ترجع تعدّل أي حاجة.
      </p>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200 mb-5">
        <ReviewRow label="الاسم" value={data.full_name} />
        <ReviewRow
          label="تاريخ الميلاد"
          value={data.date_of_birth || "(ما اتحطش)"}
        />
        <ReviewRow
          label="الرقم القومي"
          value={maskNationalId(data.national_id)}
          mono
        />
        <ReviewRow label="الموبايل" value={data.phone} mono />
        <ReviewRow label="الإيميل" value={data.email || "—"} />
        <ReviewRow label="البنك" value={data.bank_name} />
        <ReviewRow
          label="رقم الحساب"
          value={maskAccount(data.bank_account_number)}
          mono
        />
        <ReviewRow
          label="الصورة"
          value={data.avatar_url ? "✓ مرفوعة" : "(ما اترفعتش)"}
        />
      </div>

      {!isDone && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          ⚠ في بيانات مطلوبة ناقصة. ارجع وعبّيها قبل التأكيد.
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
        >
          ← عدّل
        </button>
        <form action={completeAction} className="flex-1">
          <button
            type="submit"
            disabled={!isDone}
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold text-sm shadow transition"
          >
            ✓ أكّد الكل وابدأ استخدام النظام
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  ltr,
  mono,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  ltr?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-slate-700 mb-2"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={ltr ? "ltr" : "rtl"}
        className={`w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function NavButtons({
  canNext,
  busy,
  onNext,
  onBack,
}: {
  canNext: boolean;
  busy: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-6">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
      >
        ← رجوع
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext || busy}
        className="flex-1 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold text-sm shadow transition"
      >
        {busy ? "⏳ بنحفظ..." : "احفظ + التالي ←"}
      </button>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-sm text-slate-900 font-medium ${
          mono ? "font-mono" : ""
        }`}
        dir={mono ? "ltr" : "rtl"}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function maskNationalId(id: string): string {
  if (!id || id.length < 14) return id || "—";
  return `${id.slice(0, 4)} **** **** ${id.slice(10)}`;
}

function maskAccount(acc: string): string {
  if (!acc || acc.length < 6) return acc || "—";
  return `**** **** ${acc.slice(-4)}`;
}
