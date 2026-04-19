import { useMemo } from "react";
import { useAppSelector } from "@/hooks/useAppStore";
import { useGetMessagesQuery, CHAT_MESSAGES_QUERY_LIMIT } from "@/store/api/chatApi";
import type { IMessage } from "@/types/chat.types";

const EMPTY_MESSAGE_ARRAY: IMessage[] = [];

/** Khoảng thời gian cho phép khớp optimistic ↔ tin server (socket / sau merge HTTP). */
const OPTIMISTIC_REAL_MATCH_MS = 180_000;

/**
 * Gửi tin tạo bản optimistic (id `optimistic-…`) trong RTK; socket gửi lại cùng tin với id thật.
 * Map theo messageId thấy 2 dòng — lọc bỏ optimistic khi đã có bản thật trùng nội dung.
 */
function stripOptimisticEchoes(messages: IMessage[]): IMessage[] {
  const optimistic = messages.filter((m) => m.messageId.startsWith("optimistic-"));
  if (optimistic.length === 0) return messages;

  const real = messages.filter((m) => !m.messageId.startsWith("optimistic-"));
  const drop = new Set<string>();

  for (const o of optimistic) {
    const twin = real.find((r) => {
      if (r.senderId !== o.senderId || r.conversationId !== o.conversationId) return false;
      if (r.type !== o.type) return false;
      const c1 = (o.content ?? "").trim();
      const c2 = (r.content ?? "").trim();
      if (c1 !== c2) return false;
      const dt = Math.abs(
        new Date(r.createdAt).getTime() - new Date(o.createdAt).getTime(),
      );
      return dt < OPTIMISTIC_REAL_MATCH_MS;
    });
    if (twin) drop.add(o.messageId);
  }

  return messages.filter((m) => !drop.has(m.messageId));
}

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
    { conversationId: conversationId!, limit: CHAT_MESSAGES_QUERY_LIMIT },
    { skip: !conversationId },
  );

  // 3. Merge API + socket, dedup by messageId, sort inverted (mới nhất lên đầu cho FlatList)
  const allMessages = useMemo(() => {
    const base = apiMessages ?? [];
    const map = new Map<string, IMessage>();

    // API messages thường cũ hơn socket messages trong phiên làm việc hiện tại
    base.forEach((m) => map.set(m.messageId, m));
    socketMessages.forEach((m) => map.set(m.messageId, m));

    const merged = stripOptimisticEchoes(Array.from(map.values()));

    return merged.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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
