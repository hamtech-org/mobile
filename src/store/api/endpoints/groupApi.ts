import type { MemberRole } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface UpdateGroupRequest {
  groupId: string;
  name?: string;
  avatar?: string;
}

export interface AddMembersRequest {
  groupId: string;
  memberIds: string[];
}

export interface ChangeMemberRoleRequest {
  groupId: string;
  userId: string;
  role: MemberRole;
}

export const groupApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    updateGroup: builder.mutation<ApiEnvelope<unknown>, UpdateGroupRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    deleteGroup: builder.mutation<ApiEnvelope<null>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversations"],
    }),

    leaveGroup: builder.mutation<ApiEnvelope<null>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}/leave`,
        method: "POST",
      }),
      invalidatesTags: ["Conversations"],
    }),

    addMembers: builder.mutation<ApiEnvelope<unknown>, AddMembersRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/members`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    removeMember: builder.mutation<
      ApiEnvelope<null>,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/chat/groups/${groupId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversations"],
    }),

    changeMemberRole: builder.mutation<
      ApiEnvelope<null>,
      ChangeMemberRoleRequest
    >({
      query: ({ groupId, userId, ...body }) => ({
        url: `/chat/groups/${groupId}/members/${userId}/role`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    getGroupRequests: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (groupId) => `/chat/groups/${groupId}/requests`,
      providesTags: (_result, _error, groupId) => [
        { type: "GroupRequests", id: groupId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useAddMembersMutation,
  useRemoveMemberMutation,
  useChangeMemberRoleMutation,
  useGetGroupRequestsQuery,
} = groupApi;
