import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AppToastVariant = "success" | "error" | "info" | "warning";

export interface AppToastItem {
  id: string;
  message: string;
  variant: AppToastVariant;
}

interface NotificationState {
  unreadCount: number;
  toasts: AppToastItem[];
}

const MAX_TOASTS = 4;

const initialState: NotificationState = {
  unreadCount: 0,
  toasts: [],
};

const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    pushToast(state, action: PayloadAction<AppToastItem>) {
      state.toasts.push(action.payload);
      if (state.toasts.length > MAX_TOASTS) {
        state.toasts.splice(0, state.toasts.length - MAX_TOASTS);
      }
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts(state) {
      state.toasts = [];
    },
  },
});

export const { pushToast, removeToast, clearToasts } = notificationSlice.actions;

export const notificationReducer = notificationSlice.reducer;
