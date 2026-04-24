import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { BellOff, Pin } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useAppSelector } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { formatConversationListActivityTime } from "@/utils/time";
import { formatUnreadBadge } from "@/utils/chatBadge";

interface ConversationItemProps {
  conversation: IConversation;
  onPress: () => void;
  /** Menu ghim / tắt thông báo (giữ list). */
  onLongPressMenu?: (conversation: IConversation) => void;
  isOnline?: boolean;
  /** Hàng trong panel “Đã tắt thông báo” (giống web `mutedSection`). */
  variant?: "default" | "mutedSection";
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
  variant = "default",
}: ConversationItemProps) => {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const calendarNow = useCalendarNow();
  const { destructive, muted: mutedIcon } = useIconColors();
  const isGroup = conversation.type === "group";
  const lastMsg = conversation.lastMessage;
  const unreadCount = conversation.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const isMuted = conversation.isMuted ?? false;
  const isPinnedToTop = conversation.isPinnedToTop ?? false;
  const pinnedMessageCount = conversation.pinnedMessageCount ?? 0;
  const showConvPinIcon = isPinnedToTop;
  const inMutedPanel = variant === "mutedSection";

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
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-muted/60 ${
        isMuted || inMutedPanel ? "bg-muted/30 opacity-70" : ""
      }`}
    >
      {/* Avatar — luôn cùng cột trái; icon tắt thông báo đặt bên phải (gần giờ) để không đẩy list */}
      <Avatar
        uri={conversation.avatar || undefined}
        name={conversation.name || undefined}
        size="lg"
        showOnlineDot={!isGroup && isOnline}
        isGroup={isGroup}
      />

      {/* Content */}
      <View className="flex-1 gap-0.5">
        {/* Row 1: Tên + (chuông nếu mute) + giờ — giống web */}
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <Text
              className={`${hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground"} flex-1 text-[16px]`}
              numberOfLines={1}
            >
              {conversation.name ?? "Hội thoại"}
            </Text>
          </View>
          <View className="shrink-0 flex-row items-center gap-1.5">
            {isMuted ? (
              <View accessibilityLabel="Đã tắt thông báo">
                <BellOff size={16} color={destructive} strokeWidth={1.85} />
              </View>
            ) : null}
            {timeLabel ? (
              <Text
                className={`text-[12px] tabular-nums ${hasUnread ? "font-bold text-primary" : "text-muted-foreground"}`}
              >
                {timeLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Row 2: preview trái | cột phải: ghim + badge unread (web) */}
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className={`flex-1 text-[14px] ${hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            numberOfLines={2}
          >
            {preview}
          </Text>
          <View className="min-w-[40px] shrink-0 items-end gap-1 pt-0.5">
            {showConvPinIcon ? (
              <View
                accessibilityLabel={
                  pinnedMessageCount > 0
                    ? "Ghim hội thoại, có tin ghim trong chat"
                    : "Ghim hội thoại lên đầu danh sách"
                }
              >
                <Pin size={14} color={mutedIcon} strokeWidth={1.75} />
              </View>
            ) : null}
            {hasUnread ? (
              <View className="min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1">
                <Text className="text-[10px] font-bold leading-none text-white">
                  {formatUnreadBadge(unreadCount)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
};
