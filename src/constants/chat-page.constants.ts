import type { IMessage } from "@/types/chat.types";
import type { MediaUploadResult } from "@/store/api/mediaApi";

/** Khớp web `chat-page.constants.ts`. */
export const MAX_PENDING_FILES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** MIME DocumentPicker — khớp web `accept` trên input file. */
export const CHAT_DOCUMENT_MIME_TYPES: string[] = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/*",
];

export function roughMaxBytesForMime(mimeType: string): number {
  const t = mimeType.toLowerCase();
  if (t.startsWith("image/")) return MAX_IMAGE_BYTES;
  if (t.startsWith("video/")) return MAX_VIDEO_BYTES;
  return MAX_FILE_BYTES;
}

export function messageTypeFromUploadResult(r: MediaUploadResult): IMessage["type"] {
  if (r.type === "image") return "image";
  if (r.type === "video") return "video";
  return "file";
}
