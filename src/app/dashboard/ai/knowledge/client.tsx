"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addKnowledgeDocument, deleteKnowledgeDocument } from "@/lib/ai/memory";
import { Book, Plus, Trash2, FileText, Scale, Building2 } from "lucide-react";

interface Doc {
  id: string;
  title: string;
  source_type: string;
  created_at: string;
  chunk_index: number | null;
}

interface Props {
  docs: Doc[];
  companyId: string;
  userId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "يدوي",
  policy: "سياسة",
  law_article: "مادة قانونية",
  contract: "عقد",
  faq: "أسئلة شائعة",
  uploaded: "مرفوع",
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  manual: <Book className="h-4 w-4" />,
  policy: <Building2 className="h-4 w-4" />,
  law_article: <Scale className="h-4 w-4" />,
  faq: <FileText className="h-4 w-4" />,
};

export function KnowledgeBaseClient({ docs, companyId }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState<
    "manual" | "policy" | "law_article" | "faq" | "uploaded"
  >("manual");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addKnowledgeDocument({
      companyId,
      title,
      content,
      sourceType,
    });
    setShowAdd(false);
    setTitle("");
    setContent("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قاعدة المعرفة (RAG)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            المستندات والمواد القانونية التي يستخدمها AI للإجابة على الأسئلة
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          <Plus className="h-4 w-4" />
          إضافة مستند
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl border bg-white p-6 space-y-4 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-sm font-medium">العنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: سياسة الإجازات في الشركة"
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">النوع</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as any)}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800"
            >
              <option value="manual">يدوي</option>
              <option value="policy">سياسة شركة</option>
              <option value="law_article">مادة قانونية</option>
              <option value="faq">أسئلة شائعة</option>
              <option value="uploaded">مرفوع</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">المحتوى</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="نص المستند كاملاً..."
              rows={8}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-800 font-mono"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700"
            >
              إضافة
            </button>
          </div>
        </form>
      )}

      {docs.length === 0 && !showAdd && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Book className="mx-auto mb-4 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            قاعدة المعرفة فارغة — أضف مستندات قانونية أو سياسات شركة
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="rounded-xl border bg-white p-4 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="rounded-lg bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 flex-shrink-0">
                  {SOURCE_ICONS[doc.source_type] ?? <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{doc.title}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800">
                      {SOURCE_LABELS[doc.source_type] ?? doc.source_type}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (confirm("حذف هذا المستند؟")) {
                    await deleteKnowledgeDocument(doc.id);
                    router.refresh();
                  }
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
