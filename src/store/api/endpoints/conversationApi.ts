import type { IConversation, ConversationType } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";
import { clearConversationMessages } from "@/store/slices/chatSlice";

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
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data: res } = await queryFulfilled;
          if (res?.data) {
            const incoming = res.data;
            dispatch(
              (chatApi.util as any).updateQueryData(
                "getConversations",
                undefined,
                (draft: IConversation[]) => {
                  if (!Array.isArray(draft)) return;
                  const idx = draft.findIndex((c) => c.conversationId === incoming.conversationId);
                  if (idx >= 0) {
                    draft[idx] = { ...draft[idx], ...incoming };
                  } else {
                    draft.push(incoming);
                  }
                  draft.sort((a, b) => {
                    const ta = a.lastMessageAt ?? a.updatedAt ?? "";
                    const tb = b.lastMessageAt ?? b.updatedAt ?? "";
                    return tb.localeCompare(ta);
                  });
                },
              ),
            );
          }
        } catch {
          // ignore
        }
      },
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

    deleteConversation: builder.mutation<
      ApiEnvelope<{
        conversationId: string;
        type: "direct" | "group";
        clearedAt: string;
        clearedAtMs: number;
        hiddenFromList: boolean;
      }>,
      { conversationId: string; type: "direct" | "group" }
    >({
      query: ({ conversationId }) => ({
        url: `/chat/conversations/${conversationId}`,
        method: "DELETE",
      }),
      async onQueryStarted({ conversationId }, { dispatch, queryFulfilled }) {
        dispatch(clearConversationMessages(conversationId));

        const patchResult = dispatch(
          (chatApi.util as any).updateQueryData(
            "getConversations",
            undefined,
            (draft: IConversation[]) => {
              if (!Array.isArray(draft)) return;
              const idx = draft.findIndex((c) => c.conversationId === conversationId);
              if (idx >= 0) draft.splice(idx, 1);
            },
          ),
        );

        const getMessagesPatch = dispatch(
          (chatApi.util as any).updateQueryData("getMessages", { conversationId }, (draft: any) => {
            if (draft) draft.data = [];
          }),
        );

        const getMessagesPaginatedPatch = dispatch(
          (chatApi.util as any).updateQueryData(
            "getMessagesPaginated",
            { conversationId },
            (draft: any) => {
              if (draft && draft.items) {
                draft.items = [];
                draft.hasMore = false;
                draft.nextCursor = undefined;
              }
            },
          ),
        );

        try {
          const { data: res } = await queryFulfilled;
          if (res?.data) {
            dispatch(
              (chatApi.util as any).updateQueryData(
                "getConversations",
                undefined,
                (draft: IConversation[]) => {
                  if (!Array.isArray(draft)) return;
                  const idx = draft.findIndex((c) => c.conversationId === conversationId);
                  if (idx >= 0) {
                    draft.splice(idx, 1);
                  }
                },
              ),
            );
          }
          dispatch(
            chatApi.util.invalidateTags([
              { type: "Messages", id: conversationId },
              { type: "Messages", id: `paginated-${conversationId}` },
            ] as any),
          );
        } catch {
          patchResult.undo();
          getMessagesPatch.undo();
          getMessagesPaginatedPatch.undo();
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
  useDeleteConversationMutation,
} = conversationApi;
