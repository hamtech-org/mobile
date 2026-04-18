import type {
  IConversation,
  IMessage,
  IReplyToDetails,
  MessageType,
} from "@/types/chat.types";
import type { RootState } from "@/store/store";
import { chatApi, type ApiEnvelope } from "../baseChatApi";
import { conversationApi } from "./conversationApi";

/** Khớp cache key với useChatMessageData (limit: 50). */
export const CHAT_MESSAGES_QUERY_LIMIT = 50;

export interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaId?: string;
  replyTo?: string;
  /** Chỉ client — preview bubble khi đang gửi media */
  optimisticLocalUri?: string;
  /** Chỉ client — strip khỏi body, dùng cho reply preview trên bubble optimistic */
  clientReplyToDetails?: IReplyToDetails | null;
  /** Chỉ client — tên file hiển thị khi gửi file optimistic */
  optimisticMediaName?: string;
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

function newOptimisticId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function lastMessagePreviewFromArg(arg: SendMessageRequest): string {
  if (arg.type === "image") return "[Ảnh]";
  if (arg.type === "video") return "[Video]";
  if (arg.type === "file") return "[File]";
  return (arg.content ?? "").trim() || "";
}

function buildOptimisticMessage(
  arg: SendMessageRequest,
  optimisticId: string,
  userId: string,
  displayName: string | null | undefined,
): IMessage {
  const replyTo = arg.replyTo ?? null;
  const localUri = arg.optimisticLocalUri?.trim();
  const mediaUrl =
    localUri ||
    (arg.mediaUrl?.trim() ? arg.mediaUrl.trim() : null) ||
    null;
  const isMedia = arg.type === "image" || arg.type === "video" || arg.type === "file";
  const thumb =
    arg.type === "image" || arg.type === "video"
      ? localUri || mediaUrl
      : null;

  return {
    messageId: optimisticId,
    conversationId: arg.conversationId,
    senderId: userId,
    senderDisplayName: displayName ?? null,
    type: arg.type,
    content: arg.content ?? "",
    mediaUrl: isMedia ? mediaUrl : null,
    mediaType: isMedia ? arg.type : null,
    mediaSize: null,
    mediaOriginalName: arg.optimisticMediaName?.trim() || null,
    thumbnailUrl: thumb,
    replyTo,
    replyToDetails: arg.clientReplyToDetails ?? null,
    isPinned: false,
    isEdited: false,
    isRecalled: false,
    reactions: {},
    /** Hiển thị như tin đã gửi — không spinner; lỗi thì undo cache. */
    status: "sent",
    createdAt: new Date().toISOString(),
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

/** RTK không infer endpoint `getMessages` trong callback injectEndpoints. */
function updateGetMessagesCache(
  dispatch: (a: unknown) => { undo: () => void },
  conversationId: string,
  updateFn: (draft: IMessage[]) => void,
) {
  return dispatch(
    (chatApi.util as any).updateQueryData(
      "getMessages",
      getMessagesQueryArg(conversationId),
      updateFn,
    ),
  );
}

function lastMessagePreviewFromMessage(m: IMessage): string {
  if (m.content?.trim() !== "")
    return m.content;
  if (m.type === "image") return "[Ảnh]";
  if (m.type === "video") return "[Video]";
  if (m.type === "file") return "[File]";
  return m.content ?? "";
}

function newestMessageInList(draft: IMessage[]): IMessage | undefined {
  if (draft.length === 0) return undefined;
  return [...draft].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export const messageApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getMessages: builder.query<
      IMessage[],
      { conversationId: string; limit?: number }
    >({
      query: ({ conversationId, limit = 40 }) =>
        `/chat/conversations/${conversationId}/messages?limit=${limit}`,
      transformResponse: (response: ApiEnvelope<IMessage[]>) => response.data,
      providesTags: (_result, _error, arg) => [
        { type: "Messages", id: arg.conversationId },
      ],
    }),

    sendMessage: builder.mutation<ApiEnvelope<IMessage>, SendMessageRequest>({
      query: (arg) => {
        const {
          conversationId,
          optimisticLocalUri: _u,
          clientReplyToDetails: _r,
          optimisticMediaName: _n,
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

        const optimisticId = newOptimisticId();
        const optimistic = buildOptimisticMessage(
          arg,
          optimisticId,
          user.userId,
          user.displayName,
        );

        const patchMessages = updateGetMessagesCache(
          dispatch,
          arg.conversationId,
          (draft: IMessage[]) => {
            draft.unshift(optimistic);
          },
        );

        const preview = lastMessagePreviewFromArg(arg);
        const patchConvs = dispatch(
          conversationApi.util.updateQueryData(
            "getConversations",
            undefined,
            (draft) => {
              patchLastMessage(draft, arg.conversationId, {
                messageId: optimisticId,
                content: preview,
                senderId: user.userId,
                type: arg.type,
                createdAt: optimistic.createdAt,
                senderDisplayName: user.displayName,
              });
            },
          ),
        );

        const mergeServerMessage = (serverMsg: IMessage) => {
          updateGetMessagesCache(dispatch, arg.conversationId, (draft: IMessage[]) => {
            const dup = draft.findIndex(
              (m: IMessage) =>
                m.messageId === serverMsg.messageId &&
                m.messageId !== optimisticId,
            );
            if (dup !== -1) draft.splice(dup, 1);
            const optIdx = draft.findIndex(
              (m: IMessage) => m.messageId === optimisticId,
            );
            if (optIdx !== -1) draft[optIdx] = serverMsg;
            else if (!draft.some((m: IMessage) => m.messageId === serverMsg.messageId))
              draft.unshift(serverMsg);
          });

          const lastContent = lastMessagePreviewFromMessage(serverMsg);

          dispatch(
            conversationApi.util.updateQueryData(
              "getConversations",
              undefined,
              (draft) => {
                patchLastMessage(draft, arg.conversationId, {
                  messageId: serverMsg.messageId,
                  content: lastContent,
                  senderId: serverMsg.senderId,
                  type: serverMsg.type,
                  createdAt: serverMsg.createdAt,
                  senderDisplayName: serverMsg.senderDisplayName,
                });
              },
            ),
          );
        };

        try {
          const { data } = await queryFulfilled;
          const serverMsg = (data as ApiEnvelope<IMessage>).data;
          mergeServerMessage(serverMsg);
        } catch {
          patchMessages.undo();
          patchConvs.undo();
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
        const patchMsgs = updateGetMessagesCache(
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
          conversationApi.util.updateQueryData(
            "getConversations",
            undefined,
            (draft) => {
              const conv = draft?.find((c) => c.conversationId === arg.conversationId);
              if (conv?.lastMessage?.messageId === arg.messageId) {
                conv.lastMessage = {
                  ...conv.lastMessage,
                  content: arg.content,
                };
              }
            },
          ),
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

        const patchMsgs = updateGetMessagesCache(
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
            conversationApi.util.updateQueryData(
              "getConversations",
              undefined,
              (draft) => {
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
              },
            ),
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
        const patchMsgs = updateGetMessagesCache(
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
          conversationApi.util.updateQueryData(
            "getConversations",
            undefined,
            (draft) => {
              const conv = draft?.find((c) => c.conversationId === arg.conversationId);
              if (conv?.lastMessage?.messageId === arg.messageId) {
                conv.lastMessage = {
                  ...conv.lastMessage,
                  content: "Tin nhắn đã được thu hồi",
                  type: "text",
                };
              }
            },
          ),
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
        const patchMsgs = updateGetMessagesCache(
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
        const patchMsgs = updateGetMessagesCache(
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

    reactMessage: builder.mutation<
      ApiEnvelope<Record<string, string[]>>,
      ReactMessageRequest
    >({
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
          updateGetMessagesCache(dispatch, arg.conversationId, (draft: IMessage[]) => {
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
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useRecallMessageMutation,
  useMarkAsReadMutation,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useReactMessageMutation,
} = messageApi;
