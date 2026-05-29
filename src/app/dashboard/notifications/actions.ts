"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function listNotifications() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id")
    .single();

  if (!profile) throw new Error("لم يتم العثور على المستخدم");

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("company_id", profile.company_id)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data;
}

export async function markAsRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/notifications");
}

export async function markAllAsRead() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id")
    .single();

  if (!profile) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("company_id", profile.company_id)
    .is("read_at", null);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/notifications");
}

export async function deleteNotification(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/notifications");
}

export async function clearAllRead() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id")
    .single();

  if (!profile) return;

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", profile.id)
    .eq("company_id", profile.company_id)
    .not("read_at", "is", null);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/notifications");
}
