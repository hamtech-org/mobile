import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";

import { env } from "@/config/env";
import { store } from "@/store/store";
import { toast } from "@/utils/appToast";
import { ngrokSkipBrowserWarningHeaders } from "@/utils/ngrok";
import { normalizeMediaUrl } from "@/utils/url";

const MEDIA_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Thư mục con trong Documents của app (hiện trong ứng dụng Tệp). */
const APP_DOCUMENTS_FOLDER = "TaiLieu";
const ANDROID_DOCUMENTS_SAF_URI_KEY = "@chat/android_documents_saf_uri";

const { StorageAccessFramework } = FileSystem;

function isLocalUri(uri: string): boolean {
  return uri.startsWith("file:") || uri.startsWith("content:");
}

function isCloudFrontSignedUrl(raw: string): boolean {
  const src = raw.trim();
  if (!src) return false;
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("cloudfront.net")) return false;
    return (
      u.searchParams.has("Signature") &&
      u.searchParams.has("Key-Pair-Id") &&
      (u.searchParams.has("Expires") || u.searchParams.has("Policy"))
    );
  } catch {
    return false;
  }
}

/** Trích mediaId từ URL lưu trong tin nhắn (app download hoặc CDN/S3 key). */
export function parseMediaIdFromStoredUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  try {
    const u = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed, "http://local.invalid");
    const path = u.pathname.replace(/\/+$/, "");
    const app = path.match(
      /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/download$/i,
    );
    if (app?.[1]) return app[1];
    const s3 = path.match(
      /\/(?:chat|public)\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:original|thumb)\b/i,
    );
    if (s3?.[1]) return s3[1];
    const loose = trimmed.match(MEDIA_UUID);
    return loose?.[0] ?? null;
  } catch {
    const loose = trimmed.match(MEDIA_UUID);
    return loose?.[0] ?? null;
  }
}

/** Endpoint ổn định — server redirect sang URL CDN mới (không hết hạn như URL ký trong DB). */
export function buildAppMediaDownloadUrl(mediaId: string): string {
  const base = env.apiBaseUrl.replace(/\/+$/, "");
  return `${base}/media/${mediaId}/download`;
}

/** Stream qua API (không redirect CDN) — dùng copy ảnh / tải blob, khớp web `?attachment=1`. */
export function buildAppMediaAttachmentUrl(mediaId: string, filename?: string): string {
  const base = buildAppMediaDownloadUrl(mediaId);
  const params = new URLSearchParams({ attachment: "1" });
  const safe = filename?.trim();
  if (safe) params.set("filename", sanitizeFilename(safe));
  return `${base}?${params.toString()}`;
}

/**
 * URL dùng để tải: ưu tiên `/api/v1/media/:id/download`, fallback URL đã chuẩn hóa.
 */
export function resolveChatMediaDownloadUrl(storedUrl: string): string {
  const normalized = (normalizeMediaUrl(storedUrl) ?? storedUrl).trim();
  if (!normalized) return "";
  if (isLocalUri(normalized)) return normalized;
  const mediaId = parseMediaIdFromStoredUrl(normalized);
  if (mediaId) return buildAppMediaDownloadUrl(mediaId);
  return normalized;
}

/** URL stream file — tránh lỗi redirect khi `fetch` blob (copy ảnh). */
export function resolveChatMediaAttachmentUrl(storedUrl: string, filename?: string): string {
  const normalized = (normalizeMediaUrl(storedUrl) ?? storedUrl).trim();
  if (!normalized) return "";
  if (isLocalUri(normalized)) return normalized;
  const mediaId = parseMediaIdFromStoredUrl(normalized);
  if (mediaId) return buildAppMediaAttachmentUrl(mediaId, filename);
  if (isCloudFrontSignedUrl(normalized)) return normalized;
  return resolveChatMediaDownloadUrl(normalized);
}

function authHeadersForDownload(url: string): Record<string, string> {
  if (isCloudFrontSignedUrl(url)) return {};
  const token = store.getState().auth.accessToken;
  return {
    ...ngrokSkipBrowserWarningHeaders(url),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.\-() \u00C0-\u024F]+/g, "_").trim();
  return cleaned.slice(0, 120) || "download";
}

function splitFilenameParts(name: string): { stem: string; ext: string } {
  const safe = sanitizeFilename(name);
  const dot = safe.lastIndexOf(".");
  if (dot <= 0) return { stem: safe, ext: "" };
  return { stem: safe.slice(0, dot), ext: safe.slice(dot) };
}

function mimeOrDefault(mimeType?: string | null): string {
  const m = mimeType?.trim();
  return m && m.includes("/") ? m : "application/octet-stream";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("read_failed"));
        return;
      }
      const base64 = result.includes(",") ? (result.split(",")[1] ?? "") : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted) return true;
  const req = await MediaLibrary.requestPermissionsAsync();
  return req.granted;
}

async function uniqueFileUri(dir: string, filename: string): Promise<string> {
  const safe = sanitizeFilename(filename);
  let dest = `${dir}${safe}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) return dest;
  const { stem, ext } = splitFilenameParts(safe);
  dest = `${dir}${stem}_${Date.now()}${ext}`;
  return dest;
}

async function getAppDocumentsDirectory(): Promise<string | null> {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  const dir = `${base}${APP_DOCUMENTS_FOLDER}/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* đã tồn tại */
  }
  return dir;
}

/** Lưu file vào Documents của app (iOS/Android — mở bằng ứng dụng Tệp). */
async function saveToAppDocumentsFolder(
  localUri: string,
  filename: string,
): Promise<string | null> {
  const dir = await getAppDocumentsDirectory();
  if (!dir) return null;
  const dest = await uniqueFileUri(dir, filename);
  await FileSystem.copyAsync({ from: localUri, to: dest });
  return dest;
}

async function getAndroidDocumentsSafUri(): Promise<string | null> {
  const cached = await AsyncStorage.getItem(ANDROID_DOCUMENTS_SAF_URI_KEY);
  if (cached) return cached;
  if (Platform.OS !== "android" || !StorageAccessFramework?.requestDirectoryPermissionsAsync) {
    return null;
  }

  const initial = StorageAccessFramework.getUriForDirectoryInRoot("Documents");

  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
  if (!result.granted || !result.directoryUri) return null;

  await AsyncStorage.setItem(ANDROID_DOCUMENTS_SAF_URI_KEY, result.directoryUri);
  return result.directoryUri;
}

/** Android: ghi vào thư mục Documents/Download người dùng đã cấp quyền (lần đầu có thể hỏi 1 lần). */
async function saveToAndroidDocumentsSaf(
  localUri: string,
  filename: string,
  mimeType: string,
): Promise<boolean> {
  if (Platform.OS !== "android" || !StorageAccessFramework?.createFileAsync) {
    return false;
  }

  const parentUri = await getAndroidDocumentsSafUri();
  if (!parentUri) return false;

  const { stem } = splitFilenameParts(filename);
  const mime = mimeOrDefault(mimeType);

  try {
    const destUri = await StorageAccessFramework.createFileAsync(parentUri, stem, mime);
    await StorageAccessFramework.copyAsync({ from: localUri, to: destUri });
    return true;
  } catch {
    await AsyncStorage.removeItem(ANDROID_DOCUMENTS_SAF_URI_KEY);
    return false;
  }
}

/**
 * Lưu file chat vào Tài liệu — không mở bảng Share.
 * Trả về URI local để mở bằng app khác (nếu cần).
 */
export async function saveChatFileToDocuments(
  localUri: string,
  filename: string,
  mimeType?: string | null,
): Promise<string | null> {
  if (Platform.OS === "android") {
    const savedSaf = await saveToAndroidDocumentsSaf(localUri, filename, mimeOrDefault(mimeType));
    if (savedSaf) {
      return localUri;
    }
  }
  return saveToAppDocumentsFolder(localUri, filename);
}

/**
 * Tải media chat vào cache.
 * Dùng `fetch` (theo redirect 302) — `downloadAsync` trên Android không follow redirect.
 */
export async function downloadChatMediaToCache(
  remoteUrl: string,
  filename: string,
): Promise<{ ok: boolean; localUri?: string; status?: number }> {
  const safeName = sanitizeFilename(filename);
  const mediaId = parseMediaIdFromStoredUrl(remoteUrl);
  const url = mediaId
    ? resolveChatMediaAttachmentUrl(remoteUrl, safeName)
    : resolveChatMediaDownloadUrl(remoteUrl);
  if (!url) return { ok: false };

  if (isLocalUri(url)) {
    return { ok: true, localUri: url };
  }

  const dest = `${FileSystem.cacheDirectory}chat-${Date.now()}-${safeName}`;

  try {
    const res = await fetch(url, {
      headers: authHeadersForDownload(url),
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const blob = await res.blob();
    if (!blob.size) {
      return { ok: false, status: res.status };
    }
    const base64 = await blobToBase64(blob);
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { ok: true, localUri: dest, status: res.status };
  } catch {
    return { ok: false };
  }
}

/** Lưu ảnh/video vào thư viện máy (khi được cấp quyền). */
export async function saveChatMediaToLibrary(
  remoteUrl: string,
  filename: string,
  kind: "image" | "video",
): Promise<boolean> {
  const { ok, localUri } = await downloadChatMediaToCache(remoteUrl, filename);
  if (!ok || !localUri) return false;

  if (!(await ensureMediaLibraryPermission())) {
    const saved = await saveToAppDocumentsFolder(localUri, filename);
    return Boolean(saved);
  }

  try {
    if (kind === "image") {
      await MediaLibrary.saveToLibraryAsync(localUri);
    } else {
      await MediaLibrary.createAssetAsync(localUri);
    }
    return true;
  } catch {
    const saved = await saveToAppDocumentsFolder(localUri, filename);
    return Boolean(saved);
  }
}

export function openDownloadsFolderHint(): void {
  if (Platform.OS === "ios") {
    toast.info(`File đã lưu trong ứng dụng Tệp → Trên iPhone → ${APP_DOCUMENTS_FOLDER}.`);
    return;
  }
  toast.info("File đã lưu trong Tệp / Documents (hoặc thư mục Tài liệu bạn đã chọn lần đầu).");
}

/** Mở file đã tải — ưu tiên mở trực tiếp, Share chỉ khi không mở được. */
export async function openOrShareChatFile(
  remoteUrl: string,
  filename: string,
  mimeType?: string | null,
): Promise<boolean> {
  const { ok, localUri } = await downloadChatMediaToCache(remoteUrl, filename);
  if (!ok || !localUri) return false;

  const savedUri = await saveChatFileToDocuments(localUri, filename, mimeType);
  const openUri = savedUri ?? localUri;

  try {
    if (await Linking.canOpenURL(openUri)) {
      await Linking.openURL(openUri);
      return true;
    }
  } catch {
    /* fallback share */
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(openUri, {
      mimeType: mimeOrDefault(mimeType),
      dialogTitle: "Mở file",
    });
    return true;
  }

  return Boolean(savedUri);
}

/** Tải file vào Tài liệu — không bật Share. */
export async function downloadChatFileToDevice(
  remoteUrl: string,
  filename: string,
  mimeType?: string | null,
): Promise<boolean> {
  const { ok, localUri } = await downloadChatMediaToCache(remoteUrl, filename);
  if (!ok || !localUri) return false;

  const saved = await saveChatFileToDocuments(localUri, filename, mimeType);
  return Boolean(saved);
}

export type PastedImageAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

/** File cache sau «Copy hình ảnh» — dán lại trong app khi clipboard hệ thống không đọc được. */
let inAppCopiedImageCache: PastedImageAttachment | null = null;

/** `getImageAsync` trả `data:image/...;base64,...` — tách base64 thuần trước khi ghi file. */
function stripDataUriToRawBase64(data: string): { base64: string; mimeType: string } | null {
  const trimmed = data.trim();
  if (!trimmed) return null;

  const dataUri = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(trimmed);
  if (dataUri?.[2]) {
    return {
      mimeType: dataUri[1],
      base64: dataUri[2].replace(/\s/g, ""),
    };
  }

  const compact = trimmed.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(compact)) {
    return { base64: compact, mimeType: "image/png" };
  }

  return null;
}

async function writeBase64ToCacheFile(
  base64: string,
  mimeType: string,
): Promise<PastedImageAttachment | null> {
  const baseDir = FileSystem.cacheDirectory;
  if (!baseDir) return null;

  const ext =
    mimeType.includes("jpeg") || mimeType.includes("jpg")
      ? "jpg"
      : mimeType.includes("png")
        ? "png"
        : "png";
  const name = `paste-${Date.now()}.${ext}`;
  const uri = baseDir.endsWith("/") ? `${baseDir}${name}` : `${baseDir}/${name}`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(uri);
  return {
    uri,
    name,
    mimeType,
    size: info.exists && "size" in info && typeof info.size === "number" ? info.size : undefined,
  };
}

/** Chuyển payload ảnh clipboard (data URI hoặc base64) → file cache `file://`. */
export async function pendingAttachmentFromClipboardImageData(
  data: string,
): Promise<PastedImageAttachment | null> {
  const parsed = stripDataUriToRawBase64(data);
  if (!parsed) return null;
  return writeBase64ToCacheFile(parsed.base64, parsed.mimeType);
}

/** Copy ảnh chat vào clipboard hệ thống (khớp web `fetchChatMediaBlob` + `clipboard.write`). */
export async function copyChatImageToClipboard(
  storedUrl: string,
  filename: string,
): Promise<boolean> {
  try {
    const { ok, localUri } = await downloadChatMediaToCache(storedUrl, filename);
    if (!ok || !localUri) return false;

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await Clipboard.setImageAsync(base64);

    const safeName = sanitizeFilename(filename);
    const lower = safeName.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    const info = await FileSystem.getInfoAsync(localUri);
    inAppCopiedImageCache = {
      uri: localUri,
      name: safeName,
      mimeType,
      size: info.exists && "size" in info && typeof info.size === "number" ? info.size : undefined,
    };

    return true;
  } catch {
    inAppCopiedImageCache = null;
    return false;
  }
}

/** Dán ảnh từ clipboard — không dùng `hasImageAsync` (hay false dù đã copy). */
export async function readPastedImageFromClipboard(): Promise<PastedImageAttachment | null> {
  for (const format of ["png", "jpeg"] as const) {
    try {
      const image = await Clipboard.getImageAsync({ format });
      const data = image?.data?.trim();
      if (!data) continue;
      const file = await pendingAttachmentFromClipboardImageData(data);
      if (file) return file;
    } catch {
      /* thử format khác */
    }
  }

  if (inAppCopiedImageCache) {
    try {
      const info = await FileSystem.getInfoAsync(inAppCopiedImageCache.uri);
      if (info.exists) return { ...inAppCopiedImageCache };
    } catch {
      inAppCopiedImageCache = null;
    }
  }

  return null;
}

/** iOS 16+: nút `UIPasteControl` — không cần quyền paste thủ công. */
export const isClipboardPasteButtonAvailable = Clipboard.isPasteButtonAvailable;
