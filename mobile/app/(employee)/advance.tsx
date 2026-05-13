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
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import {
  cancelPendingRequest,
  createAdvanceRequest,
  listMyAdvanceRequests,
  type AdvanceRequest,
} from "@/lib/requests";

// Advance / loan screen. Employees submit an amount + installments;
// HR approves on the dashboard side. Once status='paid' is set, the
// row appears here marked "تم الصرف" with paid_at.

export default function AdvanceScreen() {
  const { employee } = useAuth();
  const [list, setList] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employee) return;
    setList(await listMyAdvanceRequests(employee.id));
  }, [employee]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const onCancel = async (id: string) => {
    Alert.alert("إلغاء الطلب", "هتلغي طلب السلفة. متأكد؟", [
      { text: "رجوع", style: "cancel" },
      {
        text: "نعم",
        style: "destructive",
        onPress: async () => {
          setBusyId(id);
          const r = await cancelPendingRequest("advance_requests", id);
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
        <ScreenHeader title="السلف" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="السلف" subtitle="طلبات السلف والأقساط" />

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
            label="+ طلب سلفة جديدة"
            onPress={() => setFormOpen(true)}
            style={{ marginBottom: spacing.lg }}
          />
        ) : (
          <NewAdvanceForm
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
                <Text style={styles.amount}>{formatEGP(r.amount)}</Text>
                <StatusBadge status={r.status} />
              </View>
              <Text style={styles.body}>
                {r.installments} قسط على{" "}
                {Math.ceil(r.installments)} شهر
              </Text>
              {r.reason && <Text style={styles.reason}>{r.reason}</Text>}
              {r.hr_notes && (
                <Text style={styles.hrNote}>ملاحظة HR: {r.hr_notes}</Text>
              )}
              {r.paid_at && (
                <Text style={styles.paidNote}>
                  ✓ تم الصرف في {formatDate(r.paid_at)}
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

function NewAdvanceForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("3");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    const inst = parseInt(installments, 10);

    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("ناقص", "اكتب مبلغ صحيح أكبر من صفر");
      return;
    }
    if (!Number.isFinite(inst) || inst < 1 || inst > 24) {
      Alert.alert("ناقص", "عدد الأقساط لازم بين 1 و 24");
      return;
    }

    setSubmitting(true);
    const r = await createAdvanceRequest({
      amount: amt,
      installments: inst,
      reason: reason.trim() || null,
    });
    setSubmitting(false);

    if (!r.ok) {
      Alert.alert("معذرة", r.error);
      return;
    }
    Alert.alert(
      "تم الإرسال ✓",
      "طلب السلفة راح لـ HR للموافقة. هتشوف الرد قريب هنا.",
    );
    onSuccess();
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>طلب سلفة جديدة</Text>

      <Text style={styles.label}>المبلغ (جنيه مصري)</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="مثلاً: 5000"
        placeholderTextColor={colors.slate500}
        style={styles.input}
        inputMode="numeric"
      />

      <Text style={styles.label}>عدد الأقساط (1-24)</Text>
      <View style={styles.chipRow}>
        {[1, 2, 3, 6, 12].map((n) => (
          <Pressable
            key={n}
            onPress={() => setInstallments(String(n))}
            style={[
              styles.chip,
              installments === String(n) && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                installments === String(n) && styles.chipTextActive,
              ]}
            >
              {n}
            </Text>
          </Pressable>
        ))}
        <TextInput
          value={installments}
          onChangeText={setInstallments}
          style={[styles.input, styles.installmentInput]}
          placeholder="..."
          placeholderTextColor={colors.slate500}
          inputMode="numeric"
          maxLength={2}
        />
      </View>

      <Text style={styles.label}>السبب (اختياري)</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="مثلاً: مصاريف طارئة"
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

function formatEGP(value: number): string {
  return value.toLocaleString("ar-EG") + " ج";
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
  });
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
  installmentInput: {
    minWidth: 60,
    padding: spacing.xs,
    paddingHorizontal: spacing.md,
    textAlign: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
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
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.navy,
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
  amount: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "900",
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
  paidNote: {
    color: colors.emerald400,
    fontSize: fontSize.xs,
    fontWeight: "700",
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
