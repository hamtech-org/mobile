import { Pressable, Text, View } from "react-native";
import { ChevronLeft, Info, Phone, Search, Video } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { safeRouterBack } from "@/utils/navigation";
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
  /** Tìm trong hội thoại (giống web — cạnh nút gọi). */
  onPressSearch?: () => void;
  onPressCall?: () => void;
  onPressVideoCall?: () => void;
  videoCtaVariant?: "icon" | "join";
  videoCtaLabel?: string;
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
  onPressSearch,
  onPressCall,
  onPressVideoCall,
  videoCtaVariant = "icon",
  videoCtaLabel,
}: ChatHeaderProps) => {
  const isGroup = conversation.type === "group";
  const { foreground, primary } = useIconColors();
  const handleBack = onBack ?? (() => safeRouterBack("/(main)/(chat)"));

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

      {/* Actions — thứ tự giống web: tìm cạnh gọi, rồi video, rồi thông tin */}
      <View className="flex-row items-center">
        <Pressable
          onPress={onPressSearch}
          disabled={!onPressSearch}
          className={`p-2 active:opacity-60 ${!onPressSearch ? "opacity-35" : ""}`}
          hitSlop={6}
        >
          <Search size={24} color={primary} strokeWidth={1.75} />
        </Pressable>
        {!isGroup ? (
          <Pressable onPress={onPressCall} className="p-2 active:opacity-60" hitSlop={6}>
            <Phone size={24} color={primary} strokeWidth={1.5} />
          </Pressable>
        ) : null}
        {videoCtaVariant === "join" ? (
          <Pressable
            onPress={onPressVideoCall}
            className="ml-1 flex-row items-center gap-2 rounded-full bg-green-600 px-3 py-2 active:opacity-80"
            hitSlop={6}
          >
            <Video size={20} color="#fff" strokeWidth={1.7} />
            <Text className="font-semibold text-white">{videoCtaLabel ?? "Tham gia"}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onPressVideoCall} className="p-2 active:opacity-60" hitSlop={6}>
            <Video size={25} color={primary} strokeWidth={1.5} />
          </Pressable>
        )}
        <Pressable onPress={onPressInfo} className="p-2 active:opacity-60" hitSlop={6}>
          <Info size={25} color={foreground} strokeWidth={1.5} />
        </Pressable>
      </View>
    </View>
  );
};
