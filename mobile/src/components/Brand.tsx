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
      <Text style={styles.subtitle}>NIDHAM · للموظفين</Text>
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
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.gold,
    letterSpacing: 4,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});
