import { useEffect } from "react";

import { useMarkAsReadMutation } from "@/store/api/chatApi";
import {
  getLastMarkedMessageIdForConversation,
  setLastMarkedMessageIdForConversation,
} from "@/utils/markAsReadSessionDedupe";

interface UseConversationLifecycleParams {
  conversationId: string | undefined;
  /** ID tin nhắn mới nhất — dùng để markAsRead */
  latestMessageId: string | undefined;
}

/**
 * Mở hội thoại / có tin mới → `markAsRead`.
 * Không gọi lại khi chỉ reload màn mà `latestMessageId` không đổi (dedupe theo phiên).
 */
export function useConversationLifecycle({
  conversationId,
  latestMessageId,
}: UseConversationLifecycleParams): void {
  const [markAsRead] = useMarkAsReadMutation();

  useEffect(() => {
    if (!conversationId || !latestMessageId) return;
    const prev = getLastMarkedMessageIdForConversation(conversationId);
    if (prev === latestMessageId) return;

    setLastMarkedMessageIdForConversation(conversationId, latestMessageId);
    void markAsRead({ conversationId, messageId: latestMessageId });
  }, [conversationId, latestMessageId, markAsRead]);
}
