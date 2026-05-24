import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

import { Button } from "@/components/common/Button";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { useAppSelector } from "@/hooks/useAppStore";
import { formatUnreadBadge } from "@/utils/chatBadge";

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const inboxUnread = useAppSelector((s) => s.inboxNotification.unreadCount);
  const inboxBadge = formatUnreadBadge(inboxUnread);

  const toggleTheme = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Tôi" />
      <View className="flex-1 gap-4 px-6 py-4">
        <Pressable
          onPress={() => router.push("/(main)/(notifications)")}
          className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-full bg-primary/10">
              <Ionicons name="notifications-outline" size={20} color="#2563eb" />
            </View>
            <View>
              <Text className="font-medium text-foreground">Thông báo</Text>
              <Text className="text-xs text-muted-foreground">Hoạt động, bạn bè, bảng tin</Text>
            </View>
          </View>
          {inboxBadge ? (
            <View className="min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5">
              <Text className="text-[11px] font-bold text-white">{inboxBadge}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color="hsl(220 10% 60%)" />
          )}
        </Pressable>

        {/* Dark mode toggle */}
        <Pressable
          onPress={toggleTheme}
          className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-full bg-primary/10">
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={20}
                color={isDark ? "#60a5fa" : "#f59e0b"}
              />
            </View>
            <View>
              <Text className="font-medium text-foreground">Giao diện</Text>
              <Text className="text-xs text-muted-foreground">
                {isDark ? "Đang dùng chế độ tối" : "Đang dùng chế độ sáng"}
              </Text>
            </View>
          </View>
          {/* Toggle pill */}
          <View
            className={`h-6 w-12 justify-center rounded-full px-0.5 ${isDark ? "bg-primary" : "bg-muted"}`}
          >
            <View
              className={`size-5 rounded-full bg-white shadow transition-all ${isDark ? "self-end" : "self-start"}`}
            />
          </View>
        </Pressable>

        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-sm text-muted-foreground">
            Module profile sẽ được triển khai ở Phase 7.
          </Text>
        </View>

        <Button label="Đăng xuất" variant="secondary" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}
