import type { IMessage } from "@/types/chat.types";

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
