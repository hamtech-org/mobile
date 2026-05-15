import { createApi } from "@reduxjs/toolkit/query/react";

import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";

/** Bản ghi tối thiểu từ GET /users/friends (backend có thể trả thêm trường). */
export interface FriendListItem {
  userId: string;
  displayName: string;
  avatar: string | null;
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

    /** Giống web `MemberManagementModal.addFriend`. */
    sendFriendRequest: builder.mutation<ApiEnvelope<unknown>, { userId: string }>({
      query: ({ userId }) => ({
        url: "/contacts/friends/request",
        method: "POST",
        body: { userId },
      }),
      invalidatesTags: ["Friend"],
    }),
  }),
});

export const { useGetFriendsQuery, usePostMultipleUsersMutation, useSendFriendRequestMutation } =
  userApi;
