import type { IConversation, ConversationType } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface PatchConversationPreferencesRequest {
  conversationId: string;
  isMuted?: boolean;
  isPinnedToTop?: boolean;
  notificationsMutedUntil?: string | null;
  muteFor?: "1m" | "5m" | "10m";
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
              if (arg.isPinnedToTop !== undefined) c.isPinnedToTop = arg.isPinnedToTop;

              if (arg.muteFor) {
                const addMs =
                  arg.muteFor === "1m" ? 60_000 : arg.muteFor === "5m" ? 300_000 : 600_000;
                c.notificationsMutedUntil = new Date(Date.now() + addMs).toISOString();
                c.isMuted = true;
              }

              if (arg.isMuted !== undefined) {
                c.isMuted = arg.isMuted;
                if (arg.isMuted === true) c.notificationsMutedUntil = null;
                if (arg.isMuted === false) c.notificationsMutedUntil = null;
              }

              if (arg.notificationsMutedUntil !== undefined && !arg.muteFor) {
                const prevUntil = c.notificationsMutedUntil;
                const prevMs = prevUntil ? new Date(prevUntil).getTime() : NaN;
                const hadActiveSchedule = Number.isFinite(prevMs) && prevMs > Date.now();

                c.notificationsMutedUntil = arg.notificationsMutedUntil;
                const v = arg.notificationsMutedUntil;
                if (v === null && arg.isMuted === undefined) {
                  if (hadActiveSchedule) c.isMuted = false;
                } else if (typeof v === "string") {
                  const ms = new Date(v).getTime();
                  if (Number.isFinite(ms) && ms > Date.now()) c.isMuted = true;
                }
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
