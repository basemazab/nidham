import { Stack } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

// Gate: any screen under (employee)/ requires an authenticated session.
// If signed out, push back to /login. The loading state is the brief
// window during initial session restore from SecureStore.
export default function EmployeeLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cyan} />
      </View>
    );
  }
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
  },
});
