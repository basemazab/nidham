"use client";

// ============================================================================
// LandingPageClient — interactive layer of the public /p/[slug] route
// ============================================================================
//
// Renders the lead form + CTA buttons and handles all the side effects:
//   - page_view event on mount (with UTM/referrer captured from window)
//   - whatsapp_click / phone_click events on CTA presses
//   - form submit with friendly success/error state
//
// Session ID: stored in localStorage so a single visitor's events are
// correlated across page reloads. Generated lazily on first call.

import { useEffect, useState } from "react";
import { submitLeadForm, logLeadEvent } from "./actions";

type LandingPage = {
  slug: string;
  headline: string;
  sub_headline: string | null;
  body: string | null;
  accent_color: string;
  cta_label: string;
  cta_action: "form" | "whatsapp" | "phone" | "external_url";
  cta_target: string | null;
  form_enabled: boolean;
  form_fields: string[];
  form_submit_label: string;
  form_success_msg: string;
};

const SESSION_KEY = "nidham_lp_sid";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function readAttribution() {
  if (typeof window === "undefined") {
    return {
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_content: "",
      utm_term: "",
      referrer: "",
    };
  }
  const sp = new URLSearchParams(window.location.search);
  return {
    utm_source: sp.get("utm_source") ?? "",
    utm_medium: sp.get("utm_medium") ?? "",
    utm_campaign: sp.get("utm_campaign") ?? "",
    utm_content: sp.get("utm_content") ?? "",
    utm_term: sp.get("utm_term") ?? "",
    referrer: document.referrer ?? "",
  };
}

const FIELD_LABEL: Record<string, string> = {
  name: "الاسم بالكامل",
  phone: "رقم التليفون",
  whatsapp: "رقم الواتساب",
  email: "الإيميل",
  city: "المحافظة",
  interest: "اهتمامك الأساسي",
  budget: "الميزانية التقريبية",
  message: "رسالتك أو سؤالك",
};

const FIELD_TYPE: Record<string, string> = {
  name: "text",
  phone: "tel",
  whatsapp: "tel",
  email: "email",
  city: "text",
  interest: "text",
  budget: "text",
  message: "textarea",
};

const FIELD_PLACEHOLDER: Record<string, string> = {
  name: "أحمد محمد",
  phone: "01XXXXXXXXX",
  whatsapp: "01XXXXXXXXX",
  email: "ahmed@example.com",
  city: "القاهرة",
  interest: "نوع المنتج/الخدمة اللي يهمك",
  budget: "مثلاً: 3000-5000",
  message: "اكتبلنا اللي يهمك تعرفه",
};

export function LandingPageClient({ page }: { page: LandingPage }) {
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fire page_view exactly once on mount.
  useEffect(() => {
    const sid = getOrCreateSessionId();
    const attr = readAttribution();
    void logLeadEvent({
      slug: page.slug,
      event_type: "page_view",
      session_id: sid,
      ...attr,
    });
  }, [page.slug]);

  async function handleSubmit(formData: FormData) {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const sid = getOrCreateSessionId();
      const attr = readAttribution();
      const res = await submitLeadForm({
        slug: page.slug,
        session_id: sid,
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        whatsapp: String(formData.get("whatsapp") ?? ""),
        city: String(formData.get("city") ?? ""),
        message: String(formData.get("message") ?? ""),
        ...attr,
      });
      if (res.ok) {
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.error);
      }
    } catch {
      setErrorMsg("حصلت مشكلة. حاول تاني.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCtaClick() {
    if (!page.cta_target) return;
    const sid = getOrCreateSessionId();
    const attr = readAttribution();

    const eventType =
      page.cta_action === "whatsapp"
        ? ("whatsapp_click" as const)
        : page.cta_action === "phone"
          ? ("phone_click" as const)
          : ("external_click" as const);

    // Fire-and-forget — don't await; we want the visitor to navigate
    // ASAP without telemetry lag.
    void logLeadEvent({
      slug: page.slug,
      event_type: eventType,
      session_id: sid,
      ...attr,
      metadata: { cta_label: page.cta_label, target: page.cta_target },
    });

    // Open the appropriate URL
    let url = page.cta_target;
    if (page.cta_action === "whatsapp") {
      const digits = page.cta_target.replace(/\D/g, "");
      url = `https://wa.me/${digits}`;
    } else if (page.cta_action === "phone") {
      url = `tel:${page.cta_target}`;
    }
    if (typeof window !== "undefined") {
      if (page.cta_action === "phone") {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  }

  const accent = page.accent_color || "#0891B2";

  // Success screen replaces the whole interactive zone
  if (successMsg) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="text-6xl mb-3">✅</div>
        <h2 className="text-2xl font-black font-cairo text-slate-800 mb-2">
          تم بنجاح
        </h2>
        <p className="text-slate-600 font-cairo leading-relaxed">
          {successMsg}
        </p>
        {page.cta_action === "whatsapp" && page.cta_target && (
          <button
            type="button"
            onClick={handleCtaClick}
            style={{ backgroundColor: accent }}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold font-cairo hover:opacity-90 transition"
          >
            <span>💬</span>
            <span>افتح محادثة واتساب</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8">
      {/* Primary CTA button (non-form actions) */}
      {page.cta_action !== "form" && page.cta_target && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleCtaClick}
            style={{ backgroundColor: accent }}
            className="w-full py-4 rounded-2xl text-white font-black font-cairo text-lg shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
          >
            {page.cta_action === "whatsapp" && <span>💬</span>}
            {page.cta_action === "phone" && <span>📞</span>}
            {page.cta_action === "external_url" && <span>↗</span>}
            <span>{page.cta_label}</span>
          </button>
        </div>
      )}

      {/* Lead form */}
      {page.form_enabled && page.form_fields.length > 0 && (
        <>
          {page.cta_action !== "form" && page.cta_target && (
            <div className="text-center text-xs text-slate-400 font-cairo mb-4">
              — أو سيب بياناتك —
            </div>
          )}
          <form action={handleSubmit} className="space-y-3">
            {page.form_fields.map((field) => {
              const label = FIELD_LABEL[field] ?? field;
              const type = FIELD_TYPE[field] ?? "text";
              const placeholder = FIELD_PLACEHOLDER[field] ?? "";
              const required = field === "name";
              if (type === "textarea") {
                return (
                  <div key={field}>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                      {label}
                      {required && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      name={field}
                      rows={3}
                      required={required}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-cyan-400 outline-none text-sm font-cairo resize-y"
                    />
                  </div>
                );
              }
              return (
                <div key={field}>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                    {label}
                    {required && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type={type}
                    name={field}
                    required={required}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-cyan-400 outline-none text-sm font-cairo"
                  />
                </div>
              );
            })}

            {errorMsg && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 font-cairo">
                ⚠ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: accent }}
              className="w-full py-3 rounded-xl text-white font-black font-cairo shadow-md hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? "جاري الإرسال…" : page.form_submit_label}
            </button>

            <p className="text-[10px] text-slate-400 font-cairo text-center mt-2">
              بياناتك سرية وما تتشاركش مع طرف ثالث · Nidham
            </p>
          </form>
        </>
      )}
    </div>
  );
}
