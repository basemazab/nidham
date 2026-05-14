"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function ensureSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    throw new Error("Not authorized");
  }

  return supabase;
}

export async function updateSubscription(
  subscriptionId: string,
  formData: FormData,
) {
  const supabase = await ensureSuperAdmin();

  const plan = String(formData.get("plan") ?? "trial");
  const status = String(formData.get("status") ?? "trial");
  const endsAt = String(formData.get("ends_at") ?? "");
  const monthlyValueRaw = String(formData.get("monthly_value") ?? "").trim();
  const monthlyValue = monthlyValueRaw === "" ? null : Number(monthlyValueRaw);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const update: Record<string, unknown> = {
    plan,
    status,
    notes,
    monthly_value: monthlyValue,
  };
  if (endsAt) update.ends_at = endsAt;

  const { error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("id", subscriptionId);

  if (error) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent(error.message),
    );
  }

  // The owner's view at /dashboard/subscription reads from the same row.
  // Without revalidating that path here, the company admin keeps seeing
  // the stale Trial plan in their own dashboard even after super-admin
  // flipped them to a paid tier.
  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions/" + subscriptionId);
  revalidatePath("/dashboard/subscription");
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/subscriptions/${subscriptionId}?saved=1`);
}

export async function extendTrial(
  subscriptionId: string,
  formData: FormData,
) {
  const supabase = await ensureSuperAdmin();
  const days = Number(formData.get("days") ?? 14);

  const { data: current } = await supabase
    .from("subscriptions")
    .select("ends_at")
    .eq("id", subscriptionId)
    .single();

  if (!current) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent("الاشتراك غير موجود"),
    );
  }

  const currentEnd = new Date(current.ends_at as string);
  currentEnd.setDate(currentEnd.getDate() + days);
  const newEnd = currentEnd.toISOString().split("T")[0];

  const { error } = await supabase
    .from("subscriptions")
    .update({ ends_at: newEnd })
    .eq("id", subscriptionId);

  if (error) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions/" + subscriptionId);
  revalidatePath("/dashboard/subscription");
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/subscriptions/${subscriptionId}?extended=${days}`);
}
