// Arabic labels for request types -- shared between web actions (for email
// subjects + audit log) and any future server-side rendering. Kept as a
// separate module so it can be imported from server actions without
// pulling in client-only deps from the mobile flow.

export const LEAVE_TYPE_LABELS_AR: Record<string, string> = {
  annual:       "إجازة اعتيادية",
  casual:       "إجازة عارضة",
  sick:         "إجازة مرضية",
  unpaid:       "إجازة بدون أجر",
  maternity:    "إجازة وضع",
  hajj:         "إجازة حج",
  bereavement:  "إجازة وفاة",
  other:        "إجازة (أخرى)",
};

export const PERMISSION_TYPE_LABELS_AR: Record<string, string> = {
  late_arrival: "تأخير في الحضور",
  early_leave:  "مغادرة مبكرة",
  errand:       "مأمورية خارجية",
  remote_day:   "عمل عن بُعد",
  other:        "استئذان (أخرى)",
};
