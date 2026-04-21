import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Info, Phone, Video } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation, TypingUserEntry } from "@/types/chat.types";

interface ChatHeaderProps {
  conversation: IConversation;
  /** Trạng thái online (chat 1-1) */
  isOnline?: boolean;
  /** Số thành viên (chat group) */
  memberCount?: number;
  /** Danh sách người đang gõ */
  typingUsers?: TypingUserEntry[];
  /** ID user hiện tại — để lọc typing */
  currentUserId?: string;
  onBack?: () => void;
  onPressInfo?: () => void;
  onPressCall?: () => void;
  onPressVideoCall?: () => void;
}

/**
 * ChatHeader — header cho màn hình chat detail.
 * - Back button
 * - Avatar + tên conversation + subtitle (typing / online / member count)
 * - Action buttons: Video call, Audio call, Info
 */
export const ChatHeader = ({
  conversation,
  isOnline = false,
  memberCount,
  typingUsers = [],
  currentUserId,
  onBack,
  onPressInfo,
  onPressCall,
  onPressVideoCall,
}: ChatHeaderProps) => {
  const isGroup = conversation.type === "group";
  const { foreground, primary } = useIconColors();
  const handleBack = onBack ?? (() => router.back());

  // Lọc typing users (bỏ chính mình)
  const othersTyping = currentUserId
    ? typingUsers.filter((u) => u.userId !== currentUserId)
    : typingUsers;

  // Subtitle: typing > online status > member count
  let subtitle: string;
  let subtitleColor = "text-muted-foreground";

  if (othersTyping.length > 0) {
    subtitle =
      othersTyping.length === 1
        ? `${othersTyping[0].displayName || "Ai đó"} đang gõ...`
        : `${othersTyping.length} người đang gõ...`;
    subtitleColor = "text-primary";
  } else if (isGroup) {
    subtitle = memberCount !== undefined ? `${memberCount} thành viên` : "Nhóm";
  } else {
    subtitle = isOnline ? "Đang hoạt động" : "Offline";
    if (isOnline) subtitleColor = "text-green-500";
  }

  return (
    <View className="flex-row items-center border-b border-border/30 bg-background px-2 py-2">
      {/* Back */}
      <Pressable onPress={handleBack} className="p-2 active:opacity-60" hitSlop={8}>
        <ChevronLeft size={28} color={foreground} strokeWidth={1.5} />
      </Pressable>

      {/* Avatar + info */}
      <Pressable
        onPress={onPressInfo}
        className="flex-1 flex-row items-center gap-3 px-1 active:opacity-80"
      >
        <Avatar
          uri={conversation.avatar || undefined}
          name={conversation.name || undefined}
          size="md"
          showOnlineDot={!isGroup && isOnline}
          isGroup={isGroup}
        />
        <View className="flex-1">
          <Text className="text-[18px] font-bold text-foreground" numberOfLines={1}>
            {conversation.name ?? "Hội thoại"}
          </Text>
          <Text className={`text-[13px] ${subtitleColor}`} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>

      {/* Actions */}
      <View className="flex-row items-center">
        <Pressable onPress={onPressCall} className="p-2 active:opacity-60" hitSlop={6}>
          <Phone size={24} color={primary} strokeWidth={1.5} />
        </Pressable>
        <Pressable onPress={onPressVideoCall} className="p-2 active:opacity-60" hitSlop={6}>
          <Video size={25} color={primary} strokeWidth={1.5} />
        </Pressable>
        <Pressable onPress={onPressInfo} className="p-2 active:opacity-60" hitSlop={6}>
          <Info size={25} color={foreground} strokeWidth={1.5} />
        </Pressable>
      </View>
    </View>
  );
};
