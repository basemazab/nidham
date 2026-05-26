import Link from "next/link";

// ============================================================================
// Shared nav + footer for /blog and /blog/[slug]
// ============================================================================
//
// Mirrors the visual language of /crm so visitors arriving from a Google
// search on a blog post don't feel they landed on a different site. The
// nav CTAs point at /signup?plan=crm-starter because most blog readers
// arriving from SEO are top-of-funnel — CRM is the lower-commitment entry
// than a full HR plan.

export function BlogNav() {
  return (
    <nav className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white/85 backdrop-blur sticky top-0 z-20">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center shadow-md">
          <span className="text-xl font-black text-white font-display">ن</span>
        </div>
        <span className="text-xl font-black text-slate-900">نِظام HR</span>
      </Link>
      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
        <Link href="/product" className="hover:text-slate-900">المنتج</Link>
        <Link href="/pricing" className="hover:text-slate-900">الأسعار</Link>
        <Link href="/crm" className="hover:text-slate-900">CRM</Link>
        <Link href="/tools" className="hover:text-slate-900">أدوات مجانية</Link>
        <Link href="/blog" className="hover:text-slate-900">المدونة</Link>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="hidden md:inline-block px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
        >
          دخول
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white text-sm font-bold shadow-md hover:shadow-lg transition"
        >
          ابدأ مجاناً
        </Link>
      </div>
    </nav>
  );
}

// ── Footer — uses the brand-navy to mirror the rest of the marketing site
export function BlogFooter() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center">
              <span className="text-base font-black text-white font-display">ن</span>
            </div>
            <span className="font-black text-slate-900">نِظام HR</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            نظام HR + Payroll + CRM + AI للشركات المصرية. متوافق مع قانون
            العمل 12/2003 والتأمينات 148/2019.
          </p>
        </div>
        <div>
          <div className="font-bold text-slate-900 mb-3">المنتج</div>
          <ul className="space-y-2 text-slate-600">
            <li><Link href="/product" className="hover:text-brand-cyan-dark">HR + Payroll</Link></li>
            <li><Link href="/crm" className="hover:text-brand-cyan-dark">CRM</Link></li>
            <li><Link href="/pricing" className="hover:text-brand-cyan-dark">الأسعار</Link></li>
            <li><Link href="/industries" className="hover:text-brand-cyan-dark">القطاعات</Link></li>
            <li><Link href="/integrations" className="hover:text-brand-cyan-dark">التكاملات</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold text-slate-900 mb-3">الموارد</div>
          <ul className="space-y-2 text-slate-600">
            <li><Link href="/blog" className="hover:text-brand-cyan-dark">المدونة</Link></li>
            <li><Link href="/tools" className="hover:text-brand-cyan-dark">أدوات مجانية</Link></li>
            <li><Link href="/help" className="hover:text-brand-cyan-dark">المساعدة</Link></li>
            <li><Link href="/api-docs" className="hover:text-brand-cyan-dark">API Docs</Link></li>
            <li><Link href="/customers" className="hover:text-brand-cyan-dark">العملاء</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold text-slate-900 mb-3">الشركة</div>
          <ul className="space-y-2 text-slate-600">
            <li><Link href="/about" className="hover:text-brand-cyan-dark">عن نِظام</Link></li>
            <li><Link href="/contact" className="hover:text-brand-cyan-dark">تواصل</Link></li>
            <li><Link href="/security" className="hover:text-brand-cyan-dark">الأمان</Link></li>
            <li><Link href="/privacy" className="hover:text-brand-cyan-dark">الخصوصية</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} نِظام HR · مصر · جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
