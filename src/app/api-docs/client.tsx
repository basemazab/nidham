"use client";

import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export function ApiDocsClient() {
  const [spec, setSpec] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/openapi")
      .then((res) => res.json())
      .then(setSpec)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">توثيق API</h1>
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          تعذر تحميل التوثيق: {error}
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">توثيق API</h1>
        <p className="text-slate-500">جارٍ تحميل التوثيق...</p>
      </div>
    );
  }

  return (
    <div className="p-4 rtl" dir="rtl">
      <SwaggerUI spec={spec as any} />
    </div>
  );
}
