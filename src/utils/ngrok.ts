const NGROK_SKIP_BROWSER_WARNING_HEADER = "ngrok-skip-browser-warning";

function isNgrokFreeUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname.endsWith(".ngrok-free.app");
  } catch {
    return rawUrl.includes(".ngrok-free.app");
  }
}

export function ngrokSkipBrowserWarningHeaders(rawUrl: string): Record<string, string> {
  return isNgrokFreeUrl(rawUrl) ? { [NGROK_SKIP_BROWSER_WARNING_HEADER]: "true" } : {};
}

export function applyNgrokSkipBrowserWarningHeader(headers: Headers, rawUrl: string): Headers {
  if (isNgrokFreeUrl(rawUrl)) {
    headers.set(NGROK_SKIP_BROWSER_WARNING_HEADER, "true");
  }
  return headers;
}
