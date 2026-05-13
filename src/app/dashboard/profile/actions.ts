"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent("اسمك مطلوب"),
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/profile?profile_updated=1");
}

export async function changeMyPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!password || password.length < 6) {
    redirect(
      "/dashboard/profile?error=" +
        encodeURIComponent("كلمة السر لازم تكون 6 حروف على الأقل"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent(error.message),
    );
  }

  redirect("/dashboard/profile?password_changed=1");
}

export async function updateMyCompany(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only admins can update company
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect(
      "/dashboard/profile?error=" +
        encodeURIComponent("لازم تكون مدير عشان تعدّل بيانات الشركة"),
    );
  }

  const companyName = String(formData.get("company_name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;

  if (!companyName) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent("اسم الشركة مطلوب"),
    );
  }

  const { error } = await supabase
    .from("companies")
    .update({ name: companyName, industry })
    .eq("id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/profile?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/profile?company_updated=1");
}
