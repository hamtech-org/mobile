import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { BellOff, Image as ImageIcon, Paperclip, Pin, Video } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useAppSelector } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import {
  formatConversationListLastPreview,
  parseConversationListMediaPreview,
} from "@/utils/conversationListPreview";
import { formatZaloConversationTime } from "@/utils/time";
import { formatUnreadBadge } from "@/utils/chatBadge";

interface ConversationItemProps {
  conversation: IConversation;
  onPress: () => void;
  /** Menu ghim / tắt thông báo (giữ list). */
  onLongPressMenu?: (conversation: IConversation) => void;
  /** Hàng đang mở trong stack chat — nền xanh như web `ConversationListPanel`. */
  isActive?: boolean;
  isOnline?: boolean;
  /** Hàng trong panel “Đã tắt thông báo” (giống web `mutedSection`). */
  variant?: "default" | "mutedSection";
}

/**
 * ConversationItem — đồng bộ web `ConversationListPanel` (active row, Zalo time, preview 1 dòng + icon media).
 */
export const ConversationItem = ({
  conversation,
  onPress,
  onLongPressMenu,
  isActive = false,
  isOnline = false,
  variant = "default",
}: ConversationItemProps) => {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const calendarNow = useCalendarNow();
  const { destructive, muted: mutedIcon } = useIconColors();
  const lastMsg = conversation.lastMessage;
  const unreadCount = conversation.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const isMuted = conversation.isMuted ?? false;
  const isPinnedToTop = conversation.isPinnedToTop ?? false;
  const pinnedMessageCount = conversation.pinnedMessageCount ?? 0;
  const showConvPinIcon = isPinnedToTop;
  const inMutedPanel = variant === "mutedSection";

  const showActiveChrome = isActive && !inMutedPanel;

  const activityIso = lastMsg?.createdAt ?? conversation.updatedAt;
  const timeLabel = useMemo(() => {
    if (!activityIso) return "";
    return formatZaloConversationTime(activityIso, calendarNow);
  }, [activityIso, calendarNow]);

  const preview = useMemo(
    () => formatConversationListLastPreview(conversation, currentUserId),
    [conversation, currentUserId],
  );

  const lastMsgType = lastMsg?.type;
  const mediaParts = useMemo(() => {
    if (lastMsgType === "image" || lastMsgType === "video" || lastMsgType === "file") {
      return parseConversationListMediaPreview(preview, lastMsgType);
    }
    return { prefix: "", suffix: "" };
  }, [preview, lastMsgType]);

  const isMediaPreview =
    lastMsgType === "image" || lastMsgType === "video" || lastMsgType === "file";

  const nameClass = showActiveChrome
    ? "font-bold text-blue-700 dark:text-blue-300"
    : hasUnread
      ? "font-bold text-foreground"
      : "font-semibold text-foreground";

  const timeClass = showActiveChrome
    ? "font-medium text-blue-600/80 dark:text-blue-300/60"
    : hasUnread
      ? "font-bold text-primary"
      : "font-medium text-muted-foreground";

  const previewMuted = showActiveChrome
    ? "text-blue-600/80 dark:text-blue-300/70"
    : hasUnread
      ? "font-semibold text-foreground"
      : "text-muted-foreground";

  const pinColor = showActiveChrome ? "#3b82f6" : mutedIcon;
  const imgTint = showActiveChrome ? "#2563eb" : "#3b82f6";
  const vidTint = showActiveChrome ? "#7c3aed" : "#8b5cf6";
  const clipTint = showActiveChrome ? "#475569" : "#64748b";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPressMenu ? () => onLongPressMenu(conversation) : undefined}
      delayLongPress={380}
      className={`mx-1 flex-row items-center gap-3 rounded-2xl px-3 py-2.5 active:bg-muted/60 ${
        showActiveChrome
          ? "bg-blue-500/12 shadow-sm ring-1 ring-blue-500/20 dark:bg-blue-400/10 dark:ring-blue-400/15"
          : ""
      } ${isMuted || inMutedPanel ? "bg-muted/30 opacity-70" : ""}`}
    >
      <Avatar
        uri={conversation.avatar || undefined}
        name={conversation.name || undefined}
        size="lg"
        showOnlineDot={conversation.type !== "group" && isOnline}
        isGroup={conversation.type === "group"}
        groupConversationId={
          conversation.type === "group" ? conversation.conversationId : undefined
        }
        cacheVersion={
          conversation.type === "group" ? String(conversation.memberCount ?? "") : undefined
        }
      />

      <View className="min-h-[44px] flex-1 justify-between gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <Text className={`${nameClass} flex-1 text-[15px]`} numberOfLines={1}>
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
              <Text className={`text-[11px] tabular-nums ${timeClass}`}>{timeLabel}</Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-2">
          {isMediaPreview ? (
            <View className="min-w-0 flex-1 flex-row items-center gap-1">
              {mediaParts.prefix ? (
                <Text className={`shrink-0 text-[13px] ${previewMuted}`} numberOfLines={1}>
                  {mediaParts.prefix}
                </Text>
              ) : null}
              {lastMsgType === "image" ? (
                <ImageIcon size={14} color={imgTint} strokeWidth={2} />
              ) : null}
              {lastMsgType === "video" ? <Video size={14} color={vidTint} strokeWidth={2} /> : null}
              {lastMsgType === "file" ? (
                <Paperclip size={14} color={clipTint} strokeWidth={2} />
              ) : null}
              {mediaParts.suffix ? (
                <Text className={`min-w-0 flex-1 text-[13px] ${previewMuted}`} numberOfLines={1}>
                  {mediaParts.suffix}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text className={`min-w-0 flex-1 text-[13px] ${previewMuted}`} numberOfLines={1}>
              {preview}
            </Text>
          )}
          <View className="min-w-[52px] shrink-0 items-end justify-end gap-1">
            {showConvPinIcon ? (
              <View
                accessibilityLabel={
                  pinnedMessageCount > 0
                    ? "Ghim hội thoại, có tin ghim trong chat"
                    : "Ghim hội thoại lên đầu danh sách"
                }
              >
                <Pin size={14} color={pinColor} strokeWidth={1.75} />
              </View>
            ) : null}
            {!showActiveChrome && hasUnread ? (
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
