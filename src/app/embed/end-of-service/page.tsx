import { EosCalculator } from "@/app/tools/end-of-service/calculator";

export default function EmbedEosCalculatorPage() {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 mb-3 text-center">
        حاسبة مكافأة نهاية الخدمة في مصر
      </h2>
      <EosCalculator />
    </div>
  );
}
