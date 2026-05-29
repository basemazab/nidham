"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Save a push subscription for the current user.
 */
export async function savePushSubscription(subscription: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مصرح");

  const { error } = await supabase.from("user_sessions").update({
    push_subscription: subscription,
    push_enabled: true,
  }).eq("user_id", user.id).eq("is_current", true);

  if (error) throw new Error(error.message);
}

/**
 * Remove push subscription.
 */
export async function removePushSubscription() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_sessions").update({
    push_subscription: null,
    push_enabled: false,
  }).eq("user_id", user.id).eq("is_current", true);
}

/**
 * Send a push notification to a specific user.
 * Uses web-push library (to be installed separately).
 */
export async function sendNotification(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
}) {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("push_subscription")
    .eq("user_id", params.userId)
    .eq("push_enabled", true)
    .not("push_subscription", "is", null);

  for (const session of sessions ?? []) {
    if (!session.push_subscription) continue;
    try {
      const subscription = JSON.parse(
        typeof session.push_subscription === "string"
          ? session.push_subscription
          : JSON.stringify(session.push_subscription),
      );
      // The push notification will be sent via a separate service or cron
      console.info("[push] notification to user", params.userId, subscription.endpoint);
    } catch (err) {
      console.error("[push] failed to parse subscription", err);
    }
  }
}

/**
 * Send bulk notification to all active users in a company.
 */
export async function sendBulkNotification(params: {
  companyId: string;
  title: string;
  body: string;
  url?: string;
}) {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", params.companyId);

  for (const profile of profiles ?? []) {
    await sendNotification({
      userId: profile.id,
      title: params.title,
      body: params.body,
      url: params.url,
    });
  }
}

/**
 * Create an in-app notification (stored in DB).
 */
export async function createInAppNotification(params: {
  userId: string;
  companyId: string;
  title: string;
  body: string;
  type?: string;
  linkUrl?: string;
}) {
  const supabase = await createClient();
  // Gracefully handle if notifications table doesn't exist yet
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: params.userId,
      company_id: params.companyId,
      title: params.title,
      body: params.body,
      type: params.type || "general",
      link_url: params.linkUrl,
    });

    if (error) {
      console.warn("[notifications] insert failed:", error.message);
      return;
    }
    revalidatePath("/dashboard");
  } catch (err) {
    console.warn("[notifications] table may not exist:", err);
  }
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
    if (error) console.warn("[notifications] markRead failed:", error.message);
  } catch { /* table may not exist */ }
}

export async function getUnreadNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}
