import axios from "axios";
import { router } from "expo-router";

import { applyNgrokHeaders } from "@/config/apiRequestHeaders";
import { env } from "@/config/env";
import { secureStorage } from "@/services/storage";
import { refreshAuthSession, invalidateSessionAfterAuthFailure } from "@/store/api/sessionRefresh";
import { store } from "@/store/store";
import { ngrokSkipBrowserWarningHeaders } from "@/utils/ngrok";

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: ngrokSkipBrowserWarningHeaders(env.apiBaseUrl),
});

apiClient.interceptors.request.use(async (config) => {
  const headers = (config.headers ?? {}) as Record<string, string>;
  applyNgrokHeaders(headers);
  config.headers = headers as any;

  const token = await secureStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Tránh vòng lặp vô hạn và tránh can thiệp vào request refresh-token
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh-token")
    ) {
      originalRequest._retry = true;

      try {
        const refreshed = await refreshAuthSession(store.dispatch);
        if (refreshed) {
          const token = await secureStorage.getAccessToken();
          if (token && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        } else {
          await invalidateSessionAfterAuthFailure(store.dispatch);
          router.replace("/(auth)/login");
        }
      } catch (refreshError) {
        await invalidateSessionAfterAuthFailure(store.dispatch);
        router.replace("/(auth)/login");
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
