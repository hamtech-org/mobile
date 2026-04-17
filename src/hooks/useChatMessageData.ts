import { useMemo } from "react";
import { useAppSelector } from "@/hooks/useAppStore";
import { useGetMessagesQuery } from "@/store/api/chatApi";
import type { IMessage } from "@/types/chat.types";

const EMPTY_MESSAGE_ARRAY: IMessage[] = [];

/**
 * Hook quản lý data cho messages: merge API (RTK Query) + socket (Redux state).
 * Đảm bảo tin nhắn realtime hiện ngay lập tức và đồng bộ với lịch sử fetch.
 */
export function useChatMessageData(conversationId: string | null) {
  // 1. Socket messages từ Redux store (được cập nhật bởi useChatRealtimeEvents)
  const socketMessages = useAppSelector((state) => {
    if (!conversationId) return EMPTY_MESSAGE_ARRAY;
    return state.chat.messages[conversationId] ?? EMPTY_MESSAGE_ARRAY;
  });

  // 2. API messages từ RTK Query cache
  const { data: apiMessages, isLoading, isError, refetch } = useGetMessagesQuery(
    { conversationId: conversationId!, limit: 50 },
    { skip: !conversationId }
  );

  // 3. Merge API + socket, dedup by messageId, sort inverted (mới nhất lên đầu cho FlatList)
  const allMessages = useMemo(() => {
    const base = apiMessages ?? [];
    const map = new Map<string, IMessage>();

    // API messages thường cũ hơn socket messages trong phiên làm việc hiện tại
    base.forEach((m) => map.set(m.messageId, m));
    socketMessages.forEach((m) => map.set(m.messageId, m));

    return Array.from(map.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [apiMessages, socketMessages]);

  const result = useMemo(
    () => ({
      allMessages,
      isLoading,
      isError,
      refetch,
      latestMessageId:
        allMessages.length > 0 ? allMessages[0].messageId : undefined,
    }),
    [allMessages, isLoading, isError, refetch],
  );

  return result;
}
