"use client";

import { useState, useTransition } from "react";
import { saveSettings, testWebhookConnection } from "../actions";

type Defaults = {
  channel_messenger: boolean;
  channel_instagram: boolean;
  meta_page_id: string;
  meta_page_token: string;
  meta_app_secret: string;
  meta_verify_token: string;
  meta_instagram_id: string;
  ai_enabled: boolean;
  ai_system_prompt: string;
  ai_business_context: string;
  auto_push_to_crm: boolean;
};

function generateVerifyToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export function SettingsForm({ defaultValues }: { defaultValues: Defaults }) {
  const [verifyToken, setVerifyToken] = useState(defaultValues.meta_verify_token);
  const [aiEnabled, setAiEnabled] = useState(defaultValues.ai_enabled);
  const [result, setResult] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await saveSettings(formData);
      setResult(res);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Channels */}
      <section className="p-5 rounded-xl bg-white border border-slate-200">
        <h2 className="font-black text-lg text-slate-900 mb-4">
          القنوات المُفعَّلة
        </h2>
        <div className="space-y-3">
          <Checkbox
            name="channel_messenger"
            defaultChecked={defaultValues.channel_messenger}
            label="Facebook Messenger"
            description="استقبال رسائل من Facebook Page"
          />
          <Checkbox
            name="channel_instagram"
            defaultChecked={defaultValues.channel_instagram}
            label="Instagram DMs"
            description="استقبال رسائل من Instagram Business account المرتبط بـ Facebook Page"
          />
        </div>
      </section>

      {/* Meta tokens */}
      <section className="p-5 rounded-xl bg-white border border-slate-200">
        <h2 className="font-black text-lg text-slate-900 mb-4">
          🔐 بيانات Meta
        </h2>

        <Input
          name="meta_page_id"
          label="Facebook Page ID"
          defaultValue={defaultValues.meta_page_id}
          placeholder="1034426136430979"
          required
          dir="ltr"
        />

        <Input
          name="meta_page_token"
          label="Page Access Token"
          defaultValue={defaultValues.meta_page_token}
          placeholder="EAAxxx..."
          required
          dir="ltr"
          monospace
        />

        <Input
          name="meta_app_secret"
          label="App Secret"
          defaultValue={defaultValues.meta_app_secret}
          placeholder="من Settings → Basic في Meta Developer Portal"
          required
          dir="ltr"
          monospace
        />

        <div className="mt-4">
          <label className="block text-sm font-bold text-slate-900 mb-1">
            Verify Token <span className="text-rose-600">*</span>
          </label>
          <div className="flex gap-2">
            <input
              name="meta_verify_token"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              dir="ltr"
              placeholder="اضغط 'توليد' لإنشاء واحد عشوائي"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:border-brand-cyan outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setVerifyToken(generateVerifyToken())}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800"
            >
              🎲 توليد
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            استخدم نفس الـ token في Meta Webhooks Setup عشان handshake يشتغل.
          </p>
        </div>

        <Input
          name="meta_instagram_id"
          label="Instagram Business ID (اختياري)"
          defaultValue={defaultValues.meta_instagram_id}
          placeholder="17841402..."
          dir="ltr"
        />
      </section>

      {/* AI */}
      <section className="p-5 rounded-xl bg-white border border-slate-200">
        <h2 className="font-black text-lg text-slate-900 mb-4">
          🤖 الرد التلقائي بـ AI
        </h2>

        <Checkbox
          name="ai_enabled"
          defaultChecked={defaultValues.ai_enabled}
          label="فعّل AI Auto-Reply"
          description="الـ AI هيرد على الرسائل تلقائياً بالعامية المصرية + يصنّف العميل"
          onChange={(v) => setAiEnabled(v)}
        />

        {aiEnabled && (
          <>
            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-900 mb-1">
                معلومات الشركة (للـ AI)
              </label>
              <textarea
                name="ai_business_context"
                defaultValue={defaultValues.ai_business_context}
                rows={6}
                placeholder="مثال: نِظام HR — نظام HR مصري. الأسعار: 749 / 2,430 / 5,990 جنيه/شهر..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-brand-cyan outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                اللي تكتبه هنا، الـ AI هيستخدمه يرد على الأسئلة. سيبه فاضي
                لو شركتك Nidham HR (الـ default).
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-900 mb-1">
                System Prompt مخصص (اختياري — متخصصين فقط)
              </label>
              <textarea
                name="ai_system_prompt"
                defaultValue={defaultValues.ai_system_prompt}
                rows={4}
                placeholder="سيبه فاضي للـ default — أو اكتب persona مخصصة"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-brand-cyan outline-none font-mono"
              />
            </div>
          </>
        )}
      </section>

      {/* CRM */}
      <section className="p-5 rounded-xl bg-white border border-slate-200">
        <h2 className="font-black text-lg text-slate-900 mb-4">
          🎯 CRM Integration
        </h2>
        <Checkbox
          name="auto_push_to_crm"
          defaultChecked={defaultValues.auto_push_to_crm}
          label="إضافة العملاء المؤهلين تلقائياً للـ CRM"
          description="لما الـ AI يصنّف عميل كـ Hot أو Warm، يتم إنشاؤه في صفحة العملاء تلقائياً."
        />
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan disabled:opacity-50 transition"
        >
          {pending ? "بيحفظ..." : "💾 حفظ الإعدادات"}
        </button>
        {result?.ok && (
          <span className="text-emerald-700 text-sm font-bold">
            ✓ تم الحفظ
          </span>
        )}
        {result && !result.ok && (
          <span className="text-rose-700 text-sm font-bold">
            ⚠️ {result.error}
          </span>
        )}
      </div>

      {/* Test connection */}
      <ConnectionTest />
    </form>
  );
}

// ── Sub-components ──

function Input({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  dir,
  monospace,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
  dir?: "rtl" | "ltr";
  monospace?: boolean;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <label className="block text-sm font-bold text-slate-900 mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        dir={dir}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 outline-none ${monospace ? "font-mono" : ""}`}
      />
    </div>
  );
}

function ConnectionTest() {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; pageName: string; conversationCount: number; lastMessageAt: string | null }
    | { status: "error"; error: string }
  >({ status: "idle" });

  function handleTest() {
    setState({ status: "loading" });
    testWebhookConnection().then((res) => {
      if (res.ok) {
        setState({ status: "success", pageName: res.pageName, conversationCount: res.conversationCount, lastMessageAt: res.lastMessageAt });
      } else {
        setState({ status: "error", error: res.error });
      }
    });
  }

  return (
    <section className="p-5 rounded-xl bg-white border border-slate-200">
      <h2 className="font-black text-lg text-slate-900 mb-4">
        🔍 اختبار الاتصال
      </h2>
      <button
        type="button"
        onClick={handleTest}
        disabled={state.status === "loading"}
        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition"
      >
        {state.status === "loading" ? "..." : "🧪 اختبر الاتصال بـ Meta"}
      </button>

      {state.status === "success" && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <span>✅</span>
            <span className="font-bold">اتصال ناجح</span>
          </div>
          <p>اسم الصفحة: {state.pageName}</p>
          <p>عدد المحادثات: {state.conversationCount}</p>
          {state.lastMessageAt ? (
            <p>آخر رسالة: {new Date(state.lastMessageAt).toLocaleString("ar-EG")}</p>
          ) : (
            <p className="text-amber-700">⚠️ مفيش رسائل وصلت — تأكد إن الـ Webhook مضبوط في Meta</p>
          )}
        </div>
      )}
      {state.status === "error" && (
        <div className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          ❌ {state.error}
        </div>
      )}
    </section>
  );
}

function Checkbox({
  name,
  defaultChecked,
  label,
  description,
  onChange,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  description?: string;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
      />
      <div className="flex-1">
        <div className="font-bold text-slate-900 text-sm">{label}</div>
        {description && (
          <div className="text-xs text-slate-600 mt-0.5">{description}</div>
        )}
      </div>
    </label>
  );
}
