import type { IMessage, MessageType } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaId?: string;
  replyTo?: string;
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
      query: ({ conversationId, ...body }) => ({
        url: `/chat/conversations/${conversationId}/messages`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),

    editMessage: builder.mutation<ApiEnvelope<null>, EditMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
    }),

    deleteMessage: builder.mutation<ApiEnvelope<null>, DeleteMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
    }),

    recallMessage: builder.mutation<ApiEnvelope<null>, RecallMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/recall`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
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
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),

    unpinMessage: builder.mutation<ApiEnvelope<null>, PinMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/pin`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
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
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
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
