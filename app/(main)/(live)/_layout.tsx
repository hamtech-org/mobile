import { Stack } from "expo-router";

export default function LiveStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[sessionId]/host" />
      <Stack.Screen
        name="[sessionId]/watch"
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
    </Stack>
  );
}
