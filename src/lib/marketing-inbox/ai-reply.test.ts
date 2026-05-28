import { describe, it, expect } from "vitest";
import { tryTemplateMatch } from "./ai-reply";

describe("tryTemplateMatch", () => {
  const templates = [
    { trigger_keywords: ["سعر", "كم"], reply_text: "الأسعار تبدأ من 749 جنيه" },
    { trigger_keywords: ["demo", "تجربة"], reply_text: "احجز demo مجاني" },
    { trigger_keywords: ["شكر"], reply_text: "العفو دائمًا في خدمتك" },
  ];

  it("returns null for empty templates", () => {
    const result = tryTemplateMatch({ userMessage: "السلام عليكم", templates: [] });
    expect(result).toBeNull();
  });

  it("matches one keyword", () => {
    const result = tryTemplateMatch({ userMessage: "عايز اعرف سعر النظام", templates });
    expect(result).toBe("الأسعار تبدأ من 749 جنيه");
  });

  it("matches second keyword in triggers", () => {
    const result = tryTemplateMatch({ userMessage: "كم سعر الباقة", templates });
    expect(result).toBe("الأسعار تبدأ من 749 جنيه");
  });

  it("matches demo keyword", () => {
    const result = tryTemplateMatch({ userMessage: "عايز اجرب demo", templates });
    expect(result).toBe("احجز demo مجاني");
  });

  it("returns null when no keywords match", () => {
    const result = tryTemplateMatch({ userMessage: "مرحبًا", templates });
    expect(result).toBeNull();
  });

  it("case-insensitive matching", () => {
    const result = tryTemplateMatch({ userMessage: "شكراً جزيلاً", templates });
    expect(result).toBe("العفو دائمًا في خدمتك");
  });

  it("arabic text with tashkeel", () => {
    const result = tryTemplateMatch({ userMessage: "بِكَم سعر الاشتراك", templates });
    expect(result).toBe("الأسعار تبدأ من 749 جنيه");
  });

  it("prefers first matching template", () => {
    const result = tryTemplateMatch({ userMessage: "شكراً كم سعركم", templates });
    expect(result).toBe("الأسعار تبدأ من 749 جنيه");
  });

  it("empty message returns null", () => {
    const result = tryTemplateMatch({ userMessage: "", templates });
    expect(result).toBeNull();
  });
});
