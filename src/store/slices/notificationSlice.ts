import { createSlice } from "@reduxjs/toolkit";

interface NotificationState {
  unreadCount: number;
}

const initialState: NotificationState = {
  unreadCount: 0,
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {},
});

export const notificationReducer = notificationSlice.reducer;
