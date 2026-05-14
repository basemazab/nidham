import Link from "next/link";
import { type Plan, planLabel } from "@/lib/subscriptions";

// Compact subscription-tier badge for the sidebar / header. Enterprise
// gets a gold-on-navy treatment so the customer feels the upgrade.

type Props = {
  plan: Plan;
  daysLeft?: number;
  href?: string;
};

const TIER_STYLES: Record<
  Plan,
  { wrapper: string; label: string; emoji: string }
> = {
  trial: {
    wrapper: "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200",
    label: "Trial",
    emoji: "⏳",
  },
  basic: {
    wrapper: "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100",
    label: "Basic",
    emoji: "✓",
  },
  pro: {
    wrapper:
      "bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-200 text-emerald-800 hover:from-emerald-100 hover:to-cyan-100",
    label: "Pro",
    emoji: "⚡",
  },
  enterprise: {
    wrapper:
      "bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border-amber-300 text-amber-900 shadow-md ring-1 ring-amber-200 hover:from-amber-200 hover:to-amber-200",
    label: "Enterprise",
    emoji: "👑",
  },
};

export function TierBadge({ plan, daysLeft, href = "/dashboard/subscription" }: Props) {
  const style = TIER_STYLES[plan];
  const arabic = planLabel(plan);

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold font-cairo transition ${style.wrapper}`}
    >
      <span className="text-base leading-none">{style.emoji}</span>
      <span>{style.label}</span>
      {daysLeft !== undefined && daysLeft >= 0 && daysLeft < 7 && (
        <span className="text-[10px] opacity-75 mr-1">
          · {daysLeft} {daysLeft === 1 ? "يوم" : "أيام"} {arabic}
        </span>
      )}
    </Link>
  );
}
