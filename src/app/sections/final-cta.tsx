import Link from "next/link";

export function FinalCTASection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-cyan-dark text-white text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black mb-4 font-cairo leading-tight">خلاص. خلّي شغل HR يشتغل لوحده.</h2>
        <p className="text-lg text-cyan-50 mb-8 font-cairo leading-relaxed">14 يوم تجربة مجانية بدون كارت ائتمان. لو ما عجبكش، امسح حسابك بضغطة. ولو عجبك، استمر بسعر مناسب لحجم شركتك.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup" className="px-8 py-4 rounded-xl bg-white text-brand-cyan-dark font-black text-lg shadow-2xl hover:scale-105 transition-all font-cairo">
            ابدأ التجربة المجانية الآن
          </Link>
          <a href="https://wa.me/201055356622" target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-xl border-2 border-white/40 text-white font-bold text-lg hover:bg-white/10 transition-all font-cairo">
            💬 كلّمنا على واتساب
          </a>
        </div>
      </div>
    </section>
  );
}
