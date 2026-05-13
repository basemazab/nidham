import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Brand } from "@/components/Brand";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { colors, fontSize, spacing } from "@/lib/theme";

// Flow:
//   HR creates the employee row in the dashboard and clicks "Generate
//   invitation". We hand the employee the resulting UUID (paper / SMS /
//   WhatsApp). The employee opens the mobile app, taps "عندك كود دعوة"
//   on the login screen, fills email + password + the code, and we:
//     1. supabase.auth.signUp(email, password)
//     2. supabase.rpc('claim_employee_invitation', { p_token: code })
//   That second call links the new auth user to the employees row and
//   creates a profile row with role='employee'.
export default function ClaimScreen() {
  const { signUpAndClaim } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password || !token.trim()) {
      setError("اكتب الإيميل وكلمة السر وكود الدعوة");
      return;
    }
    if (password.length < 6) {
      setError("كلمة السر لازم 6 حروف على الأقل");
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: err } = await signUpAndClaim(email, password, token);
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }
    router.replace("/(employee)");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Brand />

          <View style={styles.card}>
            <Text style={styles.title}>إنشاء حساب جديد</Text>
            <Text style={styles.sub}>
              لازم يكون عندك كود دعوة من الـ HR في شركتك
            </Text>

            <Input
              label="الإيميل"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={{ textAlign: "left" }}
            />

            <Input
              label="كلمة السر"
              hint="6 حروف على الأقل"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              style={{ textAlign: "left" }}
            />

            <Input
              label="كود الدعوة"
              hint="من الـ HR"
              value={token}
              onChangeText={setToken}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ textAlign: "left", fontFamily: "Courier" }}
            />

            {error && <Text style={styles.error}>⚠ {error}</Text>}

            <Button
              label="أنشئ الحساب وادخل"
              onPress={handleSubmit}
              loading={submitting}
              style={{ marginTop: spacing.md }}
            />

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.backBtnText}>
                ← رجوع لتسجيل الدخول
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.navyLight,
    borderRadius: 20,
    padding: spacing["2xl"],
    borderWidth: 1,
    borderColor: colors.slate800,
  },
  title: {
    color: colors.white,
    fontSize: fontSize["2xl"],
    fontWeight: "900",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  sub: {
    color: colors.slate400,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.red500,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginVertical: spacing.sm,
    fontWeight: "600",
  },
  backBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  backBtnText: {
    color: colors.cyan,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
