import { useMemo } from "react";
import { useSegments, useGlobalSearchParams } from "expo-router";

/**
 * `conversationId` đang mở trong stack `(chat)` — khớp ý web `activeConversationId` trên sidebar
 * (highlight hàng list khi màn chi tiết vẫn nằm trong stack).
 */
export function useActiveChatRouteConversationId(): string | null {
  const segments = useSegments();
  const params = useGlobalSearchParams<{ conversationId?: string }>();
  const conversationId = params.conversationId;

  const segmentsJoined = segments.join(",");

  return useMemo(() => {
    if (!segmentsJoined) return null;
    const segmentsArr = segmentsJoined.split(",");
    const chatIdx = segmentsArr.lastIndexOf("(chat)");
    if (chatIdx < 0) return null;
    const rest = segmentsArr.slice(chatIdx + 1);
    const last = rest[rest.length - 1];
    if (!last || last === "index") return null;
    if (last === "[conversationId]") {
      return conversationId || null;
    }
    return last;
  }, [segmentsJoined, conversationId]);
}
