import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  FileSystemUploadType,
  uploadAsync,
} from "expo-file-system/legacy";

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
 * mediaApi — Upload media (ảnh, video, file) cho mobile.
 * Multipart dùng `expo-file-system` `uploadAsync` (native), tránh lỗi fetch+FormData với một số URI (DocumentPicker, v.v.).
 */
export const mediaApi = createApi({
  reducerPath: "mediaApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    timeout: 120_000,
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
      async queryFn({ file, mediaType }, api) {
        const state = api.getState() as {
          auth?: { accessToken?: string | null };
        };
        const token = state.auth?.accessToken;
        const base = env.apiBaseUrl.replace(/\/$/, "");
        const url = `${base}/media/upload`;
        const mimeType = file.type?.trim() || "application/octet-stream";

        try {
          const result = await uploadAsync(url, file.uri, {
            httpMethod: "POST",
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: "file",
            mimeType,
            parameters: { mediaType },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (result.status < 200 || result.status >= 300) {
            return {
              error: {
                status: result.status,
                data: result.body,
              },
            };
          }

          let envelope: ApiEnvelope<MediaUploadResult>;
          try {
            envelope = JSON.parse(result.body) as ApiEnvelope<MediaUploadResult>;
          } catch {
            return {
              error: {
                status: "PARSING_ERROR",
                originalStatus: result.status,
                data: result.body,
                error: "Invalid JSON from upload response",
              },
            };
          }

          if (!envelope.success || !envelope.data) {
            return {
              error: {
                status: result.status,
                data: envelope,
              },
            };
          }

          return { data: envelope.data };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return {
            error: {
              status: "FETCH_ERROR",
              error: message,
            },
          };
        }
      },
    }),
  }),
});

export const { useUploadMediaMutation } = mediaApi;
