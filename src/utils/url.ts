import { env } from "@/config/env";

/**
 * normalizeMediaUrl — Chuẩn hóa URL media từ backend.
 * Giải quyết vấn đề 'localhost' không truy cập được từ thiết bị di động bằng cách
 * thay thế bằng IP của máy chủ dev (hoặc IP production).
 *
 * @param url URL nhặn được từ backend (có thể là full URL hoặc relative path)
 * @returns URL đã được chuẩn hóa để load trên mobile
 */
export function normalizeMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;

  // 1. Phục hồi relative path (nếu backend trả về dạng /media/...)
  if (url.startsWith("/")) {
    // Lấy origin từ apiBaseUrl (bỏ /api/v1)
    const origin = env.apiBaseUrl.split("/api/")[0];
    return `${origin}${url}`;
  }

  // 2. Thay thế localhost / loopback / host Docker Desktop bằng host thực tế (LAN, 10.0.2.2 trên Android emulator)
  if (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("host.docker.internal") ||
    url.includes("0.0.0.0")
  ) {
    return url
      .replace(/localhost|127\.0\.0\.1/g, env.host)
      .replace(/host\.docker\.internal/g, env.host)
      .replace(/0\.0\.0\.0/g, env.host);
  }

  return url;
}

/** Endpoint avatar nhóm — path cố định, chỉ bust cache tại đây (tránh hỏng URL S3/media có query ký). */
function isStableGroupAvatarUrl(url: string): boolean {
  try {
    const path = url.includes("://") ? new URL(url).pathname : url.split("?")[0];
    return /\/conversations\/[^/]+\/avatar$/i.test(path);
  } catch {
    return /\/conversations\/[^/]+\/avatar(?:\?|$)/i.test(url);
  }
}

/**
 * Thêm query `v=` để ép tải lại ảnh khi URL endpoint không đổi (vd. avatar nhóm `/conversations/:id/avatar`).
 * Không áp dụng cho URL S3 hoặc media download có chữ ký query — thêm `v` sẽ làm ảnh lỗi.
 */
export function withMediaCacheBuster(
  url: string | null | undefined,
  version?: string | null,
): string | undefined {
  const raw = (url ?? "").trim();
  if (!raw) return undefined;
  const normalized = normalizeMediaUrl(raw) ?? raw;
  const v = (version ?? "").trim();
  if (!v || !isStableGroupAvatarUrl(normalized)) return normalized;
  const sep = normalized.includes("?") ? "&" : "?";
  return `${normalized}${sep}v=${encodeURIComponent(v)}`;
}
