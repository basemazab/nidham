import type { Metadata } from "next";
import Link from "next/link";

// ============================================================================
// /embed/* — minimal layout for iframe-embeddable calculator widgets
// ============================================================================
//
// Why this exists:
//   Other Egyptian HR / accounting / finance blogs want to embed our free
//   calculators in their articles. Each embed = a "Powered by Nidham HR"
//   backlink to https://nidhamhr.com. This is one of the most powerful
//   organic backlink strategies for a SaaS — let your tool spread.
//
// Constraints vs /tools/*:
//   • No nav, no footer chrome (the host site has its own)
//   • No <html>/<body> assumptions — Next.js's root layout handles that
//   • Compact spacing (the host's container may be narrow)
//   • Mandatory "Powered by Nidham HR" attribution at the bottom
//   • robots: noindex (we don't want /embed/* competing with /tools/* in SERPs)

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-cairo bg-white p-4 sm:p-6 min-h-[400px]" dir="rtl">
      {children}

      {/* The all-important attribution — never remove this. It's the
          whole point of the embed strategy. The link goes to the tool's
          full page on nidhamhr.com so visitors can convert. */}
      <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
        Powered by{" "}
        <Link
          href="https://www.nidhamhr.com"
          target="_blank"
          rel="noopener"
          className="font-bold text-brand-cyan-dark hover:underline"
        >
          نِظام HR
        </Link>
        {" · "}
        نظام HR + Payroll + CRM مصري
      </div>
    </div>
  );
}
