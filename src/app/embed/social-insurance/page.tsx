import { InsuranceCalculator } from "@/app/tools/social-insurance/calculator";

export default function EmbedInsuranceCalculatorPage() {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-3 text-center">
        حاسبة التأمينات الاجتماعية في مصر 2026
      </h2>
      <InsuranceCalculator />
    </div>
  );
}
