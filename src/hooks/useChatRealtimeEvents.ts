import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

import { chatApi, CHAT_MESSAGES_QUERY_LIMIT } from "@/store/api/chatApi";
import { groupApi } from "@/store/api/endpoints/groupApi";
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
  bumpGroupBoardRefresh,
  markGroupMemberRemovedRealtime,
} from "@/store/slices/chatSlice";
import {
  groupProfilePatchFromPayload,
  patchGroupProfileInConversationsCache,
  patchGroupSettingsInCaches,
} from "@/utils/groupRealtimeCache";
import { normalizeGroupSettings } from "@/utils/normalizeGroupSettings";
import { store, type AppDispatch } from "@/store/store";
import type { ChatFrameBannerVariant } from "@/store/slices/chatSlice";
import type { IConversation, IMessage } from "@/types/chat.types";
import { toast } from "@/utils/appToast";
import { formatChatPreviewLine, getMessageTypeLabel } from "@/utils/messageDisplay";
import { sortConversationsForSidebar } from "@/utils/conversationListSort";
import {
  parseConversationCreatedPayload,
  upsertConversationInListCache,
} from "@/utils/conversationRealtimeCache";
import { formatSystemLastMessagePreview } from "@/utils/systemMessage";
import {
  applyKickedFromGroupRealtime,
  applyRejoinedGroupMemberRealtime,
  messagePassesJoinCutoff,
} from "@/utils/chatMembershipRealtime";

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

function groupUpdateNoticeText(
  payload: Record<string, unknown>,
  currentUserId?: string,
): string | null {
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "";
  const changed =
    payload.changed && typeof payload.changed === "object"
      ? (payload.changed as { name?: boolean; avatar?: boolean })
      : null;
  const nameChanged = changed ? changed.name === true : Boolean(name);
  const avatarChanged = changed ? changed.avatar === true : Boolean(!name && payload.avatar);
  if (!nameChanged && !avatarChanged) return null;

  const actorId = String(payload.actorId ?? "").trim();
  const actorName = String(payload.actorName ?? "").trim();
  const who = currentUserId && actorId && actorId === currentUserId ? "Bạn" : actorName || "Ai đó";

  if (nameChanged && avatarChanged && name) {
    return `${who} đã đổi tên nhóm thành "${name}" và cập nhật ảnh đại diện nhóm`;
  }
  if (nameChanged && name) return `${who} đã đổi tên nhóm thành "${name}"`;
  if (avatarChanged) return `${who} đã cập nhật ảnh đại diện nhóm`;
  return null;
}

/** Đã có pill system trong khung chat — không banner trùng (web `useChatGroupFrameNotices`). */
function shouldSkipSystemFrameBanner(kind: string): boolean {
  if (kind === "message_pinned" || kind === "message_unpinned") return true;
  return (
    kind === "group_created" ||
    kind === "group_profile_updated" ||
    kind === "group_admin_promoted" ||
    kind === "group_admin_demoted" ||
    kind === "group_owner_transferred" ||
    kind === "group_owner_assigned" ||
    kind === "group_member_invited" ||
    kind === "group_member_joined" ||
    kind === "group_member_left" ||
    kind === "group_member_removed"
  );
}

function systemFrameBannerDedupeKey(
  msg: IMessage,
  kind: string,
  parsed: Record<string, unknown>,
): string {
  const poll = parsed.poll as { pollId?: string } | undefined;
  const task = parsed.task as { taskId?: string } | undefined;
  const pollId = String(poll?.pollId ?? "").trim();
  const taskId = String(task?.taskId ?? "").trim();
  if (kind.startsWith("poll_")) return `sys:${kind}:${pollId || msg.messageId}`;
  if (kind.startsWith("task_")) {
    if (kind === "task_reminder") {
      const stage = String(parsed.stage ?? "x");
      return `sys:${kind}:${taskId || msg.messageId}:${stage}`;
    }
    return `sys:${kind}:${taskId || msg.messageId}`;
  }
  return `sys:${kind}:${msg.messageId}`;
}

/** Tin system JSON — nội dung khớp sidebar/web `lastMessageLineFromSystemJson`. */
function bannerFromSystemMessage(msg: IMessage): {
  text: string;
  atIso: string;
  variant: ChatFrameBannerVariant;
  pollId?: string;
  dedupeKey: string;
} | null {
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
  if (shouldSkipSystemFrameBanner(kind)) return null;
  const atIso = normalizeIso(String(parsed.createdAt ?? msg.createdAt ?? ""));
  const currentUserId = store.getState().auth.user?.userId ?? "";
  const text =
    formatSystemLastMessagePreview(raw, msg.senderId, currentUserId, msg.senderDisplayName) ??
    "Thông báo nhóm";
  const dedupeKey = systemFrameBannerDedupeKey(msg, kind, parsed);

  if (kind.startsWith("poll_")) {
    let pollId: string | undefined;
    if (kind === "poll_created") {
      const poll = parsed.poll as { pollId?: string } | undefined;
      const id = String(poll?.pollId ?? "").trim();
      if (id) pollId = id;
    }
    return pollId
      ? { text, atIso, variant: "poll", pollId, dedupeKey }
      : { text, atIso, variant: "poll", dedupeKey };
  }

  if (kind.startsWith("task_")) {
    const actorId = String((parsed.actor as { userId?: string } | undefined)?.userId ?? "").trim();
    if (
      (kind === "task_assigned" || kind === "task_updated") &&
      actorId &&
      currentUserId &&
      actorId === currentUserId
    ) {
      return null;
    }
    const variant: ChatFrameBannerVariant =
      kind === "task_joined" ? "task_joined" : "task_assigned";
    return { text, atIso, variant, dedupeKey };
  }

  return { text, atIso, variant: "task_assigned", dedupeKey };
}

/**
 * Hook xử lý tất cả socket events cho chat.
 * Thông báo trong khung chat (frame banner + giờ) khi đang mở đúng hội thoại.
 */
export function useChatRealtimeEvents({
  dispatch,
  socket,
  activeConversationId,
}: UseChatRealtimeEventsParams): void {
  const activeConvRef = useRef<string | null>(activeConversationId);
  const typingIndicatorTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Tránh xử lý `message:new` trùng cùng messageId (vd: backend/lỗi emit đúp) — banner khung chat không lặp. */
  const recentMessageSocketRef = useRef<Map<string, number>>(new Map());
  const frameBannerDedupeMapRef = useRef<Map<string, number>>(new Map());
  const conversationsRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!socket) return;
    const timers = typingIndicatorTimersRef.current;

    const scheduleConversationsListRefetch = () => {
      if (conversationsRefetchTimerRef.current) {
        clearTimeout(conversationsRefetchTimerRef.current);
      }
      conversationsRefetchTimerRef.current = setTimeout(() => {
        conversationsRefetchTimerRef.current = null;
        void dispatch(
          conversationApi.endpoints.getConversations.initiate(undefined, {
            forceRefetch: true,
          }),
        );
      }, 350);
    };

    const handleConversationCreated = (data: unknown) => {
      const conv = parseConversationCreatedPayload(data);
      if (!conv) {
        scheduleConversationsListRefetch();
        return;
      }
      upsertConversationInListCache(dispatch, conv);
    };

    const clearTypingIndicatorTimer = (key: string) => {
      const t = timers[key];
      if (t) clearTimeout(t);
      delete timers[key];
    };

    const frameDedupe = frameBannerDedupeMapRef.current;

    const emitFrameBanner = (
      dedupeKey: string,
      conversationId: string,
      message: string,
      atIso?: string,
      variant?: ChatFrameBannerVariant,
      dedupeMs = 2500,
      pollId?: string | null,
    ) => {
      if (conversationId !== activeConvRef.current) return;
      const now = Date.now();
      const fullKey = `${conversationId}:${dedupeKey}`;
      const last = frameDedupe.get(fullKey) ?? 0;
      if (now - last < dedupeMs) return;
      frameDedupe.set(fullKey, now);
      if (frameDedupe.size > 200) {
        for (const [k, ts] of frameDedupe.entries()) {
          if (now - ts > 60_000) frameDedupe.delete(k);
        }
      }
      const pid = pollId?.trim();
      dispatch(
        showChatFrameBanner({
          conversationId,
          message,
          atIso: normalizeIso(atIso),
          ...(variant ? { variant } : {}),
          ...(pid ? { pollId: pid } : {}),
        }),
      );
    };

    const invalidateGroupData = (
      groupId: string,
      parts: ("polls" | "tasks" | "settings" | "requests" | "members")[],
    ) => {
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

    /** Đồng bộ sidebar với web: `memberCount` cập nhật ngay, không chỉ invalidate. */
    const patchConversationMemberCount = (gid: string, payload: Record<string, unknown>) => {
      const id = gid.trim();
      if (!id) return;
      const mc = payload.memberCount;
      if (typeof mc !== "number" || !Number.isFinite(mc)) return;
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((x: IConversation) => x.conversationId === id);
          if (conv) conv.memberCount = mc;
        }),
      );
    };

    const removeConversationFromListCache = (gid: string) => {
      const id = gid.trim();
      if (!id) return;
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const idx = draft?.findIndex((c: IConversation) => c.conversationId === id) ?? -1;
          if (idx >= 0) draft.splice(idx, 1);
        }),
      );
    };

    /**
     * `useGetGroupMembersQuery` thường `skip` khi modal quản lý nhóm đóng — invalidateTags
     * không refetch nếu không có subscriber, cache danh sách thành viên vẫn cũ.
     * (Không prefetch `getGroupRequests` ở đây: API chỉ admin/owner, member thường gọi sẽ 403.)
     */
    const prefetchGroupMembers = (groupId: string) => {
      if (!groupId.trim()) return;
      void dispatch(groupApi.endpoints.getGroupMembers.initiate(groupId, { forceRefetch: true }));
    };

    const handleNewMessage = (msg: IMessage) => {
      const cid = String(msg.conversationId ?? "").trim();
      const cutoff = store.getState().chat.messageJoinCutoffMsByConversation[cid];
      if (!messagePassesJoinCutoff(msg, cutoff)) return;

      const mid = String(msg.messageId ?? "").trim();
      if (cid && mid) {
        const sig = `${cid}:${mid}`;
        const now = Date.now();
        const prev = recentMessageSocketRef.current.get(sig);
        if (prev != null && now - prev < 5000) return;
        recentMessageSocketRef.current.set(sig, now);
        if (recentMessageSocketRef.current.size > 400) {
          for (const [k, ts] of recentMessageSocketRef.current.entries()) {
            if (now - ts > 60_000) recentMessageSocketRef.current.delete(k);
          }
        }
      }

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

      let convMissing = false;
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find(
            (item: IConversation) => item.conversationId === msg.conversationId,
          );
          if (!conv) {
            convMissing = true;
            return;
          }
          const alreadySamePreview =
            conv.lastMessage &&
            conv.lastMessage.content === listPreview &&
            conv.lastMessage.senderId === msg.senderId &&
            conv.lastMessage.createdAt === msg.createdAt;
          conv.lastMessage = {
            messageId: msg.messageId,
            content: listPreview,
            senderId: msg.senderId,
            type: msg.type,
            createdAt: msg.createdAt,
            senderDisplayName: msg.senderDisplayName,
          };
          conv.lastMessageAt = msg.createdAt;
          conv.updatedAt = msg.createdAt;
          const isIncomingFromOther = Boolean(viewerId) && msg.senderId !== viewerId;
          if (
            isIncomingFromOther &&
            msg.conversationId !== activeConvRef.current &&
            !alreadySamePreview
          ) {
            conv.unreadCount = (conv.unreadCount ?? 0) + 1;
          }
          const sorted = sortConversationsForSidebar([...(draft as IConversation[])]);
          draft.splice(0, draft.length, ...sorted);
        }),
      );
      if (convMissing) scheduleConversationsListRefetch();

      if (
        msg.type !== "system" &&
        viewerId &&
        msg.senderId !== viewerId &&
        msg.conversationId !== activeConvRef.current
      ) {
        const convList = conversationApi.endpoints.getConversations.select(undefined)(
          store.getState(),
        )?.data as IConversation[] | undefined;
        const conv = convList?.find((c) => c.conversationId === msg.conversationId);
        const muted = Boolean(conv?.isMuted);
        if (!muted) {
          const sender = msg.senderDisplayName?.trim() || "Tin nhắn mới";
          const preview = listPreview.length > 80 ? `${listPreview.slice(0, 77)}…` : listPreview;
          toast.info(`${sender}: ${preview}`, 4000);
        }
      }

      if (msg.type === "system") {
        const banner = bannerFromSystemMessage(msg);
        if (banner && msg.conversationId === activeConvRef.current) {
          const bannerDedupeMs =
            banner.dedupeKey.includes("task_reminder") || banner.dedupeKey.includes("task_due")
              ? 60_000
              : 8_000;
          emitFrameBanner(
            banner.dedupeKey,
            msg.conversationId,
            banner.text,
            banner.atIso,
            banner.variant,
            bannerDedupeMs,
            banner.pollId,
          );
          try {
            const raw = String(msg.content ?? "").trim();
            const p = JSON.parse(raw) as { kind?: string };
            const k = String(p.kind ?? "");
            const tags: { type: "Polls" | "Tasks"; id: string }[] = [];
            if (k.startsWith("poll")) tags.push({ type: "Polls", id: msg.conversationId });
            if (k.startsWith("task")) tags.push({ type: "Tasks", id: msg.conversationId });
            if (tags.length) dispatch(chatApi.util.invalidateTags(tags));
          } catch {
            dispatch(chatApi.util.invalidateTags([{ type: "Polls", id: msg.conversationId }]));
          }
        } else if (banner && msg.conversationId !== activeConvRef.current) {
          try {
            const raw = String(msg.content ?? "").trim();
            const parsed = JSON.parse(raw) as {
              kind?: string;
              poll?: { pollId?: string };
            };
            const kind = String(parsed.kind ?? "");
            let dedupeKey = `sys-toast-${kind}-${msg.messageId}`;
            if (kind === "poll_created" && parsed.poll?.pollId) {
              dedupeKey = `poll-created-${String(parsed.poll.pollId)}`;
            }
            if (!pollToastDedupe.has(dedupeKey)) {
              pollToastDedupe.add(dedupeKey);
              setTimeout(() => pollToastDedupe.delete(dedupeKey), 8000);
              toast.info(banner.text, 7000);
            }
          } catch {
            /* ignore */
          }
        }
      }
    };

    const handleEdited = (payload: {
      messageId: string;
      conversationId: string;
      content: string;
    }) => {
      dispatch(messageEdited(payload));
      if (payload.conversationId === activeConvRef.current) {
        const list = store.getState().chat.messages[payload.conversationId];
        if (list?.some((m) => m.messageId === payload.messageId)) {
          emitFrameBanner(
            `edited:${payload.messageId}`,
            payload.conversationId,
            "Tin nhắn đã được chỉnh sửa",
          );
        }
      }
      const viewerId = store.getState().auth.user?.userId ?? "";
      const nowIso = new Date().toISOString();
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find(
            (item: IConversation) => item.conversationId === payload.conversationId,
          );
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
      emitFrameBanner(
        `recall:${payload.messageId}`,
        payload.conversationId,
        "Tin nhắn đã được thu hồi",
      );
      const mid = String(payload.messageId);
      const cid = payload.conversationId;
      dispatch(
        (chatApi.util as { updateQueryData: (...args: unknown[]) => unknown }).updateQueryData(
          "getMessages",
          { conversationId: cid, limit: CHAT_MESSAGES_QUERY_LIMIT },
          (draft: IMessage[]) => {
            const m = draft.find((x) => String(x.messageId) === mid);
            if (m) {
              m.isRecalled = true;
              m.content = "Tin nhắn đã được thu hồi";
              m.isPinned = false;
            }
          },
        ) as never,
      );
      dispatch(
        conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conv = draft?.find((item: IConversation) => item.conversationId === cid);
          const lm = conv?.lastMessage;
          if (!conv || !lm || String(lm.messageId) !== mid) return;
          lm.content = "Tin nhắn đã được thu hồi";
        }),
      );
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handleHiddenForMe = (payload: { messageId: string; conversationId: string }) => {
      dispatch(messageHiddenForMe(payload));
      dispatch(
        (chatApi.util as { updateQueryData: (...args: unknown[]) => unknown }).updateQueryData(
          "getMessages",
          {
            conversationId: payload.conversationId,
            limit: CHAT_MESSAGES_QUERY_LIMIT,
          },
          (draft: IMessage[]) => {
            const idx = draft.findIndex((x) => x.messageId === payload.messageId);
            if (idx >= 0) draft.splice(idx, 1);
          },
        ) as never,
      );
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handlePinUpdated = (payload: {
      messageId: string;
      conversationId: string;
      isPinned: boolean;
    }) => {
      dispatch(messagePinUpdated(payload));
      const mid = String(payload.messageId);
      dispatch(
        (chatApi.util as { updateQueryData: (...args: unknown[]) => unknown }).updateQueryData(
          "getMessages",
          {
            conversationId: payload.conversationId,
            limit: CHAT_MESSAGES_QUERY_LIMIT,
          },
          (draft: IMessage[]) => {
            const m = draft.find((x) => String(x.messageId) === mid);
            if (m) m.isPinned = payload.isPinned;
          },
        ) as never,
      );
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handleReaction = (payload: {
      messageId: string;
      conversationId: string;
      reactions: Record<string, string[]>;
    }) => {
      dispatch(messageReacted(payload));
      const mid = String(payload.messageId);
      dispatch(
        (chatApi.util as { updateQueryData: (...args: unknown[]) => unknown }).updateQueryData(
          "getMessages",
          {
            conversationId: payload.conversationId,
            limit: CHAT_MESSAGES_QUERY_LIMIT,
          },
          (draft: IMessage[]) => {
            const m = draft.find((x) => String(x.messageId) === mid);
            if (m) m.reactions = payload.reactions;
          },
        ) as never,
      );
    };

    const handleTyping = (payload: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
      displayName?: string;
    }) => {
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
      const profileFromPayload = groupProfilePatchFromPayload(payload);
      const conversationId =
        profileFromPayload?.conversationId ??
        String(payload.conversationId ?? payload.groupId ?? "").trim();
      if (!conversationId) return;

      dispatch(bumpGroupBoardRefresh({ conversationId }));
      if (profileFromPayload) {
        patchGroupProfileInConversationsCache(
          dispatch,
          profileFromPayload.conversationId,
          profileFromPayload.patch,
        );
      }

      const hasMemberCountPatch =
        typeof profileFromPayload?.patch.memberCount === "number" &&
        Number.isFinite(profileFromPayload.patch.memberCount);
      const profileOnlyPatch =
        Boolean(profileFromPayload) &&
        !hasMemberCountPatch &&
        (profileFromPayload.patch.name !== undefined ||
          profileFromPayload.patch.avatar !== undefined ||
          profileFromPayload.patch.updatedAt !== undefined);
      if (!profileOnlyPatch) {
        dispatch(chatApi.util.invalidateTags(["Conversations"]));
      }
      if (conversationId === activeConvRef.current) {
        dispatch(
          chatApi.util.invalidateTags([{ type: "Conversations", id: `MEMBERS-${conversationId}` }]),
        );
      }

      const currentUserId = store.getState().auth.user?.userId ?? "";
      const noticeText = groupUpdateNoticeText(payload, currentUserId);
      if (conversationId === activeConvRef.current) {
        if (noticeText) {
          const atIso = typeof payload.updatedAt === "string" ? payload.updatedAt : undefined;
          emitFrameBanner(
            `group:updated:${conversationId}`,
            conversationId,
            noticeText,
            atIso,
            "task_assigned",
          );
        }
      } else if (noticeText) {
        toast.info(noticeText);
      }
    };

    const handleGroupSettingsUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const gs = payload.groupSettings;
      if (gs && typeof gs === "object") {
        patchGroupSettingsInCaches(dispatch, gid, normalizeGroupSettings(gs));
      }
      invalidateGroupData(gid, ["settings"]);
      dispatch(
        chatApi.util.invalidateTags([
          { type: "GroupSettings", id: gid },
          { type: "Messages", id: gid },
        ]),
      );
      emitFrameBanner(
        `group:settings:${gid}`,
        gid,
        "Cài đặt nhóm đã thay đổi",
        undefined,
        "task_assigned",
      );
    };

    const handleGroupPollNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["polls", "members"]);
      dispatch(chatApi.util.invalidateTags([{ type: "Messages", id: gid }]));
      emitFrameBanner(
        `group:poll_new:${gid}`,
        gid,
        "Có bình chọn mới trong nhóm",
        undefined,
        "poll",
      );
    };

    const handleGroupPollUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["polls"]);
      dispatch(chatApi.util.invalidateTags([{ type: "Messages", id: gid }]));
      const pollId = String((payload as { pollId?: string }).pollId ?? "").trim();
      emitFrameBanner(
        `group:poll_upd:${pollId || gid}`,
        gid,
        "Bình chọn vừa được cập nhật",
        undefined,
        "poll",
        1500,
        pollId || undefined,
      );
    };

    const handleGroupTaskNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["tasks"]);
      /** Giống web `useChatGroupFrameNotices`: chỉ refetch; banner từ tin system JSON. */
    };

    const handleGroupTaskUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["tasks"]);
      /** Giống web: chỉ refetch; banner từ tin system JSON (`message:new`). */
    };

    const handleGroupTaskDeleted = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["tasks"]);
      dispatch(chatApi.util.invalidateTags([{ type: "Messages", id: gid }]));
    };

    const handleGroupMemberJoined = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const viewerId = store.getState().auth.user?.userId ?? "";
      const joinedUserId = String((payload as { userId?: string }).userId ?? "").trim();
      const joinedAt = String((payload as { joinedAt?: string }).joinedAt ?? "").trim();
      if (viewerId && joinedUserId === viewerId && joinedAt) {
        applyRejoinedGroupMemberRealtime(dispatch, gid, joinedAt);
      }
      patchConversationMemberCount(gid, payload);
      invalidateGroupData(gid, ["members", "requests", "tasks"]);
      prefetchGroupMembers(gid);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      emitFrameBanner(
        `group:member_joined:${joinedUserId}`,
        gid,
        "Có thành viên mới tham gia nhóm",
        undefined,
        "task_assigned",
      );
    };

    const handleGroupMemberLeft = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const leftUserId = String((payload as { userId?: string }).userId ?? "").trim();
      if (leftUserId) {
        dispatch(markGroupMemberRemovedRealtime({ conversationId: gid, userId: leftUserId }));
      }
      patchConversationMemberCount(gid, payload);
      invalidateGroupData(gid, ["members", "tasks"]);
      prefetchGroupMembers(gid);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      const leftAt = typeof payload.leftAt === "string" ? payload.leftAt : undefined;
      emitFrameBanner(
        `group:member_left:${leftUserId}`,
        gid,
        "Một thành viên vừa rời nhóm",
        leftAt,
        "task_assigned",
      );
    };

    const handleGroupMemberRemoved = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const viewerId = store.getState().auth.user?.userId ?? "";
      const removedUserId = String((payload as { userId?: string }).userId ?? "").trim();
      if (removedUserId) {
        dispatch(markGroupMemberRemovedRealtime({ conversationId: gid, userId: removedUserId }));
      }
      if (viewerId && removedUserId === viewerId) {
        applyKickedFromGroupRealtime(dispatch, gid);
      }
      patchConversationMemberCount(gid, payload);
      invalidateGroupData(gid, ["members", "tasks"]);
      prefetchGroupMembers(gid);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      emitFrameBanner(
        `group:member_removed:${removedUserId}`,
        gid,
        "Một thành viên đã bị xóa khỏi nhóm",
        undefined,
        "task_assigned",
      );
    };

    const handleGroupRoleChanged = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["members"]);
      prefetchGroupMembers(gid);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      /** Giống web: chỉ refetch members; pill system đủ cho đổi vai trò. */
    };

    const handleGroupJoinRequestNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["requests"]);
      emitFrameBanner(
        `group:join_req_new:${gid}`,
        gid,
        "Có yêu cầu tham gia nhóm mới",
        undefined,
        "task_assigned",
      );
    };

    const handleGroupJoinRequestUpdated = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      invalidateGroupData(gid, ["requests"]);
      emitFrameBanner(
        `group:join_req_upd:${gid}`,
        gid,
        "Danh sách yêu cầu tham gia đã cập nhật",
        undefined,
        "task_assigned",
      );
    };

    const handleGroupDisbanded = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      emitFrameBanner(
        `group:disbanded:${gid}`,
        gid,
        "Nhóm đã bị giải tán",
        undefined,
        "task_assigned",
        10_000,
      );
      removeConversationFromListCache(gid);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handleGroupDeleted = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      emitFrameBanner(
        `group:deleted:${gid}`,
        gid,
        "Nhóm đã bị xóa",
        undefined,
        "task_assigned",
        10_000,
      );
      removeConversationFromListCache(gid);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const handleGroupRequestApproved = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const joinedAt = String((payload as { joinedAt?: string }).joinedAt ?? "").trim();
      if (joinedAt) {
        applyRejoinedGroupMemberRealtime(dispatch, gid, joinedAt);
      }
      patchConversationMemberCount(gid, payload);
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      toast.info("Bạn đã được duyệt vào nhóm", 5000);
    };

    const handleGroupRequestRejected = () => {
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
      toast.info("Yêu cầu tham gia nhóm đã bị từ chối", 5000);
    };

    const handleGroupRecapNew = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
      const short = summary.length > 80 ? `${summary.slice(0, 80)}…` : summary;
      emitFrameBanner(
        `recap:${gid}:${short || "empty"}`,
        gid,
        short ? `Tóm tắt AI mới: ${short}` : "Có tóm tắt AI mới cho nhóm",
      );
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

    socket.on("conversation:created", handleConversationCreated);
    socket.on("message:new", handleNewMessage);
    socket.on("message:edited", handleEdited);
    socket.on("message:recalled", handleRecalled);
    socket.on("message:recall", handleRecalled);
    socket.on("message:hidden_for_me", handleHiddenForMe);
    socket.on("message:pin_updated", handlePinUpdated);
    socket.on("message:reacted", handleReaction);
    socket.on("message:reaction", handleReaction);
    socket.on("message:typing", handleTyping);
    socket.on("message:typing_indicator", handleTypingIndicator);
    socket.on("group:updated", handleGroupUpdated);
    socket.on("group:settings_updated", handleGroupSettingsUpdated);
    socket.on("group:poll_new", handleGroupPollNew);
    socket.on("group:poll_updated", handleGroupPollUpdated);
    socket.on("group:task_new", handleGroupTaskNew);
    socket.on("group:task_updated", handleGroupTaskUpdated);
    socket.on("group:task_deleted", handleGroupTaskDeleted);
    socket.on("group:member_joined", handleGroupMemberJoined);
    socket.on("group:members_added", handleGroupMemberJoined);
    socket.on("group:member_left", handleGroupMemberLeft);
    socket.on("group:member_removed", handleGroupMemberRemoved);
    socket.on("group:role_changed", handleGroupRoleChanged);
    socket.on("group:join_request_new", handleGroupJoinRequestNew);
    socket.on("group:join_request_updated", handleGroupJoinRequestUpdated);
    socket.on("group:disbanded", handleGroupDisbanded);
    socket.on("group:deleted", handleGroupDeleted);
    const handleGroupMembershipRevoked = (payload: Record<string, unknown>) => {
      const gid = groupIdFromPayload(payload);
      if (!gid) return;
      const viewerId = store.getState().auth.user?.userId ?? "";
      const removedUserId = String((payload as { userId?: string }).userId ?? "").trim();
      if (viewerId && removedUserId === viewerId) {
        applyKickedFromGroupRealtime(dispatch, gid);
      }
    };

    socket.on("group:membership_revoked", handleGroupMembershipRevoked);
    socket.on("group:request_approved", handleGroupRequestApproved);
    socket.on("group:request_rejected", handleGroupRequestRejected);
    socket.on("group:recap_new", handleGroupRecapNew);

    return () => {
      if (conversationsRefetchTimerRef.current) {
        clearTimeout(conversationsRefetchTimerRef.current);
        conversationsRefetchTimerRef.current = null;
      }
      for (const key of Object.keys(timers)) {
        clearTimeout(timers[key]!);
        delete timers[key];
      }
      socket.off("conversation:created", handleConversationCreated);
      socket.off("message:new", handleNewMessage);
      socket.off("message:edited", handleEdited);
      socket.off("message:recalled", handleRecalled);
      socket.off("message:recall", handleRecalled);
      socket.off("message:hidden_for_me", handleHiddenForMe);
      socket.off("message:pin_updated", handlePinUpdated);
      socket.off("message:reacted", handleReaction);
      socket.off("message:reaction", handleReaction);
      socket.off("message:typing", handleTyping);
      socket.off("message:typing_indicator", handleTypingIndicator);
      socket.off("group:updated", handleGroupUpdated);
      socket.off("group:settings_updated", handleGroupSettingsUpdated);
      socket.off("group:poll_new", handleGroupPollNew);
      socket.off("group:poll_updated", handleGroupPollUpdated);
      socket.off("group:task_new", handleGroupTaskNew);
      socket.off("group:task_updated", handleGroupTaskUpdated);
      socket.off("group:task_deleted", handleGroupTaskDeleted);
      socket.off("group:member_joined", handleGroupMemberJoined);
      socket.off("group:members_added", handleGroupMemberJoined);
      socket.off("group:member_left", handleGroupMemberLeft);
      socket.off("group:member_removed", handleGroupMemberRemoved);
      socket.off("group:role_changed", handleGroupRoleChanged);
      socket.off("group:join_request_new", handleGroupJoinRequestNew);
      socket.off("group:join_request_updated", handleGroupJoinRequestUpdated);
      socket.off("group:disbanded", handleGroupDisbanded);
      socket.off("group:deleted", handleGroupDeleted);
      socket.off("group:membership_revoked", handleGroupMembershipRevoked);
      socket.off("group:request_approved", handleGroupRequestApproved);
      socket.off("group:request_rejected", handleGroupRequestRejected);
      socket.off("group:recap_new", handleGroupRecapNew);
    };
  }, [dispatch, socket]);
}
