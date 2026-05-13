// Shared labels + styling for the three request kinds (leave / advance /
// permission). Used in the inbox, detail pages, and the mobile API.

export type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "paid";

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

export const STATUS_LABELS_AR: Record<RequestStatus, string> = {
  pending: "تحت المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغي",
  paid: "تم الصرف",
};

export const STATUS_CLASSES: Record<RequestStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  paid: "bg-cyan-50 text-cyan-800 border-cyan-200",
};

export const LEAVE_TYPE_LABELS_AR: Record<LeaveType, string> = {
  annual: "إجازة سنوية",
  casual: "إجازة عارضة",
  sick: "إجازة مرضية",
  unpaid: "إجازة بدون أجر",
  maternity: "إجازة وضع",
  hajj: "إجازة حج",
  bereavement: "إجازة وفاة",
  other: "أخرى",
};

export const PERMISSION_TYPE_LABELS_AR: Record<PermissionType, string> = {
  late_arrival: "تأخير",
  early_leave: "مغادرة مبكرة",
  errand: "مأمورية",
  remote_day: "عمل عن بُعد",
  other: "أخرى",
};

export type RequestKind = "leave" | "advance" | "permission";

export const REQUEST_KIND_LABELS_AR: Record<RequestKind, string> = {
  leave: "إجازة",
  advance: "سلفة",
  permission: "استئذان",
};

export const REQUEST_KIND_ICONS: Record<RequestKind, string> = {
  leave: "🏝️",
  advance: "💵",
  permission: "⏰",
};
