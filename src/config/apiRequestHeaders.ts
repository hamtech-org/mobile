import { env } from "@/config/env";

/** Header bỏ trang cảnh báo ngrok free khi gọi API từ app native. */
export const NGROK_SKIP_HEADER = "ngrok-skip-browser-warning";

const usesNgrok = env.apiBaseUrl.includes("ngrok-free.dev") || env.apiBaseUrl.includes("ngrok.io");

export function applyNgrokHeaders(headers: Record<string, string>): void {
  if (usesNgrok) {
    headers[NGROK_SKIP_HEADER] = "true";
  }
}

export function ngrokHeadersRecord(): Record<string, string> {
  return usesNgrok ? { [NGROK_SKIP_HEADER]: "true" } : {};
}
