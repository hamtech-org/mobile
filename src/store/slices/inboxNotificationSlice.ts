import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { INotification } from "@/types/notification.types";

interface InboxNotificationState {
  items: INotification[];
  unreadCount: number;
}

const initialState: InboxNotificationState = {
  items: [],
  unreadCount: 0,
};

const inboxNotificationSlice = createSlice({
  name: "inboxNotification",
  initialState,
  reducers: {
    setInboxNotifications(state, action: PayloadAction<INotification[]>) {
      state.items = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.isRead).length;
    },
    setInboxUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    addInboxNotification(state, action: PayloadAction<INotification>) {
      const exists = state.items.some((n) => n.notificationId === action.payload.notificationId);
      if (exists) return;
      state.items.unshift(action.payload);
      if (!action.payload.isRead) state.unreadCount += 1;
    },
    markInboxRead(state, action: PayloadAction<string>) {
      const n = state.items.find((x) => x.notificationId === action.payload);
      if (n && !n.isRead) {
        n.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllInboxRead(state) {
      state.items.forEach((n) => {
        n.isRead = true;
      });
      state.unreadCount = 0;
    },
  },
});

export const {
  setInboxNotifications,
  setInboxUnreadCount,
  addInboxNotification,
  markInboxRead,
  markAllInboxRead,
} = inboxNotificationSlice.actions;

export const inboxNotificationReducer = inboxNotificationSlice.reducer;
