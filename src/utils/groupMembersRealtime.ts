import { store } from "@/store/store";

/** userId đã rời/bị kick — lọc khỏi UI cho tới khi API không còn trả về (tránh cache ghi đè). */
export function getRemovedGroupMemberIds(conversationId: string): string[] {
  const cid = String(conversationId ?? "").trim();
  if (!cid) return [];
  return store.getState().chat.removedGroupMemberIdsByConversationId?.[cid] ?? [];
}

export function filterGroupMembersExcludingRemoved<T extends { userId: string }>(
  conversationId: string,
  members: T[],
): T[] {
  const removed = getRemovedGroupMemberIds(conversationId);
  if (removed.length === 0) return members;
  const excluded = new Set(removed);
  return members.filter((m) => !excluded.has(m.userId));
}
