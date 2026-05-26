import { SalaryCalculator } from "@/app/tools/salary-calculator/calculator";

// ============================================================================
// /embed/salary-calculator — iframe-embeddable Egyptian salary calculator
// ============================================================================

export default function EmbedSalaryCalculatorPage() {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-3 text-center">
        حاسبة مرتب موظف في مصر 2026
      </h2>
      <SalaryCalculator />
    </div>
  );
}
