import type { IConversation } from "@/types/chat.types";

/** Mốc hoạt động gần nhất (đồng bộ web `conversationActivityMs`). */
export function conversationActivityMs(conv: IConversation): number {
  let best = 0;
  const consider = (iso: string | undefined | null) => {
    if (iso == null || iso === "") return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) best = Math.max(best, t);
  };
  consider(conv.lastMessageAt);
  consider(conv.updatedAt);
  consider(conv.lastMessage?.createdAt ?? null);
  consider(conv.conversationListAt);
  return best;
}

/** Ghim hội thoại lên đầu → mới nhất → nhiều tin ghim trong chat → id. */
export function sortConversationsForSidebar(convs: IConversation[]): IConversation[] {
  return [...convs].sort((a, b) => {
    const ap = a.isPinnedToTop ? 1 : 0;
    const bp = b.isPinnedToTop ? 1 : 0;
    if (bp !== ap) return bp - ap;
    const ta = conversationActivityMs(a);
    const tb = conversationActivityMs(b);
    if (tb !== ta) return tb - ta;
    const aPins = a.pinnedMessageCount ?? 0;
    const bPins = b.pinnedMessageCount ?? 0;
    if (bPins !== aPins) return bPins - aPins;
    return a.conversationId.localeCompare(b.conversationId);
  });
}
