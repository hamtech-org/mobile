import { createApi } from "@reduxjs/toolkit/query/react";

import { chatApi } from "@/store/api/baseChatApi";
import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";

/** Bản ghi tối thiểu từ GET /users/friends (backend có thể trả thêm trường). */
export interface FriendListItem {
  userId: string;
  displayName: string;
  avatar: string | null;
  email?: string | null;
  phone?: string | null;
  status?: "online" | "offline" | "away" | string | null;
  bio?: string | null;
}

export interface PendingFriendRequests {
  received: FriendListItem[];
  sent: FriendListItem[];
}

export type FriendshipStatus = "friend" | "pending_sent" | "pending_received" | "blocked" | "none";

export interface ContactSearchUser extends FriendListItem {
  isFriend?: boolean;
  friendshipStatus?: FriendshipStatus;
}

export interface ContactSearchResult {
  items: ContactSearchUser[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export type UserStatus = "online" | "offline" | "away";
export type UserRole = "user" | "admin";

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  status: UserStatus;
  lastSeen: string | null;
  role: UserRole;
  isVerified: boolean;
  faceLoginEnabled?: boolean;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export const userApi = createApi({
  reducerPath: "userApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Friend", "User"],
  endpoints: (builder) => ({
    getProfile: builder.query<ApiEnvelope<UserProfile>, void>({
      query: () => "/users/me",
      providesTags: ["User"],
    }),

    updateProfile: builder.mutation<ApiEnvelope<UserProfile>, FormData>({
      query: (body) => ({
        url: "/users/me",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    /** Danh sách đã kết bạn — cùng nguồn với web (`GET /contacts/friends`). */
    getFriends: builder.query<FriendListItem[], void>({
      query: () => "/contacts/friends",
      transformResponse: (response: ApiEnvelope<FriendListItem[]>) =>
        Array.isArray(response?.data) ? response.data : [],
      providesTags: ["Friend"],
    }),

    /** Batch fetch user public profile (displayName/avatar) by ids. */
    postMultipleUsers: builder.mutation<FriendListItem[], { userIds: string[] }>({
      query: ({ userIds }) => ({
        url: "/users/multiple",
        method: "POST",
        body: { userIds },
      }),
      transformResponse: (response: ApiEnvelope<FriendListItem[]>) =>
        Array.isArray(response?.data) ? response.data : [],
      invalidatesTags: ["User"],
    }),

    sendUserFriendRequest: builder.mutation<ApiEnvelope<unknown>, { friendId: string }>({
      query: ({ friendId }) => ({
        url: `/users/friends/${friendId}`,
        method: "POST",
      }),
      invalidatesTags: ["Friend"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatApi.util.invalidateTags(["Conversations"]));
        } catch {
          // no-op
        }
      },
    }),

    cancelFriendRequest: builder.mutation<ApiEnvelope<unknown>, { friendId: string }>({
      query: ({ friendId }) => ({
        url: `/users/friends/${friendId}/cancel`,
        method: "POST",
      }),
      invalidatesTags: ["Friend"],
    }),

    acceptFriendRequest: builder.mutation<ApiEnvelope<unknown>, { senderId: string }>({
      query: ({ senderId }) => ({
        url: `/users/friends/${senderId}/accept`,
        method: "POST",
      }),
      invalidatesTags: ["Friend"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatApi.util.invalidateTags(["Conversations"]));
        } catch {
          // no-op
        }
      },
    }),

    rejectFriendRequest: builder.mutation<ApiEnvelope<unknown>, { senderId: string }>({
      query: ({ senderId }) => ({
        url: `/users/friends/${senderId}/reject`,
        method: "POST",
      }),
      invalidatesTags: ["Friend"],
    }),

    removeFriend: builder.mutation<ApiEnvelope<unknown>, { friendId: string }>({
      query: ({ friendId }) => ({
        url: `/users/friends/${friendId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Friend"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatApi.util.invalidateTags(["Conversations"]));
        } catch {
          // no-op
        }
      },
    }),

    blockFriend: builder.mutation<ApiEnvelope<unknown>, { friendId: string }>({
      query: ({ friendId }) => ({
        url: `/users/friends/${friendId}/block`,
        method: "POST",
      }),
      invalidatesTags: ["Friend"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatApi.util.invalidateTags(["Conversations"]));
        } catch {
          // no-op
        }
      },
    }),

    unblockFriend: builder.mutation<ApiEnvelope<unknown>, { friendId: string }>({
      query: ({ friendId }) => ({
        url: `/users/friends/${friendId}/unblock`,
        method: "POST",
      }),
      invalidatesTags: ["Friend"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatApi.util.invalidateTags(["Conversations"]));
        } catch {
          // no-op
        }
      },
    }),

    getPendingRequests: builder.query<PendingFriendRequests, void>({
      query: () => "/users/friends/requests/pending",
      transformResponse: (response: ApiEnvelope<PendingFriendRequests>) => ({
        received: Array.isArray(response?.data?.received) ? response.data.received : [],
        sent: Array.isArray(response?.data?.sent) ? response.data.sent : [],
      }),
      providesTags: ["Friend"],
    }),

    getSuggestedFriends: builder.query<FriendListItem[], { limit?: number } | void>({
      query: (arg) => `/users/friends/suggestions?limit=${arg?.limit ?? 10}`,
      transformResponse: (response: ApiEnvelope<FriendListItem[]>) =>
        Array.isArray(response?.data) ? response.data : [],
      providesTags: ["Friend"],
    }),

    getFriendRequestStatus: builder.query<FriendshipStatus, string>({
      query: (userId) => `/users/friends/${userId}/status`,
      transformResponse: (response: ApiEnvelope<{ status: FriendshipStatus }>) =>
        response?.data?.status ?? "none",
      providesTags: (_result, _error, userId) => [{ type: "Friend", id: userId }],
    }),

    searchUsersByContact: builder.query<ContactSearchResult, { q: string; pageSize?: number }>({
      query: ({ q, pageSize = 10 }) => ({
        url: "/search/users/by-contact",
        params: { q, pageSize },
      }),
      transformResponse: (response: ApiEnvelope<ContactSearchResult> | ContactSearchResult) => {
        const data = "data" in response ? response.data : response;
        return {
          ...data,
          items: Array.isArray(data?.items) ? data.items : [],
        };
      },
      providesTags: ["Friend"],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetFriendsQuery,
  usePostMultipleUsersMutation,
  useSendUserFriendRequestMutation,
  useCancelFriendRequestMutation,
  useAcceptFriendRequestMutation,
  useRejectFriendRequestMutation,
  useRemoveFriendMutation,
  useBlockFriendMutation,
  useUnblockFriendMutation,
  useGetPendingRequestsQuery,
  useGetSuggestedFriendsQuery,
  useGetFriendRequestStatusQuery,
  useSearchUsersByContactQuery,
} = userApi;
