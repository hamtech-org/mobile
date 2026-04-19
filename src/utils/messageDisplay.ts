import type { MessageType } from "@/types/chat.types";

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
      String(o.name ?? o.address ?? o.title ?? nested?.name ?? nested?.address ?? "Vị trí").trim() || "Vị trí";
    return { title, lat, lng };
  } catch {
    return null;
  }
}

export function mapsUrlForLatLng(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
