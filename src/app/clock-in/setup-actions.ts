"use server";

// ============================================================================
// /clock-in setup — link the current admin/HR to an employee record
// ============================================================================
//
// Founders / HR admins often want to clock in themselves (they DO work
// at the company they own), but the auth.users → employees link is
// usually created only via the invitation flow which assumes someone
// else sends the invite. This action lets admins self-link:
//
//   1. If their email already exists as an employee row → link (set user_id)
//   2. Otherwise → create a minimal employee row with sensible defaults
//
// After either path, /clock-in works for them on the next page load.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHR } from "@/lib/permissions";

export async function linkSelfAsEmployee() {
  const { supabase, profile } = await requireHR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 0. Defensive: already linked? Just redirect.
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (existing) {
    redirect("/clock-in");
  }

  // 1. Try to find an existing employees row by email — common for
  //    founders who added themselves manually to the employee list.
  const email = user.email ?? "";
  if (email) {
    const { data: byEmail } = await supabase
      .from("employees")
      .select("id, user_id")
      .eq("company_id", profile.company_id)
      .eq("email", email)
      .is("user_id", null)
      .limit(1)
      .maybeSingle<{ id: string; user_id: string | null }>();

    if (byEmail) {
      // Found a match — link it
      await supabase
        .from("employees")
        .update({ user_id: user.id })
        .eq("id", byEmail.id);
      revalidatePath("/clock-in");
      redirect("/clock-in");
    }
  }

  // 2. No existing row — create a minimal one. HR can flesh out the
  //    details (salary, allowances) later from /dashboard/employees/[id].
  const displayName =
    profile.full_name ??
    email.split("@")[0] ??
    "Admin";

  const { error } = await supabase.from("employees").insert({
    company_id: profile.company_id,
    user_id: user.id,
    full_name: displayName,
    email,
    status: "active",
    pay_frequency: "monthly",
    basic_salary: 0,
    job_title: "مالك / مدير",
    department: "الإدارة",
    hire_date: new Date().toISOString().split("T")[0],
  });

  if (error) {
    redirect(
      "/clock-in?setup_error=" +
        encodeURIComponent("ما قدرناش نسجّلك كموظف: " + error.message),
    );
  }

  revalidatePath("/clock-in");
  revalidatePath("/dashboard/employees");
  redirect("/clock-in?setup_done=1");
}
