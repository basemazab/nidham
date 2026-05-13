"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Map Supabase auth error codes / messages to Arabic strings the user
// can act on, without leaking enumeration oracles (e.g. "this email is
// already registered" tells a brute-forcer that the account exists).
function arabicizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد أو كلمة السر غلط";
  if (m.includes("email not confirmed")) return "لازم تفعّل الإيميل الأول";
  if (m.includes("user already") || m.includes("already registered")) {
    // Deliberately generic to avoid email-existence enumeration.
    return "ما قدرناش نسجل الحساب — راجع البيانات أو جرب /login";
  }
  if (m.includes("password should be") || m.includes("password"))
    return "كلمة السر قصيرة جدًا (8 حروف على الأقل)";
  if (m.includes("rate limit")) return "حاولت كتير في وقت قصير — انتظر دقيقة";
  if (m.includes("network") || m.includes("fetch"))
    return "مفيش اتصال بالإنترنت";
  return "حصلت مشكلة في التسجيل — حاول تاني";
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(arabicizeAuthError(error.message))}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  // Bump the floor from Supabase's default 6 -- HR product, weak
  // password = back-door into the whole company.
  if (!password || password.length < 8) {
    redirect(
      `/signup?error=${encodeURIComponent("كلمة السر لازم تكون 8 حروف على الأقل")}`,
    );
  }

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password,
    options: {
      data: {
        company_name: formData.get("company_name") as string,
        full_name: formData.get("full_name") as string,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(arabicizeAuthError(error.message))}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
