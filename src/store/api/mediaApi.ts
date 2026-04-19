import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  FileSystemUploadType,
  uploadAsync,
} from "expo-file-system/legacy";
import { router } from "expo-router";

import { env } from "@/config/env";
import { invalidateSessionAfterAuthFailure, refreshAuthSession } from "@/store/api/sessionRefresh";

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
        type AuthRef = { auth?: { accessToken?: string | null } };
        const base = env.apiBaseUrl.replace(/\/$/, "");
        const url = `${base}/media/upload`;
        const mimeType = file.type?.trim() || "application/octet-stream";

        const readBearer = () => (api.getState() as AuthRef).auth?.accessToken;

        const uploadOnce = async (bearer: string | null | undefined) =>
          uploadAsync(url, file.uri, {
            httpMethod: "POST",
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: "file",
            mimeType,
            parameters: { mediaType },
            headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
          });

        try {
          let bearer = readBearer();
          let result = await uploadOnce(bearer);

          if (result.status === 401 && bearer) {
            const refreshed = await refreshAuthSession(api.dispatch);
            if (!refreshed) {
              await invalidateSessionAfterAuthFailure(api.dispatch);
              router.replace("/(auth)/login");
              return {
                error: {
                  status: 401,
                  data: result.body,
                },
              };
            }
            bearer = readBearer();
            result = await uploadOnce(bearer);
          }

          if (result.status < 200 || result.status >= 300) {
            if (result.status === 401) {
              await invalidateSessionAfterAuthFailure(api.dispatch);
              router.replace("/(auth)/login");
            }
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
