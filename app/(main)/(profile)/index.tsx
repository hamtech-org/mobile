import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

import { Button } from "@/components/common/Button";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 px-6 py-6 gap-4">
        <Text className="text-foreground text-2xl font-bold">Profile</Text>

        {/* Dark mode toggle */}
        <Pressable
          onPress={toggleTheme}
          className="bg-card border border-border rounded-2xl px-4 py-4 flex-row items-center justify-between active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <View className="size-9 rounded-full bg-primary/10 items-center justify-center">
              <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={isDark ? "#60a5fa" : "#f59e0b"} />
            </View>
            <View>
              <Text className="text-foreground font-medium">Giao diện</Text>
              <Text className="text-muted-foreground text-xs">{isDark ? "Đang dùng chế độ tối" : "Đang dùng chế độ sáng"}</Text>
            </View>
          </View>
          {/* Toggle pill */}
          <View className={`w-12 h-6 rounded-full justify-center px-0.5 ${isDark ? "bg-primary" : "bg-muted"}`}>
            <View className={`size-5 rounded-full bg-white shadow transition-all ${isDark ? "self-end" : "self-start"}`} />
          </View>
        </Pressable>

        <View className="bg-card border border-border rounded-2xl p-4">
          <Text className="text-muted-foreground text-sm">Module profile sẽ được triển khai ở Phase 7.</Text>
        </View>

        <Button label="Đăng xuất" variant="secondary" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}
