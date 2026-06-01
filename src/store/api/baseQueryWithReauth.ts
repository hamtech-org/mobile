import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { router } from "expo-router";

import { env } from "@/config/env";
import { invalidateSessionAfterAuthFailure, refreshAuthSession } from "@/store/api/sessionRefresh";
import { getMobileDeviceInfoHeader } from "@/utils/deviceInfo";
import { applyNgrokSkipBrowserWarningHeader } from "@/utils/ngrok";

type AuthSliceRef = { auth?: { accessToken?: string | null } };

function requestIncludesRefreshTokenPath(args: FetchArgs | string): boolean {
  const url = typeof args === "string" ? args : args.url;
  return url.includes("/auth/refresh-token");
}

/**
 * fetchBaseQuery + một lần refresh + retry khi 401 (access JWT hết hạn).
 */
export function createBaseQueryWithReauth(): BaseQueryFn<
  FetchArgs | string,
  unknown,
  FetchBaseQueryError
> {
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      applyNgrokSkipBrowserWarningHeader(headers, env.apiBaseUrl);
      headers.set("X-Hamtech-Device-Info", getMobileDeviceInfoHeader());
      const state = getState() as AuthSliceRef;
      const token = state.auth?.accessToken;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  });

  const baseQueryWithReauth: BaseQueryFn<FetchArgs | string, unknown, FetchBaseQueryError> = async (
    args,
    api,
    extraOptions,
  ) => {
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status !== 401) {
      return result;
    }

    const isAuthEndpoint =
      typeof args === "string" ? args.includes("/auth/") : args.url.includes("/auth/");

    if (isAuthEndpoint || requestIncludesRefreshTokenPath(args)) {
      return result;
    }

    const hadAccessToken = Boolean((api.getState() as AuthSliceRef).auth?.accessToken);
    if (!hadAccessToken) {
      await invalidateSessionAfterAuthFailure(api.dispatch);
      router.replace("/(auth)/login");
      return result;
    }

    const refreshed = await refreshAuthSession(api.dispatch);
    if (!refreshed) {
      await invalidateSessionAfterAuthFailure(api.dispatch);
      router.replace("/(auth)/login");
      return result;
    }

    result = await rawBaseQuery(args, api, extraOptions);
    if (result.error?.status === 401) {
      await invalidateSessionAfterAuthFailure(api.dispatch);
      router.replace("/(auth)/login");
    }

    return result;
  };

  return baseQueryWithReauth;
}

/** Một instance dùng chung cho mọi RTK slice cần Bearer + refresh. */
export const baseQueryWithReauth = createBaseQueryWithReauth();
