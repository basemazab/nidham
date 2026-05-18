// ============================================================================
// UAT — Seed a realistic test tenant
// ============================================================================
//
// Spins up:
//   • 1 company  ("شركة الاتحاد للتيست")
//   • 50 employees with Egyptian Arabic names + realistic salaries
//   • 30 days of attendance covering Jan 2026
//   • 5 customers + a handful of interactions
//   • 3 leave requests in various states
//
// Run with:
//   npx tsx tests/uat/seed-test-tenant.ts
//
// Required env vars:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (the SECRET service-role key — NOT the anon)
//
// The service-role key bypasses RLS so we can write across tables under a
// fake company_id. NEVER commit the key to git or expose it client-side.
//
// Safe to re-run: the script deletes the existing test company by slug
// before reseeding. So a tester can reset between cycles with one command.

import { createClient } from "@supabase/supabase-js";
import * as path from "node:path";
import * as fs from "node:fs";

// Load .env.local manually so the script doesn't need next/server bootstrapping.
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "❌ Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.error(
    "   Set them in .env.local. SUPABASE_SERVICE_ROLE_KEY is the SECRET key (Supabase → Settings → API).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const COMPANY_NAME = "شركة الاتحاد للتيست";
const COMPANY_SLUG = "uat-tenant";

// ============================================================================
// Realistic Egyptian Arabic data
// ============================================================================

const FIRST_NAMES_M = [
  "أحمد", "محمد", "علي", "حسن", "خالد", "عمر", "يوسف", "مصطفى",
  "إبراهيم", "محمود", "كريم", "طارق", "هاني", "سامر", "أيمن", "ياسر",
];
const FIRST_NAMES_F = [
  "فاطمة", "عائشة", "مريم", "سارة", "نور", "رنا", "هدى", "إيمان",
  "سلمى", "ليلى", "أمل", "ولاء", "هبة", "دينا", "منى", "نهى",
];
const LAST_NAMES = [
  "حسن", "محمود", "علي", "إبراهيم", "السيد", "عبد الله",
  "عبد الرحمن", "سعد", "بدر", "النجار", "الجوهري", "شعبان",
  "فاروق", "سامي", "نصر", "زكي",
];

const DEPARTMENTS = [
  { name: "المالية", titles: ["محاسب", "محاسب أول", "مدير حسابات", "مدقق"] },
  { name: "المبيعات", titles: ["مندوب مبيعات", "مدير مبيعات", "Account Manager"] },
  { name: "التشطيب", titles: ["فني تركيب", "مشرف تركيبات", "نجار", "حداد"] },
  { name: "الموارد البشرية", titles: ["أخصائي HR", "مدير HR"] },
  { name: "الإنتاج", titles: ["عامل إنتاج", "مشرف خط", "مدير مصنع"] },
  { name: "تكنولوجيا المعلومات", titles: ["Software Developer", "Sys Admin"] },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomEgyptianName(): string {
  const isMale = Math.random() < 0.6;
  const first = isMale ? rand(FIRST_NAMES_M) : rand(FIRST_NAMES_F);
  const middle = rand(LAST_NAMES);
  const last = rand(LAST_NAMES);
  return `${first} ${middle} ${last}`;
}

function randomNationalId(): string {
  // 14-digit Egyptian national ID — first digit 2 or 3 (century),
  // then YYMMDD, then 4 random digits.
  const century = Math.random() < 0.5 ? "2" : "3";
  const year = String(Math.floor(Math.random() * 50)).padStart(2, "0");
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  const tail = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${century}${year}${month}${day}1010${tail.slice(0, 1)}`;
}

function randomEgyptianPhone(): string {
  // Egyptian mobile: 010/011/012/015 + 8 digits
  const prefix = rand(["010", "011", "012", "015"]);
  const tail = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  return prefix + tail;
}

function randomSalary(dept: string): {
  basic: number;
  housing: number;
  transport: number;
} {
  // Realistic 2026 Egyptian payroll ranges per department
  const ranges: Record<string, [number, number]> = {
    "المالية": [6000, 18000],
    "المبيعات": [5000, 20000],
    "التشطيب": [4000, 9000],
    "الموارد البشرية": [6000, 15000],
    "الإنتاج": [3500, 8000],
    "تكنولوجيا المعلومات": [10000, 35000],
  };
  const [min, max] = ranges[dept] ?? [5000, 12000];
  const basic = Math.round((min + Math.random() * (max - min)) / 100) * 100;
  return {
    basic,
    housing: Math.round(basic * 0.1),
    transport: Math.round(basic * 0.05),
  };
}

// ============================================================================
// 1) Reset — delete any existing test tenant
// ============================================================================
async function reset() {
  console.log("🧹 Cleaning up previous test tenant...");
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", COMPANY_SLUG)
    .maybeSingle();

  if (existing?.id) {
    // ON DELETE CASCADE handles employees, attendance, profiles, etc.
    await supabase.from("companies").delete().eq("id", existing.id);
    console.log(`   Removed company ${existing.id}`);
  } else {
    console.log("   No existing test tenant found.");
  }
}

// ============================================================================
// 2) Create company
// ============================================================================
async function createCompany(): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .insert({ name: COMPANY_NAME, slug: COMPANY_SLUG, industry: "تصنيع" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Company insert failed: ${error?.message}`);
  console.log(`✅ Created company ${data.id} (${COMPANY_NAME})`);
  return data.id;
}

// ============================================================================
// 3) Create 50 employees
// ============================================================================
async function createEmployees(companyId: string): Promise<string[]> {
  console.log("👥 Creating 50 employees...");
  const employees = Array.from({ length: 50 }, (_, i) => {
    const dept = rand(DEPARTMENTS);
    const salary = randomSalary(dept.name);
    return {
      company_id: companyId,
      full_name: randomEgyptianName(),
      employee_code: `${1000 + i + 1}`,
      job_title: rand(dept.titles),
      department: dept.name,
      phone: randomEgyptianPhone(),
      email: null,
      hire_date: new Date(
        2020 + Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1,
      )
        .toISOString()
        .split("T")[0],
      basic_salary: salary.basic,
      housing_allowance: salary.housing,
      transport_allowance: salary.transport,
      other_allowances: 0,
      incentive_allowance: 0,
      pay_frequency: Math.random() < 0.8 ? "monthly" : "weekly",
      national_id: randomNationalId(),
      status: Math.random() < 0.95 ? "active" : "on_leave",
    };
  });

  const { data, error } = await supabase
    .from("employees")
    .insert(employees)
    .select("id");
  if (error || !data) throw new Error(`Employees insert failed: ${error?.message}`);
  console.log(`✅ Inserted ${data.length} employees`);
  return data.map((r) => r.id);
}

// ============================================================================
// 4) Create 30 days of attendance (Jan 2026)
// ============================================================================
async function createAttendance(
  companyId: string,
  employeeIds: string[],
): Promise<void> {
  console.log("⏰ Creating attendance records for Jan 2026...");

  const startDate = new Date("2026-01-01T00:00:00Z");
  const records: Array<Record<string, unknown>> = [];

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    const iso = date.toISOString().split("T")[0];
    const dayOfWeek = date.getUTCDay(); // 0=Sun ... 6=Sat in JS, but Egypt is Fri/Sat off
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    for (const empId of employeeIds) {
      // 90% attendance, 5% absent, 3% leave, 2% half-day
      // Weekends skipped entirely (no row).
      if (isWeekend) continue;

      const r = Math.random();
      let status: "present" | "absent" | "half_day" | "leave";
      let tardinessMinutes = 0;
      let earlyLeaveMinutes = 0;

      if (r < 0.05) status = "absent";
      else if (r < 0.08) status = "leave";
      else if (r < 0.1) status = "half_day";
      else {
        status = "present";
        // Tardiness: 15% chance, 5-45 minutes
        if (Math.random() < 0.15) tardinessMinutes = 5 + Math.floor(Math.random() * 40);
        // Early leave: 8% chance, 5-30 minutes
        if (Math.random() < 0.08) earlyLeaveMinutes = 5 + Math.floor(Math.random() * 25);
      }

      records.push({
        company_id: companyId,
        employee_id: empId,
        date: iso,
        status,
        check_in: status === "absent" || status === "leave" ? null : "08:00:00",
        check_out:
          status === "absent" || status === "leave"
            ? null
            : status === "half_day"
              ? "12:00:00"
              : "17:00:00",
        tardiness_minutes: tardinessMinutes,
        early_leave_minutes: earlyLeaveMinutes,
      });
    }
  }

  // Insert in batches of 500 to stay under Supabase request-size limits.
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const { error } = await supabase.from("attendance").insert(batch);
    if (error) {
      throw new Error(`Attendance batch insert failed at ${i}: ${error.message}`);
    }
  }
  console.log(`✅ Inserted ${records.length} attendance records`);
}

// ============================================================================
// 5) Create 5 customers
// ============================================================================
async function createCustomers(companyId: string): Promise<void> {
  console.log("💼 Creating 5 customers...");

  const customers = [
    {
      company_id: companyId,
      name: "شركة الأمل للمقاولات",
      contact_person: "أ. محمد عبد الرحمن",
      phone: "01000000001",
      email: "contact@amal.test",
      status: "active",
    },
    {
      company_id: companyId,
      name: "مؤسسة النور للتجارة",
      contact_person: "أ. فاطمة حسن",
      phone: "01000000002",
      status: "active",
    },
    {
      company_id: companyId,
      name: "شركة البركة للمصاعد",
      contact_person: "م. خالد سعيد",
      phone: "01000000003",
      status: "lead",
    },
    {
      company_id: companyId,
      name: "مكاتب الفجر",
      phone: "01000000004",
      status: "prospect",
    },
    {
      company_id: companyId,
      name: "شركة الأهرامات للديكور",
      contact_person: "أ. سامي نصر",
      phone: "01000000005",
      status: "active",
    },
  ];

  const { error } = await supabase.from("customers").insert(customers);
  if (error) {
    // The customers table may not exist on all environments — skip gracefully.
    if (error.code === "42P01") {
      console.log("   (customers table not found, skipping)");
      return;
    }
    throw new Error(`Customers insert failed: ${error.message}`);
  }
  console.log("✅ Inserted 5 customers");
}

// ============================================================================
// Run
// ============================================================================
async function main() {
  console.log("\n🚀 Nidham UAT — seeding test tenant\n");
  const t0 = Date.now();

  await reset();
  const companyId = await createCompany();
  const employeeIds = await createEmployees(companyId);
  await createAttendance(companyId, employeeIds);
  await createCustomers(companyId);

  const took = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✨ Done in ${took}s. Test tenant ready.\n`);
  console.log("📌 Notes:");
  console.log(`   Company:    ${COMPANY_NAME}`);
  console.log(`   Company ID: ${companyId}`);
  console.log(`   Employees:  50`);
  console.log(`   Attendance: Jan 2026 (working days only)`);
  console.log(`\n👤 To log in:`);
  console.log(`   1) Sign up a new user on the app.`);
  console.log(`   2) In Supabase SQL Editor, swap the profile's company_id:`);
  console.log(
    `      UPDATE profiles SET company_id = '${companyId}' WHERE id = '<your auth.users.id>';`,
  );
  console.log(`   3) Refresh — you're now logged into the test tenant.\n`);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:");
  console.error(err);
  process.exit(1);
});
