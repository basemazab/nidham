import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost";

type Props = Omit<PressableProps, "style"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
  /** Disable the built-in haptic tap. Useful when the action itself
      will fire a stronger haptic (e.g. clock-in success). */
  noHaptic?: boolean;
};

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  style,
  noHaptic,
  onPress,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;

  // Wrap onPress so every Button press fires a light tap haptic
  // unconditionally — gives the whole app a tactile feel without
  // touching call sites. Stronger haptics for success/error stay
  // in the calling code.
  const handlePress = (e: GestureResponderEvent) => {
    if (!noHaptic) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
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
