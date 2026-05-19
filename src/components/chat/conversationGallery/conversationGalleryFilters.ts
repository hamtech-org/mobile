import type { ConversationGalleryKind } from "@/components/chat/conversationGallery/conversationGalleryTheme";

type GalleryMessageLike = {
  type: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isRecalled?: boolean;
  isDeleted?: boolean;
};

function isRecalledOrDeleted(m: GalleryMessageLike): boolean {
  return Boolean(m.isRecalled || m.isDeleted);
}

function mime(m: GalleryMessageLike): string {
  return (m.mediaType ?? "").toLowerCase();
}

export function isGalleryMediaMessage(m: GalleryMessageLike): boolean {
  if (isRecalledOrDeleted(m)) return false;
  if (m.type === "sticker" || m.type === "emoji") return false;
  if (m.type === "image" || m.type === "video") return true;
  const mt = mime(m);
  return Boolean(m.mediaUrl && (mt.startsWith("image/") || mt.startsWith("video/")));
}

export function isGalleryFileMessage(m: GalleryMessageLike): boolean {
  if (isRecalledOrDeleted(m)) return false;
  if (m.type === "file") return true;
  const mt = mime(m);
  if (!m.mediaUrl || !mt) return false;
  if (mt.startsWith("image/") || mt.startsWith("video/")) return false;
  return true;
}

function systemJson(content: string): boolean {
  const t = content.trim();
  if (!t.startsWith("{")) return false;
  try {
    const o = JSON.parse(t) as { kind?: string };
    return Boolean(o && typeof o === "object" && typeof o.kind === "string");
  } catch {
    return false;
  }
}

export function isGalleryLinkMessage(m: GalleryMessageLike): boolean {
  if (isRecalledOrDeleted(m)) return false;
  if (m.type !== "text") return false;
  const c = (m.content ?? "").trim();
  if (!c || systemJson(c)) return false;
  return /^https?:\/\//i.test(c) || /https?:\/\/[^\s<>"']+/i.test(c);
}

export function firstUrlFromMessageContent(content: string): string | null {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) return line.slice(0, 800);
  }
  const match = content.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].slice(0, 800) : null;
}

export function matchesGalleryCategory(
  m: GalleryMessageLike,
  category: ConversationGalleryKind,
): boolean {
  if (category === "media") return isGalleryMediaMessage(m);
  if (category === "file") return isGalleryFileMessage(m);
  return isGalleryLinkMessage(m);
}
