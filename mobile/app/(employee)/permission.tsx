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
    setSubmitting(true);
    const r = await createPermissionRequest({
      permissionType: type,
      permissionDate: date,
      fromTime: showTimes && fromTime ? fromTime : null,
      toTime: showTimes && toTime ? toTime : null,
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
                placeholder="09:00"
                placeholderTextColor={colors.slate500}
                style={styles.input}
                maxLength={5}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>إلى (HH:MM)</Text>
              <TextInput
                value={toTime}
                onChangeText={setToTime}
                placeholder="11:00"
                placeholderTextColor={colors.slate500}
                style={styles.input}
                maxLength={5}
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
