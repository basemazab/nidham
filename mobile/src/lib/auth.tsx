// React context that exposes the current Supabase session + actions.
// Wrap the app once at the root layout; every screen can then call
// `useAuth()` to read the user or trigger sign-in/sign-out/claim.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type EmployeeContext = {
  id: string;
  full_name: string;
  company_id: string;
} | null;

type AuthState = {
  loading: boolean;          // initial session restore in progress
  session: Session | null;
  user: User | null;
  employee: EmployeeContext;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUpAndClaim: (
    email: string,
    password: string,
    inviteToken: string,
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshEmployee: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeeContext>(null);

  // Resolve the linked employee row for the current user (if any).
  // Fires after every auth state change so the UI knows whether the
  // signed-in user is a linked employee, a pure HR account, or neither.
  const resolveEmployee = async (s: Session | null) => {
    if (!s) {
      setEmployee(null);
      return;
    }
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, company_id")
      .eq("user_id", s.user.id)
      .maybeSingle();
    setEmployee(data ?? null);
  };

  // Initial load: restore the persisted session from SecureStore.
  // We give the storage + Supabase auth at most 5 seconds before we
  // give up and render the (logged-out) login screen. Without the
  // safety net, a flaky SecureStore read or network blip would leave
  // the app stuck on the splash spinner forever.
  useEffect(() => {
    let mounted = true;
    let bailed = false;
    const bailTimer = setTimeout(() => {
      if (!mounted) return;
      bailed = true;
      console.warn("Auth init timed out after 5s -- proceeding logged out");
      setLoading(false);
    }, 5000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted || bailed) return;
        setSession(data.session);
        await resolveEmployee(data.session);
      } catch (err) {
        console.warn("Auth init failed", err);
      } finally {
        clearTimeout(bailTimer);
        if (mounted && !bailed) setLoading(false);
      }
    })();
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        await resolveEmployee(newSession);
      },
    );
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? { error: arabicizeAuthError(error.message) } : {};
  };

  const signUpAndClaim: AuthState["signUpAndClaim"] = async (
    email,
    password,
    inviteToken,
  ) => {
    const trimmedEmail = email.trim();
    const trimmedToken = inviteToken.trim();

    // Pass the invite token in raw_user_meta_data so migration 021's
    // handle_new_user "Path 0" can link the employee row + create the
    // employee-role profile in one atomic trigger run. The standalone
    // claim_employee_invitation RPC is now a fallback for edge cases
    // (e.g. user already had an account, didn't go through signup).
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { employee_invite_token: trimmedToken },
      },
    });

    let hasSession = !!signUpData?.session;

    if (signUpErr) {
      // The email might be left over from a previous failed attempt --
      // signup throws 'user_already_exists' even though the row isn't
      // linked to any employee. Fall back to signing in with the same
      // password and let the fallback claim RPC finish the linking.
      const msg = signUpErr.message.toLowerCase();
      const alreadyExists =
        msg.includes("already registered") ||
        msg.includes("user already") ||
        signUpErr.code === "user_already_exists";
      if (!alreadyExists) {
        return { error: arabicizeAuthError(signUpErr.message) };
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInErr) {
        return {
          error:
            "الإيميل ده مسجّل قبل كده وكلمة السر مش مطابقة. جرّب إيميل جديد أو نفس كلمة السر اللي حطيتها قبل.",
        };
      }
      hasSession = true;
    }

    // Even on a clean signup the session may be missing if auto-confirm
    // isn't on. One more login attempt covers that case.
    if (!hasSession) {
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (siErr) {
        return {
          error:
            "تم إنشاء الحساب لكن الإيميل لازم يتأكد. ادخل إعدادات Supabase وقفّل Confirm Email.",
        };
      }
    }

    // Did handle_new_user's Path 0 already link the employee? Check
    // via a direct query against the freshly-fetched session, because
    // refreshEmployee() depends on react-state `session` which hasn't
    // ticked yet -- if we relied on it we'd briefly flash the "not
    // linked" warning on the home screen before onAuthStateChange
    // catches up.
    const { data: sessAfter } = await supabase.auth.getSession();
    const userId = sessAfter.session?.user.id;
    if (userId) {
      const linkedNow = await supabase
        .from("employees")
        .select("id, full_name, company_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (linkedNow.data) {
        // Drive React state directly from the query result so the
        // home screen renders the linked-employee branch on the first
        // paint after signup.
        setSession(sessAfter.session);
        setEmployee(linkedNow.data);
        return {};
      }
    }

    // Fallback: token didn't make it through the trigger (signup
    // already existed, token malformed, etc.). Call the strict RPC.
    const { error: claimErr } = await supabase.rpc(
      "claim_employee_invitation",
      { p_token: trimmedToken },
    );
    if (claimErr) {
      return { error: claimErr.message };
    }
    await refreshEmployee();
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setEmployee(null);
  };

  const refreshEmployee = async () => {
    await resolveEmployee(session);
  };

  return (
    <AuthCtx.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        employee,
        signIn,
        signUpAndClaim,
        signOut,
        refreshEmployee,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ----------------------------------------------------------------------------
// Best-effort translation of Supabase auth errors into Arabic.
// Falls through to the original message if no rule matches.
// ----------------------------------------------------------------------------
function arabicizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "البريد أو كلمة السر غلط";
  if (m.includes("email not confirmed"))
    return "لازم تفعّل الإيميل الأول";
  if (m.includes("user already registered"))
    return "الإيميل ده مسجّل قبل كده — جرّب تسجيل الدخول";
  if (m.includes("password should be"))
    return "كلمة السر قصيرة جدًا (6 حروف على الأقل)";
  if (m.includes("network") || m.includes("fetch"))
    return "مفيش اتصال بالإنترنت";
  return message;
}
