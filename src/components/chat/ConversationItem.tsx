import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/common/Avatar";
import { Badge } from "@/components/common/Badge";
import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useAppSelector } from "@/hooks/useAppStore";
import type { IConversation } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { formatConversationListActivityTime } from "@/utils/time";

interface ConversationItemProps {
  conversation: IConversation;
  onPress: () => void;
  /** Menu ghim / tắt thông báo (giữ list). */
  onLongPressMenu?: (conversation: IConversation) => void;
  isOnline?: boolean;
}

/**
 * ConversationItem — Messenger/Zalo flat style:
 * - Hiển thị unread badge và media preview [Ảnh], [Video],...
 * - Tên bold khi có tin mới chưa đọc
 */
export const ConversationItem = ({
  conversation,
  onPress,
  onLongPressMenu,
  isOnline = false,
}: ConversationItemProps) => {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const calendarNow = useCalendarNow();
  const isGroup = conversation.type === "group";
  const lastMsg = conversation.lastMessage;
  const unreadCount = conversation.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  const activityIso = lastMsg?.createdAt ?? conversation.updatedAt;
  const timeLabel = useMemo(() => {
    if (!activityIso) return "";
    return formatConversationListActivityTime(activityIso, calendarNow);
  }, [activityIso, calendarNow]);

  // Render preview text
  let preview = "Chưa có tin nhắn";
  if (lastMsg) {
    const line = formatChatPreviewLine(
      {
        type: lastMsg.type,
        content: lastMsg.content,
        senderId: lastMsg.senderId,
        senderDisplayName: lastMsg.senderDisplayName ?? null,
        isRecalled: false,
      },
      currentUserId,
    );
    const shouldPrefixSender = isGroup && lastMsg.senderDisplayName && lastMsg.type !== "system";

    if (shouldPrefixSender) {
      preview = `${lastMsg.senderDisplayName}: ${line}`;
    } else {
      preview = line;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPressMenu ? () => onLongPressMenu(conversation) : undefined}
      delayLongPress={380}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-muted/60"
    >
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
            className={`flex-1 text-[16px] ${hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground"}`}
            numberOfLines={1}
          >
            {conversation.name ?? "Hội thoại"}
          </Text>
          {timeLabel ? (
            <Text
              className={`shrink-0 text-[12px] ${hasUnread ? "font-bold text-primary" : "text-muted-foreground"}`}
            >
              {timeLabel}
            </Text>
          ) : null}
        </View>

        {/* Row 2: Preview + badge */}
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={`flex-1 text-[14px] ${hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
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
