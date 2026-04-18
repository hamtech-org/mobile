import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

import { chatApi } from "@/store/api/chatApi";
import { conversationApi } from "@/store/api/endpoints/conversationApi";
import {
  messageReceived,
  messageRecalled,
  messageEdited,
  messageHiddenForMe,
  messagePinUpdated,
  messageReacted,
  typingStarted,
  typingStopped,
} from "@/store/slices/chatSlice";
import type { AppDispatch } from "@/store/store";
import type { IConversation, IMessage } from "@/types/chat.types";

interface UseChatRealtimeEventsParams {
  dispatch: AppDispatch;
  socket: Socket | null;
  activeConversationId: string | null;
}

/**
 * Hook xử lý tất cả socket events cho chat.
 * Copy-adapt pattern từ web's useChatRealtimeEvents.
 */
const TYPING_INDICATOR_IDLE_MS = 2500;

export function useChatRealtimeEvents({ dispatch, socket, activeConversationId }: UseChatRealtimeEventsParams): void {
  const activeConvRef = useRef<string | null>(activeConversationId);
  const typingIndicatorTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!socket) return;
    const timers = typingIndicatorTimersRef.current;

    const clearTypingIndicatorTimer = (key: string) => {
      const t = timers[key];
      if (t) clearTimeout(t);
      delete timers[key];
    };

    // ── message:new ──────────────────────────────────────────────────
    const handleNewMessage = (msg: IMessage) => {
      dispatch(messageReceived(msg));

      // Cập nhật conversation list cache
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((item: IConversation) => item.conversationId === msg.conversationId);
          if (!conv) return;
          conv.lastMessage = {
            messageId: msg.messageId,
            content:
              msg.content?.trim() !== ""
                ? msg.content
                : msg.type === "image"
                  ? "[Ảnh]"
                  : msg.type === "video"
                    ? "[Video]"
                    : msg.type === "file"
                      ? "[File]"
                      : msg.content,
            senderId: msg.senderId,
            type: msg.type,
            createdAt: msg.createdAt,
            senderDisplayName: msg.senderDisplayName,
          };
          // Tăng unread nếu không phải conversation đang mở
          if (msg.conversationId !== activeConvRef.current) {
            conv.unreadCount = (conv.unreadCount ?? 0) + 1;
          }
        }),
      );
    };

    // ── message:edited ───────────────────────────────────────────────
    const handleEdited = (payload: { messageId: string; conversationId: string; content: string }) => {
      dispatch(messageEdited(payload));
    };

    // ── message:recalled ─────────────────────────────────────────────
    const handleRecalled = (payload: { messageId: string; conversationId: string }) => {
      dispatch(messageRecalled(payload));
    };

    // ── message:hidden_for_me ────────────────────────────────────────
    const handleHiddenForMe = (payload: { messageId: string; conversationId: string }) => {
      dispatch(messageHiddenForMe(payload));
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    // ── message:pin_updated ──────────────────────────────────────────
    const handlePinUpdated = (payload: { messageId: string; conversationId: string; isPinned: boolean }) => {
      dispatch(messagePinUpdated(payload));
    };

    // ── message:reacted ──────────────────────────────────────────────
    const handleReaction = (payload: { messageId: string; conversationId: string; reactions: Record<string, string[]> }) => {
      dispatch(messageReacted(payload));
    };

    // ── message:typing ───────────────────────────────────────────────
    const handleTyping = (payload: { conversationId: string; userId: string; isTyping: boolean; displayName?: string }) => {
      if (payload.isTyping) {
        dispatch(
          typingStarted({
            conversationId: payload.conversationId,
            userId: payload.userId,
            displayName: payload.displayName,
          }),
        );
      } else {
        dispatch(
          typingStopped({
            conversationId: payload.conversationId,
            userId: payload.userId,
          }),
        );
      }
    };

    // ── group:updated ────────────────────────────────────────────────
    const handleGroupUpdated = (payload: { conversationId?: string; name?: string; avatar?: string }) => {
      if (!payload.conversationId) return;

      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((item: IConversation) => item.conversationId === payload.conversationId);
          if (!conv) return;
          if (payload.name) conv.name = payload.name;
          if (payload.avatar) conv.avatar = payload.avatar;
        }),
      );
    };

    /** Backend emit `message:typing_indicator` (không có isTyping: false). */
    const handleTypingIndicator = (payload: {
      userId: string;
      conversationId: string;
      displayName?: string | null;
    }) => {
      const key = `${payload.conversationId}:${payload.userId}`;
      const name = payload.displayName?.trim();
      dispatch(
        typingStarted({
          conversationId: payload.conversationId,
          userId: payload.userId,
          displayName: name ? name : undefined,
        }),
      );
      clearTypingIndicatorTimer(key);
      timers[key] = setTimeout(() => {
        dispatch(typingStopped({ conversationId: payload.conversationId, userId: payload.userId }));
        delete timers[key];
      }, TYPING_INDICATOR_IDLE_MS);
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:edited", handleEdited);
    socket.on("message:recalled", handleRecalled);
    socket.on("message:recall", handleRecalled);
    socket.on("message:hidden_for_me", handleHiddenForMe);
    socket.on("message:pin_updated", handlePinUpdated);
    socket.on("message:reacted", handleReaction);
    socket.on("message:typing", handleTyping);
    socket.on("message:typing_indicator", handleTypingIndicator);
    socket.on("group:updated", handleGroupUpdated);

    return () => {
      for (const key of Object.keys(timers)) {
        clearTimeout(timers[key]!);
        delete timers[key];
      }
      socket.off("message:new", handleNewMessage);
      socket.off("message:edited", handleEdited);
      socket.off("message:recalled", handleRecalled);
      socket.off("message:recall", handleRecalled);
      socket.off("message:hidden_for_me", handleHiddenForMe);
      socket.off("message:pin_updated", handlePinUpdated);
      socket.off("message:reacted", handleReaction);
      socket.off("message:typing", handleTyping);
      socket.off("message:typing_indicator", handleTypingIndicator);
      socket.off("group:updated", handleGroupUpdated);
    };
  }, [dispatch, socket]);
}
