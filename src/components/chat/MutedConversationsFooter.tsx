import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BellOff, ChevronDown } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import { formatUnreadBadge } from "@/utils/chatBadge";

import { ConversationItem } from "./ConversationItem";

type MutedConversationsFooterProps = {
  conversations: IConversation[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenConversation: (conversationId: string) => void;
  onLongPressMenu: (conversation: IConversation) => void;
  /** Tổng tin chưa đọc trong nhóm muted (hiển thị cạnh tiêu đề). */
  mutedUnreadTotal: number;
};

/**
 * Panel “Đã tắt thông báo” cuối danh sách — đồng bộ hành vi web (mặc định thu gọn).
 */
export function MutedConversationsFooter({
  conversations,
  expanded,
  onToggleExpanded,
  onOpenConversation,
  onLongPressMenu,
  mutedUnreadTotal,
}: MutedConversationsFooterProps) {
  const { muted: iconMuted, destructive } = useIconColors();

  const renderItem = useCallback(
    (c: IConversation) => (
      <View key={c.conversationId}>
        <ConversationItem
          variant="mutedSection"
          conversation={c}
          onPress={() => onOpenConversation(c.conversationId)}
          onLongPressMenu={onLongPressMenu}
        />
      </View>
    ),
    [onLongPressMenu, onOpenConversation],
  );

  if (conversations.length === 0) return null;

  return (
    <View className="mx-4 mb-3 mt-2 overflow-hidden rounded-xl border border-border/60 bg-card">
      <Pressable
        onPress={onToggleExpanded}
        className="flex-row items-center justify-between px-3 py-2.5 active:bg-muted/50"
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <BellOff size={16} color={destructive} strokeWidth={2} />
          <Text
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            numberOfLines={1}
          >
            Đã tắt thông báo
          </Text>
          <View className="rounded-full bg-muted px-2 py-0.5">
            <Text className="text-[11px] font-bold tabular-nums text-muted-foreground">
              {conversations.length}
            </Text>
          </View>
          {mutedUnreadTotal > 0 ? (
            <View className="min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1">
              <Text className="text-[10px] font-bold leading-none text-white">
                {formatUnreadBadge(mutedUnreadTotal)}
              </Text>
            </View>
          ) : null}
        </View>
        <ChevronDown
          size={18}
          color={iconMuted}
          strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? "0deg" : "-90deg" }] }}
        />
      </Pressable>

      {expanded ? (
        <View className="max-h-56 border-t border-border/40">
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {conversations.map(renderItem)}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
