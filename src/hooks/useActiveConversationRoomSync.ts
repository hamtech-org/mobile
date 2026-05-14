import { useEffect } from "react";
import type { Socket } from "socket.io-client";

interface UseActiveConversationRoomSyncParams {
  socket: Socket | null;
  /** Giống web `useConversationRealtimeLifecycle` — chỉ join `conv:` khi đang mở thread. */
  activeConversationId: string | null;
}

/**
 * Server phát nhiều sự kiện tới cả `conv:{id}` lẫn `user:{userId}` (xem `chat.broadcast.ts`).
 * Nếu client join mọi `conv:` + sẵn có `user:` → cùng một sự kiện tới **hai lần** (toast/banner lặp).
 * Web chỉ `conversation:join` hội thoại đang mở — mobile làm tương tự.
 */
export function useActiveConversationRoomSync({
  socket,
  activeConversationId,
}: UseActiveConversationRoomSyncParams): void {
  useEffect(() => {
    if (!socket) return;

    const trimmed = activeConversationId?.trim() || null;

    const join = (cid: string | null) => {
      if (cid) socket.emit("conversation:join", cid);
    };
    const leave = (cid: string | null) => {
      if (cid) socket.emit("conversation:leave", cid);
    };

    const onConnect = () => {
      join(trimmed);
    };

    socket.on("connect", onConnect);
    if (socket.connected) join(trimmed);

    return () => {
      socket.off("connect", onConnect);
      leave(trimmed);
    };
  }, [socket, activeConversationId]);
}
