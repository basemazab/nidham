import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import {
  cancelPendingRequest,
  createPermissionRequest,
  listMyPermissionRequests,
  PERMISSION_TYPE_LABELS,
  type PermissionRequest,
  type PermissionType,
} from "@/lib/requests";

// Permission screen -- "إذن" / late-arrival / early-leave / errand /
// remote-day. Compact form: type chip + date + optional from/to time.

const PERMISSION_TYPES: PermissionType[] = [
  "late_arrival",
  "early_leave",
  "errand",
  "remote_day",
  "other",
];

export default function PermissionScreen() {
  const { employee } = useAuth();
  const [list, setList] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employee) return;
    setList(await listMyPermissionRequests(employee.id));
  }, [employee]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const onCancel = async (id: string) => {
    Alert.alert("إلغاء الطلب", "هتلغي الاستئذان ده. متأكد؟", [
      { text: "رجوع", style: "cancel" },
      {
        text: "نعم",
        style: "destructive",
        onPress: async () => {
          setBusyId(id);
          const r = await cancelPendingRequest("permission_requests", id);
          setBusyId(null);
          if (!r.ok) {
            Alert.alert("معذرة", r.error);
            return;
          }
          await refresh();
        },
      },
    ]);
  };

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScreenHeader title="الاستئذان" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title="الاستئذان"
        subtitle="تأخير / مغادرة مبكرة / مأمورية"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={colors.cyan}
          />
        }
      >
        {!formOpen ? (
          <Button
            label="+ طلب استئذان جديد"
            onPress={() => setFormOpen(true)}
            style={{ marginBottom: spacing.lg }}
          />
        ) : (
          <NewPermissionForm
            onCancel={() => setFormOpen(false)}
            onSuccess={async () => {
              setFormOpen(false);
              await refresh();
            }}
          />
        )}

        <Text style={styles.sectionTitle}>طلباتي السابقة</Text>

        {loading ? (
          <Text style={styles.bodyDim}>جاري التحميل...</Text>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.bodyDim}>مفيش طلبات لسه</Text>
          </View>
        ) : (
          list.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.type}>
                  {PERMISSION_TYPE_LABELS[r.permission_type]}
                </Text>
                <StatusBadge status={r.status} />
              </View>
              <Text style={styles.body}>
                {formatDate(r.permission_date)}
                {r.from_time && r.to_time
                  ? ` (${trimTime(r.from_time)} → ${trimTime(r.to_time)})`
                  : ""}
              </Text>
              {r.reason && <Text style={styles.reason}>{r.reason}</Text>}
              {r.hr_notes && (
                <Text style={styles.hrNote}>ملاحظة HR: {r.hr_notes}</Text>
              )}
              {r.status === "pending" && (
                <Pressable
                  onPress={() => onCancel(r.id)}
                  disabled={busyId === r.id}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>
                    {busyId === r.id ? "..." : "إلغاء الطلب"}
                  </Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NewPermissionForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<PermissionType>("late_arrival");
  const [date, setDate] = useState(todayIso());
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showTimes = type === "late_arrival" || type === "early_leave" || type === "errand";

  const submit = async () => {
    if (!date) {
      Alert.alert("ناقص", "اختار التاريخ");
      return;
    }

    // Normalize + validate the time inputs before they hit the DB.
    // Postgres time columns reject anything not in HH:MM[:SS] format —
    // a raw "9" was 404'ing the request server-side. We accept lenient
    // input ("9", "9:5", "09:30") and produce a canonical "HH:MM",
    // or null for empty. If parsing fails for a non-empty input we
    // show an Arabic error and bail out before the network call.
    let normalizedFrom: string | null = null;
    let normalizedTo: string | null = null;

    if (showTimes) {
      if (fromTime.trim()) {
        const parsed = normalizeTime(fromTime);
        if (!parsed) {
          Alert.alert("وقت غلط", "اكتب وقت البدء بصيغة HH:MM — مثلاً 09:00");
          return;
        }
        normalizedFrom = parsed;
      }
      if (toTime.trim()) {
        const parsed = normalizeTime(toTime);
        if (!parsed) {
          Alert.alert("وقت غلط", "اكتب وقت الانتهاء بصيغة HH:MM — مثلاً 11:30");
          return;
        }
        normalizedTo = parsed;
      }
      // Sanity check: end > start (when both provided)
      if (normalizedFrom && normalizedTo && normalizedTo <= normalizedFrom) {
        Alert.alert(
          "ترتيب غلط",
          "وقت الانتهاء لازم يكون بعد وقت البدء",
        );
        return;
      }
    }

    setSubmitting(true);
    const r = await createPermissionRequest({
      permissionType: type,
      permissionDate: date,
      fromTime: normalizedFrom,
      toTime: normalizedTo,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert("معذرة", r.error);
      return;
    }
    Alert.alert("تم الإرسال ✓", "طلبك راح لـ HR للموافقة.");
    onSuccess();
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>طلب استئذان جديد</Text>

      <Text style={styles.label}>النوع</Text>
      <View style={styles.chipRow}>
        {PERMISSION_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            style={[styles.chip, type === t && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, type === t && styles.chipTextActive]}
            >
              {PERMISSION_TYPE_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      <DateField label="التاريخ" value={date} onChange={setDate} />

      {showTimes && (
        <>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>من (HH:MM)</Text>
              <TextInput
                value={fromTime}
                onChangeText={setFromTime}
                onBlur={() => {
                  // Auto-canonicalize on blur so the user SEES "09:00"
                  // before they submit instead of finding out in an alert.
                  const norm = normalizeTime(fromTime);
                  if (norm) setFromTime(norm);
                }}
                placeholder="09:00"
                placeholderTextColor={colors.slate500}
                style={styles.input}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>إلى (HH:MM)</Text>
              <TextInput
                value={toTime}
                onChangeText={setToTime}
                onBlur={() => {
                  const norm = normalizeTime(toTime);
                  if (norm) setToTime(norm);
                }}
                placeholder="11:00"
                placeholderTextColor={colors.slate500}
                style={styles.input}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        </>
      )}

      <Text style={styles.label}>السبب (اختياري)</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="مثلاً: زيارة طبيب"
        placeholderTextColor={colors.slate500}
        style={[styles.input, { minHeight: 60 }]}
        multiline
      />

      <View style={styles.formButtons}>
        <Button
          label="إلغاء"
          variant="secondary"
          onPress={onCancel}
          style={{ flex: 1 }}
        />
        <Button
          label="إرسال"
          onPress={submit}
          loading={submitting}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function trimTime(t: string): string {
  // "09:30:00" -> "09:30"
  return t.slice(0, 5);
}

/**
 * Normalize a lenient time string to canonical "HH:MM".
 *
 * Accepts:
 *   "9"      → "09:00"
 *   "09"     → "09:00"
 *   "9:5"    → "09:05"
 *   "09:30"  → "09:30"
 *   "9:30 ص" → "09:30"          (Arabic AM/PM dropped — assume 24h)
 *   "  9 "   → "09:00"          (whitespace ignored)
 *
 * Returns null for:
 *   "" / undefined         (empty input — caller decides what to do)
 *   "25:00" / "09:75"      (out-of-range hour or minute)
 *   "abc" / "9:5:5:5"      (garbage)
 *
 * The Postgres `time` type accepts "HH:MM:SS" or "HH:MM"; we return
 * "HH:MM" because seconds aren't user-visible anywhere in the product
 * and adding ":00" would mislead the operator.
 */
function normalizeTime(raw: string): string | null {
  if (!raw) return null;
  // Strip Arabic AM/PM markers + any non-digit/colon character.
  const cleaned = raw
    .trim()
    .replace(/ص|م|am|pm|AM|PM/gi, "")
    .trim();
  if (!cleaned) return null;

  // Split on colon. Allow "9" → ["9"] (hours-only) or "9:30" → ["9","30"].
  const parts = cleaned.split(":");
  if (parts.length > 2) return null;

  const h = parseInt(parts[0], 10);
  const m = parts.length === 2 ? parseInt(parts[1], 10) : 0;

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] },

  sectionTitle: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: "800",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  formCard: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cyan,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  label: {
    color: colors.slate300,
    fontSize: fontSize.xs,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.slate700,
    backgroundColor: colors.navy,
  },
  chipActive: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  chipText: {
    color: colors.slate300,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
  chipTextActive: { color: colors.navy },
  input: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate700,
    padding: spacing.md,
    color: colors.white,
    fontSize: fontSize.md,
    textAlign: "right",
  },
  timeRow: { flexDirection: "row", gap: spacing.sm },
  timeField: { flex: 1 },
  formButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  emptyCard: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.slate800,
  },
  bodyDim: { color: colors.slate400, fontSize: fontSize.sm },

  card: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate800,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  type: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: "800",
  },
  body: {
    color: colors.slate300,
    fontSize: fontSize.sm,
    marginTop: 4,
  },
  reason: {
    color: colors.slate400,
    fontSize: fontSize.xs,
    marginTop: 4,
    fontStyle: "italic",
  },
  hrNote: {
    color: colors.gold,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  cancelBtn: {
    alignSelf: "flex-end",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red500,
  },
  cancelBtnText: {
    color: colors.red500,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
