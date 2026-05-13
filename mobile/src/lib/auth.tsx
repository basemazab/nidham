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
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpErr) return { error: arabicizeAuthError(signUpErr.message) };

    // GoTrue might require email confirmation; in autoconfirm mode the
    // session is already populated. Either way, the new user's auth.uid()
    // is available to the RPC.
    if (!data.session) {
      // Try signing in to grab a session (autoconfirm mode)
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (siErr) {
        return {
          error:
            "تم إنشاء الحساب — راجع إيميلك وفعّله، ثم سجّل دخول",
        };
      }
    }

    const { error: claimErr } = await supabase.rpc(
      "claim_employee_invitation",
      { p_token: inviteToken.trim() },
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
