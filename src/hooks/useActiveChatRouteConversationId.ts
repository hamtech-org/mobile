import { useMemo } from "react";
import { useSegments } from "expo-router";

/**
 * `conversationId` đang mở trong stack `(chat)` — khớp ý web `activeConversationId` trên sidebar
 * (highlight hàng list khi màn chi tiết vẫn nằm trong stack).
 */
export function useActiveChatRouteConversationId(): string | null {
  const segments = useSegments();
  return useMemo(() => {
    const chatIdx = segments.lastIndexOf("(chat)");
    if (chatIdx < 0) return null;
    const rest = segments.slice(chatIdx + 1);
    const last = rest[rest.length - 1];
    if (!last || last === "index") return null;
    return last;
  }, [segments]);
}
