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
  tagTypes: ["Friend"],
  endpoints: (builder) => ({
    /** Danh sách đã kết bạn — cùng nguồn với web (`GET /contacts/friends`). */
    getFriends: builder.query<FriendListItem[], void>({
      query: () => "/contacts/friends",
      transformResponse: (response: ApiEnvelope<FriendListItem[]>) =>
        Array.isArray(response?.data) ? response.data : [],
      providesTags: ["Friend"],
    }),
  }),
});

export const { useGetFriendsQuery } = userApi;
