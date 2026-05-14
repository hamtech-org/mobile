/**
 * Ghi nhớ `markAsRead` đã gọi cho cặp (conversationId, messageId) trong phiên app.
 * `useRef` trong màn chat bị reset khi unmount → reload/vào lại gọi API read lại;
 * Map module giữ nguyên nên không «đọc lại» cùng một tin chỉ vì reload màn.
 */
const lastMarkedMessageIdByConversation = new Map<string, string>();

export function getLastMarkedMessageIdForConversation(conversationId: string): string | undefined {
  return lastMarkedMessageIdByConversation.get(conversationId);
}

export function setLastMarkedMessageIdForConversation(
  conversationId: string,
  messageId: string,
): void {
  lastMarkedMessageIdByConversation.set(conversationId, messageId);
}

export function clearMarkAsReadDedupeCache(): void {
  lastMarkedMessageIdByConversation.clear();
}
