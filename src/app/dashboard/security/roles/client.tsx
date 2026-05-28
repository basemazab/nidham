"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Shield, Check, X } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface Permission {
  id: string;
  code: string;
  label: string;
  description: string | null;
  module: string;
}

interface Props {
  roles: Role[];
  permissions: Permission[];
  permissionMap: Record<string, string[]>;
}

const MODULE_LABELS: Record<string, string> = {
  employees: "الموظفين",
  payroll: "المرتبات",
  attendance: "الحضور",
  leaves: "الإجازات",
  advances: "السلف",
  reports: "التقارير",
  settings: "الإعدادات",
  api: "API",
  team: "الفريق",
  audit: "التدقيق",
  workflow: "الأتمتة",
  crm: "العملاء",
};

export function RolesClient({ roles, permissions, permissionMap }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());

  const groupedPerms = permissions.reduce(
    (acc, p) => {
      (acc[p.module] ??= []).push(p);
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .single();

    if (!profile?.company_id) return;

    const { error } = await supabase.from("company_roles").insert({
      company_id: profile.company_id,
      name: roleName,
      description: roleDesc || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setShowCreate(false);
    setRoleName("");
    setRoleDesc("");
    router.refresh();
  }

  function startEdit(role: Role) {
    setEditingRole(role.id);
    setEditPerms(new Set(permissionMap[role.id] ?? []));
  }

  async function savePermissions(roleId: string) {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .single();

    if (!profile?.company_id) return;

    // Delete all existing permissions for this role
    await supabase
      .from("company_role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("company_id", profile.company_id);

    // Insert new permissions
    const permsToInsert = permissions
      .filter((p) => editPerms.has(p.id))
      .map((p) => ({
        company_id: profile.company_id,
        role_id: roleId,
        permission_id: p.id,
      }));

    if (permsToInsert.length > 0) {
      await supabase.from("company_role_permissions").insert(permsToInsert);
    }

    setEditingRole(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الأدوار والصلاحيات</h1>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة أدوار الفريق والصلاحيات الممنوحة لكل دور
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          <Plus className="h-4 w-4" />
          دور جديد
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-white p-6 space-y-4 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-sm font-medium">اسم الدور</label>
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="مثال: مدير مالي"
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">وصف</label>
            <input
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              placeholder="وصف مختصر للدور"
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700"
            >
              إنشاء
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="rounded-xl border bg-white p-6 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyan-600" />
                  <h3 className="font-semibold text-lg">{role.name}</h3>
                  {role.is_system && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                      نظام
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
                )}
              </div>
              {editingRole === role.id ? (
                <button
                  onClick={() => savePermissions(role.id)}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                >
                  <Check className="h-3 w-3" /> حفظ
                </button>
              ) : (
                <button
                  onClick={() => startEdit(role)}
                  className="text-xs text-cyan-600 hover:underline"
                >
                  تعديل الصلاحيات
                </button>
              )}
            </div>

            {editingRole === role.id ? (
              <div className="space-y-4">
                {Object.entries(groupedPerms).map(([module, perms]) => (
                  <div key={module}>
                    <h4 className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {MODULE_LABELS[module] ?? module}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={editPerms.has(perm.id)}
                            onChange={() => {
                              const next = new Set(editPerms);
                              next.has(perm.id) ? next.delete(perm.id) : next.add(perm.id);
                              setEditPerms(next);
                            }}
                            className="rounded"
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {permissions
                  .filter((p) => (permissionMap[role.id] ?? []).includes(p.code))
                  .map((p) => (
                    <span
                      key={p.id}
                      className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                    >
                      {p.label}
                    </span>
                  ))}
                {(permissionMap[role.id] ?? []).length === 0 && (
                  <span className="text-xs text-slate-400">لا توجد صلاحيات محددة</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
