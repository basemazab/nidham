"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR } from "@/lib/permissions";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export async function createSignatureRequest(formData: FormData) {
  const { supabase, profile } = await requireHR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = asText(formData.get("title"));
  const documentHtml = asText(formData.get("document_html"));
  const recipientName = asText(formData.get("recipient_name"));
  const recipientPhone = asText(formData.get("recipient_phone"));
  const recipientEmail = asText(formData.get("recipient_email"));
  const employeeId = asText(formData.get("employee_id"));
  const expiresDays = Number(formData.get("expires_days") ?? "14");

  if (!title) {
    redirect(
      "/dashboard/signatures/new?error=" +
        encodeURIComponent("عنوان المستند مطلوب"),
    );
  }
  if (!documentHtml) {
    redirect(
      "/dashboard/signatures/new?error=" +
        encodeURIComponent("محتوى المستند مطلوب"),
    );
  }
  if (!recipientName) {
    redirect(
      "/dashboard/signatures/new?error=" +
        encodeURIComponent("اسم المستلم مطلوب"),
    );
  }
  if (!recipientPhone && !recipientEmail) {
    redirect(
      "/dashboard/signatures/new?error=" +
        encodeURIComponent("لازم رقم تليفون أو إيميل للمستلم"),
    );
  }

  const expiresAt = new Date();
  const validDays =
    Number.isFinite(expiresDays) && expiresDays > 0 && expiresDays <= 90
      ? Math.floor(expiresDays)
      : 14;
  expiresAt.setDate(expiresAt.getDate() + validDays);

  const { error } = await supabase.from("signature_requests").insert({
    company_id: profile.company_id,
    title,
    document_html: documentHtml,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_email: recipientEmail,
    employee_id: employeeId,
    expires_at: expiresAt.toISOString(),
    created_by: user.id,
  });

  if (error) {
    redirect(
      "/dashboard/signatures/new?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/signatures");
  redirect("/dashboard/signatures?saved=1");
}

export async function cancelSignatureRequest(formData: FormData) {
  const { supabase } = await requireHR();
  const id = asText(formData.get("id"));
  if (!id) {
    redirect("/dashboard/signatures?error=" + encodeURIComponent("ID مفقود"));
  }

  const { error } = await supabase
    .from("signature_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    redirect(
      "/dashboard/signatures?error=" + encodeURIComponent(error.message),
    );
  }
  revalidatePath("/dashboard/signatures");
  redirect("/dashboard/signatures?saved=1");
}
