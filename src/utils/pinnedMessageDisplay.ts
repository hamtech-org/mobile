import type { IMessage } from "@/types/chat.types";
import { chatFileTypeAccent, resolveChatFileBubbleMeta } from "@/utils/chatMediaDisplay";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { formatSystemLastMessagePreview } from "@/utils/systemMessage";
import { normalizeMediaUrl } from "@/utils/url";

export type PinnedMessageKind = "message" | "poll" | "image" | "video" | "file";

/** Màu logo bình chọn — đồng bộ web PollVoteModal (orange-500). */
export const CHAT_POLL_PINNED_ACCENT = "#f97316";

const PINNED_STATIC_ACCENTS: Record<Exclude<PinnedMessageKind, "file" | "poll">, string> = {
  message: "#0068FF",
  image: "#7c3aed",
  video: "#d97706",
};

export function pollQuestionFromPinnedMessage(
  msg: Pick<IMessage, "content" | "type">,
): string | null {
  const raw = String(msg.content ?? "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    const obj = JSON.parse(raw) as { kind?: string; poll?: { question?: string } };
    if (obj?.kind !== "poll_created") return null;
    const q = String(obj?.poll?.question ?? "").trim();
    return q || null;
  } catch {
    return null;
  }
}

export function pinnedMessageKind(msg: Pick<IMessage, "type" | "content">): PinnedMessageKind {
  if (pollQuestionFromPinnedMessage(msg)) return "poll";
  if (msg.type === "image") return "image";
  if (msg.type === "video") return "video";
  if (msg.type === "file") return "file";
  return "message";
}

export function pinnedMessageKindLabel(kind: PinnedMessageKind): string {
  switch (kind) {
    case "poll":
      return "Bình chọn";
    case "image":
      return "Hình ảnh";
    case "video":
      return "Video";
    case "file":
      return "Tệp tin";
    default:
      return "Tin nhắn";
  }
}

/** Tên file cụ thể cho ghim — dùng chung logic thẻ file trong chat. */
export function pinnedChatFileDisplayName(msg: IMessage): string {
  if (msg.type !== "file") return "Tệp tin";
  return resolveChatFileBubbleMeta(msg).fileName;
}

/** Tiêu đề hàng ghim: file → tên file. */
export function pinnedMessageKindTitle(msg: IMessage): string {
  const kind = pinnedMessageKind(msg);
  if (kind === "file") {
    const name = pinnedChatFileDisplayName(msg);
    return name !== "Tệp tin" && name !== "Tệp đính kèm" ? name : pinnedMessageKindLabel(kind);
  }
  return pinnedMessageKindLabel(kind);
}

/** Màu vòng icon — PDF đỏ, Excel xanh, Word xanh dương, poll cam. */
export function pinnedMessageAccent(msg: IMessage): string {
  const kind = pinnedMessageKind(msg);
  if (kind === "poll") return CHAT_POLL_PINNED_ACCENT;
  if (kind === "file") {
    const { fileName, mimeType } = resolveChatFileBubbleMeta(msg);
    return chatFileTypeAccent(fileName, mimeType);
  }
  return PINNED_STATIC_ACCENTS[kind];
}

export function mediaThumbForPinnedRow(msg: IMessage): string | undefined {
  if (msg.type === "image" || msg.type === "video") {
    return normalizeMediaUrl(msg.thumbnailUrl ?? msg.mediaUrl);
  }
  return undefined;
}

/** Một dòng preview cho thẻ tin ghim — không hiển thị JSON thô. */
export function bulletinPinnedPreviewLine(msg: IMessage, viewerUserId: string): string {
  const pollQ = pollQuestionFromPinnedMessage(msg);
  if (pollQ) return pollQ;
  const raw = String(msg.content ?? "").trim();
  if (raw.startsWith("{")) {
    const line = formatSystemLastMessagePreview(
      raw,
      msg.senderId,
      viewerUserId,
      msg.senderDisplayName,
    );
    if (line) return line;
    return "Thông báo nhóm";
  }
  if (msg.type === "file") return pinnedChatFileDisplayName(msg);
  if (msg.type === "image") return "Hình ảnh";
  if (msg.type === "video") return "Video";
  return formatChatPreviewLine(msg, viewerUserId);
}

/** Tiêu đề chính trên thẻ ghim — ưu tiên nội dung cụ thể, tránh lặp với preview. */
export function pinnedBulletinCardTitle(msg: IMessage, viewerUserId: string): string {
  const pollQ = pollQuestionFromPinnedMessage(msg);
  if (pollQ) return pollQ;
  const kind = pinnedMessageKind(msg);
  if (kind === "message") {
    const line = bulletinPinnedPreviewLine(msg, viewerUserId).trim();
    if (line) return line;
  }
  return pinnedMessageKindTitle(msg);
}

export function pinnedBulletinMetaLine(who: string, when: string): string {
  const name = who.trim() || "Thành viên";
  const time = when.trim();
  return time ? `${name} · ${time}` : name;
}

/** Chỉ hiện dòng preview phụ khi còn thông tin khác tiêu đề (vd. tin hệ thống dài). */
export function shouldShowPinnedBulletinPreview(
  kind: PinnedMessageKind,
  title: string,
  preview: string,
): boolean {
  if (kind === "poll" || kind === "file" || kind === "image" || kind === "video") {
    return false;
  }
  const p = preview.trim();
  if (!p) return false;
  const t = title.trim();
  if (p === t) return false;
  if (p === pinnedMessageKindLabel(kind)) return false;
  return kind === "message";
}
