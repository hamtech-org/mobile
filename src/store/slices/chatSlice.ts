import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  IConversation,
  IMessage,
  MessageStatus,
  TypingUserEntry,
} from "@/types/chat.types";

/** Thông báo ngắn trong khung chat (ghim, đổi tên nhóm, …) kèm mốc giờ. */
export interface ChatFrameBanner {
  conversationId: string;
  message: string;
  atIso: string;
}

interface ChatState {
  activeConversationId: string | null;
  messages: Record<string, IMessage[]>;
  typingUsers: Record<string, TypingUserEntry[]>;
  replyingTo: IMessage | null;
  frameBanner: ChatFrameBanner | null;
}

const initialState: ChatState = {
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  replyingTo: null,
  frameBanner: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setActiveConversationId: (
      state,
      action: PayloadAction<string | null>,
    ) => {
      state.activeConversationId = action.payload;
    },

    setMessages: (
      state,
      action: PayloadAction<{ conversationId: string; messages: IMessage[] }>,
    ) => {
      state.messages[action.payload.conversationId] =
        action.payload.messages;
    },

    // ─── Socket event: tin nhắn mới nhận từ server ────────────────────
    messageReceived: (state, action: PayloadAction<IMessage>) => {
      const msg = action.payload;
      if (!state.messages[msg.conversationId]) {
        state.messages[msg.conversationId] = [];
      }
      // Tránh trùng lặp
      const exists = state.messages[msg.conversationId].some(
        (m) => m.messageId === msg.messageId,
      );
      if (!exists) {
        state.messages[msg.conversationId].push(msg);
      }
    },

    // ─── Socket event: tin nhắn bị thu hồi ───────────────────────────
    messageRecalled: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string }>,
    ) => {
      const { messageId, conversationId } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        const msg = messages.find((m) => m.messageId === messageId);
        if (msg) {
          msg.isRecalled = true;
          msg.content = "Tin nhắn đã được thu hồi";
          msg.isPinned = false;
        }
      }
    },

    // ─── Socket event: tin nhắn được chỉnh sửa ──────────────────────
    messageEdited: (
      state,
      action: PayloadAction<{
        messageId: string;
        conversationId: string;
        content: string;
      }>,
    ) => {
      const { messageId, conversationId, content } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        const msg = messages.find((m) => m.messageId === messageId);
        if (msg) {
          msg.content = content;
          msg.isEdited = true;
        }
      }
    },

    // ─── Socket event: cập nhật trạng thái tin nhắn ─────────────────
    messageStatusUpdated: (
      state,
      action: PayloadAction<{
        messageId: string;
        conversationId: string;
        status: MessageStatus;
      }>,
    ) => {
      const { messageId, conversationId, status } = action.payload;
      const messages = state.messages[conversationId];
      if (messages) {
        const msg = messages.find((m) => m.messageId === messageId);
        if (msg) msg.status = status;
      }
    },

    // ─── Ẩn tin phía user hiện tại (delete for me) ──────────────────
    messageHiddenForMe: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string }>,
    ) => {
      const { messageId, conversationId } = action.payload;
      const messages = state.messages[conversationId];
      if (!messages) return;
      state.messages[conversationId] = messages.filter(
        (m) => m.messageId !== messageId,
      );
    },

    // ─── Pin/unpin tin nhắn ──────────────────────────────────────────
    messagePinUpdated: (
      state,
      action: PayloadAction<{
        messageId: string;
        conversationId: string;
        isPinned: boolean;
      }>,
    ) => {
      const { messageId, conversationId, isPinned } = action.payload;
      const messages = state.messages[conversationId];
      if (!messages) return;
      const msg = messages.find((m) => m.messageId === messageId);
      if (msg) msg.isPinned = isPinned;
    },

    // ─── Reactions cập nhật ──────────────────────────────────────────
    messageReacted: (
      state,
      action: PayloadAction<{
        messageId: string;
        conversationId: string;
        reactions: Record<string, string[]>;
      }>,
    ) => {
      const { messageId, conversationId, reactions } = action.payload;
      const messages = state.messages[conversationId];
      if (!messages) return;
      const msg = messages.find((m) => m.messageId === messageId);
      if (msg) msg.reactions = reactions;
    },

    // ─── Typing indicators ──────────────────────────────────────────
    typingStarted: (
      state,
      action: PayloadAction<{
        conversationId: string;
        userId: string;
        displayName?: string | null;
      }>,
    ) => {
      const { conversationId, userId, displayName } = action.payload;
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      const list = state.typingUsers[conversationId];
      const name = displayName?.trim() ?? "";
      const idx = list.findIndex((e) => e.userId === userId);
      if (idx >= 0) {
        if (name) list[idx].displayName = name;
      } else {
        list.push({ userId, displayName: name });
      }
    },

    typingStopped: (
      state,
      action: PayloadAction<{ conversationId: string; userId: string }>,
    ) => {
      const { conversationId, userId } = action.payload;
      if (state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = state.typingUsers[
          conversationId
        ].filter((e) => e.userId !== userId);
      }
    },

    // ─── Reset unread khi mở conversation ────────────────────────────
    resetUnread: (state, _action: PayloadAction<string>) => {
      // Unread count được quản lý qua RTK Query cache (conversations list),
      // reducer này chủ yếu để dispatch signal cho middleware nếu cần.
      void state;
    },

    // ─── Reply state ─────────────────────────────────────────────────
    setReplyingTo: (state, action: PayloadAction<IMessage | null>) => {
      state.replyingTo = action.payload;
    },

    clearReplyingTo: (state) => {
      state.replyingTo = null;
    },

    showChatFrameBanner: (state, action: PayloadAction<ChatFrameBanner>) => {
      state.frameBanner = action.payload;
    },

    clearChatFrameBanner: (state) => {
      state.frameBanner = null;
    },
  },
});

export const {
  setActiveConversationId,
  setMessages,
  messageReceived,
  messageRecalled,
  messageEdited,
  messageStatusUpdated,
  messageHiddenForMe,
  messagePinUpdated,
  messageReacted,
  typingStarted,
  typingStopped,
  resetUnread,
  setReplyingTo,
  clearReplyingTo,
  showChatFrameBanner,
  clearChatFrameBanner,
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;
