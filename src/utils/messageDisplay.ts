import type { IMessage, MessageType } from "@/types/chat.types";
import { tryParseGroupJoinLinkMessage } from "@/utils/groupJoinLinkMessage";
import { formatSystemLastMessagePreview, preprocessSystemPlainText } from "@/utils/systemMessage";
import { stripMentionMarkdown } from "@/utils/mentionHelper";

/** Nhãn ngắn cho reply preview / placeholder theo loại tin. */
export function getMessageTypeLabel(type: MessageType | string | undefined): string {
  switch (type) {
    case "image":
      return "[Ảnh]";
    case "video":
      return "[Video]";
    case "file":
      return "[File]";
    case "sticker":
      return "[Sticker]";
    case "emoji":
      return "[Emoji]";
    case "location":
      return "[Vị trí]";
    case "poll":
      return "[Bình chọn]";
    case "schedule":
      return "[Lịch]";
    case "call":
      return "[Cuộc gọi]";
    case "system":
      return "[Thông báo]";
    default:
      return "";
  }
}

export interface ParsedLocation {
  title: string;
  lat: number;
  lng: number;
}

/** Parse payload location (JSON) nếu có lat/lng. */
export function parseLocationPayload(content: string): ParsedLocation | null {
  const t = content.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const nested = o.location as Record<string, unknown> | undefined;
    const lat = Number(o.lat ?? o.latitude ?? nested?.lat ?? nested?.latitude);
    const lng = Number(o.lng ?? o.longitude ?? nested?.lng ?? nested?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const title =
      String(
        o.name ?? o.address ?? o.title ?? nested?.name ?? nested?.address ?? "Vị trí",
      ).trim() || "Vị trí";
    return { title, lat, lng };
  } catch {
    return null;
  }
}

export function mapsUrlForLatLng(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

const PREVIEW_MAX = 220;

/**
 * Một dòng preview thân thiện (danh sách chat, reply strip) — không để lộ JSON thô.
 */
export function formatChatPreviewLine(
  msg: Pick<IMessage, "type" | "content" | "senderId" | "senderDisplayName" | "isRecalled">,
  currentUserId: string,
): string {
  if (msg.isRecalled) return "Tin nhắn đã được thu hồi";
  const raw = (msg.content ?? "").trim();
  if (msg.type === "system") {
    const sys = formatSystemLastMessagePreview(
      raw,
      msg.senderId,
      currentUserId,
      msg.senderDisplayName,
    );
    if (sys) return truncatePreview(sys, PREVIEW_MAX);
    const plain = preprocessSystemPlainText(
      {
        content: raw,
        senderId: msg.senderId,
        senderDisplayName: msg.senderDisplayName,
        type: "system",
      } as IMessage,
      { isOwn: msg.senderId === currentUserId, currentUserId },
    );
    return plain ? truncatePreview(plain, PREVIEW_MAX) : getMessageTypeLabel("system");
  }
  if (raw.startsWith("{")) {
    const joinLink = tryParseGroupJoinLinkMessage(raw);
    if (joinLink) {
      return truncatePreview(`Link mời tham gia nhóm: ${joinLink.groupName}`, PREVIEW_MAX);
    }
    const sys = formatSystemLastMessagePreview(
      raw,
      msg.senderId,
      currentUserId,
      msg.senderDisplayName,
    );
    if (sys) return truncatePreview(sys, PREVIEW_MAX);
    /** JSON không parse được hoặc lạ — không hiển thị chuỗi JSON thô (đồng bộ web). */
    return "Thông báo nhóm";
  }
  if (!raw) return getMessageTypeLabel(msg.type) || "Tin nhắn";
  return truncatePreview(stripMentionMarkdown(raw), PREVIEW_MAX);
}

export function truncatePreview(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
