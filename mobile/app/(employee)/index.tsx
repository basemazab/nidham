import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/Button";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

// Phase 2 stub home. Confirms the auth context resolved a linked
// employee row, and reserves the slots that Phase 3 will fill in:
//   - Clock In / Clock Out (GPS-aware)
//   - Today's status
//   - Quick actions (leave / advance / permission)
//   - Latest payslip
export default function HomeScreen() {
  const { user, employee, signOut } = useAuth();
  const isLinked = employee !== null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>
              أهلاً {isLinked ? firstName(employee!.full_name) : "بيك"} 👋
            </Text>
            <Text style={styles.subline}>
              {isLinked ? "اليوم " + today() : user?.email}
            </Text>
          </View>
          <Pressable onPress={signOut} hitSlop={8}>
            <Text style={styles.logout}>خروج</Text>
          </Pressable>
        </View>

        {!isLinked ? (
          <View style={[styles.card, styles.warnCard]}>
            <Text style={styles.warnTitle}>⚠ حسابك مش متربط بأي موظف</Text>
            <Text style={styles.warnBody}>
              المفروض HR في شركتك يكون أضافك كموظف ودّاك كود دعوة. لو معاك كود،
              ادخل بيه. لو لأ، كلّمه عشان يضيفك ويبعتلك الكود.
            </Text>
            <Pressable onPress={() => router.push("/(auth)/claim")}>
              <Text style={styles.warnAction}>عندي كود دعوة دلوقتي ←</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>الحضور اليوم</Text>
            <Text style={styles.statusTitle}>📍 قريبًا — Phase 3</Text>
            <Text style={styles.statusBody}>
              في الإصدار الجاي هتقدر تثبت حضور وانصراف من هنا، والنظام
              هيتأكد إنك في موقع العمل عبر GPS.
            </Text>
            <View style={styles.placeholderBtns}>
              <Button
                label="✓ تثبيت حضور"
                onPress={() => {}}
                disabled
                style={{ flex: 1 }}
              />
              <Button
                label="انصراف"
                variant="secondary"
                onPress={() => {}}
                disabled
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {isLinked && (
          <View style={styles.actionsGrid}>
            <ActionTile icon="🏝️" label="إجازة" disabled hint="Phase 4" />
            <ActionTile icon="💵" label="سلفة" disabled hint="Phase 4" />
            <ActionTile icon="⏰" label="استئذان" disabled hint="Phase 4" />
            <ActionTile icon="🧾" label="قسائم الراتب" disabled hint="Phase 4" />
          </View>
        )}

        <Text style={styles.footer}>
          النسخة 1.0.0 · Nidham Employee
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  label,
  hint,
  disabled,
}: {
  icon: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.tile, disabled && { opacity: 0.4 }]}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {hint && <Text style={styles.tileHint}>{hint}</Text>}
    </View>
  );
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] ?? full;
}

function today(): string {
  return new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  hello: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: "900",
  },
  subline: {
    color: colors.slate400,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  logout: {
    color: colors.red500,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.slate800,
    marginBottom: spacing.lg,
  },
  cardEyebrow: {
    color: colors.cyan,
    fontSize: fontSize.xs,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  statusTitle: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  statusBody: {
    color: colors.slate400,
    fontSize: fontSize.sm,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  placeholderBtns: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.navyLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate800,
    padding: spacing.lg,
    alignItems: "center",
  },
  tileIcon: { fontSize: 32, marginBottom: spacing.xs },
  tileLabel: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  tileHint: {
    color: colors.gold,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  warnCard: {
    backgroundColor: colors.navyLight,
    borderColor: colors.amber500,
  },
  warnTitle: {
    color: colors.amber500,
    fontSize: fontSize.md,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  warnBody: {
    color: colors.slate300,
    fontSize: fontSize.sm,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  warnAction: {
    color: colors.cyan,
    fontSize: fontSize.md,
    fontWeight: "800",
  },
  footer: {
    textAlign: "center",
    color: colors.slate500,
    fontSize: fontSize.xs,
    marginTop: spacing["2xl"],
  },
});
