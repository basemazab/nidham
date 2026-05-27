import Link from "next/link";
import { requireHRPage } from "@/lib/permissions";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function MarketingInboxSettingsPage() {
  const { supabase, profile } = await requireHRPage();

  const { data: settings } = await supabase
    .from("marketing_inbox_settings")
    .select(
      "channel_messenger, channel_instagram, meta_page_id, meta_page_token, meta_app_secret, meta_verify_token, meta_instagram_id, ai_enabled, ai_system_prompt, ai_business_context, auto_push_to_crm",
    )
    .eq("company_id", profile.company_id)
    .maybeSingle();

  // Compute the webhook URL based on the current site URL
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.nidhamhr.com").replace(
    /\/$/,
    "",
  );
  const webhookUrl = `${SITE}/api/webhooks/meta-messages`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/marketing/inbox"
          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          ← الصندوق
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">
          ⚙️ إعدادات Marketing Inbox
        </h1>
      </div>

      {/* Setup guide */}
      <div className="mb-6 p-5 rounded-xl bg-cyan-50 border border-cyan-200">
        <div className="font-black text-cyan-900 mb-3">
          📋 خطوات الإعداد في Meta Developer Portal
        </div>
        <ol className="space-y-2 text-sm text-cyan-900 list-decimal pr-5">
          <li>
            افتح{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener"
              className="underline font-bold"
            >
              developers.facebook.com/apps
            </a>{" "}
            وأنشئ App جديد (Type: Business).
          </li>
          <li>
            ضيف Product: <strong>Messenger</strong> +{" "}
            <strong>Instagram</strong> (لو محتاج).
          </li>
          <li>
            في <strong>Webhooks</strong> → ضيف Callback URL:
            <div className="mt-2 p-2 bg-white rounded font-mono text-xs break-all border border-cyan-300">
              {webhookUrl}
            </div>
          </li>
          <li>
            <strong>Verify Token:</strong> اخترعه إنت — أي string عشوائي طويل
            (مثلاً 32 حرف). الصقه في حقل "Meta Verify Token" تحت.
          </li>
          <li>
            اشترك في events:{" "}
            <code className="bg-white px-1 rounded">messages</code>،{" "}
            <code className="bg-white px-1 rounded">messaging_postbacks</code>
          </li>
          <li>
            ارجع لـ Settings → Basic → انسخ <strong>App Secret</strong> هنا.
          </li>
          <li>
            في Messenger → Settings: اختار Facebook Page بتاعتك → انسخ{" "}
            <strong>Page Access Token</strong> + <strong>Page ID</strong>.
          </li>
          <li>
            ارجع هنا، الصقهم في الحقول، احفظ.
          </li>
        </ol>
        <div className="mt-4 text-xs text-cyan-700">
          💡 الـ App في Meta لازم يكون <strong>Live mode</strong> عشان يستقبل
          رسائل من مستخدمين حقيقيين (مش Test mode).
        </div>
      </div>

      {/* The form */}
      <SettingsForm
        defaultValues={{
          channel_messenger: settings?.channel_messenger ?? true,
          channel_instagram: settings?.channel_instagram ?? false,
          meta_page_id: settings?.meta_page_id || "",
          meta_page_token: settings?.meta_page_token || "",
          meta_app_secret: settings?.meta_app_secret || "",
          meta_verify_token: settings?.meta_verify_token || "",
          meta_instagram_id: settings?.meta_instagram_id || "",
          ai_enabled: settings?.ai_enabled ?? false,
          ai_system_prompt: settings?.ai_system_prompt || "",
          ai_business_context: settings?.ai_business_context || "",
          auto_push_to_crm: settings?.auto_push_to_crm ?? true,
        }}
      />
    </div>
  );
}
