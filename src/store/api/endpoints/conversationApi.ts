import type { IConversation, ConversationType } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface PatchConversationPreferencesRequest {
  conversationId: string;
  isMuted?: boolean;
  isPinnedToTop?: boolean;
  notificationsMutedUntil?: string | null;
  muteFor?: "1h" | "4h" | "8h";
}

export interface CreateConversationRequest {
  type: ConversationType;
  name?: string;
  /** URL ảnh (sau upload) — backend lưu META.avatar */
  avatar?: string;
  memberIds: string[];
}

export const conversationApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query<IConversation[], void>({
      query: () => "/chat/conversations",
      transformResponse: (response: ApiEnvelope<IConversation[]>) => response.data,
      providesTags: ["Conversations"],
    }),

    getConversationMembers: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (conversationId) => `/chat/conversations/${conversationId}/members`,
      providesTags: (_result, _error, conversationId) => [
        { type: "Conversations", id: `MEMBERS-${conversationId}` },
      ],
    }),

    createConversation: builder.mutation<ApiEnvelope<IConversation>, CreateConversationRequest>({
      query: (body) => ({
        url: "/chat/conversations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    patchConversationPreferences: builder.mutation<
      ApiEnvelope<null>,
      PatchConversationPreferencesRequest
    >({
      query: ({ conversationId, ...body }) => ({
        url: `/chat/conversations/${conversationId}/preferences`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Conversations"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          (chatApi.util as any).updateQueryData(
            "getConversations",
            undefined,
            (draft: IConversation[]) => {
              const c = draft.find((x) => x.conversationId === arg.conversationId);
              if (!c) return;
              if (arg.isMuted !== undefined) c.isMuted = arg.isMuted;
              if (arg.isPinnedToTop !== undefined) c.isPinnedToTop = arg.isPinnedToTop;
              if (arg.notificationsMutedUntil !== undefined) {
                c.notificationsMutedUntil = arg.notificationsMutedUntil;
              }
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetConversationsQuery,
  useGetConversationMembersQuery,
  useCreateConversationMutation,
  usePatchConversationPreferencesMutation,
} = conversationApi;
