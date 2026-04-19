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

  // 2. Thay thế localhost bằng host thực tế (10.0.2.2 hoặc IP mạng nội bộ)
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return url.replace(/localhost|127\.0\.0\.1/g, env.host);
  }

  return url;
}
