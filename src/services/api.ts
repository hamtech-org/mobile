import axios from "axios";

import { applyNgrokHeaders } from "@/config/apiRequestHeaders";
import { env } from "@/config/env";
import { secureStorage } from "@/services/storage";
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
