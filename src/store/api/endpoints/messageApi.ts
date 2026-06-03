import type {
  IConversation,
  IMessage,
  IMessagePage,
  IReplyToDetails,
  MessageType,
  IMessageMediaItem,
} from "@/types/chat.types";
import type { RootState } from "@/store/store";
import { chatApi, type ApiEnvelope } from "../baseChatApi";
import { conversationApi } from "./conversationApi";
import { mergeChatFileMessageFields, normalizeChatMediaMime } from "@/utils/chatMediaDisplay";
import { formatGroupJoinLinkListPreview } from "@/utils/groupJoinLinkMessage";

/** Khớp cache key với useChatMessageData (limit: 50). */
export const CHAT_MESSAGES_QUERY_LIMIT = 50;

/** Mobile page size for paginated endpoint (smaller for mobile networks). */
export const MOBILE_PAGINATED_LIMIT = 30;

export interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaId?: string;
  mediaIds?: string[];
  sourceMessageId?: string;
  sourceConversationId?: string;
  clientTempId?: string;
  replyTo?: string;
  duration?: number;
  mentions?: string[];
  /** Chỉ client — preview bubble khi đang gửi media */
  optimisticLocalUri?: string;
  /** Chỉ client — strip khỏi body, dùng cho reply preview trên bubble optimistic */
  clientReplyToDetails?: IReplyToDetails | null;
  /** Chỉ client — tên file hiển thị khi gửi file optimistic */
  optimisticMediaName?: string;
  /** Chỉ client — dung lượng file (byte) trên bubble optimistic */
  optimisticMediaSize?: number;
  /** Chỉ client — MIME khi gửi file (hiển thị trên bubble trước khi server trả về) */
  optimisticMimeType?: string;
  /** Chỉ client — danh sách media items đính kèm tạm thời cho album */
  optimisticMedias?: IMessageMediaItem[];
}

export interface EditMessageRequest {
  messageId: string;
  content: string;
  conversationId: string;
  createdAt: string;
}

export interface DeleteMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface RecallMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface MarkAsReadRequest {
  conversationId: string;
  messageId: string;
}

export interface PinMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface ReactMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
  emoji: string;
}

export type MessageGalleryKind = "media" | "file" | "link";

export interface MessageGalleryItem {
  messageId: string;
  senderId: string;
  senderDisplayName: string | null;
  type: MessageType;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  mediaOriginalName: string | null;
  createdAt: string;
}

function newOptimisticId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function lastMessagePreviewFromArg(arg: SendMessageRequest): string {
  if (arg.type === "image") return "[Ảnh]";
  if (arg.type === "video") return "[Video]";
  if (arg.type === "file") return "[File]";
  if (arg.type === "voice") return "[Tin nhắn thoại]";
  const raw = (arg.content ?? "").trim();
  if (arg.type === "text") {
    const joinPreview = formatGroupJoinLinkListPreview(raw);
    if (joinPreview) return joinPreview;
  }
  return raw || "";
}

function buildOptimisticMessage(
  arg: SendMessageRequest,
  optimisticId: string,
  userId: string,
  displayName: string | null | undefined,
): IMessage {
  const replyTo = arg.replyTo ?? null;
  const localUri = arg.optimisticLocalUri?.trim();
  const mediaUrl = localUri || (arg.mediaUrl?.trim() ? arg.mediaUrl.trim() : null) || null;
  const isMedia =
    arg.type === "image" || arg.type === "video" || arg.type === "file" || arg.type === "album";
  const thumb = arg.type === "image" || arg.type === "video" ? localUri || mediaUrl : null;

  return {
    messageId: optimisticId,
    conversationId: arg.conversationId,
    senderId: userId,
    senderDisplayName: displayName ?? null,
    type: arg.type,
    content: arg.content ?? "",
    mediaUrl: isMedia ? mediaUrl : null,
    mediaType: !isMedia
      ? null
      : arg.type === "file"
        ? (normalizeChatMediaMime(arg.optimisticMimeType, arg.type) ??
          arg.optimisticMimeType?.trim() ??
          null)
        : arg.type,
    mediaSize:
      typeof arg.optimisticMediaSize === "number" &&
      Number.isFinite(arg.optimisticMediaSize) &&
      arg.optimisticMediaSize > 0
        ? arg.optimisticMediaSize
        : null,
    mediaOriginalName: arg.optimisticMediaName?.trim() || null,
    thumbnailUrl: thumb,
    medias: arg.optimisticMedias ?? null,
    replyTo,
    replyToDetails: arg.clientReplyToDetails ?? null,
    isPinned: false,
    isEdited: false,
    isRecalled: false,
    reactions: {},
    duration: arg.duration ?? null,
    status: isMedia ? "sending" : "sent",
    createdAt: new Date().toISOString(),
    clientTempId: arg.clientTempId ?? optimisticId,
  };
}

function patchLastMessage(
  draft: IConversation[] | undefined,
  conversationId: string,
  patch: {
    messageId: string;
    content: string;
    senderId: string;
    type: MessageType;
    createdAt: string;
    senderDisplayName?: string | null;
  },
) {
  const conv = draft?.find((c) => c.conversationId === conversationId);
  if (!conv) return;
  conv.lastMessage = {
    messageId: patch.messageId,
    content: patch.content,
    senderId: patch.senderId,
    type: patch.type,
    createdAt: patch.createdAt,
    senderDisplayName: patch.senderDisplayName ?? null,
  };
  conv.updatedAt = patch.createdAt;
}

function getMessagesQueryArg(conversationId: string) {
  return { conversationId, limit: CHAT_MESSAGES_QUERY_LIMIT };
}

/** RTK không infer endpoint `getMessages`/`getMessagesPaginated` trong callback injectEndpoints. */
function updateChatMessagesCache(
  dispatch: any,
  conversationId: string,
  updateFn: (draft: IMessage[]) => void,
) {
  const patchGetMessages = dispatch(
    (chatApi.util as any).updateQueryData(
      "getMessages",
      getMessagesQueryArg(conversationId),
      updateFn,
    ),
  );

  const patchGetMessagesPaginated = dispatch(
    (chatApi.util as any).updateQueryData(
      "getMessagesPaginated",
      { conversationId },
      (draft: IMessagePage) => {
        if (draft && Array.isArray(draft.items)) {
          updateFn(draft.items);
        }
      },
    ),
  );

  return {
    undo() {
      patchGetMessages.undo();
      patchGetMessagesPaginated.undo();
    },
  };
}

function lastMessagePreviewFromMessage(m: IMessage): string {
  const raw = (m.content ?? "").trim();
  if (raw !== "") {
    if (m.type === "text") {
      const joinPreview = formatGroupJoinLinkListPreview(raw);
      if (joinPreview) return joinPreview;
    }
    return m.content ?? "";
  }
  if (m.type === "image") return "[Ảnh]";
  if (m.type === "video") return "[Video]";
  if (m.type === "file") return "[File]";
  if (m.type === "voice") return "[Tin nhắn thoại]";
  return m.content ?? "";
}

function newestMessageInList(draft: IMessage[]): IMessage | undefined {
  if (draft.length === 0) return undefined;
  return [...draft].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export const messageApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getMessages: builder.query<IMessage[], { conversationId: string; limit?: number }>({
      query: ({ conversationId, limit = 40 }) =>
        `/chat/conversations/${conversationId}/messages?limit=${limit}`,
      transformResponse: (response: ApiEnvelope<IMessage[]>) => response.data,
      providesTags: (_result, _error, arg) => [{ type: "Messages", id: arg.conversationId }],
    }),

    getMessageGallery: builder.query<
      MessageGalleryItem[],
      { conversationId: string; category: MessageGalleryKind; limit?: number }
    >({
      query: ({ conversationId, category, limit = 120 }) => ({
        url: `/chat/conversations/${conversationId}/gallery`,
        params: { category, limit },
      }),
      transformResponse: (response: ApiEnvelope<MessageGalleryItem[]>) => response.data ?? [],
    }),

    /**
     * Cursor-based paginated messages (oldest → newest).
     * All pages for a conversation merge into a single cache entry.
     */
    getMessagesPaginated: builder.query<
      IMessagePage,
      { conversationId: string; limit?: number; cursor?: string }
    >({
      query: ({ conversationId, limit = MOBILE_PAGINATED_LIMIT, cursor }) => {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        if (cursor) params.set("cursor", cursor);
        return `/chat/conversations/${conversationId}/messages/paginated?${params.toString()}`;
      },
      transformResponse: (response: ApiEnvelope<IMessagePage>) => response.data,
      // Group all pages for same conversation into one cache entry
      serializeQueryArgs: ({ queryArgs }) => queryArgs.conversationId,
      // Merge older pages (prepend) into existing items
      merge: (currentCache, newResponse) => {
        const existingIds = new Set(currentCache.items.map((m) => m.messageId));
        const uniqueNew = newResponse.items.filter((m) => !existingIds.has(m.messageId));
        // Older items prepend (oldest → newest order)
        currentCache.items = [...uniqueNew, ...currentCache.items];
        currentCache.nextCursor = newResponse.nextCursor;
        currentCache.hasMore = newResponse.hasMore;
      },
      // Allow refetch when cursor changes
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: `paginated-${conversationId}` },
      ],
    }),

    sendMessage: builder.mutation<ApiEnvelope<IMessage>, SendMessageRequest>({
      query: (arg) => {
        const {
          conversationId,
          optimisticLocalUri: _u,
          clientReplyToDetails: _r,
          optimisticMediaName: _n,
          optimisticMediaSize: _s,
          optimisticMimeType: _m,
          optimisticMedias: _oms,
          ...body
        } = arg;
        return {
          url: `/chat/conversations/${conversationId}/messages`,
          method: "POST",
          body,
        };
      },
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        const state = getState() as RootState;
        const user = state.auth.user;
        if (!user?.userId) return;

        const optimisticId = arg.clientTempId || newOptimisticId();
        const optimistic = buildOptimisticMessage(arg, optimisticId, user.userId, user.displayName);

        const patchMessages = dispatch(
          (chatApi.util as any).updateQueryData(
            "getMessages",
            getMessagesQueryArg(arg.conversationId),
            (draft: IMessage[]) => {
              const exists = draft.find((m) => m.messageId === optimisticId);
              if (exists) {
                Object.assign(exists, optimistic);
              } else {
                draft.unshift(optimistic);
              }
            },
          ),
        );

        const patchMessagesPaginated = dispatch(
          (chatApi.util as any).updateQueryData(
            "getMessagesPaginated",
            { conversationId: arg.conversationId },
            (draft: IMessagePage) => {
              if (draft && Array.isArray(draft.items)) {
                const exists = draft.items.find((m) => m.messageId === optimisticId);
                if (exists) {
                  Object.assign(exists, optimistic);
                } else if (!draft.items.some((m) => m.messageId === optimistic.messageId)) {
                  draft.items.push(optimistic);
                }
              }
            },
          ),
        );

        const preview = lastMessagePreviewFromArg(arg);
        const patchConvs = dispatch(
          conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
            patchLastMessage(draft, arg.conversationId, {
              messageId: optimisticId,
              content: preview,
              senderId: user.userId,
              type: arg.type,
              createdAt: optimistic.createdAt,
              senderDisplayName: user.displayName,
            });
          }),
        );

        const mergeServerMessage = (serverMsg: IMessage) => {
          dispatch(
            (chatApi.util as any).updateQueryData(
              "getMessages",
              getMessagesQueryArg(arg.conversationId),
              (draft: IMessage[]) => {
                const dup = draft.findIndex(
                  (m: IMessage) =>
                    m.messageId === serverMsg.messageId && m.messageId !== optimisticId,
                );
                if (dup !== -1) draft.splice(dup, 1);
                const optIdx = draft.findIndex((m: IMessage) => m.messageId === optimisticId);
                const optimisticMsg = optIdx !== -1 ? draft[optIdx] : undefined;
                const merged =
                  optimisticMsg != null
                    ? mergeChatFileMessageFields(serverMsg, optimisticMsg)
                    : serverMsg;
                if (optIdx !== -1) draft[optIdx] = merged;
                else if (!draft.some((m: IMessage) => m.messageId === serverMsg.messageId))
                  draft.unshift(merged);
              },
            ),
          );

          dispatch(
            (chatApi.util as any).updateQueryData(
              "getMessagesPaginated",
              { conversationId: arg.conversationId },
              (draft: IMessagePage) => {
                if (draft && Array.isArray(draft.items)) {
                  const dup = draft.items.findIndex(
                    (m: IMessage) =>
                      m.messageId === serverMsg.messageId && m.messageId !== optimisticId,
                  );
                  if (dup !== -1) draft.items.splice(dup, 1);
                  const optIdx = draft.items.findIndex(
                    (m: IMessage) => m.messageId === optimisticId,
                  );
                  const optimisticMsg = optIdx !== -1 ? draft.items[optIdx] : undefined;
                  const merged =
                    optimisticMsg != null
                      ? mergeChatFileMessageFields(serverMsg, optimisticMsg)
                      : serverMsg;
                  if (optIdx !== -1) draft.items[optIdx] = merged;
                  else if (!draft.items.some((m: IMessage) => m.messageId === serverMsg.messageId))
                    draft.items.push(merged);
                }
              },
            ),
          );

          const lastContent = lastMessagePreviewFromMessage(serverMsg);

          dispatch(
            conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
              patchLastMessage(draft, arg.conversationId, {
                messageId: serverMsg.messageId,
                content: lastContent,
                senderId: serverMsg.senderId,
                type: serverMsg.type,
                createdAt: serverMsg.createdAt,
                senderDisplayName: serverMsg.senderDisplayName,
              });
            }),
          );
        };

        try {
          const { data } = await queryFulfilled;
          const serverMsg = (data as ApiEnvelope<IMessage>).data;
          mergeServerMessage(serverMsg);
        } catch {
          dispatch(
            (chatApi.util as any).updateQueryData(
              "getMessages",
              getMessagesQueryArg(arg.conversationId),
              (draft: IMessage[]) => {
                const opt = draft.find((m) => m.messageId === optimisticId);
                if (opt) opt.status = "failed";
              },
            ),
          );
          dispatch(
            (chatApi.util as any).updateQueryData(
              "getMessagesPaginated",
              { conversationId: arg.conversationId },
              (draft: IMessagePage) => {
                if (draft && Array.isArray(draft.items)) {
                  const opt = draft.items.find((m) => m.messageId === optimisticId);
                  if (opt) opt.status = "failed";
                }
              },
            ),
          );
        }
      },
    }),

    editMessage: builder.mutation<ApiEnvelope<null>, EditMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchMsgs = updateChatMessagesCache(
          dispatch,
          arg.conversationId,
          (draft: IMessage[]) => {
            const m = draft.find((x) => x.messageId === arg.messageId);
            if (m) {
              m.content = arg.content;
              m.isEdited = true;
            }
          },
        );
        const patchConv = dispatch(
          conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
            const conv = draft?.find((c) => c.conversationId === arg.conversationId);
            if (conv?.lastMessage?.messageId === arg.messageId) {
              conv.lastMessage = {
                ...conv.lastMessage,
                content: arg.content,
              };
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchMsgs.undo();
          patchConv.undo();
        }
      },
    }),

    deleteMessage: builder.mutation<ApiEnvelope<null>, DeleteMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        const state = getState() as RootState;
        const cached = (chatApi.endpoints as any).getMessages.select(
          getMessagesQueryArg(arg.conversationId),
        )(state);
        const list = (cached?.data ?? []) as IMessage[];
        const convCached = (conversationApi.endpoints as any).getConversations.select(undefined)(
          state,
        );
        const convs = convCached?.data as IConversation[] | undefined;
        const conv = convs?.find((c) => c.conversationId === arg.conversationId);
        const wasLast = conv?.lastMessage?.messageId === arg.messageId;

        const nextList = list.filter((m) => m.messageId !== arg.messageId);
        const newest = newestMessageInList(nextList);

        const patchMsgs = updateChatMessagesCache(
          dispatch,
          arg.conversationId,
          (draft: IMessage[]) => {
            const idx = draft.findIndex((m) => m.messageId === arg.messageId);
            if (idx !== -1) draft.splice(idx, 1);
          },
        );

        let patchConv: { undo: () => void } | undefined;
        if (wasLast) {
          patchConv = dispatch(
            conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
              const c = draft?.find((x) => x.conversationId === arg.conversationId);
              if (!c) return;
              if (newest) {
                patchLastMessage(draft, arg.conversationId, {
                  messageId: newest.messageId,
                  content: lastMessagePreviewFromMessage(newest),
                  senderId: newest.senderId,
                  type: newest.type,
                  createdAt: newest.createdAt,
                  senderDisplayName: newest.senderDisplayName,
                });
              } else {
                c.lastMessage = null;
              }
            }),
          );
        }

        try {
          await queryFulfilled;
        } catch {
          patchMsgs.undo();
          patchConv?.undo();
        }
      },
    }),

    recallMessage: builder.mutation<ApiEnvelope<null>, RecallMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/recall`,
        method: "POST",
        body,
      }),
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchMsgs = updateChatMessagesCache(
          dispatch,
          arg.conversationId,
          (draft: IMessage[]) => {
            const m = draft.find((x) => x.messageId === arg.messageId);
            if (m) {
              m.isRecalled = true;
              m.content = "Tin nhắn đã được thu hồi";
              m.isPinned = false;
            }
          },
        );
        const patchConv = dispatch(
          conversationApi.util.updateQueryData("getConversations", undefined, (draft) => {
            const conv = draft?.find((c) => c.conversationId === arg.conversationId);
            if (conv?.lastMessage?.messageId === arg.messageId) {
              conv.lastMessage = {
                ...conv.lastMessage,
                content: "Tin nhắn đã được thu hồi",
                type: "text",
              };
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchMsgs.undo();
          patchConv.undo();
        }
      },
    }),

    markAsRead: builder.mutation<ApiEnvelope<null>, MarkAsReadRequest>({
      query: ({ conversationId, messageId }) => ({
        url: `/chat/conversations/${conversationId}/read`,
        method: "POST",
        body: { messageId },
      }),
      invalidatesTags: ["Conversations"],
    }),

    pinMessage: builder.mutation<ApiEnvelope<null>, PinMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/pin`,
        method: "POST",
        body,
      }),
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchMsgs = updateChatMessagesCache(
          dispatch,
          arg.conversationId,
          (draft: IMessage[]) => {
            const m = draft.find((x) => x.messageId === arg.messageId);
            if (m) m.isPinned = true;
          },
        );
        try {
          await queryFulfilled;
        } catch {
          patchMsgs.undo();
        }
      },
    }),

    unpinMessage: builder.mutation<ApiEnvelope<null>, PinMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/pin`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchMsgs = updateChatMessagesCache(
          dispatch,
          arg.conversationId,
          (draft: IMessage[]) => {
            const m = draft.find((x) => x.messageId === arg.messageId);
            if (m) m.isPinned = false;
          },
        );
        try {
          await queryFulfilled;
        } catch {
          patchMsgs.undo();
        }
      },
    }),

    reactMessage: builder.mutation<ApiEnvelope<Record<string, string[]>>, ReactMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/react`,
        method: "POST",
        body,
      }),
      invalidatesTags: () => [],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const reactions = (data as ApiEnvelope<Record<string, string[]>>).data;
          updateChatMessagesCache(dispatch, arg.conversationId, (draft: IMessage[]) => {
            const m = draft.find((x) => x.messageId === arg.messageId);
            if (m) m.reactions = reactions;
          });
        } catch {
          /* không optimistic — giữ nguyên nếu lỗi */
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMessagesQuery,
  useGetMessagesPaginatedQuery,
  useLazyGetMessagesPaginatedQuery,
  useGetMessageGalleryQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useRecallMessageMutation,
  useMarkAsReadMutation,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useReactMessageMutation,
} = messageApi;
