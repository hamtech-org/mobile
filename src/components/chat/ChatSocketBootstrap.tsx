import { useAppDispatch } from "@/hooks/useAppStore";
import { useActiveChatRouteConversationId } from "@/hooks/useActiveChatRouteConversationId";
import { useSocket } from "@/hooks/useSocket";
import { useActiveConversationRoomSync } from "@/hooks/useActiveConversationRoomSync";
import { useChatRealtimeEvents } from "@/hooks/useChatRealtimeEvents";

/**
 * Socket chat toàn app — gắn ở `(main)` để vẫn chạy khi user ở tab Bảng tin / Danh bạ.
 * Join `conv:` **chỉ** cho hội thoại đang mở (đồng bộ web), tránh nhận đúp từ `conv` + `user`.
 */
export function ChatSocketBootstrap(): null {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const activeConversationId = useActiveChatRouteConversationId();

  useActiveConversationRoomSync({ socket, activeConversationId });
  useChatRealtimeEvents({ dispatch, socket, activeConversationId });

  return null;
}
