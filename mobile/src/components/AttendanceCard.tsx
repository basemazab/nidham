import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Button } from "./Button";
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import {
  clockIn,
  clockOut,
  getTodayAttendance,
  type TodayAttendance,
} from "@/lib/attendance";

type Props = { employeeId: string };

// Three-state UI:
//   "fresh"   - no row for today yet -> show big 'Clock in' button
//   "in"      - check_in_at present, check_out_at null -> Clock out button
//   "out"     - both set -> read-only summary with hours
//
// Distance + outside-geofence are surfaced for transparency: HR can
// configure the office as a 100 m radius and we tell the employee
// 'You were 42 m from the office' on each clock-in so they don't get
// surprises later when HR opens the timesheet.
export function AttendanceCard({ employeeId }: Props) {
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  const refresh = useCallback(async () => {
    const row = await getTodayAttendance(employeeId);
    setToday(row);
  }, [employeeId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const handleClockIn = async () => {
    setBusy("in");
    const result = await clockIn();
    setBusy(null);

    if (!result.ok) {
      Alert.alert("معذرة", result.error);
      return;
    }

    await refresh();
    const distance = result.distanceMeters;
    Alert.alert(
      "تم تثبيت الحضور ✓",
      distance == null
        ? "تم بنجاح"
        : result.outsideGeofence
          ? `ملاحظة: المسافة من المكتب ${Math.round(distance)} م -- خارج النطاق المحدد`
          : `المسافة من المكتب ${Math.round(distance)} م`,
    );
  };

  const handleClockOut = async () => {
    setBusy("out");
    const result = await clockOut();
    setBusy(null);

    if (!result.ok) {
      Alert.alert("معذرة", result.error);
      return;
    }

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

  // ---- Three render states -------------------------------------------------

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
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
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

  // Checked in AND out -- read-only summary
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
}

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
});
