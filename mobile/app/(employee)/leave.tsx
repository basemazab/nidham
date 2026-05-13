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
  createLeaveRequest,
  getMySummary,
  listMyLeaveRequests,
  LEAVE_TYPE_LABELS,
  type LeaveRequest,
  type LeaveType,
  type MySummary,
} from "@/lib/requests";

// Leave screen: top half shows balance pills + a collapsible "new request"
// form, bottom half lists past requests with status badges + a cancel
// button on pending rows.

const LEAVE_TYPE_OPTIONS: LeaveType[] = [
  "annual",
  "casual",
  "sick",
  "unpaid",
  "hajj",
  "bereavement",
  "other",
];

export default function LeaveScreen() {
  const { employee } = useAuth();
  const [summary, setSummary] = useState<MySummary | null>(null);
  const [list, setList] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employee) return;
    const [s, items] = await Promise.all([
      getMySummary(),
      listMyLeaveRequests(employee.id),
    ]);
    setSummary(s);
    setList(items);
  }, [employee]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const onCancel = async (id: string) => {
    Alert.alert("إلغاء الطلب", "هتلغي الطلب ده. متأكد؟", [
      { text: "رجوع", style: "cancel" },
      {
        text: "نعم",
        style: "destructive",
        onPress: async () => {
          setBusyId(id);
          const r = await cancelPendingRequest("leave_requests", id);
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
        <ScreenHeader title="إجازات" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            حسابك مش متربط بأي موظف.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title="إجازاتي"
        subtitle="رصيدك السنوي وطلباتك"
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
        {/* Balance cards */}
        <View style={styles.balanceRow}>
          <BalanceCard
            label="اعتيادية"
            remaining={summary?.annual_remaining ?? 0}
          />
          <BalanceCard
            label="عارضة"
            remaining={summary?.casual_remaining ?? 0}
          />
          <BalanceCard
            label="مرضية"
            remaining={summary?.sick_remaining ?? 0}
          />
        </View>

        {/* New request toggle */}
        {!formOpen ? (
          <Button
            label="+ طلب إجازة جديد"
            onPress={() => setFormOpen(true)}
            style={{ marginBottom: spacing.lg }}
          />
        ) : (
          <NewLeaveForm
            onCancel={() => setFormOpen(false)}
            onSuccess={async () => {
              setFormOpen(false);
              await refresh();
            }}
          />
        )}

        {/* List */}
        <Text style={styles.sectionTitle}>طلباتي السابقة</Text>

        {loading ? (
          <Text style={styles.bodyDim}>جاري التحميل...</Text>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.bodyDim}>مفيش طلبات لسه</Text>
          </View>
        ) : (
          list.map((r) => (
            <View key={r.id} style={styles.requestCard}>
              <View style={styles.requestRow}>
                <Text style={styles.requestType}>
                  {LEAVE_TYPE_LABELS[r.leave_type]}
                </Text>
                <StatusBadge status={r.status} />
              </View>
              <Text style={styles.requestBody}>
                {formatDateRange(r.start_date, r.end_date)} ({r.days_count} يوم)
              </Text>
              {r.reason && (
                <Text style={styles.requestReason}>{r.reason}</Text>
              )}
              {r.hr_notes && (
                <Text style={styles.requestHrNote}>
                  ملاحظة HR: {r.hr_notes}
                </Text>
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

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function BalanceCard({
  label,
  remaining,
}: {
  label: string;
  remaining: number;
}) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceValue}>{remaining}</Text>
      <Text style={styles.balanceUnit}>يوم</Text>
      <Text style={styles.balanceLabel}>{label}</Text>
    </View>
  );
}

function NewLeaveForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!startDate || !endDate) {
      Alert.alert("ناقص", "اختار تاريخ البداية والنهاية");
      return;
    }
    setSubmitting(true);
    const r = await createLeaveRequest({
      leaveType,
      startDate,
      endDate,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert("معذرة", r.error);
      return;
    }
    Alert.alert(
      "تم الإرسال ✓",
      `طلبك (${r.data!.daysCount} يوم) راح لـ HR للموافقة.\nرصيدك المتبقي: ${r.data!.remainingBalance} يوم`,
    );
    onSuccess();
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>طلب إجازة جديد</Text>

      {/* Type chips */}
      <Text style={styles.label}>النوع</Text>
      <View style={styles.chipRow}>
        {LEAVE_TYPE_OPTIONS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setLeaveType(t)}
            style={[styles.chip, leaveType === t && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                leaveType === t && styles.chipTextActive,
              ]}
            >
              {LEAVE_TYPE_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Dates */}
      <View style={styles.dateRow}>
        <DateField
          label="من"
          value={startDate}
          onChange={setStartDate}
          minimumDate={new Date(Date.now() - 7 * 24 * 3600 * 1000)}
        />
        <DateField
          label="إلى"
          value={endDate}
          onChange={setEndDate}
          minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
        />
      </View>
      <Text style={styles.label}>السبب (اختياري)</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="مثلاً: سفر، ظرف عائلي..."
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
          label="إرسال للموافقة"
          onPress={submit}
          loading={submitting}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
  };
  const s = new Date(start).toLocaleDateString("ar-EG", opts);
  const e = new Date(end).toLocaleDateString("ar-EG", opts);
  if (start === end) return s;
  return `من ${s} إلى ${e}`;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.slate400, fontSize: fontSize.md },

  balanceRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.navyLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate800,
    padding: spacing.md,
    alignItems: "center",
  },
  balanceValue: {
    color: colors.white,
    fontSize: fontSize["2xl"],
    fontWeight: "900",
  },
  balanceUnit: {
    color: colors.slate400,
    fontSize: fontSize.xs,
  },
  balanceLabel: {
    color: colors.cyan,
    fontSize: fontSize.xs,
    fontWeight: "700",
    marginTop: spacing.xs,
  },

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
  chipTextActive: {
    color: colors.navy,
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dateField: { flex: 1 },
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
  helpText: {
    color: colors.slate500,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
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

  requestCard: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate800,
    marginBottom: spacing.sm,
  },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  requestType: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: "800",
  },
  requestBody: {
    color: colors.slate300,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  requestReason: {
    color: colors.slate400,
    fontSize: fontSize.xs,
    marginTop: 4,
    fontStyle: "italic",
  },
  requestHrNote: {
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
