import { createClient } from "@/lib/supabase/server";
import { PayrollAnalyticsClient } from "./client";

export const metadata = {
  title: "تحليلات المرتبات",
};

export default async function PayrollAnalyticsPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .single();

  if (!profile) return <div className="p-6">لا يمكن تحميل البيانات</div>;

  // Monthly payroll totals for the last 12 months
  const { data: monthlyData } = await supabase
    .from("payroll_periods")
    .select(`
      id, year, month, status,
      payroll_entries ( gross_salary, net_salary, total_deductions, social_insurance, income_tax, bonuses )
    `)
    .eq("company_id", profile.company_id)
    .gte("start_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_date", { ascending: true });

  // Department breakdown
  const { data: deptData } = await supabase
    .from("payroll_entries")
    .select(`
      net_salary, gross_salary,
      employees!inner ( department, status )
    `)
    .eq("company_id", profile.company_id)
    .eq("employees.status", "active");

  // Employee count
  const { count: empCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("status", "active");

  // Recent payroll periods summary
  const { data: recentPeriods } = await supabase
    .from("payroll_periods")
    .select("id, year, month, status, start_date, end_date, working_days")
    .eq("company_id", profile.company_id)
    .order("start_date", { ascending: false })
    .limit(6);

  return (
    <PayrollAnalyticsClient
      monthlyData={monthlyData ?? []}
      deptData={deptData ?? []}
      empCount={empCount ?? 0}
      recentPeriods={recentPeriods ?? []}
    />
  );
}
