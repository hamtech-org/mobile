import "../src/theme/global.css";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return <Stack screenOptions={{ headerShown: false }} />;
}
