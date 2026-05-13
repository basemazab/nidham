import { useEffect, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
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

  // Deep-link entry: `nidham://claim?token=...` carries the invitation
  // token in the URL so the field is pre-filled. The QR codes the
  // dashboard generates use this exact format -- one tap on the camera
  // notification opens the app right here.
  const params = useLocalSearchParams<{ token?: string }>();
  const incomingToken =
    typeof params.token === "string" ? params.token : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(incomingToken);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromQR, setFromQR] = useState(!!incomingToken);

  // If the user navigates back-and-forth and a new token arrives, sync.
  useEffect(() => {
    if (incomingToken && incomingToken !== token) {
      setToken(incomingToken);
      setFromQR(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingToken]);

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

            {fromQR && (
              <View style={styles.qrBanner}>
                <Text style={styles.qrBannerText}>
                  ✓ تم تحميل كود الدعوة من الـ QR
                </Text>
              </View>
            )}

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
  qrBanner: {
    backgroundColor: "rgba(34,211,238,0.10)",
    borderColor: colors.cyan,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  qrBannerText: {
    color: colors.cyan,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
});
