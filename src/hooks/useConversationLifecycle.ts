import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

import { useMarkAsReadMutation } from "@/store/api/chatApi";

interface UseConversationLifecycleParams {
  socket: Socket | null;
  conversationId: string | undefined;
  /** ID tin nhắn mới nhất — dùng để markAsRead */
  latestMessageId: string | undefined;
}

/**
 * Hook quản lý lifecycle của một conversation đang mở:
 * - Join/leave socket room khi mở/đóng conversation
 * - Auto markAsRead khi mở conversation hoặc có tin nhắn mới
 */
export function useConversationLifecycle({
  socket,
  conversationId,
  latestMessageId,
}: UseConversationLifecycleParams): void {
  const [markAsRead] = useMarkAsReadMutation();
  const prevMessageIdRef = useRef<string | undefined>(undefined);

  // Join/leave room
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("conversation:join", conversationId);

    return () => {
      socket.emit("conversation:leave", conversationId);
    };
  }, [socket, conversationId]);

  // Mark as read khi mở conversation hoặc có tin nhắn mới
  useEffect(() => {
    if (!conversationId || !latestMessageId) return;
    if (prevMessageIdRef.current === latestMessageId) return;

    prevMessageIdRef.current = latestMessageId;
    void markAsRead({ conversationId, messageId: latestMessageId });
  }, [conversationId, latestMessageId, markAsRead]);
}
