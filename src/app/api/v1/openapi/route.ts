import { NextResponse } from "next/server";

const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Nidham HR API",
    version: "1.0.0",
    description:
      "واجهة برمجة تطبيقات رسمية لنظام نِظام للموارد البشرية والمرتبات.\nمتوافقة مع قانون العمل المصري 12/2003 وقانون التأمينات 148/2019.",
    contact: {
      name: "فريق نِظام",
      email: "api@nidhamhr.com",
      url: "https://www.nidhamhr.com",
    },
  },
  servers: [
    { url: "https://www.nidhamhr.com/api/v1", description: "الإنتاج" },
    { url: "http://localhost:3000/api/v1", description: "تطوير محلي" },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API key",
        description: "مفتاح API تحصل عليه من لوحة التحكم → الإعدادات → مفاتيح API",
      },
    },
    schemas: {
      Employee: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          employee_code: { type: "string" },
          full_name: { type: "string" },
          job_title: { type: "string" },
          department: { type: "string" },
          phone: { type: "string" },
          email: { type: "string", format: "email" },
          status: { type: "string", enum: ["active", "inactive", "terminated"] },
          hire_date: { type: "string", format: "date" },
          basic_salary: { type: "number" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      PayrollEntry: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          employee: { $ref: "#/components/schemas/Employee" },
          gross_salary: { type: "number" },
          net_salary: { type: "number" },
          social_insurance: { type: "number" },
          income_tax: { type: "number" },
          bonuses: { type: "number" },
          overtime: { type: "number" },
          total_deductions: { type: "number" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          status: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/employees": {
      get: {
        tags: ["الموظفين"],
        summary: "قائمة الموظفين",
        description: "جلب قائمة الموظفين مع إمكانية التصفية والترقيم",
        security: [{ bearerAuth: ["employees:read"] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
            description: "رقم الصفحة",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, maximum: 100 },
            description: "عدد النتائج في الصفحة",
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["active", "inactive", "terminated"] },
            description: "تصفية حسب الحالة",
          },
          {
            name: "department",
            in: "query",
            schema: { type: "string" },
            description: "تصفية حسب القسم",
          },
        ],
        responses: {
          "200": {
            description: "قائمة الموظفين",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Employee" } },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        total: { type: "integer" },
                        total_pages: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "غير مصرح - مفتاح API غير صالح" },
          "403": { description: "صلاحية غير كافية" },
        },
      },
      post: {
        tags: ["الموظفين"],
        summary: "إضافة موظف جديد",
        security: [{ bearerAuth: ["employees:write"] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["full_name"],
                properties: {
                  full_name: { type: "string" },
                  job_title: { type: "string" },
                  department: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string" },
                  basic_salary: { type: "number" },
                  hire_date: { type: "string", format: "date" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "تم إنشاء الموظف" },
          "400": { description: "بيانات غير صالحة" },
        },
      },
    },
    "/payroll": {
      get: {
        tags: ["المرتبات"],
        summary: "قائمة المرتبات",
        security: [{ bearerAuth: ["payroll:read"] }],
        parameters: [
          {
            name: "period_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
            description: "تصفية حسب فترة المرتبات",
          },
        ],
        responses: {
          "200": {
            description: "قائمة المرتبات",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PayrollEntry" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "الموظفين", description: "إدارة الموظفين" },
    { name: "المرتبات", description: "بيانات المرتبات والتأمينات" },
  ],
};

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
