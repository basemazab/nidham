import type { Metadata } from "next";
import { IndustryPage, type IndustryPageData } from "@/components/industry-page";

// Target: "نظام HR للمطاعم" / "إدارة موظفين مطعم" / "حضور وانصراف مطعم"

export const metadata: Metadata = {
  title: "نظام HR للمطاعم والكافيهات في مصر — ورديات + بقشيش | نِظام HR",
  description:
    "نظام HR متخصص للمطاعم والكافيهات: جدولة ورديات الويترز والشيفات، حساب البقشيش (Tips Pool)، حضور بالموبايل، حساب الأوفر تايم بنسب القانون.",
  alternates: { canonical: "/industries/restaurants" },
};

const data: IndustryPageData = {
  slug: "restaurants",
  badge: "متخصص للمطاعم والكافيهات",
  h1: "نظام HR للمطاعم — مصمم لإيقاع الـ F&B",
  subhead:
    "جدولة الورديات المتغيرة، توزيع البقشيش بشفافية، إدارة الـ Casual staff، وحساب المرتبات لـ Servers و Chefs و Hosts كلهم في نظام واحد.",
  audienceLabel: "للمطاعم",
  painPoints: [
    {
      icon: "📅",
      problem: "ورديات بتتغيّر يومياً",
      cost: "ساعتين كل يوم في الجدول",
    },
    {
      icon: "💵",
      problem: "توزيع البقشيش بدون شفافية",
      cost: "خلافات + موظفين بيسيبوا",
    },
    {
      icon: "⏱️",
      problem: "موظفين Part-time + Full-time",
      cost: "حسابات مختلفة كل شهر",
    },
    {
      icon: "🥡",
      problem: "Turnover عالي = موظفين جداد كل شهر",
      cost: "ورق + Onboarding مرهق",
    },
  ],
  features: [
    {
      icon: "📆",
      title: "جدولة ورديات ذكية",
      description:
        "حدّد المناصب (Server, Chef, Host, Cashier) + المتطلبات لكل وردية. النظام يقترح أفضل توزيع حسب توافر الموظفين.",
    },
    {
      icon: "💰",
      title: "Tips Pool (توزيع البقشيش)",
      description:
        "يتسجّل البقشيش يومياً، النظام يوزّعه على الموظفين الحاضرين بنسب قابلة للتخصيص. شفاف وعادل.",
    },
    {
      icon: "👥",
      title: "Part-time + Full-time + Casual",
      description:
        "3 أنواع توظيف بحسابات مختلفة. النظام بيتعامل مع كلهم في نفس Dashboard.",
    },
    {
      icon: "📱",
      title: "حضور من الموبايل",
      description:
        "الموظف يدوّر QR Code في المطعم، أو يستخدم GPS. مفيش بصمة محتاج صيانة.",
    },
    {
      icon: "🆕",
      title: "Onboarding سريع للموظفين الجداد",
      description:
        "موظف جديد كل أسبوع؟ النظام بياخد نسخة من البطاقة + التوقيع الإلكتروني + يطبع نموذج 1 في 5 دقايق.",
    },
    {
      icon: "🍽️",
      title: "تقارير الأقسام",
      description:
        "Kitchen / Service / Bar — تقارير منفصلة لكل قسم: تكلفة العمالة، الـ Tips، الأداء.",
    },
  ],
  proofPoint:
    "سلسلة كافيهات في القاهرة فيها 4 فروع و 28 موظف، وفّرت 5 ساعات/أسبوع في جدولة الورديات + قللت الـ Turnover 30% بعد ما الموظفين بقوا شايفين رواتبهم وبقشيشهم بشفافية.",
  faqs: [
    {
      question: "كم تكلفة النظام لمطعم بـ 15 موظف؟",
      answer: "باقة Starter بـ 749 جنيه/شهر لحتى 25 موظف. مناسبة للمطعم/الكافيه المتوسط.",
    },
    {
      question: "هل بيحسب البقشيش حسب الساعات اللي اشتغلها الموظف؟",
      answer:
        "أيوة، تقدر تختار: توزيع بالتساوي، أو بنسبة الساعات، أو بنسبة قيمة الفواتير (Server-specific tips). إنت اللي تحدد السياسة.",
    },
    {
      question: "موظف Part-time بياخد التأمينات؟",
      answer:
        "حسب القانون 148/2019: لو الموظف بياخد أكتر من 8 ساعات/أسبوع منتظمة، لازم يكون مسجّل في التأمينات. النظام بيحسب التأمينات بنسبة ساعاته الفعلية.",
    },
    {
      question: "هل النظام يربط مع نظام الـ POS؟",
      answer:
        "ممكن — عبر الـ REST API. تقدر تربط أنظمة POS زي Square و Fawaterk وغيرهم.",
    },
    {
      question: "إيه يحصل لو موظف ساب الشغل بدون إخطار؟",
      answer:
        "تسجّل تاريخ المغادرة، النظام بيحسب المستحقات الباقية ويطبع نموذج 6 (ترك خدمة) لتقدّمه للتأمينات.",
    },
  ],
};

export default function RestaurantsPage() {
  return <IndustryPage data={data} />;
}
