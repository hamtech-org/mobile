import type { IMessage } from "@/types/chat.types";
import { tryParseGroupJoinLinkMessage } from "@/utils/groupJoinLinkMessage";

export function isConversationSearchLinkMessage(m: IMessage, preview: string): boolean {
  if (m.type !== "text") return false;
  const raw = (m.content ?? "").trim();
  if (raw.startsWith("{") && tryParseGroupJoinLinkMessage(raw)) return true;
  return /Link mời tham gia/i.test(preview);
}

export type ConversationSearchLeadKind =
  | "image-thumb"
  | "video-icon"
  | "link-icon"
  | "sender-avatar";

export function conversationSearchLeadKind(
  m: Pick<IMessage, "type">,
  linkLike: boolean,
): ConversationSearchLeadKind {
  if (m.type === "image") return "image-thumb";
  if (m.type === "video") return "video-icon";
  if (linkLike) return "link-icon";
  return "sender-avatar";
}

/** Tiêu đề dòng kết quả — không lặp [Ảnh] khi đã có thumbnail. */
export function conversationSearchResultTitle(
  m: Pick<IMessage, "type" | "content">,
  rawPreview: string,
): string {
  const preview = rawPreview.trim();
  const content = (m.content ?? "").trim();

  if (m.type === "image") {
    if (content && !content.startsWith("[")) {
      return content.length > 100 ? `${content.slice(0, 99)}…` : content;
    }
    return "Ảnh";
  }
  if (m.type === "video") {
    if (content && !content.startsWith("[")) {
      return content.length > 100 ? `${content.slice(0, 99)}…` : content;
    }
    return "Video";
  }
  if (/^\[(Ảnh|Video|File|Sticker|Emoji)\]$/i.test(preview)) {
    return preview.replace(/^\[|\]$/g, "");
  }
  return preview || "Tin nhắn";
}

export function conversationSearchResultMeta(senderLabel: string, timeLabel: string): string {
  return [senderLabel, timeLabel].filter(Boolean).join(" · ");
}
