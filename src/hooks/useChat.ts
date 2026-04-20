import { useCallback, useRef } from "react";

import { useAppSelector } from "@/hooks/useAppStore";
import {
  useSendMessageMutation,
  useEditMessageMutation,
  useRecallMessageMutation,
  useDeleteMessageMutation,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useReactMessageMutation,
} from "@/store/api/chatApi";
import { useSocket } from "@/hooks/useSocket";
import type { IMessage, IReplyToDetails, MessageType } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";

/**
 * Hook cung cấp tất cả actions liên quan đến chat messaging.
 * Mở rộng từ sendMessage cơ bản sang full CRUD + reactions + typing.
 */
export const useChat = () => {
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

  // ── Gửi tin nhắn text ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (conversationId: string, content: string): Promise<void> => {
      await sendMessageMutation({
        conversationId,
        type: "text",
        content,
      }).unwrap();
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

  // ── Gửi tin nhắn với reply ─────────────────────────────────────────
  const sendReplyMessage = useCallback(
    async (conversationId: string, content: string, replyToMessage: IMessage): Promise<void> => {
      const clientReplyToDetails: IReplyToDetails = {
        messageId: replyToMessage.messageId,
        senderId: replyToMessage.senderId,
        senderDisplayName: replyToMessage.senderDisplayName ?? null,
        content: formatChatPreviewLine(replyToMessage, currentUserId),
        type: replyToMessage.type,
      };
      await sendMessageMutation({
        conversationId,
        type: "text",
        content,
        replyTo: replyToMessage.messageId,
        clientReplyToDetails,
      }).unwrap();
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
      await recallMessageMutation({
        messageId: msg.messageId,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
      }).unwrap();
    },
    [recallMessageMutation],
  );

  // ── Xóa tin nhắn (ẩn phía mình) ───────────────────────────────────
  const deleteMessage = useCallback(
    async (msg: IMessage): Promise<void> => {
      await deleteMessageMutation({
        messageId: msg.messageId,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
      }).unwrap();
    },
    [deleteMessageMutation],
  );

  // ── Ghim/bỏ ghim tin nhắn ─────────────────────────────────────────
  const togglePinMessage = useCallback(
    async (msg: IMessage): Promise<void> => {
      const mutation = msg.isPinned
        ? unpinMessageMutation
        : pinMessageMutation;
      await mutation({
        messageId: msg.messageId,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
      }).unwrap();
    },
    [pinMessageMutation, unpinMessageMutation],
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
      }, 900);
    },
    [socket],
  );

  return {
    sendMessage,
    sendMediaMessage,
    sendReplyMessage,
    editMessage,
    recallMessage,
    deleteMessage,
    togglePinMessage,
    reactMessage,
    emitTyping,
    isSending: sendState.isLoading,
    isEditing: editState.isLoading,
  };
};
