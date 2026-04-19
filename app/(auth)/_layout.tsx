import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AuthAmbientBackground } from "@/components/auth/AuthAmbientBackground";

export default function AuthLayout() {
  return (
    <View style={styles.root}>
      <AuthAmbientBackground />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
