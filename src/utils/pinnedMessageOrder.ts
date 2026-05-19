import type { IMessage } from "@/types/chat.types";

/** Cập nhật MRU khi ghim/bỏ ghim — đồng bộ web `useChatRealtimeEvents` / `useMessagePinController`. */
export function applyPinnedMruOrderUpdate(
  orderIds: string[],
  messageId: string,
  isPinned: boolean,
): string[] {
  const cur = orderIds ?? [];
  if (isPinned) {
    return [messageId, ...cur.filter((id) => id !== messageId)];
  }
  return cur.filter((id) => id !== messageId);
}

/** Sắp tin ghim theo MRU — đồng bộ web `useChatMessageData.pinnedMessagesOrdered`. */
export function orderPinnedMessagesMRU(pinned: IMessage[], orderIds: string[]): IMessage[] {
  if (pinned.length === 0) return [];
  const byId = new Map(pinned.map((m) => [m.messageId, m]));
  const pinnedIds = new Set(pinned.map((m) => m.messageId));
  const fromOrder = orderIds.filter((id) => pinnedIds.has(id));
  const notInOrder = pinned
    .filter((m) => !fromOrder.includes(m.messageId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((m) => m.messageId);
  const mergedIds = [...fromOrder, ...notInOrder];
  return mergedIds.map((id) => byId.get(id)).filter((m): m is IMessage => m != null);
}
