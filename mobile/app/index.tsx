import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

// Decides where the user lands after the splash screen. Each branch is a
// single declarative Redirect -- no manual navigation calls.
export default function Index() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cyan} />
      </View>
    );
  }

  return <Redirect href={session ? "/(employee)" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
  },
});
