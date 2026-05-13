import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, fontSize, spacing } from "@/lib/theme";

type Props = {
  title: string;
  subtitle?: string;
};

// Shared header for non-tab screens: back arrow on the right (RTL),
// title + optional subtitle on the left side of the bar. Matches the
// dark brand chrome of the home screen so navigation feels seamless.
export function ScreenHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.back}
        accessibilityLabel="رجوع"
      >
        <Text style={styles.backText}>← رجوع</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  text: { flex: 1 },
  title: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.slate400,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  back: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.cyan,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
});
