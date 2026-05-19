import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";

import { useAppSelector } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import { formatUnreadBadge } from "@/utils/chatBadge";

export function NotificationBellButton() {
  const colors = useIconColors();
  const unreadCount = useAppSelector((s) => s.inboxNotification.unreadCount);
  const badge = formatUnreadBadge(unreadCount);

  return (
    <Pressable
      onPress={() => router.push("/(main)/(notifications)")}
      className="relative rounded-full p-2"
      accessibilityLabel="Thông báo"
    >
      <Bell size={22} color={colors.foreground} strokeWidth={1.8} />
      {badge ? (
        <View className="absolute right-0.5 top-0.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1">
          <Text className="text-[10px] font-bold text-white">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
