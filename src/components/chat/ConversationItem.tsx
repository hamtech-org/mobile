import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { useAppSelector } from "@/hooks/useAppStore";
import type { IConversation } from "@/types/chat.types";
import { getMessageTypeLabel } from "@/utils/messageDisplay";
import { formatSystemLastMessagePreview } from "@/utils/systemMessage";

interface ConversationItemProps {
  conversation: IConversation;
  onPress: () => void;
  isOnline?: boolean;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return date.toLocaleDateString("vi-VN", { weekday: "short" });
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/**
 * ConversationItem — Messenger/Zalo flat style:
 * - Hiển thị unread badge và media preview [Ảnh], [Video],...
 * - Tên bold khi có tin mới chưa đọc
 */
export const ConversationItem = ({ conversation, onPress, isOnline = false }: ConversationItemProps) => {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const isGroup = conversation.type === "group";
  const lastMsg = conversation.lastMessage;
  const unreadCount = conversation.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  // Render preview text
  let preview = "Chưa có tin nhắn";
  if (lastMsg) {
    const typeLabel = getMessageTypeLabel(lastMsg.type);
    let line = lastMsg.content?.trim() || "";

    if (lastMsg.type === "system") {
      const sys = formatSystemLastMessagePreview(lastMsg.content, lastMsg.senderId, currentUserId, lastMsg.senderDisplayName);
      if (sys) line = sys;
    }

    const content = line || typeLabel || "Tin nhắn mới";
    const shouldPrefixSender = isGroup && lastMsg.senderDisplayName && lastMsg.type !== "system";

    if (shouldPrefixSender) {
      preview = `${lastMsg.senderDisplayName}: ${content}`;
    } else {
      preview = content;
    }
  }

  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 active:bg-muted/60">
      {/* Avatar */}
      <Avatar
        uri={conversation.avatar || undefined}
        name={conversation.name || undefined}
        size="lg"
        showOnlineDot={!isGroup && isOnline}
        isGroup={isGroup}
      />

      {/* Content */}
      <View className="flex-1 gap-0.5">
        {/* Row 1: Tên + thời gian */}
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`flex-1 text-[16px] ${hasUnread ? "text-foreground font-bold" : "text-foreground font-semibold"}`}
            numberOfLines={1}
          >
            {conversation.name ?? "Hội thoại"}
          </Text>
          {lastMsg?.createdAt ? (
            <Text className={`text-[12px] shrink-0 ${hasUnread ? "text-primary font-bold" : "text-muted-foreground"}`}>
              {formatTime(lastMsg.createdAt)}
            </Text>
          ) : null}
        </View>

        {/* Row 2: Preview + badge */}
        <View className="flex-row items-center justify-between gap-2">
          <Text className={`flex-1 text-[14px] ${hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"}`} numberOfLines={1}>
            {preview}
          </Text>
          {hasUnread ? <Badge count={unreadCount} variant="primary" /> : null}
        </View>
      </View>
    </Pressable>
  );
};
