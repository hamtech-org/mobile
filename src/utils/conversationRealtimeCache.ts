import type { AppDispatch } from "@/store/store";
import { conversationApi } from "@/store/api/endpoints/conversationApi";
import type { IConversation } from "@/types/chat.types";
import { sortConversationsForSidebar } from "@/utils/conversationListSort";

export function parseConversationCreatedPayload(data: unknown): IConversation | null {
  const p = data as { conversation?: IConversation };
  const conv = p?.conversation;
  const cid = String(conv?.conversationId ?? "").trim();
  if (!cid) return null;
  return conv as IConversation;
}

export function upsertConversationInListCache(
  dispatch: AppDispatch,
  incoming: IConversation,
): void {
  const cid = String(incoming.conversationId ?? "").trim();
  if (!cid) return;
  dispatch(
    conversationApi.util.updateQueryData(
      "getConversations",
      undefined,
      (draft: IConversation[]) => {
        const idx = draft.findIndex((c) => c.conversationId === cid);
        if (idx >= 0) {
          draft[idx] = { ...draft[idx], ...incoming };
        } else {
          draft.push(incoming);
        }
        const sorted = sortConversationsForSidebar([...draft]);
        draft.splice(0, draft.length, ...sorted);
      },
    ),
  );
}
