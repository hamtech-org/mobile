import { env } from "@/config/env";

/**
 * Origin web cho link mời (mở trên trình duyệt, không phải API :3000).
 * - Production: EXPO_PUBLIC_WEB_ORIGIN=https://hamtech.app
 * - Dev: EXPO_PUBLIC_WEB_ORIGIN hoặc http://{host}:5173 (Vite local)
 */
export function getPublicWebOrigin(): string {
  const fromEnv = env.publicWebOrigin.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (__DEV__) {
    return `http://${env.host}:5173`;
  }
  return "";
}

export function getJoinGroupUrl(suffix: string | undefined | null): string {
  const s = String(suffix ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  const origin = getPublicWebOrigin();
  if (!origin) return `/join/${s}`;
  return `${origin}/join/${s}`;
}
