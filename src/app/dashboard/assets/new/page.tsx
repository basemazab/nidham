// ============================================================================
// /dashboard/assets/new — Add a new asset
// ============================================================================

import Link from "next/link";
import { createAsset } from "../actions";
import { SubmitButton } from "@/components/submit-button";

type SearchParams = Promise<{ error?: string }>;

const ASSET_TYPES = [
  { value: "laptop",      label: "💻 لاب توب" },
  { value: "desktop",     label: "🖥 كمبيوتر مكتبي" },
  { value: "phone",       label: "📱 تليفون" },
  { value: "tablet",      label: "📲 تابلت" },
  { value: "monitor",     label: "🖼 شاشة" },
  { value: "printer",     label: "🖨 طابعة" },
  { value: "car",         label: "🚗 سيارة" },
  { value: "motorcycle",  label: "🏍 موتوسيكل" },
  { value: "tool",        label: "🔧 أداة / معدة" },
  { value: "uniform",     label: "👔 زي / يونيفورم" },
  { value: "sim_card",    label: "📞 خط محمول" },
  { value: "access_card", label: "🔑 بطاقة دخول" },
  { value: "other",       label: "📦 أخرى" },
];

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard/assets"
          className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
        >
          ← الرجوع للأصول
        </Link>

        <header className="mt-3 mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            ➕ أضف أصل جديد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            سجّل لاب توب / تليفون / سيارة / أي معدة عشان تقدر تتبعها وتعرف
            مين عنده كل واحد.
          </p>
        </header>

        {sp.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(sp.error)}
          </div>
        )}

        <form
          action={createAsset}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5 font-cairo"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">
                اسم الأصل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="مثلاً: لاب توب MacBook Pro 2024 — أحمد"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                النوع <span className="text-rose-500">*</span>
              </label>
              <select
                name="asset_type"
                required
                defaultValue="laptop"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                كود الأصل (Asset Tag)
              </label>
              <input
                type="text"
                name="asset_tag"
                placeholder="LAP-001"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none font-mono text-right"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">
                رقم السيريال (Serial Number)
              </label>
              <input
                type="text"
                name="serial_number"
                placeholder="C02XY12ZAB"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none font-mono text-right"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                تاريخ الشراء
              </label>
              <input
                type="date"
                name="purchase_date"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                تكلفة الشراء (ج.م)
              </label>
              <input
                type="number"
                name="purchase_cost"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                مدة الاستهلاك (سنوات)
              </label>
              <input
                type="number"
                name="depreciation_years"
                min="1"
                placeholder="3"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              ملاحظات
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="حالة الأصل، ضمان، أي تفاصيل إضافية..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan outline-none"
            />
          </div>

          <SubmitButton
            loadingText="جاري الإضافة..."
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30"
          >
            ✓ أضف الأصل
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
