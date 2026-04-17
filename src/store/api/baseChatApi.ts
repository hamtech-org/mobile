import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { env } from "@/config/env";

// ─── Shared Interfaces ──────────────────────────────────────────────────────────

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

// ─── Base API Definition ────────────────────────────────────────────────────────

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth?: { accessToken?: string | null } };
      const token = state.auth?.accessToken;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Conversations", "Messages", "Polls", "Tasks", "GroupRequests"],
  endpoints: () => ({}), // Endpoints will be injected in separate files
});
