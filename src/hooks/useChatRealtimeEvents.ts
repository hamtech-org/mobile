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
  showChatFrameBanner,
  typingStarted,
  typingStopped,
} from "@/store/slices/chatSlice";
import { store, type AppDispatch } from "@/store/store";
import type { IConversation, IMessage } from "@/types/chat.types";
import { toast } from "@/utils/appToast";
import { formatChatPreviewLine, getMessageTypeLabel } from "@/utils/messageDisplay";

/** Toast khi không mở hội thoại — tránh trùng poll. */
const pollToastDedupe = new Set<string>();

interface UseChatRealtimeEventsParams {
  dispatch: AppDispatch;
  socket: Socket | null;
  activeConversationId: string | null;
}

const TYPING_INDICATOR_IDLE_MS = 2500;

function normalizeIso(at?: string | null): string {
  if (at && !Number.isNaN(new Date(at).getTime())) return at;
  return new Date().toISOString();
}

function groupIdFromPayload(p: Record<string, unknown>): string {
  return String(p.conversationId ?? p.groupId ?? "").trim();
}

function roleVi(role: string): string {
  if (role === "owner") return "trưởng nhóm";
  if (role === "admin") return "quản trị";
  return "thành viên";
}

/** Tin system JSON (bình chọn, …) → banner trong khung chat. */
function bannerFromSystemMessage(msg: IMessage): { text: string; atIso: string } | null {
  if (msg.type !== "system") return null;
  const raw = String(msg.content ?? "").trim();
  if (!raw.startsWith("{")) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const kind = String(parsed.kind ?? "");
  const actor = (parsed.actor ?? {}) as { name?: string };
  const actorName = String(actor.name ?? "Thành viên").trim();
  const poll = (parsed.poll ?? {}) as Record<string, unknown>;
  const question = String(poll.question ?? "").trim();
  const atIso = normalizeIso(String(parsed.createdAt ?? msg.createdAt ?? ""));

  switch (kind) {
    case "poll_created":
      return {
        text: question ? `${actorName} đã tạo bình chọn: ${question}` : `${actorName} đã tạo bình chọn mới`,
        atIso,
      };
    case "poll_voted": {
      const opt = String(poll.optionText ?? "").trim();
      return {
        text: opt ? `${actorName} đã bình chọn: ${opt}` : `${actorName} đã tham gia bình chọn`,
        atIso,
      };
    }
    case "poll_vote_changed": {
      const opt = String(poll.optionText ?? "").trim();
      const prev = String(poll.prevOptionText ?? "").trim();
      return {
        text: prev && opt ? `${actorName} đổi bình chọn (${prev} → ${opt})` : `${actorName} đã đổi lựa chọn bình chọn`,
        atIso,
      };
    }
    case "poll_unvoted":
      return { text: `${actorName} đã bỏ chọn bình chọn`, atIso };
    case "poll_option_added": {
      const ot = String(poll.optionText ?? "").trim();
      return {
        text: ot ? `${actorName} đã thêm lựa chọn: ${ot}` : `${actorName} đã thêm lựa chọn bình chọn`,
        atIso,
      };
    }
    case "poll_closed":
      return {
        text: question ? `Bình chọn đã đóng: ${question}` : "Một bình chọn đã được đóng",
        atIso,
      };
    default:
      return null;
  }
}

/**
 * Hook xử lý tất cả socket events cho chat.
 * Thông báo trong khung chat (frame banner + giờ) khi đang mở đúng hội thoại.
 */
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

    const emitFrameBanner = (conversationId: string, message: string, atIso?: string) => {
      if (conversationId !== activeConvRef.current) return;
      dispatch(
        showChatFrameBanner({
          conversationId,
          message,
          atIso: normalizeIso(atIso),
        }),
      );
    };

    const invalidateGroupData = (groupId: string, parts: ("polls" | "tasks" | "settings" | "requests" | "members")[]) => {
      const tags: Parameters<typeof chatApi.util.invalidateTags>[0] = [];
      for (const p of parts) {
        if (p === "polls") tags.push({ type: "Polls", id: groupId });
        if (p === "tasks") tags.push({ type: "Tasks", id: groupId });
        if (p === "settings") tags.push({ type: "GroupSettings", id: groupId });
        if (p === "requests") tags.push({ type: "GroupRequests", id: groupId });
        if (p === "members") tags.push({ type: "Conversations", id: `MEMBERS-${groupId}` });
      }
      if (tags.length) dispatch(chatApi.util.invalidateTags(tags));
    };

    const handleNewMessage = (msg: IMessage) => {
      dispatch(messageReceived(msg));

      const viewerId = store.getState().auth.user?.userId ?? "";
      const listPreview =
        msg.content?.trim() !== ""
          ? formatChatPreviewLine(msg, viewerId)
          : msg.type === "image"
            ? "[Ảnh]"
            : msg.type === "video"
              ? "[Video]"
              : msg.type === "file"
                ? "[File]"
                : getMessageTypeLabel(msg.type) || "Tin nhắn";

      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((item: IConversation) => item.conversationId === msg.conversationId);
          if (!conv) return;
          conv.lastMessage = {
            messageId: msg.messageId,
            content: listPreview,
            senderId: msg.senderId,
            type: msg.type,
            createdAt: msg.createdAt,
            senderDisplayName: msg.senderDisplayName,
          };
          conv.updatedAt = msg.createdAt;
          if (msg.conversationId !== activeConvRef.current) {
            conv.unreadCount = (conv.unreadCount ?? 0) + 1;
          }
        }),
      );

      if (msg.type === "system") {
        const banner = bannerFromSystemMessage(msg);
        if (banner && msg.conversationId === activeConvRef.current) {
          emitFrameBanner(msg.conversationId, banner.text, banner.atIso);
          dispatch(chatApi.util.invalidateTags([{ type: "Polls", id: msg.conversationId }]));
        } else if (banner && msg.conversationId !== activeConvRef.current) {
          try {
            const raw = String(msg.content ?? "").trim();
            const parsed = JSON.parse(raw) as { kind?: string; poll?: { pollId?: string; question?: string } };
            if (parsed.kind === "poll_created" && parsed.poll?.pollId) {
              const pollId = String(parsed.poll.pollId);
              const dedupeKey = `poll-created-${pollId}`;
              if (!pollToastDedupe.has(dedupeKey)) {
                pollToastDedupe.add(dedupeKey);
                setTimeout(() => pollToastDedupe.delete(dedupeKey), 8000);
                const question = String(parsed.poll.question ?? "").trim();
                toast.info(question ? `Có bình chọn mới: ${question}` : "Có bình chọn mới", 7000);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    };

    const handleEdited = (payload: { messageId: string; conversationId: string; content: string }) => {
      dispatch(messageEdited(payload));
      if (payload.conversationId === activeConvRef.current) {
        const list = store.getState().chat.messages[payload.conversationId];
        if (list?.some((m) => m.messageId === payload.messageId)) {
          emitFrameBanner(payload.conversationId, "Tin nhắn đã được chỉnh sửa");
        }
      }
      const viewerId = store.getState().auth.user?.userId ?? "";
      const nowIso = new Date().toISOString();
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((item: IConversation) => item.conversationId === payload.conversationId);
          if (!conv?.lastMessage || conv.lastMessage.messageId !== payload.messageId) return;
          conv.lastMessage = {
            ...conv.lastMessage,
            content: formatChatPreviewLine(
              {
                type: conv.lastMessage.type,
                content: payload.content,
                senderId: conv.lastMessage.senderId,
                senderDisplayName: conv.lastMessage.senderDisplayName ?? null,
                isRecalled: false,
              },
              viewerId,
            ),
          };
          conv.updatedAt = nowIso;
        }),
      );
    };

    const handleRecalled = (payload: { messageId: string; conversationId: string }) => {
      dispatch(messageRecalled(payload));
      emitFrameBanner(payload.conversationId, "Tin nhắn đã được thu hồi");
    };

    const handleHiddenForMe = (payload: { messageId: string; conversationId: string }) => {
      dispatch(messageHiddenForMe(payload));
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handlePinUpdated = (payload: { messageId: string; conversationId: string; isPinned: boolean }) => {
      dispatch(messagePinUpdated(payload));
      if (payload.conversationId !== activeConvRef.current) return;
      const list = store.getState().chat.messages[payload.conversationId];
      const msg = list?.find((m) => m.messageId === payload.messageId);
      if (!payload.isPinned && msg?.isRecalled) return;
      emitFrameBanner(payload.conversationId, payload.isPinned ? "Tin nhắn đã được ghim" : "Đã bỏ ghim tin nhắn");
    };

    const handleReaction = (payload: { messageId: string; conversationId: string; reactions: Record<string, string[]> }) => {
      dispatch(messageReacted(payload));
    };

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

    const handleGroupUpdated = (payload: Record<string, unknown>) => {
      const conversationId = String(payload.conversationId ?? "").trim();
      if (!conversationId) return;

      const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : undefined;
      const avatar = typeof payload.avatar === "string" && payload.avatar.trim() ? payload.avatar.trim() : undefined;

      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((item: IConversation) => item.conversationId === conversationId);
          if (!conv) return;
          if (name) conv.name = name;
          if (avatar) conv.avatar = avatar;
        }),
      );

      if (conversationId === activeConvRef.current) {
        const bits: string[] = [];
        if (name) bits.push(`Tên nhóm: ${name}`);
        if (avatar) bits.push("Ảnh đại diện nhóm đã đổi");
        const message = bits.length > 0 ? bits.join(" · ") : "Thông tin nhóm đã được cập nhật";
        const atIso = typeof payload.updatedAt === "string" ? payload.updatedAt : undefined;
        emitFrameBanner(conversationId, message, atIso);
      } else if (name) {
        toast.info(`Nhóm '${name}' vừa cập nhật thông tin`);
      }
    };

    const handleGroupSettingsUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["settings"]);
      emitFrameBanner(gid, "Cài đặt nhóm đã được cập nhật");
    };

    const handleGroupPollNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["polls", "members"]);
      dispatch(chatApi.util.invalidateTags([{ type: "Messages", id: gid }]));
    };

    const handleGroupPollUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["polls"]);
      dispatch(chatApi.util.invalidateTags([{ type: "Messages", id: gid }]));
    };

    const handleGroupTaskNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["tasks"]);
      emitFrameBanner(gid, "Có công việc nhóm mới");
    };

    const handleGroupTaskUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["tasks"]);
      emitFrameBanner(gid, "Công việc nhóm đã được cập nhật");
    };

    const handleGroupMemberJoined = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["members", "requests"]);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      emitFrameBanner(gid, "Có thành viên mới tham gia nhóm");
    };

    const handleGroupMemberLeft = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["members"]);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      const leftAt = typeof payload.leftAt === "string" ? payload.leftAt : undefined;
      emitFrameBanner(gid, "Có thành viên đã rời nhóm", leftAt);
    };

    const handleGroupMemberRemoved = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["members"]);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      emitFrameBanner(gid, "Một thành viên đã bị xóa khỏi nhóm");
    };

    const handleGroupRoleChanged = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["members"]);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      const role = String(payload.role ?? "");
      const msg = role ? `Vai trò trong nhóm đã đổi (${roleVi(role)})` : "Vai trò trong nhóm đã được cập nhật";
      emitFrameBanner(gid, msg);
    };

    const handleGroupJoinRequestNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["requests"]);
      const mids = payload.memberIds;
      const isInvite = Array.isArray(mids) && mids.length > 0;
      emitFrameBanner(gid, isInvite ? "Đã gửi lời mời tham gia nhóm" : "Có yêu cầu tham gia nhóm mới");
    };

    const handleGroupJoinRequestUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["requests"]);
      emitFrameBanner(gid, "Danh sách chờ duyệt đã cập nhật");
    };

    const handleGroupDisbanded = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      emitFrameBanner(gid, "Nhóm đã được giải tán");
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handleGroupDeleted = (payload: Record<string, unknown>) => {
      const gid = String((payload as { groupId?: string }).groupId ?? "").trim();
      if (!gid) return;
      emitFrameBanner(gid, "Nhóm đã bị xóa");
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handleGroupRecapNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
      const short = summary.length > 80 ? `${summary.slice(0, 80)}…` : summary;
      emitFrameBanner(gid, short ? `Tóm tắt AI mới: ${short}` : "Có tóm tắt AI mới cho nhóm");
    };

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
    socket.on("group:settings_updated", handleGroupSettingsUpdated);
    socket.on("group:poll_new", handleGroupPollNew);
    socket.on("group:poll_updated", handleGroupPollUpdated);
    socket.on("group:task_new", handleGroupTaskNew);
    socket.on("group:task_updated", handleGroupTaskUpdated);
    socket.on("group:member_joined", handleGroupMemberJoined);
    socket.on("group:member_left", handleGroupMemberLeft);
    socket.on("group:member_removed", handleGroupMemberRemoved);
    socket.on("group:role_changed", handleGroupRoleChanged);
    socket.on("group:join_request_new", handleGroupJoinRequestNew);
    socket.on("group:join_request_updated", handleGroupJoinRequestUpdated);
    socket.on("group:disbanded", handleGroupDisbanded);
    socket.on("group:deleted", handleGroupDeleted);
    socket.on("group:recap_new", handleGroupRecapNew);

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
      socket.off("group:settings_updated", handleGroupSettingsUpdated);
      socket.off("group:poll_new", handleGroupPollNew);
      socket.off("group:poll_updated", handleGroupPollUpdated);
      socket.off("group:task_new", handleGroupTaskNew);
      socket.off("group:task_updated", handleGroupTaskUpdated);
      socket.off("group:member_joined", handleGroupMemberJoined);
      socket.off("group:member_left", handleGroupMemberLeft);
      socket.off("group:member_removed", handleGroupMemberRemoved);
      socket.off("group:role_changed", handleGroupRoleChanged);
      socket.off("group:join_request_new", handleGroupJoinRequestNew);
      socket.off("group:join_request_updated", handleGroupJoinRequestUpdated);
      socket.off("group:disbanded", handleGroupDisbanded);
      socket.off("group:deleted", handleGroupDeleted);
      socket.off("group:recap_new", handleGroupRecapNew);
    };
  }, [dispatch, socket]);
}
