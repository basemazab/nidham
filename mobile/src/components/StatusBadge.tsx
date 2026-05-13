import { View, Text, StyleSheet } from "react-native";
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import type { RequestStatus } from "@/lib/requests";
import { STATUS_LABELS } from "@/lib/requests";

type Props = { status: RequestStatus };

// Coloured pill that renders the Arabic label for a request status.
// Centralised so leave / advance / permission screens all share the
// same palette and shape.
export function StatusBadge({ status }: Props) {
  const c = COLORS[status];
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const COLORS: Record<RequestStatus, { bg: string; fg: string; border: string }> = {
  pending:   { bg: "#3a2e15", fg: colors.gold,      border: "#54421d" },
  approved:  { bg: "#0f3a2c", fg: colors.emerald400, border: "#1b5a45" },
  rejected:  { bg: "#3a1818", fg: colors.red400,     border: "#5a2424" },
  cancelled: { bg: "#1f2733", fg: colors.slate400,   border: "#2b3645" },
  paid:      { bg: "#0a2e3a", fg: colors.cyan,       border: "#13455a" },
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "800",
  },
});
