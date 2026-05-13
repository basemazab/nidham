import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, fontSize, radius, spacing } from "@/lib/theme";

type Props = {
  label: string;
  value: string;                  // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

// Wraps the native iOS / Android date picker behind a Pressable that
// shows the formatted Arabic date. Stores back to a yyyy-mm-dd string
// so the parent form (and the RPC) never has to deal with Date objects.
//
// iOS shows the spinner inline; Android pops a modal -- we hide the
// component again as soon as the user picks (or cancels).
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: Props) {
  const [open, setOpen] = useState(false);

  // Parse yyyy-mm-dd into a real Date for the picker. Fall back to today.
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date();

  const display = value
    ? parsed.toLocaleDateString("ar-EG", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "اختار التاريخ";

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.input,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {display}
        </Text>
      </Pressable>

      {open && (
        <DateTimePicker
          value={parsed}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          // iOS: keep open until user dismisses elsewhere.
          // Android: the picker auto-closes; we mirror that on iOS too
          // so the form doesn't get stuck in spinner mode forever.
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === "dismissed" || !selected) return;
            const iso = toIso(selected);
            onChange(iso);
          }}
        />
      )}
    </View>
  );
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
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
    minHeight: 50,
    justifyContent: "center",
  },
  value: {
    color: colors.white,
    fontSize: fontSize.md,
    textAlign: "right",
  },
  placeholder: {
    color: colors.slate500,
  },
});
