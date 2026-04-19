import type { UnknownAction } from "@reduxjs/toolkit";

import { env } from "@/config/env";
import { secureStorage } from "@/services/storage";
import { clearAuthState, setSessionTokens } from "@/store/slices/authSlice";

interface RefreshEnvelope {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  message?: string;
}

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Gọi POST /auth/refresh-token (fetch trần), cập nhật SecureStore + Redux.
 * Mọi caller đồng thời dùng chung một Promise (tránh race rotation).
 */
export function refreshAuthSession(dispatch: (action: UnknownAction) => unknown): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const base = env.apiBaseUrl.replace(/\/$/, "");
      let response: Response;
      try {
        response = await fetch(`${base}/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        return false;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return false;
      }

      const envelope = body as RefreshEnvelope;
      if (!response.ok || !envelope.success || !envelope.data?.accessToken || !envelope.data?.refreshToken) {
        return false;
      }

      const { accessToken, refreshToken: newRefresh } = envelope.data;
      await secureStorage.setTokens(accessToken, newRefresh);
      dispatch(setSessionTokens({ accessToken, refreshToken: newRefresh }));
      return true;
    })().finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}

export async function invalidateSessionAfterAuthFailure(
  dispatch: (action: UnknownAction) => unknown,
): Promise<void> {
  await secureStorage.clearTokens();
  dispatch(clearAuthState());
}
