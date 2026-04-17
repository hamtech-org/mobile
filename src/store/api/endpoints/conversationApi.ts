import type { IConversation, ConversationType } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface CreateConversationRequest {
  type: ConversationType;
  name?: string;
  memberIds: string[];
}

export const conversationApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query<IConversation[], void>({
      query: () => "/chat/conversations",
      transformResponse: (response: ApiEnvelope<IConversation[]>) =>
        response.data,
      providesTags: ["Conversations"],
    }),

    getConversationMembers: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (conversationId) =>
        `/chat/conversations/${conversationId}/members`,
      providesTags: (_result, _error, conversationId) => [
        { type: "Conversations", id: `MEMBERS-${conversationId}` },
      ],
    }),

    createConversation: builder.mutation<
      ApiEnvelope<IConversation>,
      CreateConversationRequest
    >({
      query: (body) => ({
        url: "/chat/conversations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConversationsQuery,
  useGetConversationMembersQuery,
  useCreateConversationMutation,
} = conversationApi;
