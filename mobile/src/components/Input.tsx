import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

type Props = TextInputProps & {
  label: string;
  hint?: string;
};

// Labelled text input matching the Nidham web app's form styling.
// RTL Arabic by default; pass `dir="ltr"` style overrides where needed
// (e.g. email + password fields where Latin is typed).
export function Input({ label, hint, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {hint && <Text style={styles.hint}>  ·  {hint}</Text>}
      </Text>
      <TextInput
        placeholderTextColor={colors.slate400}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.slate100,
    fontSize: fontSize.sm,
    fontWeight: "700",
    marginBottom: spacing.sm,
    textAlign: "right",
  },
  hint: {
    color: colors.slate400,
    fontSize: fontSize.xs,
    fontWeight: "400",
  },
  input: {
    backgroundColor: colors.white,
    color: colors.slate900,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    fontSize: fontSize.md,
    textAlign: "right",
  },
});
