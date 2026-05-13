import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost";

type Props = Omit<PressableProps, "style"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : (
        <Text style={[styles.label, { color: textColor[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: "800",
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: colors.cyan,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate300,
  },
  ghost: {
    backgroundColor: "transparent",
  },
};

const textColor: Record<Variant, string> = {
  primary: colors.navy,
  secondary: colors.slate800,
  ghost: colors.slate200,
};
