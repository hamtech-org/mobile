import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import type { Conversation } from "@/store/api/chatApi";

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  unreadCount?: number;
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
 * - Không có card border — flat trên background
 * - Avatar lớn bên trái với online dot
 * - Tên bold khi có unread
 * - Preview tin nhắn cuối
 * - Thời gian + unread badge phải
 */
export const ConversationItem = ({ conversation, onPress, unreadCount = 0, isOnline = false }: ConversationItemProps) => {
  const isGroup = conversation.type === "group";
  const lastMsg = conversation.lastMessage;
  const hasUnread = unreadCount > 0;

  const preview = lastMsg
    ? isGroup && lastMsg.senderDisplayName
      ? `${lastMsg.senderDisplayName}: ${lastMsg.content}`
      : lastMsg.content
    : "Chưa có tin nhắn";

  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 active:bg-muted/60">
      {/* Avatar */}
      <Avatar
        uri={conversation.avatar}
        name={conversation.name}
        size="lg"
        showOnlineDot={!isGroup && isOnline}
        isGroup={isGroup}
      />

      {/* Content */}
      <View className="flex-1 gap-0.5">
        {/* Row 1: Tên + thời gian */}
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`flex-1 text-[15px] ${hasUnread ? "text-foreground font-bold" : "text-foreground font-semibold"}`}
            numberOfLines={1}
          >
            {conversation.name ?? "Hội thoại"}
          </Text>
          {lastMsg?.createdAt ? (
            <Text className={`text-xs shrink-0 ${hasUnread ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {formatTime(lastMsg.createdAt)}
            </Text>
          ) : null}
        </View>

        {/* Row 2: Preview + badge */}
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`flex-1 text-sm ${hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread ? <Badge count={unreadCount} variant="primary" /> : null}
        </View>
      </View>
    </Pressable>
  );
};
