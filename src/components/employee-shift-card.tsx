"use client";

// Embedded on the employee detail page. Three radio modes:
//   - "none"     : clear both shift_id and rotation_id
//   - "fixed"    : pick a single shift (office / admin staff)
//   - "rotation" : pick a rotation pattern + anchor date + position
//
// The actual save happens via the assignEmployeeShift server action
// imported from /dashboard/shifts/actions.ts.

import { useState } from "react";
import { assignEmployeeShift } from "@/app/dashboard/shifts/actions";

type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
};

type Rotation = {
  id: string;
  name: string;
  cycle_days: number;
};

type Props = {
  employeeId: string;
  shifts: Shift[];
  rotations: Rotation[];
  current: {
    shift_id: string | null;
    rotation_id: string | null;
    rotation_anchor_date: string | null;
    rotation_anchor_position: number | null;
  };
  todaysShiftName: string | null;
};

export function EmployeeShiftCard({
  employeeId,
  shifts,
  rotations,
  current,
  todaysShiftName,
}: Props) {
  const initial = current.rotation_id
    ? "rotation"
    : current.shift_id
    ? "fixed"
    : "none";

  const [mode, setMode] = useState<"none" | "fixed" | "rotation">(initial);

  const action = assignEmployeeShift.bind(null, employeeId);

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 font-cairo mb-1">
            ⏱ توزيع الورديات
          </h3>
          <p className="text-xs text-slate-500 font-cairo">
            وردية ثابتة (للإدارة) أو نمط تدوير (لعمال الإنتاج)
          </p>
        </div>
        {todaysShiftName && (
          <div className="text-left">
            <div className="text-[10px] text-slate-500 font-cairo">وردية النهاردة</div>
            <div className="text-sm font-bold text-emerald-700 font-cairo">
              {todaysShiftName}
            </div>
          </div>
        )}
      </div>

      <form action={action} className="space-y-4">
        {/* Mode picker */}
        <div className="grid grid-cols-3 gap-2">
          <ModeChip
            checked={mode === "none"}
            onChange={() => setMode("none")}
            name="assignment_type"
            value="none"
            label="مفيش وردية"
            description="مش مرتبط بأي نظام دوام"
          />
          <ModeChip
            checked={mode === "fixed"}
            onChange={() => setMode("fixed")}
            name="assignment_type"
            value="fixed"
            label="وردية ثابتة"
            description="للإدارة والمكاتب"
          />
          <ModeChip
            checked={mode === "rotation"}
            onChange={() => setMode("rotation")}
            name="assignment_type"
            value="rotation"
            label="تدوير"
            description="لعمال الإنتاج"
          />
        </div>

        {mode === "fixed" && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
              الوردية
            </label>
            <select
              name="shift_id"
              defaultValue={current.shift_id ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-cairo"
            >
              <option value="">— اختار وردية —</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "rotation" && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                نمط التدوير
              </label>
              <select
                name="rotation_id"
                defaultValue={current.rotation_id ?? ""}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-cairo"
              >
                <option value="">— اختار نمط —</option>
                {rotations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (دورة {r.cycle_days} يوم)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  تاريخ المرجع (Anchor)
                </label>
                <input
                  type="date"
                  name="anchor_date"
                  defaultValue={
                    current.rotation_anchor_date ??
                    new Date().toISOString().split("T")[0]
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-cairo">
                  تاريخ موجود في النمط، الموظف كان في موقعه المحدد تحت يومها.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  موقعه في الدورة (Position)
                </label>
                <input
                  type="number"
                  name="anchor_position"
                  min="0"
                  defaultValue={current.rotation_anchor_position ?? 0}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-cairo">
                  رقم اليوم في الدورة (0 = أول يوم، 6 = يوم الراحة الأول، 7 = أول يوم وردية ثانية...).
                </p>
              </div>
            </div>
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 font-cairo leading-relaxed">
              💡 مثال: لو الـ anchor_date = اليوم، ومحمد لسه بادئ أول يوم في الوردية
              الأولى، اكتب 0. لو هو في اليوم الرابع من الوردية الثانية، اكتب 10.
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
        >
          حفظ التوزيع
        </button>
      </form>
    </section>
  );
}

function ModeChip({
  checked,
  onChange,
  name,
  value,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  label: string;
  description: string;
}) {
  return (
    <label
      className={`cursor-pointer p-3 rounded-xl border-2 transition text-right ${
        checked
          ? "border-brand-cyan bg-brand-cyan/5 ring-2 ring-brand-cyan/30"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div className="font-bold text-sm text-slate-800 font-cairo">{label}</div>
      <div className="text-[10px] text-slate-500 font-cairo mt-0.5">{description}</div>
    </label>
  );
}
