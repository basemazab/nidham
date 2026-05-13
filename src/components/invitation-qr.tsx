"use client";

import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "./copy-button";

type Props = {
  token: string;
  employeeName: string;
  whatsappPhone?: string | null;
};

// Deep-link the mobile app to the claim screen with the token pre-filled.
// The scheme `nidham://` is declared in mobile/app.json. When the user
// scans the QR with their phone camera, iOS / Android recognises the
// custom scheme and either opens the installed Nidham app or, when the
// app isn't published yet, offers the user to install it.
function buildDeepLink(token: string): string {
  // expo-router resolves `nidham://(auth)/claim?token=...` to the claim
  // screen automatically once we wire useLocalSearchParams there.
  return `nidham://claim?token=${encodeURIComponent(token)}`;
}

export function InvitationQR({ token, employeeName, whatsappPhone }: Props) {
  const deepLink = buildDeepLink(token);
  const firstName = employeeName.split(/\s+/)[0] ?? employeeName;

  return (
    <div className="bg-white border border-emerald-200 rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-l from-emerald-50 via-cyan-50 to-emerald-50 px-5 py-3 border-b border-emerald-100">
        <div className="font-bold text-emerald-800 font-cairo text-sm">
          ✓ كود الدعوة جاهز — يصلح 30 يوم
        </div>
      </div>

      <div className="p-6 grid md:grid-cols-[auto_1fr] gap-6 items-center">
        {/* QR */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-white rounded-xl border-2 border-emerald-300 shadow-sm">
            <QRCodeSVG
              value={deepLink}
              size={180}
              level="M"
              bgColor="#ffffff"
              fgColor="#0a1428"
              marginSize={0}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-cairo text-center max-w-[180px]">
            صوّر بكاميرا الموبايل — هيفتح Nidham على طول
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 min-w-0">
          <div>
            <h3 className="font-black font-cairo text-slate-800 mb-1">
              ابعت لـ {firstName} طريقة من اتنين:
            </h3>
            <ul className="space-y-2 text-sm text-slate-700 font-cairo">
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-700 shrink-0">1.</span>
                <span>
                  <b>وريه الـ QR</b> — يصوّره من موبايله وهيفتح التطبيق
                  تلقائيًا.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-700 shrink-0">2.</span>
                <span>
                  <b>ابعت الكود</b> — لو الـ QR مش متاح، انسخه له على واتساب.
                </span>
              </li>
            </ul>
          </div>

          {/* Token + copy */}
          <div>
            <div className="text-[10px] text-slate-500 font-bold mb-1 font-cairo">
              كود الدعوة:
            </div>
            <div
              className="bg-slate-900 text-emerald-300 px-3 py-2 rounded-lg font-mono text-xs break-all"
              dir="ltr"
            >
              {token}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton
              text={token}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-cyan-dark text-white text-sm font-bold hover:bg-brand-cyan transition font-cairo"
              copiedClassName="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold font-cairo"
            />
            {whatsappPhone && (
              <a
                href={`https://wa.me/${whatsappPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `أهلاً ${firstName}، ده كود دعوتك لتطبيق نِظام:\n\n${token}\n\nنزّل تطبيق Nidham واختار "عندك كود دعوة من HR" وادخل الكود مع إيميل وكلمة سر من اختيارك.\n\nأو افتح اللينك ده مباشرة من الموبايل (لو التطبيق مثبت):\n${buildDeepLink(token)}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition font-cairo"
              >
                💬 ابعت على واتساب
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
