import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import {
  getMyPayslip,
  listMyPayslips,
  cycleLabel,
  type PayslipDetail,
  type PayslipSummary,
} from "@/lib/payslips";

// Payslip browser. Master/detail in one screen -- tap a month to expand
// the breakdown (earnings + deductions + net) inline. Avoids a second
// route while still showing the full detail an employee needs to verify
// their pay matches HR's calculations.

export default function PayslipsScreen() {
  const { employee } = useAuth();
  const [list, setList] = useState<PayslipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!employee) return;
    setList(await listMyPayslips(employee.id));
  }, [employee]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const onExpand = async (entryId: string) => {
    if (!employee) return;
    if (expanded === entryId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(entryId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getMyPayslip(entryId, employee.id);
      setDetail(d);
    } catch {
      Alert.alert("معذرة", "ما قدرناش نجيب تفاصيل قسيمة المرتب");
    } finally {
      setDetailLoading(false);
    }
  };

  if (!employee) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScreenHeader title="قسائم الراتب" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="قسائم الراتب" subtitle="مرتباتك الشهرية" />

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
        {loading ? (
          <Text style={styles.bodyDim}>جاري التحميل...</Text>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>لسه مفيش قسائم</Text>
            <Text style={styles.emptyBody}>
              لما HR يعتمد كشف الرواتب الشهري، هتلاقي قسائمك هنا.
            </Text>
          </View>
        ) : (
          list.map((p) => {
            const isOpen = expanded === p.id;
            return (
              <View key={p.id} style={styles.card}>
                <Pressable
                  onPress={() => onExpand(p.id)}
                  style={styles.cardHeader}
                >
                  <View>
                    <Text style={styles.month}>
                      {cycleLabel(p)}
                    </Text>
                    <Text style={styles.subline}>
                      {p.period_status === "paid"
                        ? `✓ تم الصرف${p.paid_at ? " · " + formatDate(p.paid_at) : ""}`
                        : "✓ معتمدة"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-start" }}>
                    <Text style={styles.netSalary}>{formatEGP(p.net_salary)}</Text>
                    <Text style={styles.netLabel}>صافي</Text>
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={styles.detail}>
                    {detailLoading || !detail ? (
                      <Text style={styles.bodyDim}>جاري تحميل التفاصيل...</Text>
                    ) : (
                      <PayslipBreakdown d={detail} />
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PayslipBreakdown({ d }: { d: PayslipDetail }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Section title="الحضور" hideDivider>
        <Row label="أيام الحضور" value={`${d.attended_days} يوم`} />
        {d.half_day_days > 0 && (
          <Row label="أنصاف اليوم" value={`${d.half_day_days}`} />
        )}
        {d.leave_days > 0 && (
          <Row label="أيام الإجازة" value={`${d.leave_days}`} />
        )}
        {d.absent_days > 0 && (
          <Row label="أيام الغياب" value={`${d.absent_days}`} negative />
        )}
      </Section>

      <Section title="الاستحقاقات">
        <Row label="المرتب الأساسي" value={formatEGP(d.basic_salary)} />
        {d.housing_allowance > 0 && (
          <Row label="بدل سكن" value={formatEGP(d.housing_allowance)} />
        )}
        {d.transport_allowance > 0 && (
          <Row label="بدل انتقالات" value={formatEGP(d.transport_allowance)} />
        )}
        {d.other_allowances > 0 && (
          <Row label="بدلات أخرى" value={formatEGP(d.other_allowances)} />
        )}
        {d.bonuses > 0 && (
          <Row label="حوافز" value={formatEGP(d.bonuses)} positive />
        )}
        {d.overtime > 0 && (
          <Row label="أوفر تايم" value={formatEGP(d.overtime)} positive />
        )}
        <Row label="الإجمالي" value={formatEGP(d.gross_salary)} bold />
      </Section>

      <Section title="الاستقطاعات">
        {d.absence_deduction > 0 && (
          <Row label="استقطاع غياب" value={formatEGP(d.absence_deduction)} negative />
        )}
        {d.social_insurance > 0 && (
          <Row label="تأمينات اجتماعية" value={formatEGP(d.social_insurance)} negative />
        )}
        {d.income_tax > 0 && (
          <Row label="ضريبة دخل" value={formatEGP(d.income_tax)} negative />
        )}
        {d.loan_deduction > 0 && (
          <Row label="قسط سلفة" value={formatEGP(d.loan_deduction)} negative />
        )}
        {d.other_deductions > 0 && (
          <Row label="استقطاعات أخرى" value={formatEGP(d.other_deductions)} negative />
        )}
        <Row label="إجمالي الاستقطاعات" value={formatEGP(d.total_deductions)} bold negative />
      </Section>

      <View style={styles.netRow}>
        <Text style={styles.netRowLabel}>الصافي</Text>
        <Text style={styles.netRowValue}>{formatEGP(d.net_salary)}</Text>
      </View>

      {d.notes && (
        <Text style={styles.note}>ملاحظة: {d.notes}</Text>
      )}
    </View>
  );
}

function Section({
  title,
  hideDivider,
  children,
}: {
  title: string;
  hideDivider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, !hideDivider && styles.sectionDivider]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  positive,
  negative,
  bold,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  bold?: boolean;
}) {
  const color = positive
    ? colors.emerald400
    : negative
    ? colors.red400
    : colors.slate200;
  return (
    <View style={styles.rowLine}>
      <Text style={[styles.rowLabel, bold && { fontWeight: "800", color: colors.white }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color }, bold && { fontWeight: "800" }]}>
        {value}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------------------

function formatEGP(value: number): string {
  return value.toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ج";
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
  bodyDim: { color: colors.slate400, fontSize: fontSize.sm },

  emptyCard: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.slate800,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  emptyBody: {
    color: colors.slate400,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 22,
  },

  card: {
    backgroundColor: colors.navyLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate800,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    padding: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  month: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },
  subline: {
    color: colors.emerald400,
    fontSize: fontSize.xs,
    fontWeight: "700",
    marginTop: 2,
  },
  netSalary: {
    color: colors.emerald400,
    fontSize: fontSize.xl,
    fontWeight: "900",
  },
  netLabel: {
    color: colors.slate400,
    fontSize: fontSize.xs,
  },

  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.slate800,
    padding: spacing.lg,
    backgroundColor: colors.navy,
  },

  section: {
    paddingVertical: spacing.sm,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.slate800,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    color: colors.cyan,
    fontSize: fontSize.xs,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLabel: {
    color: colors.slate300,
    fontSize: fontSize.sm,
  },
  rowValue: {
    color: colors.slate200,
    fontSize: fontSize.sm,
    fontVariant: ["tabular-nums"],
  },
  netRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.emerald600,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netRowLabel: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },
  netRowValue: {
    color: colors.emerald400,
    fontSize: fontSize.xl,
    fontWeight: "900",
  },
  note: {
    marginTop: spacing.sm,
    color: colors.gold,
    fontSize: fontSize.xs,
    fontStyle: "italic",
  },
});
