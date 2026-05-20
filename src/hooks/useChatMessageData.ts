import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import {
  useGetMessagesPaginatedQuery,
  useLazyGetMessagesPaginatedQuery,
  MOBILE_PAGINATED_LIMIT,
} from "@/store/api/chatApi";
import { messageApi } from "@/store/api/endpoints/messageApi";
import type { IMessage } from "@/types/chat.types";
import { mergeChatFileMessageFields } from "@/utils/chatMediaDisplay";
import { orderPinnedMessagesMRU } from "@/utils/pinnedMessageOrder";

const EMPTY_MESSAGE_ARRAY: IMessage[] = [];

/** Khoảng thời gian cho phép khớp optimistic ↔ tin server (socket / sau merge HTTP). */
const OPTIMISTIC_REAL_MATCH_MS = 180_000;

/**
 * Gửi tin tạo bản optimistic (id `optimistic-…`) trong RTK; socket gửi lại cùng tin với id thật.
 * Map theo messageId thấy 2 dòng — lọc bỏ optimistic khi đã có bản thật trùng nội dung.
 */
function stripOptimisticEchoes(messages: IMessage[]): IMessage[] {
  const optimistic = messages.filter((m) => m.messageId.startsWith("optimistic-"));
  if (optimistic.length === 0) return messages;

  const real = messages.filter((m) => !m.messageId.startsWith("optimistic-"));
  const drop = new Set<string>();

  for (const o of optimistic) {
    const twin = real.find((r) => {
      if (r.senderId !== o.senderId || r.conversationId !== o.conversationId) return false;
      if (r.type !== o.type) return false;
      const c1 = (o.content ?? "").trim();
      const c2 = (r.content ?? "").trim();
      if (c1 !== c2) return false;
      const dt = Math.abs(new Date(r.createdAt).getTime() - new Date(o.createdAt).getTime());
      return dt < OPTIMISTIC_REAL_MATCH_MS;
    });
    if (twin) drop.add(o.messageId);
  }

  return messages.filter((m) => !drop.has(m.messageId));
}

/**
 * Giống web `ChatMessageList` `seenTaskAssignedIds`: mỗi `taskId` chỉ giữ một tin
 * `task_assigned` — ưu bản server (không phải `local-task-card:*`) thay vì thẻ local.
 */
function dedupeTaskAssignedSystemMessages(messages: IMessage[]): IMessage[] {
  type Pick = { messageId: string; createdAt: number; isLocal: boolean };
  const best = new Map<string, Pick>();

  for (const m of messages) {
    if (m.type !== "system") continue;
    const raw = String(m.content ?? "").trim();
    if (!raw.startsWith("{")) continue;
    let tid: string | null = null;
    try {
      const o = JSON.parse(raw) as { kind?: string; task?: { taskId?: string } };
      if (o?.kind === "task_assigned" && o?.task?.taskId) tid = String(o.task.taskId).trim();
    } catch {
      continue;
    }
    if (!tid) continue;

    const cur: Pick = {
      messageId: m.messageId,
      createdAt: new Date(m.createdAt).getTime(),
      isLocal: m.messageId.startsWith("local-task-card:"),
    };
    const prev = best.get(tid);
    if (!prev) {
      best.set(tid, cur);
      continue;
    }
    if (prev.isLocal && !cur.isLocal) {
      best.set(tid, cur);
      continue;
    }
    if (!prev.isLocal && cur.isLocal) continue;
    if (cur.createdAt < prev.createdAt) best.set(tid, cur);
  }

  return messages.filter((m) => {
    if (m.type !== "system") return true;
    const raw = String(m.content ?? "").trim();
    if (!raw.startsWith("{")) return true;
    try {
      const o = JSON.parse(raw) as { kind?: string; task?: { taskId?: string } };
      if (o?.kind !== "task_assigned" || !o?.task?.taskId) return true;
      const tid = String(o.task.taskId).trim();
      const keeper = best.get(tid)?.messageId;
      return keeper === m.messageId;
    } catch {
      return true;
    }
  });
}

/**
 * Hook quản lý data cho messages: merge API (RTK Query paginated) + socket (Redux state).
 * Now uses cursor-based pagination for infinite scroll.
 *
 * Note: Mobile FlatList is `inverted`, so allMessages is sorted newest→oldest.
 */
export function useChatMessageData(conversationId: string | null) {
  const dispatch = useAppDispatch();
  const pinnedMessageOrderByConv = useAppSelector((s) => s.chat.pinnedMessageOrderByConv);

  // 1. Socket messages từ Redux store (được cập nhật bởi useChatRealtimeEvents)
  const socketMessages = useAppSelector((state) => {
    if (!conversationId) return EMPTY_MESSAGE_ARRAY;
    return state.chat.messages[conversationId] ?? EMPTY_MESSAGE_ARRAY;
  });

  // 2. Paginated API messages từ RTK Query cache (oldest → newest from API)
  const {
    data: paginatedData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetMessagesPaginatedQuery(
    { conversationId: conversationId!, limit: MOBILE_PAGINATED_LIMIT },
    { skip: !conversationId },
  );

  const apiMessages = paginatedData?.items ?? [];
  const nextCursor = paginatedData?.nextCursor ?? null;
  const hasMore = paginatedData?.hasMore ?? false;

  // 3. Lazy query for loading older messages
  const [triggerLoadMore, { isFetching: isLoadingOlder }] = useLazyGetMessagesPaginatedQuery();

  const loadOlderMessages = useCallback(() => {
    if (!conversationId || !nextCursor || isLoadingOlder) return;
    triggerLoadMore({
      conversationId,
      limit: MOBILE_PAGINATED_LIMIT,
      cursor: nextCursor,
    });
  }, [conversationId, nextCursor, isLoadingOlder, triggerLoadMore]);

  // 4. Merge API + socket, dedup by messageId, sort newest→oldest (for inverted FlatList)
  const allMessages = useMemo(() => {
    const map = new Map<string, IMessage>();

    // API messages (oldest → newest from server)
    apiMessages.forEach((m) => map.set(m.messageId, m));
    // Socket messages override / add
    socketMessages.forEach((m) => {
      const prev = map.get(m.messageId);
      map.set(m.messageId, prev ? mergeChatFileMessageFields(m, prev) : m);
    });

    const merged = stripOptimisticEchoes(Array.from(map.values()));
    const deduped = dedupeTaskAssignedSystemMessages(merged);

    // Newest → oldest for inverted FlatList
    return deduped.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [apiMessages, socketMessages]);

  const pinnedMessagesOrdered = useMemo(() => {
    if (!conversationId) return [];
    const pinned = allMessages.filter((m) => m.isPinned && !m.isRecalled && !m.isDeleted);
    const order = pinnedMessageOrderByConv[conversationId] ?? [];
    return orderPinnedMessagesMRU(pinned, order);
  }, [allMessages, conversationId, pinnedMessageOrderByConv]);

  const patchMessageInCache = useCallback(
    (cid: string, messageId: string, patch: Partial<IMessage>) => {
      dispatch(
        messageApi.util.updateQueryData(
          "getMessagesPaginated",
          { conversationId: cid },
          (draft) => {
            const m = draft.items.find((x) => x.messageId === messageId);
            if (m) Object.assign(m, patch);
          },
        ),
      );
    },
    [dispatch],
  );

  const result = useMemo(
    () => ({
      allMessages,
      pinnedMessagesOrdered,
      patchMessageInCache,
      isLoading,
      isError,
      isFetching,
      refetch,
      latestMessageId: allMessages.length > 0 ? allMessages[0].messageId : undefined,
      // Pagination
      hasMore,
      isLoadingOlder,
      loadOlderMessages,
    }),
    [
      allMessages,
      pinnedMessagesOrdered,
      patchMessageInCache,
      isLoading,
      isError,
      isFetching,
      refetch,
      hasMore,
      isLoadingOlder,
      loadOlderMessages,
    ],
  );

  return result;
}
