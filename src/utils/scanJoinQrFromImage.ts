import { scanFromURLAsync } from "expo-camera";

import { downloadChatMediaToCache } from "@/utils/chatMediaDownload";
import { extractJoinSuffixFromText } from "@/utils/groupJoinLinkMessage";
import { tryParseUserQrPayload, type UserQrPayload } from "@/utils/userQrPayload";

const joinSuffixScanCache = new Map<string, string | null>();
const chatQrScanCache = new Map<string, ChatQrScanResult | null>();

export type ChatQrScanResult =
  | { kind: "group_join"; suffix: string }
  | { kind: "user"; user: UserQrPayload };

function cacheKey(messageId: string, imageUri: string): string {
  return `${messageId}:${imageUri}`;
}

async function resolveScanTargetUri(imageUri: string, messageId: string): Promise<string> {
  if (imageUri.startsWith("file:") || imageUri.startsWith("content:")) {
    return imageUri;
  }
  if (!imageUri.startsWith("http")) {
    return imageUri;
  }
  const dl = await downloadChatMediaToCache(imageUri, `qr-scan-${messageId}.jpg`);
  return dl.ok && dl.localUri ? dl.localUri : imageUri;
}

/** Đọc mã QR trong ảnh; trả về suffix link `/join/...` nếu hợp lệ. */
export async function scanJoinSuffixFromImageUrl(
  imageUri: string,
  messageId: string,
): Promise<string | null> {
  const key = cacheKey(messageId, imageUri);
  if (joinSuffixScanCache.has(key)) {
    return joinSuffixScanCache.get(key) ?? null;
  }

  let suffix: string | null = null;
  try {
    const target = await resolveScanTargetUri(imageUri, messageId);
    const results = await scanFromURLAsync(target, ["qr"]);
    for (const row of results) {
      const parsed = extractJoinSuffixFromText(row.data);
      if (parsed) {
        suffix = parsed;
        break;
      }
    }
  } catch {
    suffix = null;
  }

  joinSuffixScanCache.set(key, suffix);
  return suffix;
}

export async function scanChatQrFromImageUrl(
  imageUri: string,
  messageId: string,
): Promise<ChatQrScanResult | null> {
  const key = cacheKey(messageId, imageUri);
  if (chatQrScanCache.has(key)) {
    return chatQrScanCache.get(key) ?? null;
  }

  let result: ChatQrScanResult | null = null;
  try {
    const target = await resolveScanTargetUri(imageUri, messageId);
    const results = await scanFromURLAsync(target, ["qr"]);
    for (const row of results) {
      const user = tryParseUserQrPayload(row.data);
      if (user) {
        result = { kind: "user", user };
        break;
      }

      const suffix = extractJoinSuffixFromText(row.data);
      if (suffix) {
        result = { kind: "group_join", suffix };
        break;
      }
    }
  } catch {
    result = null;
  }

  chatQrScanCache.set(key, result);
  if (result?.kind === "group_join") {
    joinSuffixScanCache.set(key, result.suffix);
  }
  return result;
}
