import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { IMessage, MessageStatus, TypingUserEntry } from "@/types/chat.types";
import { applyPinnedMruOrderUpdate } from "@/utils/pinnedMessageOrder";

/** Giống web `ChatFrameNoticeVariant` — màu + icon banner nhóm. */
export type ChatFrameBannerVariant = "poll" | "task_assigned" | "task_joined";
export type FriendPresenceStatus = "online" | "offline" | "away" | string;

/** Thông báo ngắn trong khung chat (ghim, đổi tên nhóm, …) kèm mốc giờ. */
export interface ChatFrameBanner {
  conversationId: string;
  message: string;
  atIso: string;
  /** Không set → coi như `task_assigned` (giống web `ChatGroupFrameNoticeBar`). */
  variant?: ChatFrameBannerVariant;
  /** Bình chọn — bấm banner mở modal (đồng bộ web `poll_created` onClick). */
  pollId?: string | null;
}

interface ChatState {
  activeConversationId: string | null;
  messages: Record<string, IMessage[]>;
  typingUsers: Record<string, TypingUserEntry[]>;
  friendStatuses: Record<string, FriendPresenceStatus>;
  replyingTo: IMessage | null;
  frameBanner: ChatFrameBanner | null;
  messageJoinCutoffMsByConversation: Record<string, number>;
  /** Tăng khi socket báo thay đổi nhóm; refetch members/tasks/polls (đồng bộ web). */
  groupBoardRefreshTickByConversationId: Record<string, number>;
  /** Thành viên đã rời/bị kick (socket) — lọc khỏi danh sách UI realtime. */
  removedGroupMemberIdsByConversationId: Record<string, string[]>;
  /** Thứ tự ghim MRU theo hội thoại — tin ghim mới nhất ở đầu (đồng bộ web). */
  pinnedMessageOrderByConv: Record<string, string[]>;
}

const initialState: ChatState = {
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  friendStatuses: {},
  replyingTo: null,
  frameBanner: null,
  messageJoinCutoffMsByConversation: {},
  groupBoardRefreshTickByConversationId: {},
  removedGroupMemberIdsByConversationId: {},
  pinnedMessageOrderByConv: {},
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setActiveConversationId: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload;
    },

    setMessages: (
      state,
      action: PayloadAction<{ conversationId: string; messages: IMessage[] }>,
    ) => {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },

    // ─── Socket event: tin nhắn mới nhận từ server ────────────────────
    messageReceived: (state, action: PayloadAction<IMessage>) => {
      const msg = action.payload;
      const cutoff = state.messageJoinCutoffMsByConversation[msg.conversationId];
      if (cutoff != null) {
        const t = Date.parse(msg.createdAt);
        if (Number.isFinite(t) && t < cutoff) return;
      }
      if (!state.messages[msg.conversationId]) {
        state.messages[msg.conversationId] = [];
      }
      // Tránh trùng lặp
      const exists = state.messages[msg.conversationId].some((m) => m.messageId === msg.messageId);
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
          const cur = state.pinnedMessageOrderByConv[conversationId] ?? [];
          state.pinnedMessageOrderByConv[conversationId] = cur.filter((id) => id !== messageId);
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
      state.messages[conversationId] = messages.filter((m) => m.messageId !== messageId);
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
      const cur = state.pinnedMessageOrderByConv[conversationId] ?? [];
      state.pinnedMessageOrderByConv[conversationId] = applyPinnedMruOrderUpdate(
        cur,
        messageId,
        isPinned,
      );
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

    typingStopped: (state, action: PayloadAction<{ conversationId: string; userId: string }>) => {
      const { conversationId, userId } = action.payload;
      if (state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
          (e) => e.userId !== userId,
        );
      }
    },

    // ─── Reset unread khi mở conversation ────────────────────────────
    friendStatusChanged: (
      state,
      action: PayloadAction<{ userId: string; status: FriendPresenceStatus }>,
    ) => {
      const userId = String(action.payload.userId ?? "").trim();
      const status = String(action.payload.status ?? "").trim();
      if (!userId || !status) return;
      state.friendStatuses[userId] = status;
    },

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

    setMessageJoinCutoff: (
      state,
      action: PayloadAction<{ conversationId: string; minCreatedAtMs: number | null }>,
    ) => {
      const id = String(action.payload.conversationId ?? "").trim();
      if (!id) return;
      if (action.payload.minCreatedAtMs == null) {
        delete state.messageJoinCutoffMsByConversation[id];
        return;
      }
      state.messageJoinCutoffMsByConversation[id] = action.payload.minCreatedAtMs;
    },

    clearConversationMessages: (state, action: PayloadAction<string>) => {
      const id = String(action.payload ?? "").trim();
      if (!id) return;
      delete state.messages[id];
    },

    bumpGroupBoardRefresh: (state, action: PayloadAction<{ conversationId: string }>) => {
      const id = String(action.payload.conversationId ?? "").trim();
      if (!id) return;
      const prev = state.groupBoardRefreshTickByConversationId[id] ?? 0;
      state.groupBoardRefreshTickByConversationId[id] = prev + 1;
    },

    markGroupMemberRemovedRealtime: (
      state,
      action: PayloadAction<{ conversationId: string; userId: string }>,
    ) => {
      const cid = String(action.payload.conversationId ?? "").trim();
      const uid = String(action.payload.userId ?? "").trim();
      if (!cid || !uid) return;
      const prev = state.removedGroupMemberIdsByConversationId[cid] ?? [];
      if (!prev.includes(uid)) {
        state.removedGroupMemberIdsByConversationId[cid] = [...prev, uid];
      }
    },

    resetRemovedGroupMembersRealtime: (state, action: PayloadAction<string>) => {
      const cid = String(action.payload ?? "").trim();
      if (!cid) return;
      delete state.removedGroupMemberIdsByConversationId[cid];
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
  friendStatusChanged,
  resetUnread,
  setReplyingTo,
  clearReplyingTo,
  showChatFrameBanner,
  clearChatFrameBanner,
  setMessageJoinCutoff,
  clearConversationMessages,
  bumpGroupBoardRefresh,
  markGroupMemberRemovedRealtime,
  resetRemovedGroupMembersRealtime,
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;
