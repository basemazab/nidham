import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { Button } from "./Button";
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import {
  clockIn,
  clockOut,
  getTodayAttendance,
  type TodayAttendance,
} from "@/lib/attendance";

type Props = { employeeId: string };

// Imperative handle so the parent (home screen) can trigger a refresh
// from its pull-to-refresh gesture without prop drilling state down.
export type AttendanceCardHandle = {
  refresh: () => Promise<void>;
};

// Three-state UI:
//   "fresh"   - no row for today yet -> show big 'Clock in' button
//   "in"      - check_in_at present, check_out_at null -> Clock out button
//   "out"     - both set -> read-only summary with hours
//
// On every state transition we give a haptic pulse so the user feels the
// app responded — even before the success alert renders. Errors get a
// warning pulse so failures feel different from successes without
// requiring the user to read the screen.
export const AttendanceCard = forwardRef<AttendanceCardHandle, Props>(
  function AttendanceCard({ employeeId }, ref) {
    const [today, setToday] = useState<TodayAttendance | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<"in" | "out" | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
      const row = await getTodayAttendance(employeeId);
      setToday(row);
      setLastError(null);
    }, [employeeId]);

    useImperativeHandle(
      ref,
      () => ({ refresh }),
      [refresh],
    );

    useEffect(() => {
      (async () => {
        setLoading(true);
        try {
          await refresh();
        } catch {
          setLastError("مش قادرين نجيب بيانات الحضور");
        } finally {
          setLoading(false);
        }
      })();
    }, [refresh]);

    const handleClockIn = async () => {
      setBusy("in");
      setLastError(null);
      const result = await clockIn();
      setBusy(null);

      if (!result.ok) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
        setLastError(result.error);
        Alert.alert("معذرة", result.error, [
          { text: "موافق" },
          { text: "حاول تاني", onPress: handleClockIn },
        ]);
        return;
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      await refresh();
      const distance = result.distanceMeters;
      Alert.alert(
        "تم تثبيت الحضور ✓",
        distance == null
          ? "تم بنجاح"
          : result.outsideGeofence
            ? `ملاحظة: المسافة من المكتب ${Math.round(distance)} م — خارج النطاق المحدد`
            : `المسافة من المكتب ${Math.round(distance)} م`,
      );
    };

    const handleClockOut = async () => {
      setBusy("out");
      setLastError(null);
      const result = await clockOut();
      setBusy(null);

      if (!result.ok) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
        setLastError(result.error);
        Alert.alert("معذرة", result.error, [
          { text: "موافق" },
          { text: "حاول تاني", onPress: handleClockOut },
        ]);
        return;
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      await refresh();
      const hours = result.hoursWorked ?? 0;
      Alert.alert(
        "تم تسجيل الانصراف ✓",
        `اشتغلت ${hours.toFixed(1)} ساعة اليوم`,
      );
    };

    if (loading) {
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>الحضور اليوم</Text>
          <Text style={styles.body}>جاري التحميل...</Text>
        </View>
      );
    }

    // ---- Three render states ----------------------------------------------

    const checkedIn = !!today?.check_in_at;
    const checkedOut = !!today?.check_out_at;

    if (!checkedIn) {
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>الحضور اليوم</Text>
          <Text style={styles.title}>ابدأ يومك بتثبيت حضور</Text>
          <Text style={styles.body}>
            هنحدد موقعك ونتأكد إنك في المكتب قبل ما نسجّل الحضور.
          </Text>
          {lastError && (
            <Text style={styles.errorBanner}>⚠ {lastError}</Text>
          )}
          <Button
            label="✓ تثبيت حضور"
            onPress={handleClockIn}
            loading={busy === "in"}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      );
    }

    if (!checkedOut) {
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>أنت داخل دلوقتي</Text>
          <Text style={styles.title}>
            ✓ تم الحضور — {formatTime(today.check_in_at)}
          </Text>
          {today.check_in_distance_meters !== null && (
            <Text style={styles.body}>
              المسافة من المكتب: {Math.round(today.check_in_distance_meters)} م
              {today.check_in_outside_geofence && " ⚠"}
            </Text>
          )}
          {lastError && (
            <Text style={styles.errorBanner}>⚠ {lastError}</Text>
          )}
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              marginTop: spacing.lg,
            }}
          >
            <Button
              label="انصراف"
              variant="secondary"
              onPress={handleClockOut}
              loading={busy === "out"}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      );
    }

    // Checked in AND out — read-only summary
    return (
      <View style={[styles.card, styles.cardDone]}>
        <Text style={styles.eyebrow}>اليوم خلص ✓</Text>
        <Text style={styles.title}>
          {formatTime(today.check_in_at)} → {formatTime(today.check_out_at)}
        </Text>
        <Text style={styles.body}>
          إجمالي ساعات العمل: {(today.hours_worked ?? 0).toFixed(1)} ساعة
        </Text>
      </View>
    );
  },
);

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.slate800,
    marginBottom: spacing.lg,
  },
  cardDone: {
    borderColor: colors.emerald600,
  },
  eyebrow: {
    color: colors.cyan,
    fontSize: fontSize.xs,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.slate400,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  errorBanner: {
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: colors.red500,
    borderRadius: radius.md,
    color: colors.red500,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
});
