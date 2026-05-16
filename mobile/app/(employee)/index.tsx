import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import { AttendanceCard, type AttendanceCardHandle } from "@/components/AttendanceCard";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

// Employee home screen. Renders:
//   - The GPS-aware attendance card (clock in/out + today's status)
//   - The four self-service tiles below, each routing to its screen
//     (leave / advance / permission / payslips) -- all wired and live.
//
// Pull-to-refresh refreshes the attendance card so the user can sync
// state without backgrounding the app. Sign-out explicitly navigates
// back to login — without it, an aged session would briefly show the
// employee tiles before the route guard catches up.
export default function HomeScreen() {
  const { user, employee, signOut, refreshEmployee } = useAuth();
  const isLinked = employee !== null;
  const attendanceRef = useRef<AttendanceCardHandle>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshEmployee(),
        attendanceRef.current?.refresh() ?? Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshEmployee]);

  const handleSignOut = useCallback(() => {
    Alert.alert("تسجيل خروج", "متأكد عايز تخرج من التطبيق؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          await signOut();
          // Explicit navigation — the (employee)/_layout guard would
          // redirect on the next render too, but doing it eagerly
          // avoids a single frame of stale UI.
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.cyan}
            colors={[colors.cyan]}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>
              أهلاً {isLinked ? firstName(employee!.full_name) : "بيك"} 👋
            </Text>
            <Text style={styles.subline}>
              {isLinked ? "اليوم " + today() : user?.email}
            </Text>
          </View>
          <Pressable
            onPress={handleSignOut}
            hitSlop={12}
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
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
            <Pressable
              onPress={() => router.push("/(auth)/claim")}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.warnAction}>عندي كود دعوة دلوقتي ←</Text>
            </Pressable>
          </View>
        ) : (
          <AttendanceCard ref={attendanceRef} employeeId={employee!.id} />
        )}

        {isLinked && (
          <View style={styles.actionsGrid}>
            <ActionTile
              icon="🏝️"
              label="إجازة"
              onPress={() => router.push("/(employee)/leave")}
            />
            <ActionTile
              icon="💵"
              label="سلفة"
              onPress={() => router.push("/(employee)/advance")}
            />
            <ActionTile
              icon="⏰"
              label="استئذان"
              onPress={() => router.push("/(employee)/permission")}
            />
            <ActionTile
              icon="🧾"
              label="قسائم الراتب"
              onPress={() => router.push("/(employee)/payslips")}
            />
          </View>
        )}

        <Text style={styles.footer}>
          النسخة 1.0.0 · Nidham Employee
        </Text>
        <Text style={styles.footerHint}>
          اسحب لتحت لتحديث الصفحة
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
  onPress,
}: {
  icon: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const handlePress = async () => {
    if (disabled) return;
    await Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tile,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.7, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {hint && <Text style={styles.tileHint}>{hint}</Text>}
    </Pressable>
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
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.slate800,
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
  footerHint: {
    textAlign: "center",
    color: colors.slate600,
    fontSize: 11,
    marginTop: 4,
  },
});
