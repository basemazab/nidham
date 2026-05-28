"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createApiKey, revokeApiKey, deleteApiKey } from "./actions";
import { API_SCOPES } from "@/lib/api/keys";
import { Copy, Trash2, Plus, X, Check, Key } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  rate_limit_rps: number;
  created_at: string;
}

interface ApiKeysClientProps {
  keys: ApiKeyRow[];
}

export function ApiKeysClient({ keys }: ApiKeysClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"production" | "test">("production");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["employees:read"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", newKeyName);
    formData.set("env", newKeyEnv);
    selectedScopes.forEach((s) => formData.append("scopes", s));

    const result = await createApiKey(formData);
    setCreatedKey(result.raw);
    setShowCreate(false);
    router.refresh();
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  if (createdKey) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <h3 className="mb-2 font-bold text-amber-800 dark:text-amber-300">
            ⚠ تم إنشاء مفتاح API
          </h3>
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
            هذا هو المفتاح الوحيد الذي سيظهر لك. احفظه في مكان آمن.
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-white p-3 font-mono text-sm dark:bg-slate-900">
            <code className="flex-1 break-all">{createdKey}</code>
            <button
              onClick={() => navigator.clipboard.writeText(createdKey)}
              className="flex-shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setCreatedKey(null)}
          className="text-sm text-cyan-600 hover:underline"
        >
          → العودة لمفاتيح API
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">مفاتيح API</h2>
          <p className="text-sm text-slate-500">
            استخدم مفاتيح API لربط نظام نِظام مع تطبيقاتك الخارجية
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          <Plus className="h-4 w-4" />
          مفتاح جديد
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-white p-6 space-y-4 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-sm font-medium">اسم المفتاح</label>
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="مثال: مفتاح الإنتاج - ERP"
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">البيئة</label>
            <select
              value={newKeyEnv}
              onChange={(e) => setNewKeyEnv(e.target.value as "production" | "test")}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800"
            >
              <option value="test">اختبار (معدل 10 req/s)</option>
              <option value="production">إنتاج (معدل 30 req/s)</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">الصلاحيات</label>
            <div className="grid grid-cols-2 gap-2">
              {API_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">{scope.label}</div>
                    <div className="text-xs text-slate-400">{scope.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700"
            >
              إنشاء المفتاح
            </button>
          </div>
        </form>
      )}

      {keys.length === 0 && !showCreate && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Key className="mx-auto mb-4 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">لا توجد مفاتيح API بعد</p>
        </div>
      )}

      <div className="space-y-3">
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-slate-900"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{key.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    key.is_active
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                >
                  {key.is_active ? "نشط" : "ملغي"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="font-mono text-xs text-slate-400">{key.key_prefix}...</span>
                <span className="text-xs text-slate-400">{key.rate_limit_rps} req/s</span>
                {key.scopes.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                تم الإنشاء: {new Date(key.created_at).toLocaleDateString("ar-EG")}
                {key.last_used_at && ` · آخر استخدام: ${new Date(key.last_used_at).toLocaleDateString("ar-EG")}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {key.is_active && (
                <button
                  onClick={async () => {
                    await revokeApiKey(key.id);
                    router.refresh();
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  إلغاء
                </button>
              )}
              <button
                onClick={async () => {
                  if (confirm("هل أنت متأكد من حذف هذا المفتاح؟")) {
                    await deleteApiKey(key.id);
                    router.refresh();
                  }
                }}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
