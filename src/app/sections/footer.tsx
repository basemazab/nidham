import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-brand-navy text-slate-400 px-6 py-10">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow">
              <span className="text-lg font-black text-white font-display">ن</span>
            </div>
            <div>
              <div className="text-lg font-black text-white font-cairo">نِظام</div>
              <div className="text-[10px] tracking-widest text-brand-gold font-bold">NIDHAM</div>
            </div>
          </div>
          <p className="leading-relaxed font-cairo text-slate-400">منصة HR + CRM + AI Recruitment مصرية. مبنية في دمياط، مصر — للسوق المصري والعربي.</p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 font-cairo">المنصة</h4>
          <ul className="space-y-2 font-cairo">
            <li><Link href="/signup" className="hover:text-white transition">تسجيل شركة (Cloud)</Link></li>
            <li><a href="https://wa.me/201055356622?text=أهلاً، عايز أعرف تفاصيل نسخة Nidham Enterprise" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">نسخة Enterprise (On-Premise)</a></li>
            <li><a href="https://wa.me/201055356622?text=أهلاً، عايز أعرف تفاصيل استوديو التسويق Enterprise" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 transition">✦ استوديو التسويق</a></li>
            <li><Link href="/login" className="hover:text-white transition">دخول</Link></li>
            <li><Link href="/download" className="hover:text-white transition">تطبيق الموبايل</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 font-cairo">تواصل</h4>
          <ul className="space-y-2 font-cairo">
            <li><a href="https://wa.me/201055356622" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">💬 واتساب</a></li>
            <li><a href="mailto:nidhamhr@proton.me" className="hover:text-white transition">✉ nidhamhr@proton.me</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-slate-800 flex flex-col gap-4 text-xs">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-cairo">
          <Link href="/about" className="hover:text-white transition">مين إحنا</Link><span className="text-slate-700">·</span>
          <Link href="/customers" className="hover:text-white transition">عملاؤنا</Link><span className="text-slate-700">·</span>
          <Link href="/product" className="hover:text-white transition">شوف النظام</Link><span className="text-slate-700">·</span>
          <Link href="/security" className="hover:text-white transition">الأمان</Link><span className="text-slate-700">·</span>
          <Link href="/integrations" className="hover:text-white transition">التكاملات</Link><span className="text-slate-700">·</span>
          <Link href="/api-docs" className="hover:text-white transition">API</Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-cairo border-t border-slate-800/50 pt-3">
          <Link href="/privacy" className="hover:text-white transition">سياسة الخصوصية</Link><span className="text-slate-700">·</span>
          <Link href="/terms" className="hover:text-white transition">الشروط والأحكام</Link><span className="text-slate-700">·</span>
          <Link href="/refund" className="hover:text-white transition">سياسة الاسترداد</Link><span className="text-slate-700">·</span>
          <Link href="/beta-terms" className="hover:text-white transition">شروط Beta</Link><span className="text-slate-700">·</span>
          <Link href="/help" className="hover:text-white transition">مركز المساعدة</Link><span className="text-slate-700">·</span>
          <Link href="/contact" className="hover:text-white transition">تواصل معانا</Link>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-800/50">
          <p className="font-cairo">© 2026 Nidham. كل الحقوق محفوظة.</p>
          <span className="font-mono tracking-wider text-slate-500">v1.0 · BUILT IN DAMIETTA, EGYPT</span>
        </div>
      </div>
    </footer>
  );
}
