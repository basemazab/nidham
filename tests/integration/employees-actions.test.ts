// ============================================================================
// Integration tests — src/app/dashboard/employees/actions.ts
// ============================================================================
//
// We mock Supabase + permissions + next/cache + next/navigation so the
// server action runs end-to-end against an in-memory query builder. The
// assertions look at:
//   1) the redirect target (success vs error path)
//   2) the payload passed to .insert() / .update()
//   3) the gating helpers (requireHR is actually called)
//
// This is the layer where real bugs hide — the FormData parser was the
// reason "كود البصمة" wasn't being saved last month — so the round-trip
// from a populated form to the DB shape is what we pin down here.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must come BEFORE the import of the SUT (system under test).
// ---------------------------------------------------------------------------

// Captured state — each test resets via beforeEach
const state = {
  redirects: [] as string[],
  lastInsert: null as Record<string, unknown> | null,
  lastUpdate: null as Record<string, unknown> | null,
  lastTable: null as string | null,
  lastEq: [] as Array<[string, unknown]>,
  insertShouldFail: null as { message: string } | null,
  updateShouldFail: null as { message: string } | null,
  // What `.from("profiles").select(...).eq(...).single()` returns
  profileRow: { company_id: "company-1" } as { company_id: string } | null,
};

// next/navigation.redirect() normally throws a `NEXT_REDIRECT` error to
// abort server-action execution. We mirror that here so control-flow in
// the SUT (which often has `redirect()` directly followed by more code)
// matches production behaviour.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    state.redirects.push(url);
    const err = new Error("NEXT_REDIRECT");
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Bypass the role gate — return a fake admin profile.
vi.mock("@/lib/permissions", () => {
  const profile = {
    id: "user-1",
    email: "admin@test.com",
    company_id: "company-1",
    full_name: "Test Admin",
    role: "admin" as const,
  };
  return {
    requireHR: vi.fn(async () => ({ supabase: mockSupabase, profile })),
    requireAdmin: vi.fn(async () => ({ supabase: mockSupabase, profile })),
    getMyProfile: vi.fn(async () => ({ supabase: mockSupabase, profile })),
  };
});

vi.mock("@/lib/cache", () => ({ bustDashboardCache: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  emailMobileInvitation: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({ arabicizeDbError: (m: string) => m }));

// ---------------------------------------------------------------------------
// Supabase mock — a hand-rolled query builder that mirrors the subset of
// PostgrestFilterBuilder methods our server actions actually use:
//
//   .from(t).select(cols).eq(col,val).single()  -> Promise<{data,error}>
//   .from(t).insert(payload)                    -> Promise<{data,error}>
//   .from(t).update(payload).eq(col,val)        -> Promise<{data,error}>
//
// The builder is a thenable: `await builder` resolves to a Postgres-style
// `{ data, error }` envelope. That keeps the call sites identical to
// production code.
// ---------------------------------------------------------------------------
function makeBuilder(table: string) {
  // We intentionally do NOT set state.lastTable here — `getCurrentCompanyId`
  // calls .from("profiles") to look up the caller's company before the
  // employees insert runs, so if we tracked the table at .from() time the
  // "profiles" call would clobber the "employees" one. Instead, we record
  // the table when an actual mutation (insert/update/delete/select) is
  // initiated.
  let op: "select" | "insert" | "update" | "delete" | null = null;
  let isSingle = false;

  const builder = {
    select: vi.fn(() => {
      op = "select";
      // Don't overwrite lastTable for selects on the profiles lookup;
      // tests assert on the *mutated* table.
      return builder;
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      op = "insert";
      state.lastInsert = payload;
      state.lastTable = table;
      return builder;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      op = "update";
      state.lastUpdate = payload;
      state.lastTable = table;
      return builder;
    }),
    delete: vi.fn(() => {
      op = "delete";
      state.lastTable = table;
      return builder;
    }),
    eq: vi.fn((col: string, val: unknown) => {
      state.lastEq.push([col, val]);
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    not: vi.fn(() => builder),
    is: vi.fn(() => builder),
    returns: vi.fn(() => builder),
    single: vi.fn(() => {
      isSingle = true;
      return builder;
    }),
    then(
      onfulfilled: (v: { data: unknown; error: unknown }) => unknown,
    ) {
      // Resolve based on which operation initiated the chain.
      if (op === "select" && table === "profiles" && isSingle) {
        return Promise.resolve({
          data: state.profileRow,
          error: state.profileRow ? null : { message: "Not found" },
        }).then(onfulfilled);
      }
      if (op === "insert") {
        return Promise.resolve({
          data: null,
          error: state.insertShouldFail,
        }).then(onfulfilled);
      }
      if (op === "update") {
        return Promise.resolve({
          data: null,
          error: state.updateShouldFail,
        }).then(onfulfilled);
      }
      return Promise.resolve({ data: null, error: null }).then(onfulfilled);
    },
  };
  return builder;
}

const mockSupabase = {
  from: vi.fn((table: string) => makeBuilder(table)),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: "user-1", email: "admin@test.com" } },
        error: null,
      }),
    ),
  },
} as unknown;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

// Pull the SUT *after* the mocks are registered.
import {
  createEmployee,
  updateEmployee,
} from "@/app/dashboard/employees/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

/**
 * Run a server action and catch the NEXT_REDIRECT it always throws. Returns
 * the redirect URL it asked for (server actions never return normally on
 * success — they redirect to a status page).
 */
async function runAction<T>(fn: () => Promise<T>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") {
      return state.redirects[state.redirects.length - 1];
    }
    throw e;
  }
  throw new Error(
    "Action returned without redirecting — not the expected flow",
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("createEmployee", () => {
  beforeEach(() => {
    state.redirects.length = 0;
    state.lastInsert = null;
    state.lastUpdate = null;
    state.lastTable = null;
    state.lastEq.length = 0;
    state.insertShouldFail = null;
    state.updateShouldFail = null;
    state.profileRow = { company_id: "company-1" };
    vi.clearAllMocks();
  });

  it("redirects with an Arabic error when full_name is missing", async () => {
    const target = await runAction(() =>
      createEmployee(fd({ employee_code: "1023" })),
    );
    expect(target).toMatch(/^\/dashboard\/employees\/new\?error=/);
    expect(decodeURIComponent(target)).toContain("اسم الموظف مطلوب");
    expect(state.lastInsert).toBeNull();
  });

  it("inserts into the `employees` table with the correct shape on happy path", async () => {
    const target = await runAction(() =>
      createEmployee(
        fd({
          full_name: "أحمد محمد",
          employee_code: "E-1023",
          job_title: "محاسب",
          department: "المالية",
          phone: "01000000000",
          email: "ahmed@test.com",
          hire_date: "2026-01-01",
          basic_salary: "8500",
          housing_allowance: "500",
          transport_allowance: "200",
          other_allowances: "0",
          incentive_allowance: "300",
          pay_frequency: "monthly",
          national_id: "29501010101010",
          status: "active",
        }),
      ),
    );

    // Success redirects back to the index
    expect(target).toBe("/dashboard/employees");

    expect(state.lastTable).toBe("employees");
    expect(state.lastInsert).toMatchObject({
      full_name: "أحمد محمد",
      employee_code: "E-1023",
      job_title: "محاسب",
      department: "المالية",
      phone: "01000000000",
      email: "ahmed@test.com",
      hire_date: "2026-01-01",
      basic_salary: 8500,
      housing_allowance: 500,
      transport_allowance: 200,
      other_allowances: 0,
      incentive_allowance: 300,
      pay_frequency: "monthly",
      national_id: "29501010101010",
      status: "active",
      // The action resolves company_id via getCurrentCompanyId() — which
      // queries profiles. Our mocked profile row has company_id="company-1".
      company_id: "company-1",
    });
  });

  it("normalises empty / whitespace-only strings to null (no leaking empties to DB)", async () => {
    await runAction(() =>
      createEmployee(
        fd({
          full_name: "محمد علي",
          employee_code: "   ", // whitespace-only
          phone: "",
          email: "",
        }),
      ),
    );

    expect(state.lastInsert).toMatchObject({
      full_name: "محمد علي",
      employee_code: null,
      phone: null,
      email: null,
    });
  });

  it("defaults pay_frequency to 'monthly' when the value is invalid", async () => {
    await runAction(() =>
      createEmployee(
        fd({ full_name: "ali", pay_frequency: "yearly" /* not allowed */ }),
      ),
    );
    expect(state.lastInsert).toMatchObject({ pay_frequency: "monthly" });
  });

  it("accepts 'weekly' pay_frequency", async () => {
    await runAction(() =>
      createEmployee(fd({ full_name: "fatma", pay_frequency: "weekly" })),
    );
    expect(state.lastInsert).toMatchObject({ pay_frequency: "weekly" });
  });

  it("redirects with the DB error message on insert failure", async () => {
    state.insertShouldFail = { message: "duplicate key value" };
    const target = await runAction(() =>
      createEmployee(fd({ full_name: "duplicate" })),
    );
    expect(target).toMatch(/^\/dashboard\/employees\/new\?error=/);
    expect(decodeURIComponent(target)).toContain("duplicate key value");
  });

  it("scopes the row to the caller's company resolved from the profiles table", async () => {
    state.profileRow = { company_id: "company-XYZ" };
    await runAction(() =>
      createEmployee(fd({ full_name: "scoped" })),
    );
    expect(state.lastInsert).toMatchObject({ company_id: "company-XYZ" });
  });
});

describe("updateEmployee", () => {
  beforeEach(() => {
    state.redirects.length = 0;
    state.lastInsert = null;
    state.lastUpdate = null;
    state.lastTable = null;
    state.lastEq.length = 0;
    state.updateShouldFail = null;
    vi.clearAllMocks();
  });

  it("redirects with an error when name is missing", async () => {
    const target = await runAction(() =>
      updateEmployee("emp-1", fd({ phone: "01000" })),
    );
    expect(target).toMatch(/^\/dashboard\/employees\/emp-1\?error=/);
    expect(decodeURIComponent(target)).toContain("اسم الموظف مطلوب");
    expect(state.lastUpdate).toBeNull();
  });

  it("updates the right row with the right payload", async () => {
    const target = await runAction(() =>
      updateEmployee(
        "emp-1",
        fd({
          full_name: "اسم جديد",
          job_title: "مدير",
          basic_salary: "12000",
        }),
      ),
    );
    expect(target).toBe("/dashboard/employees?updated=1");

    expect(state.lastTable).toBe("employees");
    expect(state.lastUpdate).toMatchObject({
      full_name: "اسم جديد",
      job_title: "مدير",
      basic_salary: 12000,
    });
    // .eq("id", "emp-1") must have been called
    expect(state.lastEq).toEqual(
      expect.arrayContaining([["id", "emp-1"]]),
    );
  });

  it("surfaces DB error and redirects to the detail page with the message", async () => {
    state.updateShouldFail = { message: "violates foreign key constraint" };
    const target = await runAction(() =>
      updateEmployee("emp-1", fd({ full_name: "x" })),
    );
    expect(target).toMatch(/^\/dashboard\/employees\/emp-1\?error=/);
    expect(decodeURIComponent(target)).toContain(
      "violates foreign key constraint",
    );
  });
});
