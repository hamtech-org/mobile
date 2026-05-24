import * as FileSystem from "expo-file-system/legacy";

import { ngrokHeadersRecord } from "@/config/apiRequestHeaders";
import { toNotificationAvatarUrl } from "@/utils/notificationAvatar";

const AVATAR_CACHE_DIR = `${FileSystem.cacheDirectory ?? ""}notif-avatars/`;

function cacheFileForUrl(remoteUrl: string): string {
  const safe = remoteUrl.replace(/[^a-zA-Z0-9]/g, "_").slice(-96);
  return `${AVATAR_CACHE_DIR}${safe}.jpg`;
}

export function buildAvatarNotificationFieldsSync(rawUrl?: string | null): Record<string, string> {
  const remote = toNotificationAvatarUrl(rawUrl);
  if (!remote) return {};
  return { actorAvatar: remote, imageUrl: remote };
}

async function ensureCacheDir(): Promise<void> {
  if (!AVATAR_CACHE_DIR) return;
  const info = await FileSystem.getInfoAsync(AVATAR_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AVATAR_CACHE_DIR, { intermediates: true });
  }
}

/**
 * Tải avatar về cache thiết bị — native Android đọc `localAvatarUri` (file://).
 * Tránh lỗi tải trực tiếp (ngrok, TLS, redirect).
 */
export async function cacheNotificationAvatarForNative(
  rawUrl?: string | null,
): Promise<string | undefined> {
  console.log("[NotificationAvatar] Raw URL input:", rawUrl);
  const remote = toNotificationAvatarUrl(rawUrl);
  console.log("[NotificationAvatar] Standardized URL:", remote);

  if (!remote || !FileSystem.cacheDirectory) {
    console.log("[NotificationAvatar] Remote URL is empty or FileSystem cache is unavailable.");
    return undefined;
  }

  await ensureCacheDir();
  const target = cacheFileForUrl(remote);
  console.log("[NotificationAvatar] Local target file path:", target);

  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) {
    console.log("[NotificationAvatar] Existing cached file found:", existing.uri);
    return existing.uri ?? target;
  }

  try {
    console.log("[NotificationAvatar] Starting download from:", remote);
    const result = await FileSystem.downloadAsync(remote, target, {
      headers: ngrokHeadersRecord(),
    });
    console.log("[NotificationAvatar] Download completed. HTTP status:", result.status);
    if (result.status >= 200 && result.status < 300) {
      console.log("[NotificationAvatar] Successfully downloaded to:", result.uri);
      return result.uri;
    } else {
      console.warn("[NotificationAvatar] Download failed with HTTP status code:", result.status);
    }
  } catch (error) {
    console.error("[NotificationAvatar] Download failed with exception:", error);
  }

  return undefined;
}
