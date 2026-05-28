import type { ReactNode } from "react";

export function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-12">
      <div className="text-sm text-brand-cyan-dark font-bold tracking-wider uppercase mb-3 font-cairo">
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-4xl font-black text-slate-800 font-cairo mb-3 leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-cairo leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function MockupCard({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
        {children}
      </div>
      <p className="px-4 py-3 text-xs text-slate-600 font-cairo leading-relaxed text-center">
        {caption}
      </p>
    </div>
  );
}

export function Quote({ text }: { text: string }) {
  return (
    <div className="border-r-4 border-brand-cyan/50 pr-4 text-slate-200 font-cairo italic">
      &quot;{text}&quot;
    </div>
  );
}

export function TableRow({ name, attendance, interactions, status, good, warn, bad }: {
  name: string; attendance: string; interactions: string; status: string;
  good?: boolean; warn?: boolean; bad?: boolean;
}) {
  const cls = good ? "text-emerald-400" : warn ? "text-amber-400" : bad ? "text-red-400" : "text-slate-300";
  return (
    <tr className="border-b border-slate-800">
      <td className="py-2 text-slate-200">{name}</td>
      <td className="py-2 text-center text-slate-300">{attendance}</td>
      <td className="py-2 text-center text-slate-300">{interactions}</td>
      <td className={`py-2 text-center font-bold ${cls}`}>{status}</td>
    </tr>
  );
}

export function AICard({ icon, title, desc, cta }: { icon: string; title: string; desc: string; cta: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-amber-300 hover:shadow-lg transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl">{icon}</div>
        <h3 className="text-lg font-black text-slate-800 font-cairo flex-1">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4 font-cairo">{desc}</p>
      <div className="text-xs text-amber-700 font-bold font-cairo">{cta}</div>
    </div>
  );
}

export function ToolCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="group bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur border border-amber-400/20 hover:border-amber-400/60 rounded-2xl p-4 transition hover:scale-105">
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="text-sm font-black font-cairo text-white mb-1 group-hover:text-amber-300 transition">{title}</h4>
      <p className="text-[11px] text-slate-400 font-cairo leading-snug">{desc}</p>
    </div>
  );
}

export function FlowCard({ num, icon, title, desc, accent }: {
  num: string; icon: string; title: string; desc: string;
  accent: "cyan" | "violet" | "rose" | "emerald";
}) {
  const accentRing: Record<string, string> = {
    cyan: "ring-cyan-400/50 from-cyan-500/20 to-cyan-500/5",
    violet: "ring-violet-400/50 from-violet-500/20 to-violet-500/5",
    rose: "ring-rose-400/50 from-rose-500/20 to-rose-500/5",
    emerald: "ring-emerald-400/50 from-emerald-500/20 to-emerald-500/5",
  };
  const numRing: Record<string, string> = {
    cyan: "bg-cyan-500/30 border-cyan-300 text-cyan-100",
    violet: "bg-violet-500/30 border-violet-300 text-violet-100",
    rose: "bg-rose-500/30 border-rose-300 text-rose-100",
    emerald: "bg-emerald-500/30 border-emerald-300 text-emerald-100",
  };
  return (
    <div className={`relative bg-gradient-to-br backdrop-blur rounded-2xl p-5 ring-1 ${accentRing[accent]}`}>
      <div className={`absolute -top-3 right-4 w-8 h-8 rounded-full border-2 font-display font-black flex items-center justify-center text-sm ${numRing[accent]}`}>
        {num}
      </div>
      <div className="text-3xl mb-2 mt-2">{icon}</div>
      <h4 className="text-base font-black font-cairo text-white mb-1">{title}</h4>
      <p className="text-xs text-slate-300 font-cairo leading-relaxed">{desc}</p>
    </div>
  );
}

export function Pill({ text }: { text: string }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold font-cairo bg-amber-500/15 border border-amber-400/30 text-amber-200">
      {text}
    </span>
  );
}

export function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="text-center bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-400/20 rounded-2xl p-4">
      <div className="text-4xl font-black font-display bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent mb-1">{big}</div>
      <div className="text-xs text-slate-300 font-cairo">{label}</div>
    </div>
  );
}

export function ProviderBadge({ text }: { text: string }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full font-mono bg-slate-800/70 border border-slate-700 text-slate-300">
      {text}
    </span>
  );
}

export function Check({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-slate-700">
      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0 mt-0.5">✓</span>
      <span>{text}</span>
    </li>
  );
}

export function CheckDark({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-slate-200">
      <span className="w-5 h-5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold flex items-center justify-center text-xs shrink-0 mt-0.5">✓</span>
      <span>{text}</span>
    </li>
  );
}

export function MobileFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 text-slate-200 font-cairo">
      <span className="w-6 h-6 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center text-brand-cyan text-xs shrink-0 mt-0.5">✓</span>
      <span>{text}</span>
    </li>
  );
}
