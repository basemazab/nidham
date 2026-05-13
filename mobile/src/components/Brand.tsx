import { View, Text, Image, StyleSheet } from "react-native";
import { colors, fontSize, spacing } from "@/lib/theme";

// Nidham logo + product name -- used as the masthead on auth screens.
export function Brand() {
  return (
    <View style={styles.wrap}>
      <Image
        source={require("../../assets/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>نِظام</Text>
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitleArabic}>للموظفين</Text>
        <Text style={styles.subtitleDivider}>·</Text>
        <Text style={styles.subtitleEnglish}>NIDHAM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize["3xl"],
    fontWeight: "900",
    color: colors.white,
    letterSpacing: 1,
  },
  // Arabic + English live in their own <Text> so letterSpacing only
  // ever applies to the Latin part. Spacing on Arabic glyphs would
  // break the connecting joins between letters (renders as "للمو ظفين"
  // instead of "للموظفين").
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  subtitleArabic: {
    fontSize: fontSize.xs,
    color: colors.gold,
    fontWeight: "700",
  },
  subtitleDivider: {
    fontSize: fontSize.xs,
    color: colors.gold,
    fontWeight: "700",
    opacity: 0.5,
  },
  subtitleEnglish: {
    fontSize: fontSize.xs,
    color: colors.gold,
    fontWeight: "700",
    letterSpacing: 4,
  },
});
