import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";
import type { IPost } from "@/types/newsfeed.types";
import type {
  CommunityCategory,
  ICommunity,
  ICommunityContentPage,
  ICommunityJoinRequest,
  ICommunityListPage,
  ICommunityMember,
  ICreateCommunityDto,
  CommunityMemberRole,
  ISearchGroupResult,
} from "@/types/community.types";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export const communityApi = createApi({
  reducerPath: "communityApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Communities",
    "CommunityDetail",
    "CommunityMembers",
    "CommunityRequests",
    "CommunityPosts",
    "CommunityPendingPosts",
  ],
  endpoints: (builder) => ({
    listCommunities: builder.query<
      ICommunityListPage,
      {
        category?: CommunityCategory;
        scope?: "discover" | "joined";
        limit?: number;
        cursor?: string | null;
      } | void
    >({
      query: (params) => ({
        url: "/communities",
        params: {
          category: params?.category,
          scope: params?.scope,
          limit: params?.limit,
          cursor: params?.cursor ?? undefined,
        },
      }),
      transformResponse: (response: ApiEnvelope<ICommunityListPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: ["Communities"],
    }),
    createCommunity: builder.mutation<ICommunity, ICreateCommunityDto>({
      query: (body) => ({ url: "/communities", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<ICommunity>) => response.data,
      invalidatesTags: ["Communities"],
    }),
    getCommunity: builder.query<ICommunity, string>({
      query: (groupId) => `/communities/${groupId}`,
      transformResponse: (response: ApiEnvelope<ICommunity>) => response.data,
      providesTags: (_res, _err, groupId) => [{ type: "CommunityDetail", id: groupId }],
    }),
    updateCommunity: builder.mutation<
      ICommunity,
      { groupId: string; body: Partial<ICreateCommunityDto> }
    >({
      query: ({ groupId, body }) => ({ url: `/communities/${groupId}`, method: "PUT", body }),
      transformResponse: (response: ApiEnvelope<ICommunity>) => response.data,
      invalidatesTags: (_res, _err, { groupId }) => [
        "Communities",
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    archiveCommunity: builder.mutation<null, string>({
      query: (groupId) => ({ url: `/communities/${groupId}`, method: "DELETE" }),
      transformResponse: () => null,
      invalidatesTags: ["Communities"],
    }),
    joinCommunity: builder.mutation<
      { status: string; community: ICommunity },
      { groupId: string; message?: string }
    >({
      query: ({ groupId, message }) => ({
        url: `/communities/${groupId}/join`,
        method: "POST",
        body: { message },
      }),
      transformResponse: (response: ApiEnvelope<{ status: string; community: ICommunity }>) =>
        response.data,
      invalidatesTags: (_res, _err, { groupId }) => [
        "Communities",
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    leaveCommunity: builder.mutation<null, string>({
      query: (groupId) => ({ url: `/communities/${groupId}/leave`, method: "POST" }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, groupId) => [
        "Communities",
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    getCommunityMembers: builder.query<ICommunityMember[], string>({
      query: (groupId) => `/communities/${groupId}/members`,
      transformResponse: (response: ApiEnvelope<ICommunityMember[]>) => response.data ?? [],
      providesTags: (_res, _err, groupId) => [{ type: "CommunityMembers", id: groupId }],
    }),
    removeCommunityMember: builder.mutation<null, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({
        url: `/communities/${groupId}/members/${userId}`,
        method: "DELETE",
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [
        { type: "CommunityMembers", id: groupId },
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    updateCommunityMemberRole: builder.mutation<
      null,
      { groupId: string; userId: string; role: CommunityMemberRole }
    >({
      query: ({ groupId, userId, role }) => ({
        url: `/communities/${groupId}/members/${userId}/role`,
        method: "PUT",
        body: { role },
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [
        { type: "CommunityMembers", id: groupId },
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    transferCommunityOwner: builder.mutation<null, { groupId: string; targetUserId: string }>({
      query: ({ groupId, targetUserId }) => ({
        url: `/communities/${groupId}/transfer-owner`,
        method: "POST",
        body: { targetUserId },
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [
        "Communities",
        { type: "CommunityMembers", id: groupId },
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    getCommunityRequests: builder.query<ICommunityJoinRequest[], string>({
      query: (groupId) => `/communities/${groupId}/requests`,
      transformResponse: (response: ApiEnvelope<ICommunityJoinRequest[]>) => response.data ?? [],
      providesTags: (_res, _err, groupId) => [{ type: "CommunityRequests", id: groupId }],
    }),
    resolveCommunityRequest: builder.mutation<
      null,
      { groupId: string; userId: string; action: "approve" | "reject" }
    >({
      query: ({ groupId, userId, action }) => ({
        url: `/communities/${groupId}/requests/${userId}`,
        method: "PATCH",
        body: { action },
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [
        { type: "CommunityRequests", id: groupId },
        { type: "CommunityMembers", id: groupId },
        { type: "CommunityDetail", id: groupId },
      ],
    }),
    getCommunityPosts: builder.query<
      ICommunityContentPage<IPost>,
      { groupId: string; limit?: number }
    >({
      query: ({ groupId, limit }) => ({ url: `/communities/${groupId}/posts`, params: { limit } }),
      transformResponse: (response: ApiEnvelope<ICommunityContentPage<IPost>>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: (_res, _err, { groupId }) => [{ type: "CommunityPosts", id: groupId }],
    }),
    searchGroups: builder.query<
      { items: ISearchGroupResult[]; total: number },
      { q: string; pageSize?: number }
    >({
      query: ({ q, pageSize = 20 }) => ({
        url: "/search/groups",
        params: { q, pageSize },
      }),
      transformResponse: (
        response: ApiEnvelope<{ items: ISearchGroupResult[]; total: number }>,
      ) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        total: response?.data?.total ?? 0,
      }),
    }),
    pinCommunityPost: builder.mutation<null, { groupId: string; postId: string }>({
      query: ({ groupId, postId }) => ({
        url: `/communities/${groupId}/posts/${postId}/pin`,
        method: "PUT",
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [{ type: "CommunityPosts", id: groupId }],
    }),
    unpinCommunityPost: builder.mutation<null, { groupId: string; postId: string }>({
      query: ({ groupId, postId }) => ({
        url: `/communities/${groupId}/posts/${postId}/unpin`,
        method: "PUT",
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [{ type: "CommunityPosts", id: groupId }],
    }),
    reportCommunity: builder.mutation<null, { groupId: string; reason: string; details?: string }>({
      query: ({ groupId, ...body }) => ({
        url: `/communities/${groupId}/reports`,
        method: "POST",
        body,
      }),
      transformResponse: () => null,
    }),
    getPendingPosts: builder.query<IPost[], string>({
      query: (groupId) => `/communities/${groupId}/moderation/posts`,
      transformResponse: (response: ApiEnvelope<ICommunityContentPage<IPost>>) =>
        response.data?.items ?? [],
      providesTags: (_res, _err, groupId) => [{ type: "CommunityPendingPosts", id: groupId }],
    }),
    resolvePendingPost: builder.mutation<
      null,
      { groupId: string; postId: string; action: "approve" | "reject"; rejectReason?: string }
    >({
      query: ({ groupId, postId, action, rejectReason }) => ({
        url: `/communities/${groupId}/moderation/posts/${postId}/resolve`,
        method: "POST",
        body: { action, rejectReason },
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, { groupId }) => [
        { type: "CommunityPendingPosts", id: groupId },
        { type: "CommunityPosts", id: groupId },
      ],
    }),
  }),
});

export const {
  useArchiveCommunityMutation,
  useCreateCommunityMutation,
  useGetCommunityMembersQuery,
  useGetCommunityPostsQuery,
  useGetCommunityQuery,
  useGetCommunityRequestsQuery,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
  useListCommunitiesQuery,
  useRemoveCommunityMemberMutation,
  useResolveCommunityRequestMutation,
  useTransferCommunityOwnerMutation,
  useUpdateCommunityMemberRoleMutation,
  useUpdateCommunityMutation,
  useSearchGroupsQuery,
  useLazySearchGroupsQuery,
  usePinCommunityPostMutation,
  useUnpinCommunityPostMutation,
  useReportCommunityMutation,
  useGetPendingPostsQuery,
  useResolvePendingPostMutation,
} = communityApi;
