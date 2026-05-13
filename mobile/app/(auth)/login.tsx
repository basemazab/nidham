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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError("اكتب الإيميل وكلمة السر");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: err } = await signIn(email, password);
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
            <Text style={styles.title}>تسجيل الدخول</Text>
            <Text style={styles.sub}>
              ادخل بإيميلك اللي إداك إياه مسؤول الـ HR
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
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              style={{ textAlign: "left" }}
            />

            {error && <Text style={styles.error}>⚠ {error}</Text>}

            <Button
              label="تسجيل دخول"
              onPress={handleSubmit}
              loading={submitting}
              style={{ marginTop: spacing.md }}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>أو</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={() => router.push("/(auth)/claim")}
              style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.inviteBtnText}>
                عندك كود دعوة من HR؟ →
              </Text>
            </Pressable>
          </View>

          <Text style={styles.support}>
            مشكلة تسجيل الدخول؟ كلّم الـ HR.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.slate700,
  },
  dividerText: {
    color: colors.slate500,
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
  },
  inviteBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  inviteBtnText: {
    color: colors.cyan,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  support: {
    color: colors.slate500,
    fontSize: fontSize.xs,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
