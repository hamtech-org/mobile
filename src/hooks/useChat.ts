import { useCallback, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import {
  chatApi,
  CHAT_MESSAGES_QUERY_LIMIT,
  useSendMessageMutation,
  useEditMessageMutation,
  useRecallMessageMutation,
  useDeleteMessageMutation,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useReactMessageMutation,
} from "@/store/api/chatApi";
import { messageReceived, messagePinUpdated } from "@/store/slices/chatSlice";
import { useSocket } from "@/hooks/useSocket";
import type { IMessage, IReplyToDetails, MessageType } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { toast } from "@/utils/appToast";
import { splitMessageContent } from "@/utils/chatTextSplitter";

/**
 * Hook cung cấp tất cả actions liên quan đến chat messaging.
 * Mở rộng từ sendMessage cơ bản sang full CRUD + reactions + typing.
 */
export const useChat = () => {
  const dispatch = useAppDispatch();
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const socket = useSocket();
  const [sendMessageMutation, sendState] = useSendMessageMutation();
  const [editMessageMutation, editState] = useEditMessageMutation();
  const [recallMessageMutation] = useRecallMessageMutation();
  const [deleteMessageMutation] = useDeleteMessageMutation();
  const [pinMessageMutation] = usePinMessageMutation();
  const [unpinMessageMutation] = useUnpinMessageMutation();
  const [reactMessageMutation] = useReactMessageMutation();
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Giống web `useMessagePinController.pushLocalPinSystemLine` — dòng giữa luồng + icon ghim. */
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
        (chatApi.util as { updateQueryData: (...args: unknown[]) => unknown }).updateQueryData(
          "getMessages",
          { conversationId, limit: CHAT_MESSAGES_QUERY_LIMIT },
          (draft: IMessage[]) => {
            draft.push(sys);
          },
        ) as never,
      );
      dispatch(messageReceived(sys));
    },
    [dispatch],
  );

  // ── Gửi tin nhắn text ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (conversationId: string, content: string, mentions?: string[]): Promise<void> => {
      const chunks = splitMessageContent(content, 2000);
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]!;
          const chunkMentions = mentions
            ? mentions.filter((id) => chunk.includes(`mention:${id}`))
            : undefined;
          await sendMessageMutation({
            conversationId,
            type: "text",
            content: chunk,
            mentions: chunkMentions,
          }).unwrap();
        }
      } else {
        await sendMessageMutation({
          conversationId,
          type: "text",
          content,
          mentions,
        }).unwrap();
      }
    },
    [sendMessageMutation],
  );

  // ── Gửi tin nhắn media (sau khi đã upload) ────────────────────────
  const sendMediaMessage = useCallback(
    async (
      conversationId: string,
      type: MessageType,
      content: string,
      mediaId: string,
      replyTo?: string,
      options?: {
        optimisticLocalUri?: string;
        optimisticMediaName?: string;
        optimisticMediaSize?: number;
        optimisticMimeType?: string;
        clientReplyToDetails?: IReplyToDetails | null;
      },
    ): Promise<void> => {
      await sendMessageMutation({
        conversationId,
        type,
        content: content || " ",
        mediaId,
        replyTo,
        optimisticLocalUri: options?.optimisticLocalUri,
        optimisticMediaName: options?.optimisticMediaName,
        optimisticMediaSize: options?.optimisticMediaSize,
        optimisticMimeType: options?.optimisticMimeType,
        clientReplyToDetails: options?.clientReplyToDetails,
      }).unwrap();
    },
    [sendMessageMutation],
  );

  // ── Gửi tin nhắn thoại (Voice Message) ────────────────────────
  const sendVoiceMessage = useCallback(
    async (
      conversationId: string,
      mediaId: string,
      duration: number,
      replyTo?: string,
      options?: {
        optimisticLocalUri?: string;
        clientReplyToDetails?: IReplyToDetails | null;
      },
    ): Promise<void> => {
      await sendMessageMutation({
        conversationId,
        type: "voice",
        content: "[Tin nhắn thoại]",
        mediaId,
        replyTo,
        duration,
        optimisticLocalUri: options?.optimisticLocalUri,
        clientReplyToDetails: options?.clientReplyToDetails,
      }).unwrap();
    },
    [sendMessageMutation],
  );

  // ── Gửi tin nhắn với reply ─────────────────────────────────────────
  const sendReplyMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      replyToMessage: IMessage,
      mentions?: string[],
    ): Promise<void> => {
      const clientReplyToDetails: IReplyToDetails = {
        messageId: replyToMessage.messageId,
        senderId: replyToMessage.senderId,
        senderDisplayName: replyToMessage.senderDisplayName ?? null,
        content: formatChatPreviewLine(replyToMessage, currentUserId),
        type: replyToMessage.type,
      };

      const chunks = splitMessageContent(content, 2000);
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]!;
          const chunkMentions = mentions
            ? mentions.filter((id) => chunk.includes(`mention:${id}`))
            : undefined;
          await sendMessageMutation({
            conversationId,
            type: "text",
            content: chunk,
            replyTo: i === 0 ? replyToMessage.messageId : undefined,
            clientReplyToDetails: i === 0 ? clientReplyToDetails : undefined,
            mentions: chunkMentions,
          }).unwrap();
        }
      } else {
        await sendMessageMutation({
          conversationId,
          type: "text",
          content,
          replyTo: replyToMessage.messageId,
          clientReplyToDetails,
          mentions,
        }).unwrap();
      }
    },
    [sendMessageMutation, currentUserId],
  );

  // ── Chỉnh sửa tin nhắn ────────────────────────────────────────────
  const editMessage = useCallback(
    async (msg: IMessage, newContent: string): Promise<void> => {
      await editMessageMutation({
        messageId: msg.messageId,
        content: newContent,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
      }).unwrap();
    },
    [editMessageMutation],
  );

  // ── Thu hồi tin nhắn ───────────────────────────────────────────────
  const recallMessage = useCallback(
    async (msg: IMessage): Promise<void> => {
      try {
        await recallMessageMutation({
          messageId: msg.messageId,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt,
        }).unwrap();
      } catch (e: unknown) {
        const d =
          typeof e === "object" && e !== null && "data" in e
            ? (e as { data?: unknown }).data
            : undefined;
        const body =
          d && typeof d === "object"
            ? (d as { error?: { message?: string }; message?: string })
            : undefined;
        const msgText = String(body?.error?.message ?? body?.message ?? "").trim();
        toast.error(msgText || "Không thu hồi được tin nhắn");
        throw e;
      }
    },
    [recallMessageMutation],
  );

  // ── Xóa tin nhắn (ẩn phía mình) ───────────────────────────────────
  const deleteMessage = useCallback(
    async (msg: IMessage): Promise<void> => {
      try {
        await deleteMessageMutation({
          messageId: msg.messageId,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt,
        }).unwrap();
      } catch (e: unknown) {
        const d =
          typeof e === "object" && e !== null && "data" in e
            ? (e as { data?: unknown }).data
            : undefined;
        const body =
          d && typeof d === "object"
            ? (d as { error?: { message?: string }; message?: string })
            : undefined;
        const msgText = String(body?.error?.message ?? body?.message ?? "").trim();
        toast.error(msgText || "Không xóa được tin nhắn");
        throw e;
      }
    },
    [deleteMessageMutation],
  );

  // ── Ghim/bỏ ghim tin nhắn ─────────────────────────────────────────
  const togglePinMessage = useCallback(
    async (msg: IMessage): Promise<void> => {
      const conversationId = msg.conversationId;
      const actorLabel = "Bạn";
      const nextPinned = !msg.isPinned;
      const mutation = msg.isPinned ? unpinMessageMutation : pinMessageMutation;
      await mutation({
        messageId: msg.messageId,
        conversationId,
        createdAt: msg.createdAt,
      }).unwrap();
      dispatch(
        messagePinUpdated({
          messageId: msg.messageId,
          conversationId,
          isPinned: nextPinned,
        }),
      );
      pushLocalPinSystemLine({ conversationId, actorLabel, pinned: nextPinned });
    },
    [pinMessageMutation, unpinMessageMutation, dispatch, pushLocalPinSystemLine],
  );

  // ── Thả cảm xúc ───────────────────────────────────────────────────
  const reactMessage = useCallback(
    async (msg: IMessage, emoji: string): Promise<void> => {
      await reactMessageMutation({
        messageId: msg.messageId,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
        emoji,
      }).unwrap();
    },
    [reactMessageMutation],
  );

  // ── Typing indicator (debounced) ───────────────────────────────────
  const emitTyping = useCallback(
    (conversationId: string) => {
      if (!socket || !conversationId) return;
      if (!typingTimerRef.current) {
        socket.emit("message:typing", conversationId);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, 1000); // Chuẩn hóa emit interval thành 1000ms
    },
    [socket],
  );

  const emitTypingStop = useCallback(
    (conversationId: string) => {
      if (!socket || !conversationId) return;
      socket.emit("message:typing_stop", conversationId);
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    },
    [socket],
  );

  return {
    sendMessage,
    sendMediaMessage,
    sendVoiceMessage,
    sendReplyMessage,
    editMessage,
    recallMessage,
    deleteMessage,
    togglePinMessage,
    reactMessage,
    emitTyping,
    emitTypingStop,
    isSending: sendState.isLoading,
    isEditing: editState.isLoading,
  };
};
