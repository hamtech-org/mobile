import { chatApi, type ApiEnvelope } from "@/store/api/baseChatApi";

export type GroupJoinPreview = {
  conversationId: string;
  name: string;
  avatar: string | null;
  memberCount: number;
  approvalRequired: boolean;
  isMember: boolean;
  requestStatus: "pending" | "invited" | null;
};

export type GroupJoinViaLinkResult = {
  conversationId: string;
  status: "joined" | "pending" | "already_member";
  memberCount?: number;
};

export const joinApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getGroupJoinPreview: builder.query<GroupJoinPreview, string>({
      query: (suffix) => `/chat/join/${encodeURIComponent(suffix)}/preview`,
      transformResponse: (response: ApiEnvelope<GroupJoinPreview>) => response.data,
    }),
    joinGroupViaLink: builder.mutation<GroupJoinViaLinkResult, string>({
      query: (suffix) => ({
        url: `/chat/join/${encodeURIComponent(suffix)}`,
        method: "POST",
      }),
      transformResponse: (response: ApiEnvelope<GroupJoinViaLinkResult>) => response.data,
      invalidatesTags: ["Conversations", "GroupRequests"],
    }),
  }),
  overrideExisting: true,
});

export const { useGetGroupJoinPreviewQuery, useJoinGroupViaLinkMutation } = joinApi;
