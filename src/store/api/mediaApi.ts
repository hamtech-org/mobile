import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { env } from "@/config/env";

export type MediaUploadType = "image" | "video" | "audio" | "file";

export interface MediaUploadResult {
  mediaId: string;
  url: string;
  thumbnailUrl: string | null;
  type: MediaUploadType;
  size: number;
  mimeType: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

/**
 * mediaApi — Xử lý upload media (ảnh, video, file) cho mobile.
 * Sử dụng FormData phù hợp với React Native.
 */
export const mediaApi = createApi({
  reducerPath: "mediaApi",
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
  tagTypes: ["Media"],
  endpoints: (builder) => ({
    uploadMedia: builder.mutation<
      MediaUploadResult,
      {
        file: { uri: string; name: string; type: string };
        mediaType: MediaUploadType;
      }
    >({
      query: ({ file, mediaType }) => {
        const body = new FormData();
        body.append("mediaType", mediaType);

        // React Native FormData đặc thù: field file phải là object có uri, name, type
        // @ts-ignore
        body.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        });

        return {
          url: "/media/upload",
          method: "POST",
          body,
          // Content-Type được fetchBaseQuery tự động xử lý khi body là FormData
        };
      },
      transformResponse: (response: ApiEnvelope<MediaUploadResult>) =>
        response.data,
    }),
  }),
});

export const { useUploadMediaMutation } = mediaApi;
