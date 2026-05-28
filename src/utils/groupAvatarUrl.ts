import { env } from "@/config/env";

const MEDIA_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function absoluteApiUrl(pathOrUrl: string): string {
  const raw = pathOrUrl.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = env.apiBaseUrl.replace(/\/+$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;

  let basePath = "";
  try {
    basePath = new URL(base).pathname.replace(/\/+$/, "");
  } catch {
    basePath = base.replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "");
  }

  const normalizedPath =
    basePath && path.toLowerCase().startsWith(`${basePath.toLowerCase()}/`)
      ? path.slice(basePath.length)
      : path;

  return `${base}${normalizedPath}`;
}

function parseGroupAvatarMediaId(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed || /\/conversations\/[^/]+\/avatar/i.test(trimmed)) return null;
  if (MEDIA_UUID_RE.test(trimmed)) return trimmed;
  try {
    const u = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed, "http://local.invalid");
    const path = u.pathname.replace(/\/+$/, "");
    const app = path.match(
      /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:download|thumbnail)$/i,
    );
    if (app?.[1]) return app[1];
    const object = path.match(
      /\/(?:chat|public)\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:original|thumb)\b/i,
    );
    return object?.[1] ?? null;
  } catch {
    return null;
  }
}

function buildGroupAvatarMediaUrl(mediaId: string): string {
  return absoluteApiUrl(`/media/${mediaId}/download`);
}

function resolveGroupAvatarFetchUrl(storedUrl: string): string {
  const trimmed = storedUrl.trim();
  if (!trimmed) return "";
  if (/^(?:file|content|blob|data):/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/?api\//i.test(trimmed) || /^\/?(?:chat|media)\//i.test(trimmed)) {
    return absoluteApiUrl(trimmed);
  }
  return absoluteApiUrl(trimmed);
}

/** Path avatar nhóm ghép mặc định — được phép thêm `?v=` (không có chữ ký query). */
function isGroupAvatarCacheBustable(url: string): boolean {
  try {
    const path = url.includes("://") ? new URL(url).pathname : url.split("?")[0];
    return /\/conversations\/[^/]+\/avatar$/i.test(path);
  } catch {
    return /\/conversations\/[^/]+\/avatar(?:\?|$)/i.test(url);
  }
}

/** Bust cache avatar ghép mặc định khi version riêng đổi; không dùng conversation.updatedAt. */
export function withGroupAvatarCacheBuster(
  url: string | null | undefined,
  version?: string | null,
): string | undefined {
  const raw = (url ?? "").trim();
  if (!raw) return undefined;
  const v = (version ?? "").trim();
  if (!v || !isGroupAvatarCacheBustable(raw)) return raw;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}v=${encodeURIComponent(v)}`;
}

/** Chuẩn hóa giá trị avatar nhóm từ API/socket (relative path, không phụ thuộc host). */
export function normalizeGroupAvatarStoredValue(
  avatar: string | null | undefined,
  conversationId: string,
): string {
  const cid = String(conversationId ?? "").trim();
  const fallback = cid ? `/api/v1/chat/conversations/${cid}/avatar` : "";
  const trimmed = (avatar ?? "").trim();
  if (!trimmed) return fallback;

  const mediaId = parseGroupAvatarMediaId(trimmed);
  if (mediaId) return `/api/v1/media/${mediaId}/download`;

  let pathOnly = trimmed.split("?")[0];
  try {
    if (trimmed.includes("://")) pathOnly = new URL(trimmed).pathname;
  } catch {
    /* keep pathOnly */
  }
  if (/\/conversations\/[^/]+\/avatar$/i.test(pathOnly) && cid) {
    return `/api/v1/chat/conversations/${cid}/avatar`;
  }
  if (pathOnly.startsWith("/api/")) return pathOnly;
  return trimmed;
}

/** URL đầy đủ để hiển thị avatar nhóm trên thiết bị hiện tại. */
export function resolveGroupAvatarDisplayUrl(
  avatar: string | null | undefined,
  opts?: { conversationId?: string; updatedAt?: string | null; avatarVersion?: string | null },
): string | undefined {
  const cid = String(opts?.conversationId ?? "").trim();
  const stored = cid ? normalizeGroupAvatarStoredValue(avatar, cid) : (avatar ?? "").trim();
  if (!stored) return undefined;

  const mediaId = parseGroupAvatarMediaId(stored);
  const base = mediaId ? buildGroupAvatarMediaUrl(mediaId) : resolveGroupAvatarFetchUrl(stored);
  return withGroupAvatarCacheBuster(base, opts?.avatarVersion) ?? base;
}
