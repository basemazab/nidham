export function BridgeMockup() {
  const rows = [
    { name: "أحمد محمد", attendance: 95, interactions: 24, status: "ok" },
    { name: "محمد علي", attendance: 88, interactions: 18, status: "ok" },
    { name: "هند سامي", attendance: 72, interactions: 9, status: "warn" },
    { name: "كريم أحمد", attendance: 91, interactions: 31, status: "ok" },
  ];
  const maxInter = Math.max(...rows.map((r) => r.interactions));

  return (
    <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" direction="ltr" className="w-full h-auto" role="img" aria-label="Bridge Analytics dashboard mockup">
      <rect x="0" y="0" width="400" height="240" rx="10" fill="#ffffff" stroke="#e2e8f0" />
      <rect x="0" y="0" width="400" height="36" rx="10" fill="#0a1428" />
      <rect x="0" y="20" width="400" height="16" fill="#0a1428" />
      <text x="380" y="23" fill="#22d3ee" fontSize="11" fontWeight="700" textAnchor="end" fontFamily="sans-serif">Bridge Analytics</text>
      <text x="380" y="14" fill="#c9a84c" fontSize="8" textAnchor="end" fontFamily="sans-serif">June 2026</text>
      <circle cx="14" cy="18" r="4" fill="#ef4444" opacity="0.6" />
      <circle cx="26" cy="18" r="4" fill="#f59e0b" opacity="0.6" />
      <circle cx="38" cy="18" r="4" fill="#10b981" opacity="0.6" />
      <line x1="0" y1="56" x2="400" y2="56" stroke="#f1f5f9" />
      <text x="380" y="51" fill="#475569" fontSize="9" textAnchor="end" fontWeight="700" fontFamily="sans-serif">الاسم</text>
      <text x="270" y="51" fill="#475569" fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="sans-serif">حضور</text>
      <text x="200" y="51" fill="#475569" fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="sans-serif">تفاعلات</text>
      <text x="50" y="51" fill="#475569" fontSize="9" textAnchor="start" fontWeight="700" fontFamily="sans-serif">الحالة</text>
      {rows.map((r, i) => {
        const y = 70 + i * 22;
        return (
          <g key={r.name}>
            <line x1="0" y1={y + 12} x2="400" y2={y + 12} stroke="#f8fafc" />
            <text x="380" y={y + 4} fill="#1e293b" fontSize="10" textAnchor="end" fontFamily="sans-serif">{r.name}</text>
            <text x="270" y={y + 4} fill="#0891b2" fontSize="10" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">{r.attendance}%</text>
            <text x="200" y={y + 4} fill="#1e293b" fontSize="10" textAnchor="middle" fontFamily="sans-serif">{r.interactions}</text>
            <rect x="14" y={y - 6} width="58" height="14" rx="7" fill={r.status === "ok" ? "#dcfce7" : "#fef3c7"} />
            <text x="43" y={y + 4} fill={r.status === "ok" ? "#15803d" : "#92400e"} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">
              {r.status === "ok" ? "منتج" : "مراجعة"}
            </text>
          </g>
        );
      })}
      <line x1="14" y1="200" x2="386" y2="200" stroke="#cbd5e1" />
      {rows.map((r, i) => {
        const h = (r.interactions / maxInter) * 26;
        const x = 50 + i * 80;
        return (
          <g key={`bar-${i}`}>
            <rect x={x} y={200 - h} width="40" height={h} rx="2" fill="#22d3ee" opacity="0.85" />
            <text x={x + 20} y={216} fontSize="8" fill="#64748b" textAnchor="middle" fontFamily="sans-serif">{r.name.split(" ")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function PayslipMockup() {
  return (
    <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" direction="ltr" className="w-full h-auto" role="img" aria-label="Payslip mockup">
      <rect x="0" y="0" width="400" height="240" rx="10" fill="#ffffff" stroke="#e2e8f0" />
      <rect x="0" y="0" width="400" height="56" rx="10" fill="#fef7e0" />
      <rect x="0" y="40" width="400" height="16" fill="#fef7e0" />
      <text x="380" y="22" fontSize="13" fill="#0a1428" fontWeight="900" textAnchor="end" fontFamily="sans-serif">قسيمة راتب</text>
      <text x="380" y="38" fontSize="11" fill="#475569" textAnchor="end" fontFamily="sans-serif">أحمد محمد · مارس 2026</text>
      <text x="20" y="22" fontSize="9" fill="#c9a84c" fontWeight="700" fontFamily="sans-serif">NIDHAM</text>
      <text x="20" y="34" fontSize="7" fill="#94a3b8" fontFamily="sans-serif">EMP-0142</text>
      <text x="380" y="84" fontSize="10" fill="#475569" textAnchor="end" fontFamily="sans-serif">مرتب أساسي</text>
      <text x="20" y="84" fontSize="10" fill="#1e293b" fontWeight="700" fontFamily="sans-serif">8,000 ج</text>
      <line x1="14" y1="93" x2="386" y2="93" stroke="#f1f5f9" />
      <text x="380" y="110" fontSize="10" fill="#475569" textAnchor="end" fontFamily="sans-serif">تأمينات اجتماعية (14%)</text>
      <text x="20" y="110" fontSize="10" fill="#dc2626" fontFamily="sans-serif">-1,120 ج</text>
      <line x1="14" y1="119" x2="386" y2="119" stroke="#f1f5f9" />
      <text x="380" y="136" fontSize="10" fill="#475569" textAnchor="end" fontFamily="sans-serif">ضريبة الدخل (شرائح 2024)</text>
      <text x="20" y="136" fontSize="10" fill="#dc2626" fontFamily="sans-serif">-467 ج</text>
      <line x1="14" y1="145" x2="386" y2="145" stroke="#f1f5f9" />
      <rect x="14" y="155" width="372" height="40" rx="8" fill="#0a1428" />
      <text x="372" y="172" fontSize="11" fill="#22d3ee" fontWeight="700" textAnchor="end" fontFamily="sans-serif">صافي الراتب</text>
      <text x="372" y="188" fontSize="14" fill="#c9a84c" fontWeight="900" textAnchor="end" fontFamily="sans-serif">6,413 ج</text>
      <text x="28" y="180" fontSize="10" fill="#ffffff" fontFamily="sans-serif" fontWeight="700">NET</text>
      <rect x="270" y="210" width="116" height="22" rx="6" fill="#22d3ee" />
      <text x="328" y="225" fontSize="10" fill="#0a1428" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">📄 تصدير PDF</text>
      <text x="20" y="225" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">يتم احتساب جميع الخصومات تلقائياً</text>
    </svg>
  );
}

export function MobileAttendanceMockup() {
  return (
    <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" direction="ltr" className="w-full h-auto" role="img" aria-label="Mobile attendance mockup">
      <rect x="0" y="0" width="400" height="240" rx="10" fill="#f8fafc" />
      <g transform="translate(132, 8)">
        <rect x="0" y="0" width="136" height="226" rx="22" fill="#0a1428" />
        <rect x="6" y="20" width="124" height="200" rx="14" fill="#ffffff" />
        <rect x="56" y="10" width="24" height="4" rx="2" fill="#1e293b" />
        <circle cx="100" cy="12" r="2" fill="#1e293b" />
        <text x="12" y="32" fontSize="6" fill="#64748b" fontFamily="sans-serif" fontWeight="700">10:24</text>
        <text x="124" y="32" fontSize="6" fill="#64748b" textAnchor="end" fontFamily="sans-serif">📶 100%</text>
        <text x="68" y="46" fontSize="9" fill="#0a1428" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">تثبيت الحضور</text>
        <rect x="14" y="52" width="108" height="80" rx="6" fill="#e0f2fe" />
        <line x1="14" y1="78" x2="122" y2="78" stroke="#bae6fd" strokeWidth="2" />
        <line x1="14" y1="100" x2="122" y2="100" stroke="#bae6fd" strokeWidth="2" />
        <line x1="40" y1="52" x2="40" y2="132" stroke="#bae6fd" strokeWidth="2" />
        <line x1="90" y1="52" x2="90" y2="132" stroke="#bae6fd" strokeWidth="2" />
        <circle cx="68" cy="92" r="22" fill="#22d3ee" opacity="0.18" />
        <circle cx="68" cy="92" r="22" fill="none" stroke="#0891b2" strokeWidth="1.2" strokeDasharray="2 2" />
        <circle cx="68" cy="92" r="6" fill="#dc2626" />
        <circle cx="68" cy="92" r="2" fill="#ffffff" />
        <rect x="20" y="140" width="96" height="20" rx="10" fill="#dcfce7" />
        <text x="68" y="153" fontSize="7" fill="#15803d" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">✓ داخل نطاق المكتب</text>
        <rect x="20" y="170" width="96" height="32" rx="10" fill="#22d3ee" />
        <text x="68" y="190" fontSize="10" fill="#0a1428" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">تسجيل دخول</text>
        <text x="68" y="214" fontSize="6" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">GPS · ±3m</text>
      </g>
      <text x="20" y="40" fontSize="9" fill="#475569" fontFamily="sans-serif" fontWeight="700">حضور بالـ GPS</text>
      <text x="20" y="56" fontSize="8" fill="#64748b" fontFamily="sans-serif">Geofence حوالين</text>
      <text x="20" y="68" fontSize="8" fill="#64748b" fontFamily="sans-serif">المكتب — مفيش</text>
      <text x="20" y="80" fontSize="8" fill="#64748b" fontFamily="sans-serif">حد يـ-clock-in</text>
      <text x="20" y="92" fontSize="8" fill="#64748b" fontFamily="sans-serif">من برّاه</text>
      <text x="380" y="40" fontSize="9" fill="#475569" textAnchor="end" fontFamily="sans-serif" fontWeight="700">±3 متر دقة</text>
      <text x="380" y="56" fontSize="8" fill="#64748b" textAnchor="end" fontFamily="sans-serif">يدعم iOS</text>
      <text x="380" y="68" fontSize="8" fill="#64748b" textAnchor="end" fontFamily="sans-serif">و Android</text>
    </svg>
  );
}

export function CvReviewMockup() {
  const score = 87;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" direction="ltr" className="w-full h-auto" role="img" aria-label="AI CV review mockup">
      <rect x="0" y="0" width="400" height="240" rx="10" fill="#ffffff" stroke="#e2e8f0" />
      <rect x="0" y="0" width="400" height="44" rx="10" fill="#0a1428" />
      <rect x="0" y="28" width="400" height="16" fill="#0a1428" />
      <text x="380" y="20" fontSize="11" fill="#ffffff" fontWeight="900" textAnchor="end" fontFamily="sans-serif">محمد عبدالله</text>
      <text x="380" y="34" fontSize="9" fill="#94a3b8" textAnchor="end" fontFamily="sans-serif">مهندس برمجيات · 5 سنين خبرة</text>
      <text x="20" y="20" fontSize="9" fill="#c9a84c" fontWeight="700" fontFamily="sans-serif">✦ AI CV REVIEW</text>
      <text x="20" y="34" fontSize="7" fill="#64748b" fontFamily="sans-serif">Powered by Nidham</text>
      <g transform="translate(70, 115)">
        <circle cx="0" cy="0" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
        <circle cx="0" cy="0" r={radius} stroke="#22d3ee" strokeWidth="8" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90)" />
        <text x="0" y="2" fontSize="18" fontWeight="900" fill="#0a1428" textAnchor="middle" fontFamily="sans-serif">{score}</text>
        <text x="0" y="14" fontSize="7" fill="#64748b" textAnchor="middle" fontFamily="sans-serif">/ 100</text>
      </g>
      <text x="70" y="170" fontSize="10" fill="#0891b2" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">Strong Match</text>
      <text x="380" y="62" fontSize="10" fill="#15803d" fontWeight="700" textAnchor="end" fontFamily="sans-serif">✓ نقاط القوة</text>
      <text x="380" y="78" fontSize="9" fill="#1e293b" textAnchor="end" fontFamily="sans-serif">· React + TypeScript</text>
      <text x="380" y="94" fontSize="9" fill="#1e293b" textAnchor="end" fontFamily="sans-serif">· مشاريع B2B Egypt</text>
      <text x="380" y="110" fontSize="9" fill="#1e293b" textAnchor="end" fontFamily="sans-serif">· Supabase / Postgres</text>
      <text x="380" y="138" fontSize="10" fill="#b45309" fontWeight="700" textAnchor="end" fontFamily="sans-serif">⚠ مناطق للتطوير</text>
      <text x="380" y="154" fontSize="9" fill="#1e293b" textAnchor="end" fontFamily="sans-serif">· مفيش DevOps experience</text>
      <text x="380" y="170" fontSize="9" fill="#1e293b" textAnchor="end" fontFamily="sans-serif">· مفيش mobile native</text>
      <text x="380" y="186" fontSize="9" fill="#1e293b" textAnchor="end" fontFamily="sans-serif">· إنجليزي conversational</text>
      <rect x="14" y="202" width="372" height="28" rx="8" fill="#0a1428" />
      <text x="200" y="220" fontSize="11" fill="#22d3ee" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">✦ ٥ أسئلة مقابلة مقترحة بالـ AI</text>
    </svg>
  );
}
