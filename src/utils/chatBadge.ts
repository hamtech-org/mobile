/** Giống web `ConversationListPanel` — hiển thị badge unread. */
export function formatUnreadBadge(n: number): string {
  if (n > 99) return "99+";
  if (n > 9) return "9+";
  return String(n);
}
