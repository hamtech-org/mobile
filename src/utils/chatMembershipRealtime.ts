import type { IMessage } from "@/types/chat.types";
import type { AppDispatch } from "@/store/store";
import { chatApi } from "@/store/api/chatApi";
import { getSocketClient } from "@/services/socket";
import { conversationApi } from "@/store/api/endpoints/conversationApi";
import { clearConversationMessages, setMessageJoinCutoff } from "@/store/slices/chatSlice";

export function messagePassesJoinCutoff(
  msg: Pick<IMessage, "createdAt">,
  minCreatedAtMs: number | undefined,
): boolean {
  if (minCreatedAtMs == null || !Number.isFinite(minCreatedAtMs)) return true;
  const t = Date.parse(msg.createdAt);
  if (!Number.isFinite(t)) return true;
  return t >= minCreatedAtMs;
}

export function resetConversationMessagesRealtime(
  dispatch: AppDispatch,
  conversationId: string,
): void {
  const cid = conversationId.trim();
  if (!cid) return;

  dispatch(clearConversationMessages(cid));
  dispatch(
    chatApi.util.updateQueryData("getMessages", { conversationId: cid }, (draft) => {
      if (!draft) return;
      draft.splice(0, draft.length);
    }),
  );
  void dispatch(
    chatApi.endpoints.getMessages.initiate(
      { conversationId: cid },
      { forceRefetch: true, subscribe: true },
    ),
  );
}

export function applyRejoinedGroupMemberRealtime(
  dispatch: AppDispatch,
  conversationId: string,
  joinedAtIso: string,
): void {
  const cid = conversationId.trim();
  if (!cid) return;

  const joinedMs = Date.parse(joinedAtIso);
  dispatch(
    setMessageJoinCutoff({
      conversationId: cid,
      minCreatedAtMs: Number.isFinite(joinedMs) ? joinedMs : Date.now(),
    }),
  );
  resetConversationMessagesRealtime(dispatch, cid);
  dispatch(chatApi.util.invalidateTags(["Conversations", { type: "Messages", id: cid }]));
  void dispatch(
    conversationApi.endpoints.getConversations.initiate(undefined, { forceRefetch: true }),
  );
}

export function applyKickedFromGroupRealtime(dispatch: AppDispatch, conversationId: string): void {
  const cid = conversationId.trim();
  if (!cid) return;

  try {
    const socket = getSocketClient();
    if (socket.connected) socket.emit("conversation:leave", cid);
  } catch {
    /* ignore */
  }

  dispatch(setMessageJoinCutoff({ conversationId: cid, minCreatedAtMs: null }));
  dispatch(clearConversationMessages(cid));
  dispatch(
    chatApi.util.updateQueryData("getMessages", { conversationId: cid }, (draft) => {
      if (!draft) return;
      draft.splice(0, draft.length);
    }),
  );
  dispatch(
    conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
      if (!draft) return;
      const idx = draft.findIndex((c) => c.conversationId === cid);
      if (idx >= 0) draft.splice(idx, 1);
    }),
  );
  dispatch(chatApi.util.invalidateTags(["Conversations", { type: "Messages", id: cid }]));
}
