// Best-effort translation of common Supabase / Postgres / auth error
// messages into actionable Arabic. Used by every server action so the
// user sees "الإيميل ده موجود قبل كده" instead of "duplicate key value
// violates unique constraint employees_email_key".
//
// The function is intentionally pattern-based and conservative: when no
// rule matches we return a generic Arabic fallback rather than the raw
// English string (which often exposes table / column / constraint
// names). For Postgres P0001 errors (the ones our RPCs raise), the
// message is already Arabic by design, so we pass it through.

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Missing table/relation/function — most common after a feature ships
  // without the matching migration. Surfacing this clearly is critical:
  // "حاول تاني" wastes hours when the actual fix is one SQL run.
  [
    /relation .* does not exist|table .* does not exist|42P01/i,
    "الجدول مش موجود في قاعدة البيانات — لازم تطبق آخر Migration على Supabase",
  ],
  [
    /function .* does not exist|42883/i,
    "الـ function في قاعدة البيانات مش موجود — لازم تطبق آخر Migration على Supabase",
  ],
  [
    /column .* does not exist|42703/i,
    "عمود مش موجود في قاعدة البيانات — في Migration ناقصة",
  ],
  [
    /schema cache|PGRST205|PGRST204/i,
    "Supabase ما عملش refresh للـ schema — استنى دقيقة وحاول تاني، أو اعمل reload في Supabase Dashboard",
  ],

  // Postgres unique-violation errors come in two flavours -- the
  // Supabase REST one ("duplicate key value violates unique constraint")
  // and the older error code 23505.
  [/duplicate key|unique constraint|23505/i, "القيمة دي مسجّلة قبل كده"],

  // Foreign-key violation -- usually "this row is still referenced".
  [/foreign key|23503/i, "مينفعش تحذف العنصر ده -- مرتبط ببيانات تانية"],

  // NOT NULL violation -- a required field came in empty.
  [/null value in column|23502|not-null/i, "في حقل مطلوب فاضي -- راجع البيانات"],

  // CHECK constraint -- the value is outside an allowed range / enum.
  [/check constraint|23514/i, "القيمة المُدخلة مش مقبولة"],

  // RLS denied. Either the user is anon (shouldn't happen with our
  // server gates) or rows are scoped to another tenant.
  [/permission denied|RLS|row-level security|42501/i, "ملكش صلاحية على العملية دي"],

  // Auth / login specifics.
  [/invalid login credentials/i, "البريد أو كلمة السر غلط"],
  [/email not confirmed/i, "لازم تفعّل الإيميل الأول"],
  [/user already|already registered/i, "في حساب مسجّل قبل كده -- جرّب /login"],

  // Network blips.
  [/network|fetch failed|ETIMEDOUT|ECONNREFUSED/i, "مفيش اتصال بالإنترنت -- جرّب تاني"],

  // Rate limiting (Supabase Auth + our own).
  [/rate limit|too many requests/i, "حاولت كتير في وقت قصير -- استنى دقيقة"],

  // AI provider quota / API key issues
  [
    /api[_ ]?key|invalid.*key|unauthorized.*api/i,
    "مفتاح الـ AI غير صحيح — راجع GROQ_API_KEY / GEMINI_API_KEY في Vercel",
  ],
  [
    /quota|resource_exhausted|429/i,
    "وصلنا للحد اليومي للـ AI — استنى ساعة أو ضيف مفتاح ثاني (Groq أو Gemini)",
  ],
];

export function arabicizeDbError(message: string | null | undefined): string {
  if (!message) return "حصلت مشكلة غير معروفة -- حاول تاني";
  const m = String(message).trim();
  if (!m) return "حصلت مشكلة غير معروفة -- حاول تاني";

  // Our PL/pgSQL functions raise errcode P0001 with Arabic strings on
  // purpose; keep those as-is (e.g. "الكود انتهت صلاحيته").
  if (/^[؀-ۿ]/.test(m)) return m;

  for (const [pattern, replacement] of PATTERNS) {
    if (pattern.test(m)) return replacement;
  }

  // Fallback: include the first 80 chars of the raw error so an admin can
  // grep logs. Better than the opaque "حصلت مشكلة" — at least HR can
  // tell the developer what they saw.
  const snippet = m.slice(0, 80);
  return `حصلت مشكلة: ${snippet}${m.length > 80 ? "..." : ""}`;
}
