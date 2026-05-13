// Server-side authorization helpers for /dashboard server actions and pages.
//
// Migration 017 tightened every RLS policy on business tables so that
// role='employee' can no longer SELECT / INSERT / UPDATE / DELETE anything
// outside their own row. That stops the data leak at the database layer,
// but the server actions still happily call `.delete()` / `.update()` and
// get back "0 rows affected" with no error -- which the UI surfaces as a
// silent success. The helpers below give every action the same gate:
//
//   const { supabase, profile } = await requireHR();   // throws on miss
//
// `requireHR()` redirects to /login (with an Arabic explainer) if the
// caller is anonymous, and to /dashboard (with an Arabic error toast in
// the URL) if the caller is a logged-in employee. Use it at the top of
// every destructive server action.
//
// For non-destructive reads, `getMyProfile()` returns null on miss so
// the caller can render an "access denied" UI without an exception.

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";

export type Role = "admin" | "manager" | "employee";

export type MyProfile = {
  id: string;
  email: string;
  company_id: string;
  full_name: string | null;
  role: Role;
};

/**
 * Read the current user's profile. Returns null if anonymous or if the
 * profile row is missing (e.g. signup trigger didn't run). Does NOT
 * redirect; that's the caller's job.
 */
export async function getMyProfile(): Promise<{
  supabase: SupabaseClient;
  profile: MyProfile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, role")
    .eq("id", user.id)
    .single<Omit<MyProfile, "email">>();

  if (!data) return { supabase, profile: null };

  return {
    supabase,
    profile: { ...data, email: user.email ?? "" },
  };
}

/**
 * Top guard for any server action that mutates business data. Returns
 * the supabase client + profile when the caller is admin or manager;
 * redirects otherwise. Use redirect-with-error for the employee case
 * so the receiving page can surface a clear Arabic message instead
 * of a 500.
 */
export async function requireHR(): Promise<{
  supabase: SupabaseClient;
  profile: MyProfile;
}> {
  const { supabase, profile } = await getMyProfile();

  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin" && profile.role !== "manager") {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("الصفحة دي مخصصة لـ HR (admin / manager) فقط"),
    );
  }

  return { supabase, profile };
}

/**
 * Lighter guard for read-only HR pages -- redirects employees to a safe
 * landing page but lets all logged-in HR through.
 */
export async function requireHRPage(): Promise<{
  supabase: SupabaseClient;
  profile: MyProfile;
}> {
  return requireHR();
}

/**
 * Admin-only guard (for super-sensitive operations like deleting an
 * employee, approving payroll, or changing the office geofence).
 */
export async function requireAdmin(): Promise<{
  supabase: SupabaseClient;
  profile: MyProfile;
}> {
  const { supabase, profile } = await getMyProfile();

  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin") {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("الصلاحية دي للـ admin فقط"),
    );
  }

  return { supabase, profile };
}

/**
 * Convenience: true if the caller is HR. Used inside server components
 * that conditionally render admin/manager-only UI elements.
 */
export async function isHR(): Promise<boolean> {
  const { profile } = await getMyProfile();
  return !!profile && (profile.role === "admin" || profile.role === "manager");
}
