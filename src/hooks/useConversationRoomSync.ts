import { useEffect, useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";

import { useGetConversationsQuery } from "@/store/api/chatApi";

interface UseConversationRoomSyncParams {
  socket: Socket | null;
}

/**
 * Đồng bộ socket room theo toàn bộ conversation hiện có.
 * - Join room mới
 * - Leave room bị xóa/rời
 * - Re-join toàn bộ sau khi socket reconnect
 */
export function useConversationRoomSync({ socket }: UseConversationRoomSyncParams): void {
  const { data: conversations } = useGetConversationsQuery();
  const joinedIdsRef = useRef<Set<string>>(new Set());

  const conversationIds = useMemo(
    () => (conversations ?? []).map((item) => item.conversationId).filter(Boolean),
    [conversations],
  );

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      for (const id of conversationIds) {
        socket.emit("conversation:join", id);
      }
      joinedIdsRef.current = new Set(conversationIds);
    };

    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, conversationIds]);

  useEffect(() => {
    if (!socket || !socket.connected) return;

    const next = new Set(conversationIds);
    const prev = joinedIdsRef.current;

    for (const id of next) {
      if (!prev.has(id)) {
        socket.emit("conversation:join", id);
      }
    }

    for (const id of prev) {
      if (!next.has(id)) {
        socket.emit("conversation:leave", id);
      }
    }

    joinedIdsRef.current = next;
  }, [socket, conversationIds]);

  useEffect(() => {
    return () => {
      if (!socket) return;
      for (const id of joinedIdsRef.current) {
        socket.emit("conversation:leave", id);
      }
      joinedIdsRef.current = new Set();
    };
  }, [socket]);
}
