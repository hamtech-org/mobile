import { createApi } from "@reduxjs/toolkit/query/react";

import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";
import type { INotification } from "@/types/notification.types";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

interface NotificationListData {
  items: INotification[];
  unreadCount: number;
}

export const notificationApi = createApi({
  reducerPath: "notificationApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Notifications"],
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationListData, { limit?: number } | void>({
      query: (params) => ({
        url: "/notifications",
        params: params?.limit ? { limit: params.limit } : undefined,
      }),
      transformResponse: (res: ApiEnvelope<NotificationListData>) => ({
        items: res?.data?.items ?? [],
        unreadCount: res?.data?.unreadCount ?? 0,
      }),
      providesTags: ["Notifications"],
    }),
    getUnreadCount: builder.query<number, void>({
      query: () => "/notifications/unread-count",
      transformResponse: (res: ApiEnvelope<{ unreadCount: number }>) => res?.data?.unreadCount ?? 0,
      providesTags: ["Notifications"],
    }),
    markNotificationRead: builder.mutation<void, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),
    markAllNotificationsRead: builder.mutation<number, void>({
      query: () => ({ url: "/notifications/read-all", method: "POST" }),
      transformResponse: (res: ApiEnvelope<{ count: number }>) => res?.data?.count ?? 0,
      invalidatesTags: ["Notifications"],
    }),
    registerDeviceToken: builder.mutation<
      void,
      { token: string; platform: "ios" | "android" | "web" }
    >({
      query: (body) => ({
        url: "/notifications/device-tokens",
        method: "POST",
        body,
      }),
    }),
    removeDeviceToken: builder.mutation<void, { token: string }>({
      query: (body) => ({
        url: "/notifications/device-tokens",
        method: "DELETE",
        body,
      }),
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useRegisterDeviceTokenMutation,
  useRemoveDeviceTokenMutation,
} = notificationApi;
