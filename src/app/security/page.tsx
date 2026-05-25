// ============================================================================
// /security — Security + Compliance details (الأمان + الامتثال)
// ============================================================================
//
// For the buyer's IT person + CFO. They want specific answers, not
// marketing fluff:
//   - Where is my data physically?
//   - What encryption?
//   - Who has access?
//   - What if you go bankrupt?
//   - SLA enforcement?

import Link from "next/link";

export const metadata = {
  title: "الأمان + الامتثال | نِظام",
  description:
    "تفاصيل الأمان والـ compliance في Nidham — تشفير AES-256، 2FA، Audit Log، Backup يومي، PDPL 151/2020 + قانون العمل 12/2003.",
};

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        <header className="mb-10 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold mb-3 font-cairo">
            🔒 Security First
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            الأمان + الامتثال
          </h1>
          <p className="text-lg text-slate-600 font-cairo max-w-2xl mx-auto">
            بياناتك أأمن من Excel على الموبايل بكتير. تفاصيل تقنية للـ IT
            team + CFO.
          </p>
        </header>

        {/* Top-level pillars */}
        <section className="grid md:grid-cols-3 gap-4 mb-12">
          <Pillar
            emoji="🔐"
            title="تشفير AES-256"
            sub="على الـ disk + in-transit"
          />
          <Pillar
            emoji="🛡"
            title="2FA إجباري"
            sub="لكل admin"
          />
          <Pillar
            emoji="📋"
            title="Audit Log"
            sub="Immutable hash chain"
          />
        </section>

        {/* Detailed sections */}
        <article className="space-y-8">

          <Section title="1. تشفير البيانات">
            <p>
              <strong>التشفير على مستويين:</strong>
            </p>
            <ul>
              <li>
                <strong>Disk encryption:</strong> Supabase بيخزّن قاعدة البيانات
                على AWS EBS مع AES-256 encryption. الـ disk نفسه مشفّر.
              </li>
              <li>
                <strong>PII encryption (مستوى التطبيق):</strong> الحقول الحساسة
                — الرقم القومي، رقم التأمينات، بيانات البنك — مشفّرة بـ{" "}
                <code>pgp_sym_encrypt</code> على مستوى application قبل ما تتسجّل.
                يعني حتى Nidham staff ما عندهمش وصول لـ plaintext.
              </li>
              <li>
                <strong>In-transit:</strong> كل اتصال بـ HTTPS / TLS 1.3 إلزامي.
                مفيش HTTP أبداً.
              </li>
            </ul>
          </Section>

          <Section title="2. الـ Authentication + Access Control">
            <ul>
              <li>
                <strong>كلمات السر:</strong> bcrypt hash مع salt — مفيش حد
                (حتى Nidham) يقدر يقرأ كلمة السر بتاعتك.
              </li>
              <li>
                <strong>Two-Factor Authentication (2FA):</strong> إجباري لكل
                الـ admins. بيشتغل بـ TOTP (Google Authenticator / Authy /
                1Password).
              </li>
              <li>
                <strong>Role-Based Access Control (RBAC):</strong> 3 أدوار
                أساسية — admin / manager / employee — كل واحد عنده permissions
                مختلفة بقاعدة "least privilege".
              </li>
              <li>
                <strong>Row-Level Security (RLS):</strong> على مستوى قاعدة
                البيانات نفسها. حتى لو شخص اخترق الـ application layer، RLS
                بيمنعه من قراءة بيانات شركة تانية.
              </li>
              <li>
                <strong>Session timeout:</strong> الـ sessions بتنتهي بعد 24
                ساعة من عدم النشاط — بتقلل خطر الـ "left logged in" attacks.
              </li>
            </ul>
          </Section>

          <Section title="3. Audit Log Immutable">
            <p>
              كل عملية حساسة (إنشاء موظف، تعديل راتب، إنهاء خدمة، تشغيل دورة
              مرتبات) بتتسجّل في <strong>audit_log</strong> table محصّن بـ
              <strong> hash chain</strong> — زي blockchain بس مبسّط:
            </p>
            <ul>
              <li>كل entry فيه hash للـ entry اللي قبله</li>
              <li>أي تعديل بأثر رجعي بيكسر الـ chain → بنكتشفه فوراً</li>
              <li>الـ log بيتحفظ لمدة <strong>7 سنين</strong> (قانون الضرايب)</li>
              <li>متاح للتفتيش بنقرة من dashboard</li>
            </ul>
            <p className="text-sm text-slate-600 mt-2">
              ده feature موجود حتى في الـ Free Plan — مش حصري Enterprise.
            </p>
          </Section>

          <Section title="4. Backup + Disaster Recovery">
            <ul>
              <li>
                <strong>Daily backups:</strong> Supabase بياخد snapshot يومي
                لكل قاعدة البيانات. الـ backup encrypted ومحفوظ في region تاني
                (Multi-AZ).
              </li>
              <li>
                <strong>Point-in-time recovery:</strong> Pro plan وأعلى — تقدر
                ترجع الـ database لأي لحظة في آخر 7 أيام.
              </li>
              <li>
                <strong>Disaster recovery:</strong> RTO (Recovery Time
                Objective) = 4 ساعات. RPO (Recovery Point Objective) = 1 ساعة.
              </li>
              <li>
                <strong>Customer-controlled export:</strong> تقدر تنزّل كل
                بياناتك بصيغة Excel/CSV/JSON أي وقت من الـ dashboard. مفيش
                lock-in.
              </li>
            </ul>
          </Section>

          <Section title="5. Data Residency">
            <ul>
              <li>
                <strong>Primary storage:</strong> Supabase / AWS — منطقة{" "}
                <code>ap-southeast-1 (Singapore)</code>
              </li>
              <li>
                <strong>Backup region:</strong> AWS US-East (للـ disaster recovery)
              </li>
              <li>
                <strong>CDN:</strong> Cloudflare — distributed عالمياً لكن
                البيانات الحساسة بتيجي من الـ origin مباشرة (مش cached)
              </li>
            </ul>
            <p className="text-sm text-slate-600 mt-2">
              لو شركتك محتاجة data residency في مصر تحديداً (طلب enterprise نادر)،
              عندنا on-premise option — تواصل معانا.
            </p>
          </Section>

          <Section title="6. الـ Compliance + Certifications">
            <ul>
              <li>
                ✅ <strong>قانون حماية البيانات المصري (PDPL) 151/2020</strong>{" "}
                — متوافق تماماً (راجع{" "}
                <Link href="/privacy" className="text-brand-cyan-dark hover:underline">
                  سياسة الخصوصية
                </Link>{" "}
                + signup consent flow)
              </li>
              <li>
                ✅ <strong>قانون العمل المصري 12/2003 + التأمينات 148/2019</strong>{" "}
                — كل الحسابات (مرتبات، إجازات، EOS، نماذج 1+2+6) مبنية على
                النصوص القانونية الأصلية
              </li>
              <li>
                ✅ <strong>قانون الضرايب 2026</strong> — الشرايح الجديدة مطبّقة
                (0% / 10% / 15% / 20% / 22.5%)
              </li>
              <li>
                ⏳ <strong>SOC 2 Type II</strong> — في الـ roadmap (Q4 2026)
              </li>
              <li>
                ⏳ <strong>ISO 27001</strong> — في الـ roadmap (2027)
              </li>
              <li>
                ✅ <strong>GDPR alignment</strong> — للعملاء اللي عندهم فرع
                في أوروبا
              </li>
            </ul>
          </Section>

          <Section title="7. لو Nidham أفلسنا (سيناريو الـ worst case)">
            <p>
              سؤال مشروع جداً — startup صغيرة، إيه ضماني إنكم هتفضلوا live
              لـ 5 سنين؟
            </p>
            <ul>
              <li>
                <strong>Source escrow (للـ Enterprise):</strong> الكود
                source بيتحط عند طرف ثالث محايد. لو Nidham قفلت لأي سبب،
                الـ Enterprise customers بياخدوا الـ code كامل + يقدروا
                يشغّلوه self-hosted.
              </li>
              <li>
                <strong>Data export forever:</strong> حتى لو Nidham أفلسنا
                بكرة، بياناتك بتفضل متاحة للـ export لمدة 90 يوم بعد إعلان
                الإغلاق (notification إلزامي قبل 90 يوم).
              </li>
              <li>
                <strong>Open data formats:</strong> Excel/CSV/JSON — تقدر
                تنقلها لأي نظام تاني (Bayzat / ZenHR / حتى Excel) بدون
                تعديل.
              </li>
            </ul>
          </Section>

          <Section title="8. SLA + الـ uptime">
            <table className="w-full text-sm border-collapse mt-3">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-right py-2 px-3 border border-slate-300 font-bold">
                    الباقة
                  </th>
                  <th className="text-right py-2 px-3 border border-slate-300 font-bold">
                    Uptime SLA
                  </th>
                  <th className="text-right py-2 px-3 border border-slate-300 font-bold">
                    Response Time
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 px-3 border border-slate-300">Free</td>
                  <td className="py-2 px-3 border border-slate-300">95%</td>
                  <td className="py-2 px-3 border border-slate-300">Best effort</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 border border-slate-300">Starter / Pro</td>
                  <td className="py-2 px-3 border border-slate-300">99%</td>
                  <td className="py-2 px-3 border border-slate-300">24 ساعة عمل</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 border border-slate-300">Business</td>
                  <td className="py-2 px-3 border border-slate-300">99.5%</td>
                  <td className="py-2 px-3 border border-slate-300">4 ساعات عمل</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 border border-slate-300">Enterprise</td>
                  <td className="py-2 px-3 border border-slate-300">99.9%</td>
                  <td className="py-2 px-3 border border-slate-300">1 ساعة (24/7)</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-slate-600 mt-3">
              لو خرقنا الـ uptime SLA لشهر، بنرجّع 10% من قيمة الاشتراك الشهري
              كـ credit للشهر التالي (تفاصيل في{" "}
              <Link href="/terms" className="text-brand-cyan-dark hover:underline">
                الشروط والأحكام
              </Link>
              ).
            </p>
          </Section>

          <Section title="9. Reporting security issues">
            <p>
              لو لقيت bug أمني، ابعتلنا فوراً قبل ما تنشر:
            </p>
            <ul>
              <li>📧 <code>nidhamhr@proton.me</code> — اكتب في الـ subject "SECURITY"</li>
              <li>هنرد خلال 24 ساعة + Fix خلال 72 ساعة للـ critical issues</li>
              <li>
                Responsible disclosure: لو ساعدتنا، بنذكر اسمك في صفحة الـ
                acknowledgments + هدية رمزية
              </li>
            </ul>
          </Section>

        </article>

        <footer className="mt-12 text-center pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-cairo">
            Last security review: 25 مايو 2026 · بنحدّث الصفحة دي كل ربع
          </p>
        </footer>
      </div>
    </main>
  );
}

function Pillar({
  emoji,
  title,
  sub,
}: {
  emoji: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-emerald-200 text-center shadow-sm">
      <div className="text-4xl mb-2">{emoji}</div>
      <h3 className="font-black font-cairo text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 font-cairo mt-1">{sub}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
      <h2 className="text-2xl font-black font-cairo text-slate-900 mb-4 border-r-4 border-brand-cyan pr-3">
        {title}
      </h2>
      <div className="prose prose-slate max-w-none font-cairo text-slate-700 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
