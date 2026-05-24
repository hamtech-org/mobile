import axios from "axios";

import { env } from "@/config/env";
import { secureStorage } from "@/services/storage";
import { ngrokSkipBrowserWarningHeaders } from "@/utils/ngrok";

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: ngrokSkipBrowserWarningHeaders(env.apiBaseUrl),
});

apiClient.interceptors.request.use(async (config) => {
  const token = await secureStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
