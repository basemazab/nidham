import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateSubscription,
  extendTrial,
  setTenantFeatureOverride,
  applyTenantFeaturePreset,
  clearTenantFeatureOverrides,
} from "../../actions";
import {
  FEATURE_CATALOGUE,
  FEATURE_PRESETS,
  hasFeature,
  type Feature,
  type Plan,
} from "@/lib/subscriptions";
import { getCompanyFeatureOverrides } from "@/lib/subscriptions-server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    extended?: string;
    error?: string;
    feature_saved?: string;
    preset_applied?: string;
    overrides_cleared?: string;
  }>;
};

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan: string;
  status: string;
  starts_at: string;
  ends_at: string;
  monthly_value: number | null;
  invoiced_until: string | null;
  notes: string | null;
  companies: { name: string; industry: string | null } | null;
};

export default async function AdminSubscriptionPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const saved = !!sp.saved;
  const extended = sp.extended ? parseInt(sp.extended, 10) : null;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!superAdmin) redirect("/dashboard");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "id, company_id, plan, status, starts_at, ends_at, monthly_value, invoiced_until, notes, companies(name, industry)",
    )
    .eq("id", id)
    .single<SubscriptionRow>();

  if (!subscription) notFound();

  const updateAction = updateSubscription.bind(null, id);
  const extendAction = extendTrial.bind(null, id);

  // Per-tenant feature overrides
  const overrides = await getCompanyFeatureOverrides(subscription.company_id);
  const presetApplied = sp.preset_applied
    ? decodeURIComponent(sp.preset_applied)
    : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-navy-900 to-brand-navy text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <Link href="/admin" className="text-sm text-slate-300 hover:text-white font-cairo">
                ← لوحة الإدارة
              </Link>
              <div className="text-lg font-black font-display">إدارة اشتراك</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {saved && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 font-cairo text-emerald-800 flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <div className="font-bold">تم الحفظ</div>
              <p className="text-sm mt-0.5">
                التحديث ظهر في حساب الشركة فورًا. لو شفت الصفحة الـ
                trial في الـ dashboard اعمل refresh.
              </p>
            </div>
          </div>
        )}

        {extended && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 font-cairo text-amber-800 flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <div className="font-bold">
                اتمدّد الاشتراك {extended} يوم
              </div>
              <p className="text-sm mt-0.5">
                تاريخ الانتهاء الجديد ظاهر تحت.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-cairo text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        <header className="mb-8">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            {subscription.companies?.name ?? "—"}
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {subscription.companies?.industry ?? "بدون قطاع محدد"} · ID: <span className="font-mono">{subscription.company_id.slice(0, 8)}…</span>
          </p>
        </header>

        {/* Quick extend trial */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <h2 className="text-base font-bold font-cairo text-slate-800 mb-3">⏰ تمديد سريع</h2>
          <p className="text-xs text-slate-500 mb-4 font-cairo">
            ضيف أيام للاشتراك الحالي بدون ما تغيّر الخطة
          </p>
          <form action={extendAction} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-600 mb-1 font-cairo">عدد الأيام</label>
              <input
                type="number"
                name="days"
                defaultValue="30"
                min="1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm font-cairo transition"
            >
              مدّد
            </button>
          </form>
        </section>

        {/* Full subscription editor */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-base font-bold font-cairo text-slate-800 mb-1">📝 تعديل تفصيلي</h2>
          <p className="text-xs text-slate-500 mb-5 font-cairo">
            غيّر الخطة، الحالة، تاريخ الانتهاء، أو القيمة الشهرية
          </p>

          <form action={updateAction} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">الخطة</label>
                <select
                  name="plan"
                  defaultValue={subscription.plan}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                >
                  <option value="trial">تجريبية</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">الحالة</label>
                <select
                  name="status"
                  defaultValue={subscription.status}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
                >
                  <option value="trial">تجريبية</option>
                  <option value="active">نشطة</option>
                  <option value="past_due">متأخرة الدفع</option>
                  <option value="cancelled">ملغية</option>
                  <option value="expired">منتهية</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">تاريخ الانتهاء</label>
                <input
                  type="date"
                  name="ends_at"
                  defaultValue={subscription.ends_at}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">القيمة الشهرية (ج)</label>
                <input
                  type="number"
                  name="monthly_value"
                  step="0.01"
                  min="0"
                  defaultValue={subscription.monthly_value ?? ""}
                  placeholder="1500"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-cairo">ملاحظات إدارية</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={subscription.notes ?? ""}
                placeholder="مثلًا: دفع 18000 ج بنك ترانسفر يوم 12-05-2026"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold font-cairo transition shadow-md"
              >
                حفظ التعديلات
              </button>
              <Link
                href="/admin"
                className="px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition font-cairo"
              >
                إلغاء
              </Link>
            </div>
          </form>
        </section>

        {/* Per-tenant feature overrides */}
        <FeatureOverridesSection
          subscriptionId={id}
          companyId={subscription.company_id}
          plan={subscription.plan as Plan}
          overrides={overrides}
          featureSavedFlash={!!sp.feature_saved}
          overridesClearedFlash={!!sp.overrides_cleared}
          presetAppliedFlash={presetApplied}
        />
      </div>
    </main>
  );
}

// ============================================================================
// FeatureOverridesSection — per-tenant feature toggles
// ============================================================================
function FeatureOverridesSection({
  subscriptionId,
  companyId,
  plan,
  overrides,
  featureSavedFlash,
  overridesClearedFlash,
  presetAppliedFlash,
}: {
  subscriptionId: string;
  companyId: string;
  plan: Plan;
  overrides: Partial<Record<Feature, boolean>>;
  featureSavedFlash: boolean;
  overridesClearedFlash: boolean;
  presetAppliedFlash: string | null;
}) {
  const overrideCount = Object.keys(overrides).length;

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-base font-bold font-cairo text-slate-800">
            🎛 تخصيص الموديولات لهذا العميل
          </h2>
          {overrideCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-bold font-cairo">
              {overrideCount} override نشط
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 font-cairo leading-relaxed">
          عيّن إيه بالظبط اللي يظهر للعميل ده — بغض النظر عن الباقة. مفيد
          لما عميل يشتري <strong>&quot;Marketing فقط&quot;</strong> أو <strong>&quot;HR فقط&quot;</strong>{" "}
          بدل الباقة الكاملة.
        </p>
      </div>

      {/* Flash messages */}
      {featureSavedFlash && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
          ✅ تم حفظ الـ override
        </div>
      )}
      {presetAppliedFlash && (
        <div className="mb-4 p-3 rounded-lg bg-violet-50 border border-violet-200 text-violet-800 font-cairo text-sm">
          ✨ تم تطبيق preset: <strong>{presetAppliedFlash}</strong>
        </div>
      )}
      {overridesClearedFlash && (
        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-cairo text-sm">
          ✓ تم مسح كل الـ overrides — العميل دلوقتي رجع للـ defaults بتاع الـ {plan}
        </div>
      )}

      {/* Quick presets */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
        <h3 className="text-sm font-black text-violet-900 mb-2 font-cairo">
          ⚡ Quick Presets — طبّق باقة جاهزة بضغطة
        </h3>
        <p className="text-xs text-violet-700 font-cairo mb-3">
          الـ preset بيـ overrride كل الـ features دفعة واحدة. أي حاجة مش
          في الـ preset بتترسم disabled.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {FEATURE_PRESETS.map((preset) => (
            <form key={preset.key} action={applyTenantFeaturePreset}>
              <input type="hidden" name="subscription_id" value={subscriptionId} />
              <input type="hidden" name="company_id" value={companyId} />
              <input type="hidden" name="preset_key" value={preset.key} />
              <button
                type="submit"
                className="w-full text-right p-3 rounded-lg bg-white border border-violet-200 hover:border-violet-400 hover:shadow transition group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black font-cairo text-slate-800 group-hover:text-violet-700 transition">
                      {preset.label}
                    </div>
                    <div className="text-[11px] text-slate-500 font-cairo leading-snug mt-0.5">
                      {preset.description}
                    </div>
                  </div>
                </div>
              </button>
            </form>
          ))}
        </div>
      </div>

      {/* Feature catalog with per-feature toggles */}
      <div className="space-y-5">
        {FEATURE_CATALOGUE.map((cat) => (
          <div key={cat.category}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{cat.icon}</span>
              <h3 className="text-sm font-black font-cairo text-slate-700">
                {cat.category}
              </h3>
            </div>
            <div className="space-y-2">
              {cat.features.map((f) => {
                const override = overrides[f.key];
                const isOverridden = override !== undefined;
                // What the tenant ACTUALLY sees right now
                const finalState = isOverridden
                  ? override
                  : hasFeature(plan, f.key);
                // What they'd see WITHOUT the override (tier default)
                const tierDefault = hasFeature(plan, f.key);
                return (
                  <FeatureRow
                    key={f.key}
                    subscriptionId={subscriptionId}
                    companyId={companyId}
                    featureKey={f.key}
                    label={f.label}
                    description={f.description}
                    finalState={finalState}
                    tierDefault={tierDefault}
                    override={override}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Clear all overrides */}
      {overrideCount > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-rose-600 hover:text-rose-800 font-cairo">
            🗑 مسح كل الـ overrides ({overrideCount}) → العميل يرجع للـ defaults
            بتاع الـ {plan}
          </summary>
          <form
            action={clearTenantFeatureOverrides}
            className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg"
          >
            <input
              type="hidden"
              name="subscription_id"
              value={subscriptionId}
            />
            <input type="hidden" name="company_id" value={companyId} />
            <p className="text-xs text-rose-700 font-cairo mb-2">
              ⚠ ده هيمسح كل الـ {overrideCount} overrides اللي عندك للعميل
              ده. هيرجع يشوف اللي الباقة بتديه افتراضياً.
            </p>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold font-cairo"
            >
              تأكيد المسح
            </button>
          </form>
        </details>
      )}
    </section>
  );
}

function FeatureRow({
  subscriptionId,
  companyId,
  featureKey,
  label,
  description,
  finalState,
  tierDefault,
  override,
}: {
  subscriptionId: string;
  companyId: string;
  featureKey: Feature;
  label: string;
  description: string;
  finalState: boolean;
  tierDefault: boolean;
  override: boolean | undefined;
}) {
  const isOverridden = override !== undefined;
  return (
    <div
      className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
        isOverridden
          ? finalState
            ? "bg-emerald-50/50 border-emerald-200"
            : "bg-rose-50/50 border-rose-200"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-bold text-slate-800 font-cairo">
            {label}
          </div>
          {isOverridden ? (
            override ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold font-cairo">
                🔓 Override: ON
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold font-cairo">
                🔒 Override: OFF
              </span>
            )
          ) : (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${
                tierDefault
                  ? "bg-slate-200 text-slate-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {tierDefault ? "✓ من الباقة" : "✗ من الباقة"}
            </span>
          )}
        </div>
        {description && (
          <div className="text-[11px] text-slate-500 font-cairo mt-0.5">
            {description}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 shrink-0">
        <ToggleButton
          subscriptionId={subscriptionId}
          companyId={companyId}
          featureKey={featureKey}
          action="enable"
          active={isOverridden && override === true}
          label="ON"
        />
        <ToggleButton
          subscriptionId={subscriptionId}
          companyId={companyId}
          featureKey={featureKey}
          action="disable"
          active={isOverridden && override === false}
          label="OFF"
        />
        <ToggleButton
          subscriptionId={subscriptionId}
          companyId={companyId}
          featureKey={featureKey}
          action="inherit"
          active={!isOverridden}
          label="↺ تبع الباقة"
        />
      </div>
    </div>
  );
}

function ToggleButton({
  subscriptionId,
  companyId,
  featureKey,
  action,
  active,
  label,
}: {
  subscriptionId: string;
  companyId: string;
  featureKey: Feature;
  action: "enable" | "disable" | "inherit";
  active: boolean;
  label: string;
}) {
  const cls = {
    enable: active
      ? "bg-emerald-600 text-white border-emerald-700"
      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    disable: active
      ? "bg-rose-600 text-white border-rose-700"
      : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50",
    inherit: active
      ? "bg-slate-700 text-white border-slate-800"
      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
  }[action];

  return (
    <form action={setTenantFeatureOverride}>
      <input type="hidden" name="subscription_id" value={subscriptionId} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="feature_key" value={featureKey} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className={`px-2.5 py-1 rounded text-[11px] font-bold font-cairo border transition ${cls}`}
      >
        {label}
      </button>
    </form>
  );
}
