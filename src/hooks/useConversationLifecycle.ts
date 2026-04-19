import { useEffect, useRef } from "react";

import { useMarkAsReadMutation } from "@/store/api/chatApi";

interface UseConversationLifecycleParams {
  conversationId: string | undefined;
  /** ID tin nhắn mới nhất — dùng để markAsRead */
  latestMessageId: string | undefined;
}

/**
 * Hook quản lý lifecycle của một conversation đang mở:
 * - Auto markAsRead khi mở conversation hoặc có tin nhắn mới
 */
export function useConversationLifecycle({
  conversationId,
  latestMessageId,
}: UseConversationLifecycleParams): void {
  const [markAsRead] = useMarkAsReadMutation();
  const prevMessageIdRef = useRef<string | undefined>(undefined);

  // Mark as read khi mở conversation hoặc có tin nhắn mới
  useEffect(() => {
    if (!conversationId || !latestMessageId) return;
    if (prevMessageIdRef.current === latestMessageId) return;

    prevMessageIdRef.current = latestMessageId;
    void markAsRead({ conversationId, messageId: latestMessageId });
  }, [conversationId, latestMessageId, markAsRead]);
}
