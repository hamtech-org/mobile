import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { env } from "@/config/env";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface Conversation {
  conversationId: string;
  name?: string;
  avatar?: string;
  type: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderDisplayName?: string | null;
  };
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderDisplayName?: string | null;
  content: string;
  type: string;
  createdAt: string;
  isRecalled?: boolean;
}

interface SendTextMessageRequest {
  conversationId: string;
  content: string;
}

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth?: { accessToken?: string | null } };
      const token = state.auth?.accessToken;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Conversations", "Messages"],
  endpoints: (builder) => ({
    getConversations: builder.query<Conversation[], void>({
      query: () => "/chat/conversations",
      transformResponse: (response: ApiEnvelope<Conversation[]>) => response.data,
      providesTags: ["Conversations"],
    }),
    getMessages: builder.query<ChatMessage[], { conversationId: string; limit?: number }>({
      query: ({ conversationId, limit = 30 }) => `/chat/conversations/${conversationId}/messages?limit=${limit}`,
      transformResponse: (response: ApiEnvelope<ChatMessage[]>) => response.data,
      providesTags: (_result, _error, arg) => [{ type: "Messages", id: arg.conversationId }],
    }),
    sendTextMessage: builder.mutation<ChatMessage, SendTextMessageRequest>({
      query: ({ conversationId, content }) => ({
        url: `/chat/conversations/${conversationId}/messages`,
        method: "POST",
        body: {
          type: "text",
          content,
        },
      }),
      transformResponse: (response: ApiEnvelope<ChatMessage>) => response.data,
      invalidatesTags: (_result, _error, arg) => [
        { type: "Messages", id: arg.conversationId },
        "Conversations",
      ],
    }),
  }),
});

export const { useGetConversationsQuery, useGetMessagesQuery, useSendTextMessageMutation } = chatApi;
