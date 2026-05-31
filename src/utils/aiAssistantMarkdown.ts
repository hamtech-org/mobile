const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

const IMAGE_LINK_LABEL =
  /^(?:link\s*(?:ảnh|anh)|(?:ảnh|anh)(?:\s*đại\s*diện|\s*dai\s*dien)?|xem\s*ảnh|xem\s*anh|avatar|image|photo|hình|hinh)$/iu;

/** URL trỏ tới ảnh (avatar, media S3, …) — dùng để render img thay vì link. */
export function isAiAssistantImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed.includes(" ") ? trimmed.replace(/ /g, "%20") : trimmed);
    if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(parsed.pathname)) return true;
    if (/\/avatars?\//i.test(parsed.pathname)) return true;
  } catch {
    /* relative or malformed — fall through */
  }

  return (
    /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(trimmed) ||
    /\/avatars?\//i.test(trimmed) ||
    /zalogram-media/i.test(trimmed)
  );
}

function normalizeLinkLabel(label: string): string {
  return label.normalize("NFC").trim();
}

function isImageLinkLabel(label: string): boolean {
  const normalized = normalizeLinkLabel(label);
  if (!normalized) return false;
  if (IMAGE_LINK_LABEL.test(normalized)) return true;
  const lower = normalized.toLowerCase();
  return /link.*(ảnh|anh)/u.test(lower) || /^(ảnh|anh|hình|hinh)\b/u.test(lower);
}

/** Chuẩn hóa href ảnh (khoảng trắng sau sanitize UUID → %20). */
export function normalizeAiAssistantImageHref(href: string): string {
  const trimmed = href.trim();
  if (!/\s/.test(trimmed)) return trimmed;
  return trimmed.replace(/ /g, "%20");
}

/** Chuyển `[link ảnh](url)` → `![](url)` để markdown hiển thị ảnh. */
export function preprocessAiAssistantMarkdown(content: string): string {
  return content.replace(MARKDOWN_LINK_RE, (full, label: string, href: string) => {
    const decodedHref = normalizeAiAssistantImageHref(href.replace(/&amp;/g, "&"));
    if (isAiAssistantImageUrl(decodedHref) || isImageLinkLabel(label)) {
      return `![](${decodedHref})`;
    }
    return full;
  });
}
