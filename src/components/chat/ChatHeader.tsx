import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/components/common/Avatar";
import { useIconColors } from "@/hooks/useIconColors";
import type { Conversation } from "@/store/api/chatApi";

interface ChatHeaderProps {
  conversation: Conversation;
  /** Trạng thái online (chat 1-1) */
  isOnline?: boolean;
  /** Số thành viên (chat group) */
  memberCount?: number;
  onBack?: () => void;
}

/**
 * ChatHeader — header cho màn hình chat detail.
 * - Back button (Android)
 * - Avatar + tên conversation
 * - Subtitle: "Đang hoạt động" / "X thành viên" / "Offline"
 * - Action buttons: Video call, Audio call, Info
 */
export const ChatHeader = ({ conversation, isOnline = false, memberCount, onBack }: ChatHeaderProps) => {
  const isGroup = conversation.type === "group";
  const { foreground } = useIconColors();
  const handleBack = onBack ?? (() => router.back());

  // Subtitle: group → số thành viên, 1-1 → trạng thái online
  const subtitle = isGroup ? (memberCount !== undefined ? `${memberCount} thành viên` : "Nhóm") : isOnline ? "Đang hoạt động" : "Offline";

  return (
    <View className="flex-row items-center gap-2 px-2 py-2 border-b border-border/40 bg-background">
      {/* Back button */}
      <Pressable onPress={handleBack} className="p-2 rounded-full active:bg-muted" hitSlop={6} accessibilityLabel="Quay lại">
        <Ionicons name="arrow-back" size={22} color={foreground} />
      </Pressable>

      {/* Avatar + Info — ấn vào mở thông tin conversation */}
      <Pressable className="flex-1 flex-row items-center gap-2.5 active:opacity-80">
        <Avatar uri={conversation.avatar} name={conversation.name} size="sm" showOnlineDot={!isGroup && isOnline} isGroup={isGroup} />
        <View className="flex-1">
          <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
            {conversation.name ?? "Hội thoại"}
          </Text>
          <Text className={`text-xs ${isOnline && !isGroup ? "text-green-500" : "text-muted-foreground"}`} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>

      {/* Action buttons */}
      <View className="flex-row items-center gap-0.5">
        {/* Gọi video */}
        <Pressable className="p-2 rounded-full active:bg-muted" hitSlop={6} accessibilityLabel="Gọi video">
          <Ionicons name="videocam-outline" size={22} color={foreground} />
        </Pressable>

        {/* Gọi thoại */}
        <Pressable className="p-2 rounded-full active:bg-muted" hitSlop={6} accessibilityLabel="Gọi thoại">
          <Ionicons name="call-outline" size={22} color={foreground} />
        </Pressable>

        {/* Thông tin */}
        <Pressable className="p-2 rounded-full active:bg-muted" hitSlop={6} accessibilityLabel="Thông tin cuộc trò chuyện">
          <Ionicons name="information-circle-outline" size={22} color={foreground} />
        </Pressable>
      </View>
    </View>
  );
};
