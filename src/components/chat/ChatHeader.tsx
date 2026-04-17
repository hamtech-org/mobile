import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Info, Phone, Video } from "lucide-react-native";

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
  const { foreground, primary } = useIconColors();
  const handleBack = onBack ?? (() => router.back());

  // Subtitle: group → số thành viên, 1-1 → trạng thái online
  const subtitle = isGroup ? (memberCount !== undefined ? `${memberCount} thành viên` : "Nhóm") : isOnline ? "Đang hoạt động" : "Offline";

  return (
    <View className="flex-row items-center bg-background border-b border-border/30 px-2 py-2">
      {/* Back */}
      <Pressable onPress={handleBack} className="p-2 active:opacity-60" hitSlop={8}>
        <ChevronLeft size={28} color={foreground} strokeWidth={1.5} />
      </Pressable>

      {/* Avatar + info */}
      <Pressable className="flex-1 flex-row items-center gap-3 px-1 active:opacity-80">
        <Avatar uri={conversation.avatar} name={conversation.name} size="md" showOnlineDot={!isGroup && isOnline} isGroup={isGroup} />
        <View className="flex-1">
          <Text className="text-foreground font-bold text-[18px]" numberOfLines={1}>
            {conversation.name ?? "Hội thoại"}
          </Text>
          <Text className={`text-[13px] ${isOnline && !isGroup ? "text-green-500" : "text-muted-foreground"}`} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>

      {/* Actions */}
      <View className="flex-row items-center">
        <Pressable className="p-2 active:opacity-60" hitSlop={6}>
          <Phone size={24} color={primary} strokeWidth={1.5} />
        </Pressable>
        <Pressable className="p-2 active:opacity-60" hitSlop={6}>
          <Video size={25} color={primary} strokeWidth={1.5} />
        </Pressable>
        <Pressable className="p-2 active:opacity-60" hitSlop={6}>
          <Info size={25} color={foreground} strokeWidth={1.5} />
        </Pressable>
      </View>
    </View>
  );
};
