import { buildAppMediaDownloadUrl, parseMediaIdFromStoredUrl } from "@/utils/chatMediaDownload";
import { normalizeMediaUrl } from "@/utils/url";

/** Path avatar nhóm / media download nội bộ — được phép thêm `?v=` (không có chữ ký query). */
function isGroupAvatarCacheBustable(url: string): boolean {
  try {
    const path = url.includes("://") ? new URL(url).pathname : url.split("?")[0];
    if (/\/conversations\/[^/]+\/avatar$/i.test(path)) return true;
    return /\/media\/[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/download$/i.test(
      path,
    );
  } catch {
    return (
      /\/conversations\/[^/]+\/avatar(?:\?|$)/i.test(url) ||
      /\/media\/[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/download/i.test(url)
    );
  }
}

/** Bust cache ảnh nhóm khi `updatedAt` đổi (URL endpoint hoặc media id có thể giữ nguyên). */
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

  const mediaId = parseMediaIdFromStoredUrl(trimmed);
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
  opts?: { conversationId?: string; updatedAt?: string | null },
): string | undefined {
  const cid = String(opts?.conversationId ?? "").trim();
  const stored = cid ? normalizeGroupAvatarStoredValue(avatar, cid) : (avatar ?? "").trim();
  if (!stored) return undefined;

  const mediaId = parseMediaIdFromStoredUrl(stored);
  const base = mediaId ? buildAppMediaDownloadUrl(mediaId) : (normalizeMediaUrl(stored) ?? stored);
  return withGroupAvatarCacheBuster(base, opts?.updatedAt) ?? base;
}
