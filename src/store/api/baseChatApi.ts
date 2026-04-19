import { createApi } from "@reduxjs/toolkit/query/react";

import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";

// ─── Shared Interfaces ──────────────────────────────────────────────────────────

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

// ─── Base API Definition ────────────────────────────────────────────────────────

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Conversations", "Messages", "Polls", "Tasks", "GroupRequests"],
  endpoints: () => ({}), // Endpoints will be injected in separate files
});
