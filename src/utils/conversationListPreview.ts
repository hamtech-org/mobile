import type { IConversation, MessageType } from "@/types/chat.types";
import { formatCallMessagePreview } from "@/utils/callMessagePreview";
import { formatGroupJoinLinkListPreview } from "@/utils/groupJoinLinkMessage";
import { formatSystemLastMessagePreview } from "@/utils/systemMessage";
import { stripMentionMarkdown } from "@/utils/mentionHelper";

/** Đồng bộ `frontend/src/utils/chatUtils.ts` — preview sidebar / lastMessage. */
function normalizeLastMessagePreview(type: MessageType, content: string): string {
  const t = (content ?? "").trim();
  if (type === "image") {
    if (t === "" || t === "[Ảnh]" || t === "[ ]") return "Hình ảnh";
    return t;
  }
  if (type === "video") {
    if (t === "" || t === "[Video]") return "Video";
    return t;
  }
  if (type === "file") {
    if (t === "" || t === "[File]") return "Tệp tin";
    return t;
  }
  return content ?? "";
}

/** Dòng preview tin cuối trên danh sách hội thoại (direct / group, Bạn vs tên) — khớp web. */
export function formatConversationListLastPreview(
  conv: IConversation,
  currentUserId: string,
): string {
  const lm = conv.lastMessage;
  if (!lm) return "Chưa có tin nhắn";
  const content = lm.content ?? "";

  const formatSystemPreview = (): string | null => {
    if (lm.type !== "system") return null;
    if (typeof content !== "string") return null;
    const raw = content.trim();
    if (!raw) return null;
    return formatSystemLastMessagePreview(
      raw,
      lm.senderId,
      currentUserId,
      lm.senderDisplayName ?? null,
    );
  };

  const systemPreview = formatSystemPreview();
  if (systemPreview) {
    if (systemPreview.startsWith("Bạn ")) {
      return `Bạn: ${systemPreview.slice("Bạn ".length)}`;
    }
    if (conv.type === "group") {
      const senderNameForSysJson = lm.senderDisplayName?.trim() ?? "";
      if (senderNameForSysJson && systemPreview.startsWith(`${senderNameForSysJson} `)) {
        return `${senderNameForSysJson}: ${systemPreview.slice(senderNameForSysJson.length + 1)}`;
      }
    }
    return systemPreview;
  }

  const joinLinkPreview = lm.type === "text" ? formatGroupJoinLinkListPreview(content) : null;

  const previewText = normalizeLastMessagePreview(
    lm.type,
    lm.type === "call" ? formatCallMessagePreview(content) : (joinLinkPreview ?? content),
  );
  let finalPreview = "";
  if (currentUserId && lm.senderId === currentUserId) {
    finalPreview = `Bạn: ${previewText}`;
  } else if (conv.type === "direct") {
    finalPreview = previewText;
  } else {
    const name = lm.senderDisplayName?.trim() || "Thành viên";
    finalPreview = `${name}: ${previewText}`;
  }
  return stripMentionMarkdown(finalPreview);
}

const IMAGE_PLACEHOLDER_LABEL = "Hình ảnh";

function isImagePlaceholderText(s: string): boolean {
  const t = s.trim();
  return t === "Ảnh" || t === IMAGE_PLACEHOLDER_LABEL;
}

/** Tách prefix ("Bạn:", "Tên:") và phần sau icon — đồng bộ web `parseConversationListMediaPreview`. */
export function parseConversationListMediaPreview(
  full: string,
  type: MessageType | undefined,
): { prefix: string; suffix: string } {
  const isMedia = type === "image" || type === "video" || type === "file";
  if (!isMedia) return { prefix: "", suffix: full };

  const videoLabel = "Video";
  const fileLabel = "Tệp tin";

  const mBan = /^Bạn:\s*(.*)$/s.exec(full);
  if (mBan) {
    const rest = mBan[1].trim();
    if (type === "image" && isImagePlaceholderText(rest)) {
      return { prefix: "Bạn:", suffix: IMAGE_PLACEHOLDER_LABEL };
    }
    if (type === "video" && rest === videoLabel) return { prefix: "Bạn:", suffix: videoLabel };
    if (type === "file" && rest === fileLabel) return { prefix: "Bạn:", suffix: fileLabel };
    return { prefix: "Bạn:", suffix: rest };
  }

  const mNamed = /^(.+):\s*(.*)$/s.exec(full);
  if (mNamed) {
    const rest = mNamed[2].trim();
    if (type === "image" && isImagePlaceholderText(rest)) {
      return { prefix: `${mNamed[1]}:`, suffix: IMAGE_PLACEHOLDER_LABEL };
    }
    if (type === "video" && rest === videoLabel) {
      return { prefix: `${mNamed[1]}:`, suffix: videoLabel };
    }
    if (type === "file" && rest === fileLabel) {
      return { prefix: `${mNamed[1]}:`, suffix: fileLabel };
    }
    return { prefix: `${mNamed[1]}:`, suffix: rest };
  }

  if (type === "image" && isImagePlaceholderText(full)) {
    return { prefix: "", suffix: IMAGE_PLACEHOLDER_LABEL };
  }
  if (type === "video" && full.trim() === videoLabel) return { prefix: "", suffix: videoLabel };
  if (type === "file" && full.trim() === fileLabel) return { prefix: "", suffix: fileLabel };
  return { prefix: "", suffix: full };
}
