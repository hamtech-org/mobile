import { router } from "expo-router";
import type { Href } from "expo-router";

/**
 * Gọi `router.back()` chỉ khi còn màn hình trong stack — tránh lỗi dev
 * `The action 'GO_BACK' was not handled` khi user vào chat/detail trực tiếp (replace, deep link).
 */
export function safeRouterBack(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
