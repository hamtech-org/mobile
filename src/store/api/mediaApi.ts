import type { BaseQueryApi } from "@reduxjs/toolkit/query";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { FileSystemUploadType, uploadAsync } from "expo-file-system/legacy";
import { router } from "expo-router";

import { env } from "@/config/env";
import { invalidateSessionAfterAuthFailure, refreshAuthSession } from "@/store/api/sessionRefresh";
import { mediaUploadTypeFromMime } from "@/utils/chatMediaMime";
import { applyNgrokSkipBrowserWarningHeader, ngrokSkipBrowserWarningHeaders } from "@/utils/ngrok";

export type MediaUploadType = "image" | "video" | "audio" | "file";

export interface MediaUploadResult {
  mediaId: string;
  url: string;
  thumbnailUrl: string | null;
  type: MediaUploadType;
  scope: string;
  size: number;
  mimeType: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

type AuthRef = { auth?: { accessToken?: string | null } };

function readBearer(api: BaseQueryApi): string | null | undefined {
  return (api.getState() as AuthRef).auth?.accessToken;
}

function parseEnvelope<T>(
  body: string,
  status: number,
): { ok: true; data: T } | { ok: false; error: { status: number | string; data: unknown } } {
  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(body) as ApiEnvelope<T>;
  } catch {
    return {
      ok: false,
      error: {
        status: "PARSING_ERROR",
        data: body,
      },
    };
  }
  if (!envelope.success || !envelope.data) {
    return { ok: false, error: { status, data: envelope } };
  }
  return { ok: true, data: envelope.data };
}

/**
 * mediaApi — Upload media (ảnh, video, file) cho mobile.
 * Đơn: `uploadAsync` (native). Batch: `fetch` + FormData sau khi copy URI vào cache.
 */
export const mediaApi = createApi({
  reducerPath: "mediaApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    timeout: 120_000,
    prepareHeaders: (headers, { getState }) => {
      applyNgrokSkipBrowserWarningHeader(headers, env.apiBaseUrl);
      const state = getState() as AuthRef;
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
        deliveryScope?: string;
      }
    >({
      async queryFn({ file, mediaType, deliveryScope = "chat" }, api) {
        const base = env.apiBaseUrl.replace(/\/$/, "");
        const url = `${base}/media/upload`;
        const mimeType = file.type?.trim() || "application/octet-stream";

        const uploadOnce = async (bearer: string | null | undefined) =>
          uploadAsync(url, file.uri, {
            httpMethod: "POST",
            uploadType: FileSystemUploadType.MULTIPART,
            fieldName: "file",
            mimeType,
            parameters: { mediaType, deliveryScope },
            headers: {
              ...ngrokSkipBrowserWarningHeaders(url),
              ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
            },
          });

        try {
          let bearer = readBearer(api);
          let result = await uploadOnce(bearer);

          if (result.status === 401 && bearer) {
            const refreshed = await refreshAuthSession(api.dispatch);
            if (!refreshed) {
              await invalidateSessionAfterAuthFailure(api.dispatch);
              router.replace("/(auth)/login");
              return { error: { status: 401, data: result.body } };
            }
            bearer = readBearer(api);
            result = await uploadOnce(bearer);
          }

          if (result.status < 200 || result.status >= 300) {
            if (result.status === 401) {
              await invalidateSessionAfterAuthFailure(api.dispatch);
              router.replace("/(auth)/login");
            }
            return { error: { status: result.status, data: result.body } };
          }

          const parsed = parseEnvelope<MediaUploadResult>(result.body, result.status);
          if (!parsed.ok) {
            return { error: parsed.error as any };
          }
          return { data: parsed.data };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return { error: { status: "FETCH_ERROR", error: message } };
        }
      },
    }),

    /**
     * Khớp web `/media/upload/multi` — upload tuần tự qua `uploadAsync` (giữ đúng tên file gốc).
     */
    uploadMediaMulti: builder.mutation<
      MediaUploadResult[],
      { files: { uri: string; name: string; type: string }[]; deliveryScope?: string }
    >({
      async queryFn({ files, deliveryScope = "chat" }, api) {
        if (files.length === 0) {
          return { error: { status: 400, data: { message: "No files" } } };
        }

        const base = env.apiBaseUrl.replace(/\/$/, "");
        const url = `${base}/media/upload`;
        const results: MediaUploadResult[] = [];

        try {
          for (const file of files) {
            const mimeType = file.type?.trim() || "application/octet-stream";
            const mediaType = mediaUploadTypeFromMime(mimeType);

            const uploadOnce = async (bearer: string | null | undefined) =>
              uploadAsync(url, file.uri, {
                httpMethod: "POST",
                uploadType: FileSystemUploadType.MULTIPART,
                fieldName: "file",
                mimeType,
                parameters: { mediaType, deliveryScope },
                headers: {
                  ...ngrokSkipBrowserWarningHeaders(url),
                  ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
                },
              });

            let bearer = readBearer(api);
            let uploadRes = await uploadOnce(bearer);

            if (uploadRes.status === 401 && bearer) {
              const refreshed = await refreshAuthSession(api.dispatch);
              if (!refreshed) {
                await invalidateSessionAfterAuthFailure(api.dispatch);
                router.replace("/(auth)/login");
                return { error: { status: 401, data: uploadRes.body } };
              }
              bearer = readBearer(api);
              uploadRes = await uploadOnce(bearer);
            }

            if (uploadRes.status < 200 || uploadRes.status >= 300) {
              if (uploadRes.status === 401) {
                await invalidateSessionAfterAuthFailure(api.dispatch);
                router.replace("/(auth)/login");
              }
              return { error: { status: uploadRes.status, data: uploadRes.body } };
            }

            const parsed = parseEnvelope<MediaUploadResult>(uploadRes.body, uploadRes.status);
            if (!parsed.ok) {
              return { error: parsed.error as any };
            }
            results.push(parsed.data);
          }

          return { data: results };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return { error: { status: "FETCH_ERROR", error: message } };
        }
      },
    }),
  }),
});

export const { useUploadMediaMutation, useUploadMediaMultiMutation } = mediaApi;
