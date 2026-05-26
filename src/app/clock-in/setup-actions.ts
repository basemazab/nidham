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

  // 1. Try to find an existing employees row by email OR full_name match —
  //    founders often add themselves to the employee list manually with a
  //    different email (or no email at all) than the auth account they
  //    log in with. Trying just email creates a duplicate that has to be
  //    cleaned up later — same bug that hit Basem in production.
  const email = user.email ?? "";
  const displayName = profile.full_name ?? "";

  // Try email first (exact match — strongest signal)
  if (email) {
    const { data: byEmail } = await supabase
      .from("employees")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("email", email)
      .is("user_id", null)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (byEmail) {
      await supabase
        .from("employees")
        .update({ user_id: user.id })
        .eq("id", byEmail.id);
      revalidatePath("/clock-in");
      redirect("/clock-in");
    }
  }

  // Fall back: name match — only when the auth profile has a full_name.
  // Uses ILIKE %name% so "HR — باسم محمود عزب" matches a "Basem" auth
  // profile. Defensive: only link if EXACTLY one unlinked match exists.
  //
  // J2 fix — ILIKE injection: the previous version interpolated firstWord
  // directly into the LIKE pattern. A profile named "%" would have
  // matched every employee in the tenant. Escape the three Postgres LIKE
  // wildcards (%, _, \) before passing them through. Also reject any
  // first word with non-letter chars to be defensive.
  if (displayName.trim().length >= 3) {
    const firstWord = displayName.trim().split(/\s+/)[0];
    // Only allow letters (Arabic + Latin) + digits. Anything else is
    // either junk or an injection attempt; skip the name-match path.
    const isSafeFirstWord = /^[\p{L}\p{N}'\-.]+$/u.test(firstWord);
    if (isSafeFirstWord) {
      // Escape LIKE metacharacters explicitly even though the regex above
      // already blocked them — defense in depth.
      const escapedFirstWord = firstWord
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");

      const { data: nameMatches } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", profile.company_id)
        .is("user_id", null)
        .ilike("full_name", `%${escapedFirstWord}%`)
        .returns<Array<{ id: string }>>();

      if (nameMatches && nameMatches.length === 1) {
        await supabase
          .from("employees")
          .update({ user_id: user.id, email })
          .eq("id", nameMatches[0].id);
        revalidatePath("/clock-in");
        redirect("/clock-in");
      }
      // 2+ matches: ambiguous — don't auto-link, fall through to create
      // a fresh record and let HR manually merge later
    }
  }

  // 2. No existing row — create a minimal one. HR can flesh out the
  //    details (salary, allowances) later from /dashboard/employees/[id].
  const fallbackName =
    displayName || email.split("@")[0] || "Admin";

  const { error } = await supabase.from("employees").insert({
    company_id: profile.company_id,
    user_id: user.id,
    full_name: fallbackName,
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
