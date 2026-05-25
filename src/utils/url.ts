import { env } from "@/config/env";

/**
 * normalizeMediaUrl — Chuẩn hóa URL media từ backend.
 * Giải quyết vấn đề 'localhost' không truy cập được từ thiết bị di động bằng cách
 * thay thế bằng IP của máy chủ dev (hoặc IP production / ngrok origin).
 *
 * @param url URL nhận được từ backend (có thể là full URL hoặc relative path)
 * @returns URL đã được chuẩn hóa để load trên mobile
 */
export function normalizeMediaUrl(url: string | null | undefined): string | undefined {
  if (
    !url ||
    url === "null" ||
    url === "undefined" ||
    url === "default" ||
    url.trim() === "" ||
    url.endsWith("/null") ||
    url.endsWith("/undefined") ||
    url.endsWith("/default") ||
    url.includes("avatar-group-default") ||
    url.includes("cover-group-default")
  ) {
    return undefined;
  }

  const origin = env.apiBaseUrl.split("/api/")[0];

  // 1. Phục hồi relative path (nếu backend trả về dạng /media/...)
  if (url.startsWith("/")) {
    return `${origin}${url}`;
  }

  // 2. Thay thế localhost / loopback / host Docker Desktop bằng host thực tế hoặc ngrok origin
  const isPublicUrl =
    !env.apiBaseUrl.includes("localhost") &&
    !env.apiBaseUrl.includes("127.0.0.1") &&
    !env.apiBaseUrl.includes("10.0.2.2");

  if (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("host.docker.internal") ||
    url.includes("0.0.0.0")
  ) {
    if (isPublicUrl && origin) {
      // Nếu apiBaseUrl dùng ngrok hoặc domain public, ta thay thế toàn bộ origin (bao gồm cả port) bằng public origin
      return url.replace(
        /https?:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|0\.0\.0\.0)(:\d+)?/g,
        origin,
      );
    }

    return url
      .replace(/localhost|127\.0\.0\.1/g, env.host)
      .replace(/host\.docker\.internal/g, env.host)
      .replace(/0\.0\.0\.0/g, env.host);
  }

  return url;
}
