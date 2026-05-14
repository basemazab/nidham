// Request domain layer for the mobile app. Wraps the three RPCs from
// migration 018:
//   mobile_create_leave_request
//   mobile_create_advance_request
//   mobile_create_permission_request
// plus list/cancel/summary helpers. RPCs raise Arabic errors via
// errcode P0001 -- the wrappers preserve those messages verbatim.

import { supabase } from "./supabase";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type LeaveType =
  | "annual"
  | "casual"
  | "sick"
  | "unpaid"
  | "maternity"
  | "hajj"
  | "bereavement"
  | "other";

export type PermissionType =
  | "late_arrival"
  | "early_leave"
  | "errand"
  | "remote_day"
  | "other";

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "paid";

export type LeaveRequest = {
  id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: RequestStatus;
  hr_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type AdvanceRequest = {
  id: string;
  amount: number;
  installments: number;
  reason: string | null;
  status: RequestStatus;
  hr_notes: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PermissionRequest = {
  id: string;
  permission_type: PermissionType;
  permission_date: string;
  from_time: string | null;
  to_time: string | null;
  reason: string | null;
  status: RequestStatus;
  hr_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type MySummary = {
  employee_id: string;
  full_name: string;
  job_title: string | null;
  annual_remaining: number;
  casual_remaining: number;
  sick_remaining: number;
  pending_leave_requests: number;
  pending_advance_requests: number;
  pending_permission_requests: number;
};

export type SubmitResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ----------------------------------------------------------------------------
// Arabic labels (shared across screens)
// ----------------------------------------------------------------------------

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual:       "إجازة اعتيادية",
  casual:       "إجازة عارضة",
  sick:         "إجازة مرضية",
  unpaid:       "إجازة بدون أجر",
  maternity:    "إجازة وضع",
  hajj:         "إجازة حج",
  bereavement:  "إجازة وفاة",
  other:        "أخرى",
};

export const PERMISSION_TYPE_LABELS: Record<PermissionType, string> = {
  late_arrival: "تأخير في الحضور",
  early_leave:  "مغادرة مبكرة",
  errand:       "مأمورية خارجية",
  remote_day:   "عمل عن بُعد",
  other:        "أخرى",
};

// Kept in lockstep with the web's `src/lib/requests.ts` STATUS_LABELS_AR
// so HR sees the same wording on both surfaces. If you change one,
// change the other.
export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending:    "تحت المراجعة",
  approved:   "موافق عليه",
  rejected:   "مرفوض",
  cancelled:  "ملغي",
  paid:       "تم الصرف",
};

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

export async function getMySummary(): Promise<MySummary | null> {
  const { data } = await supabase
    .rpc("mobile_get_my_summary")
    .single<MySummary>();
  return data ?? null;
}

// ----------------------------------------------------------------------------
// Leave requests
// ----------------------------------------------------------------------------

export async function listMyLeaveRequests(
  employeeId: string,
): Promise<LeaveRequest[]> {
  const { data } = await supabase
    .from("leave_requests")
    .select(
      "id, leave_type, start_date, end_date, days_count, reason, status, hr_notes, reviewed_at, created_at",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  return (data as LeaveRequest[] | null) ?? [];
}

export async function createLeaveRequest(input: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
}): Promise<SubmitResult<{ daysCount: number; remainingBalance: number }>> {
  const { data, error } = await supabase
    .rpc("mobile_create_leave_request", {
      p_leave_type: input.leaveType,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_reason: input.reason,
    })
    .single<{
      request_id: string;
      days_count: number;
      remaining_balance: number;
    }>();

  if (error) return { ok: false, error: rpcError(error.message) };
  if (!data) return { ok: false, error: "مفيش رد من السيرفر" };
  return {
    ok: true,
    data: {
      daysCount: data.days_count,
      remainingBalance: data.remaining_balance,
    },
  };
}

// ----------------------------------------------------------------------------
// Advance requests
// ----------------------------------------------------------------------------

export async function listMyAdvanceRequests(
  employeeId: string,
): Promise<AdvanceRequest[]> {
  const { data } = await supabase
    .from("advance_requests")
    .select(
      "id, amount, installments, reason, status, hr_notes, reviewed_at, paid_at, created_at",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  return (data as AdvanceRequest[] | null) ?? [];
}

export async function createAdvanceRequest(input: {
  amount: number;
  installments: number;
  reason: string | null;
}): Promise<SubmitResult> {
  const { error } = await supabase.rpc("mobile_create_advance_request", {
    p_amount: input.amount,
    p_installments: input.installments,
    p_reason: input.reason,
  });
  if (error) return { ok: false, error: rpcError(error.message) };
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Permission requests
// ----------------------------------------------------------------------------

export async function listMyPermissionRequests(
  employeeId: string,
): Promise<PermissionRequest[]> {
  const { data } = await supabase
    .from("permission_requests")
    .select(
      "id, permission_type, permission_date, from_time, to_time, reason, status, hr_notes, reviewed_at, created_at",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  return (data as PermissionRequest[] | null) ?? [];
}

export async function createPermissionRequest(input: {
  permissionType: PermissionType;
  permissionDate: string;
  fromTime: string | null;
  toTime: string | null;
  reason: string | null;
}): Promise<SubmitResult> {
  const { error } = await supabase.rpc("mobile_create_permission_request", {
    p_permission_type: input.permissionType,
    p_permission_date: input.permissionDate,
    p_from_time: input.fromTime,
    p_to_time: input.toTime,
    p_reason: input.reason,
  });
  if (error) return { ok: false, error: rpcError(error.message) };
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Cancel own pending request (works on all three tables via RLS policies)
// ----------------------------------------------------------------------------

export async function cancelPendingRequest(
  table: "leave_requests" | "advance_requests" | "permission_requests",
  id: string,
): Promise<SubmitResult> {
  const { error } = await supabase
    .from(table)
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: rpcError(error.message) };
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Error mapping
// ----------------------------------------------------------------------------

function rpcError(message: string): string {
  // Migration 018 RPCs raise Arabic errors via errcode P0001. Anything
  // starting with an Arabic character we pass through. Otherwise fall
  // back to a generic message.
  if (/^[؀-ۿ]/.test(message)) return message;
  if (message.includes("permission denied")) return "ملكش صلاحية على ده";
  if (message.includes("network") || message.includes("fetch"))
    return "مفيش اتصال بالإنترنت";
  return `حصلت مشكلة: ${message}`;
}
