import { configureStore } from "@reduxjs/toolkit";

import { authApi } from "./api/authApi";
import { chatApi } from "./api/chatApi";
import { mediaApi } from "./api/mediaApi";
import { userApi } from "./api/userApi";
import { authReducer } from "./slices/authSlice";
import { callReducer } from "./slices/callSlice";
import { chatReducer } from "./slices/chatSlice";
import { contactReducer } from "./slices/contactSlice";
import { newsfeedReducer } from "./slices/newsfeedSlice";
import { notificationReducer } from "./slices/notificationSlice";
import { reelUploadReducer } from "./slices/reelUploadSlice";
import { uiReducer } from "./slices/uiSlice";
import { newsfeedApi } from "./api/newsfeedApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    call: callReducer,
    chat: chatReducer,
    contact: contactReducer,
    newsfeed: newsfeedReducer,
    notification: notificationReducer,
    reelUpload: reelUploadReducer,
    ui: uiReducer,
    [authApi.reducerPath]: authApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [mediaApi.reducerPath]: mediaApi.reducer,
    [userApi.reducerPath]: userApi.reducer,
    [newsfeedApi.reducerPath]: newsfeedApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      chatApi.middleware,
      mediaApi.middleware,
      userApi.middleware,
      newsfeedApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
