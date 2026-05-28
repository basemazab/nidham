import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIXES: Record<string, string> = {
  production: "nidham_pro_",
  test: "nidham_test_",
};

export function generateApiKey(env: "production" | "test" = "production"): {
  raw: string;
  prefix: string;
  hash: string;
} {
  const prefix = KEY_PREFIXES[env];
  const suffix = randomBytes(24).toString("base64url");
  const raw = `${prefix}${suffix}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function validateApiKeyFormat(raw: string): boolean {
  return /^nidham_(pro|test)_[A-Za-z0-9_-]{32,}$/.test(raw);
}

export interface ApiScope {
  resource: "employees" | "payroll" | "attendance" | "analytics" | "ai";
  action: "read" | "write" | "admin";
}

export const API_SCOPES: { value: string; label: string; description: string }[] = [
  { value: "employees:read", label: "قراءة الموظفين", description: "جلب بيانات الموظفين" },
  { value: "employees:write", label: "كتابة الموظفين", description: "إنشاء وتحديث الموظفين" },
  { value: "payroll:read", label: "قراءة المرتبات", description: "جلب بيانات المرتبات" },
  { value: "payroll:write", label: "كتابة المرتبات", description: "إنشاء وتحديث المرتبات" },
  { value: "attendance:read", label: "قراءة الحضور", description: "جلب بيانات الحضور" },
  { value: "attendance:write", label: "كتابة الحضور", description: "تسجيل حضور وانصراف" },
  { value: "analytics:read", label: "قراءة التحليلات", description: "جلب التقارير والتحليلات" },
  { value: "ai:chat", label: "محادثة AI", description: "استخدام المساعد الذكي" },
];
