import { useCallback, useState } from "react";

import { useAppDispatch } from "@/hooks/useAppStore";
import {
  CHAT_MESSAGES_QUERY_LIMIT,
  chatApi,
  usePinMessageMutation,
  useUnpinMessageMutation,
} from "@/store/api/chatApi";
import { messagePinUpdated, messageReceived } from "@/store/slices/chatSlice";
import { MAX_PINNED_PER_CONVERSATION } from "@/constants/chatPin";
import type { IConversation, IMessage } from "@/types/chat.types";
import type { GroupMember } from "@/types/chat.group.types";
import { canUserPinMessageInGroup } from "@/utils/groupConversationPermissions";
import { toast } from "@/utils/appToast";

type UseMessagePinControllerParams = {
  activeConversation?: IConversation;
  currentUserId: string;
  groupMembers: GroupMember[];
  pinnedMessagesOrdered: IMessage[];
  allMessages: IMessage[];
};

export function useMessagePinController({
  activeConversation,
  currentUserId,
  groupMembers,
  pinnedMessagesOrdered,
  allMessages,
}: UseMessagePinControllerParams) {
  const dispatch = useAppDispatch();
  const [pinMessage] = usePinMessageMutation();
  const [unpinMessage] = useUnpinMessageMutation();

  const [pinLimitModalMsg, setPinLimitModalMsg] = useState<IMessage | null>(null);
  const [pinReplaceIndex, setPinReplaceIndex] = useState<number | null>(null);
  const [pinLimitSubmitting, setPinLimitSubmitting] = useState(false);

  const patchMessageInCache = useCallback(
    (conversationId: string, messageId: string, patch: Partial<IMessage>) => {
      dispatch(
        chatApi.util.updateQueryData(
          "getMessages",
          { conversationId, limit: CHAT_MESSAGES_QUERY_LIMIT },
          (draft) => {
            const m = draft.find((x) => x.messageId === messageId);
            if (m) Object.assign(m, patch);
          },
        ),
      );
    },
    [dispatch],
  );

  const pushLocalPinSystemLine = useCallback(
    (params: { conversationId: string; actorLabel: string; pinned: boolean }) => {
      const { conversationId, actorLabel, pinned } = params;
      const sys: IMessage = {
        messageId: `local-pin:${conversationId}:${pinned ? "pin" : "unpin"}:${Date.now()}`,
        conversationId,
        senderId: "system",
        senderDisplayName: "Hệ thống",
        type: "system",
        content: `${actorLabel} ${pinned ? "đã ghim" : "đã bỏ ghim"} một tin nhắn`,
        mediaUrl: null,
        thumbnailUrl: null,
        replyTo: null,
        replyToDetails: null,
        isPinned: false,
        isEdited: false,
        isRecalled: false,
        isDeleted: false,
        reactions: {},
        status: "sent",
        createdAt: new Date().toISOString(),
      };
      dispatch(
        chatApi.util.updateQueryData(
          "getMessages",
          { conversationId, limit: CHAT_MESSAGES_QUERY_LIMIT },
          (draft) => {
            draft.push(sys);
          },
        ),
      );
      dispatch(messageReceived(sys));
    },
    [dispatch],
  );

  const handleTogglePinMsg = useCallback(
    async (msg: IMessage) => {
      try {
        const cid = msg.conversationId;
        const actorLabel = msg.senderId === currentUserId ? "Bạn" : "Ai đó";
        const myRole = groupMembers.find((m) => m.userId === currentUserId)?.role;

        if (msg.isPinned) {
          if (
            !canUserPinMessageInGroup({
              conversation: activeConversation,
              userRole: myRole,
            })
          ) {
            toast.error("Nhóm không cho phép thành viên bỏ/ghim tin nhắn.");
            return;
          }
          await unpinMessage({
            messageId: msg.messageId,
            conversationId: cid,
            createdAt: msg.createdAt,
          }).unwrap();
          dispatch(
            messagePinUpdated({
              messageId: msg.messageId,
              conversationId: cid,
              isPinned: false,
            }),
          );
          patchMessageInCache(cid, msg.messageId, { isPinned: false });
          pushLocalPinSystemLine({ conversationId: cid, actorLabel, pinned: false });
        } else {
          const visiblePinCount = allMessages.filter(
            (m) => m.conversationId === cid && Boolean(m.isPinned) && !m.isRecalled && !m.isDeleted,
          ).length;
          if (visiblePinCount >= MAX_PINNED_PER_CONVERSATION) {
            setPinReplaceIndex(null);
            setPinLimitModalMsg(msg);
            return;
          }
          if (
            !canUserPinMessageInGroup({
              conversation: activeConversation,
              userRole: myRole,
            })
          ) {
            toast.error("Nhóm không cho phép thành viên ghim tin nhắn.");
            return;
          }
          await pinMessage({
            messageId: msg.messageId,
            conversationId: cid,
            createdAt: msg.createdAt,
          }).unwrap();
          dispatch(
            messagePinUpdated({
              messageId: msg.messageId,
              conversationId: cid,
              isPinned: true,
            }),
          );
          patchMessageInCache(cid, msg.messageId, { isPinned: true });
          pushLocalPinSystemLine({ conversationId: cid, actorLabel, pinned: true });
        }
      } catch (e: unknown) {
        const body = e as { data?: { error?: { message?: string } } };
        const errMsg = body?.data?.error?.message;
        toast.error(errMsg?.trim() || "Không cập nhật ghim được. Thử lại.");
      }
    },
    [
      activeConversation,
      allMessages,
      currentUserId,
      dispatch,
      groupMembers,
      patchMessageInCache,
      pinMessage,
      pushLocalPinSystemLine,
      unpinMessage,
    ],
  );

  const handleConfirmPinReplace = useCallback(async () => {
    if (
      pinReplaceIndex === null ||
      !pinLimitModalMsg ||
      pinnedMessagesOrdered.length < MAX_PINNED_PER_CONVERSATION
    ) {
      return;
    }
    const victim = pinnedMessagesOrdered[pinReplaceIndex];
    if (!victim) return;
    const toPin = pinLimitModalMsg;
    const cid = toPin.conversationId;
    setPinLimitSubmitting(true);
    try {
      await unpinMessage({
        messageId: victim.messageId,
        conversationId: cid,
        createdAt: victim.createdAt,
      }).unwrap();
      dispatch(
        messagePinUpdated({
          messageId: victim.messageId,
          conversationId: cid,
          isPinned: false,
        }),
      );
      patchMessageInCache(cid, victim.messageId, { isPinned: false });

      await pinMessage({
        messageId: toPin.messageId,
        conversationId: cid,
        createdAt: toPin.createdAt,
      }).unwrap();
      dispatch(
        messagePinUpdated({
          messageId: toPin.messageId,
          conversationId: cid,
          isPinned: true,
        }),
      );
      patchMessageInCache(cid, toPin.messageId, { isPinned: true });
      pushLocalPinSystemLine({ conversationId: cid, actorLabel: "Bạn", pinned: true });
      setPinLimitModalMsg(null);
    } catch {
      toast.error("Không cập nhật ghim được. Thử lại.");
    } finally {
      setPinLimitSubmitting(false);
    }
  }, [
    dispatch,
    patchMessageInCache,
    pinLimitModalMsg,
    pinMessage,
    pinReplaceIndex,
    pinnedMessagesOrdered,
    pushLocalPinSystemLine,
    unpinMessage,
  ]);

  return {
    handleTogglePinMsg,
    handleConfirmPinReplace,
    pinLimitModalMsg,
    setPinLimitModalMsg,
    pinReplaceIndex,
    setPinReplaceIndex,
    pinLimitSubmitting,
  };
}
