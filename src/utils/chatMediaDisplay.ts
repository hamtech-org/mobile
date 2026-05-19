import type { ChatMediaLightboxState } from "@/components/chat/ChatMediaLightbox";
import type { IMessage } from "@/types/chat.types";
import { resolveChatMediaDownloadUrl } from "@/utils/chatMediaDownload";
import { normalizeMediaUrl } from "@/utils/url";

/** Ưu tiên ảnh gốc; HEIC/HEIF dùng thumbnail JPEG (khớp web `imageDisplaySrc`). */
export function chatImageDisplayUrl(msg: IMessage): string | null {
  const full = (msg.mediaUrl ?? "").trim();
  const thumb = (msg.thumbnailUrl ?? "").trim();
  const mime = (msg.mediaType ?? "").toLowerCase();
  if (!full && !thumb) return null;
  if (mime.includes("heic") || mime.includes("heif")) {
    const src = thumb || full;
    return normalizeMediaUrl(src) ?? src;
  }
  const pick = full || thumb;
  return pick ? (normalizeMediaUrl(pick) ?? pick) : null;
}

export function chatVideoPlayUrl(msg: IMessage): string | null {
  const raw = (msg.mediaUrl ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("file:") || raw.startsWith("content:")) return raw;
  return normalizeMediaUrl(raw) ?? raw;
}

/** Ảnh thumbnail / preview trang đầu (Zalo) cho tin file. */
export function chatFilePreviewUrl(msg: IMessage): string | null {
  const thumb = (msg.thumbnailUrl ?? "").trim();
  if (thumb) {
    if (thumb.startsWith("file:") || thumb.startsWith("content:")) return thumb;
    return normalizeMediaUrl(thumb) ?? thumb;
  }
  const mime = normalizeChatMediaMime(msg.mediaType, msg.type);
  if (mime?.startsWith("image/")) return chatImageDisplayUrl(msg);
  return null;
}

function fileExtension(fileName: string): string {
  const base = fileName.trim();
  if (!base.includes(".")) return "";
  return (base.split(".").pop() ?? "").toUpperCase();
}

/** MIME hợp lệ trên message (loại bỏ `file` / `image` placeholder). */
export function normalizeChatMediaMime(
  mediaType?: string | null,
  messageType?: string | null,
): string | null {
  const raw = (mediaType ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("/")) return raw;
  if (raw === "file" || raw === "image" || raw === "video" || raw === "audio") return null;
  if (messageType && raw === messageType) return null;
  return raw;
}

const EXT_TYPE_LABEL: Record<string, string> = {
  PDF: "PDF",
  DOC: "DOC",
  DOCX: "DOCX",
  XLS: "XLS",
  XLSX: "XLSX",
  PPT: "PPT",
  PPTX: "PPTX",
  ZIP: "ZIP",
  RAR: "RAR",
  "7Z": "7Z",
  TXT: "TXT",
  CSV: "CSV",
  MP3: "MP3",
  WAV: "WAV",
  M4A: "M4A",
};

/** Nhãn loại file: PDF, XLSX, … — khớp web `chatFileDisplay.ts`. */
export function chatFileTypeLabel(fileName: string, mimeType?: string | null): string {
  const ext = fileExtension(fileName);
  if (ext && EXT_TYPE_LABEL[ext]) return EXT_TYPE_LABEL[ext];
  if (ext && ext.length <= 8) return ext;

  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("pdf")) return "PDF";
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("sheet")) return "XLSX";
  if (m.includes("word") || m.includes("msword") || m.includes("document")) return "DOC";
  if (m.includes("presentation") || m.includes("powerpoint")) return "PPT";
  if (m.includes("zip") && !m.includes("gzip")) return "ZIP";
  if (m.includes("rar")) return "RAR";
  if (m.startsWith("audio/")) return "MP3";
  return "FILE";
}

/** Màu badge icon loại file (Zalo). */
export function chatFileTypeAccent(fileName: string, mimeType?: string | null): string {
  const label = chatFileTypeLabel(fileName, mimeType);
  if (label === "PDF") return "#E53935";
  if (label === "XLSX" || label === "XLS" || label === "CSV") return "#2E7D32";
  if (label === "DOC" || label === "DOCX") return "#1967D2";
  if (label === "PPT" || label === "PPTX") return "#E65100";
  if (label === "ZIP" || label === "RAR" || label === "7Z") return "#F9A825";
  if (label === "MP3" || label === "WAV" || label === "M4A") return "#6A1B9A";
  return "#5C6BC0";
}

function inferFileNameFromMime(mime: string | null): string | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.includes("pdf")) return "document.pdf";
  if (m.includes("spreadsheet") || m.includes("excel")) return "spreadsheet.xlsx";
  if (m.includes("word")) return "document.docx";
  if (m.includes("presentation") || m.includes("powerpoint")) return "presentation.pptx";
  if (m.includes("zip")) return "archive.zip";
  if (m.includes("rar")) return "archive.rar";
  if (m.startsWith("audio/")) return "audio.mp3";
  return null;
}

/** Tên file do mobile upload tạm (cache) — không dùng làm tên hiển thị. */
export function isGeneratedUploadCacheName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  return /^upload_\d+_[a-z0-9]+\.[a-z0-9]+$/i.test(n);
}

/** Sửa tên file UTF-8 bị hiển thị sai (Latin-1) — vd. `Nguyá»n` → `Nguyễn`. */
export function repairUtf8Mojibake(text: string): string {
  const raw = text.trim();
  if (!raw || !/[ÃÂÄÆÐÑØÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/.test(raw)) {
    return raw;
  }
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i) & 0xff;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return raw;
  }
}

export function pickMediaOriginalName(
  serverName?: string | null,
  clientName?: string | null,
): string | null {
  const s = repairUtf8Mojibake(serverName?.trim() ?? "");
  const c = repairUtf8Mojibake(clientName?.trim() ?? "");
  if (c && (!s || isGeneratedUploadCacheName(s))) return c;
  return s || c || null;
}

/** Metadata hiển thị thẻ file — một nguồn cho ChatBubble / GroupManage. */
export function resolveChatFileBubbleMeta(msg: IMessage): {
  fileName: string;
  mimeType: string | null;
  typeLabel: string;
  accent: string;
} {
  const mimeType = normalizeChatMediaMime(msg.mediaType, msg.type);
  const rawName = pickMediaOriginalName(msg.mediaOriginalName, null);
  const fileName = rawName || inferFileNameFromMime(mimeType) || "Tệp đính kèm";
  const typeLabel = chatFileTypeLabel(fileName, mimeType);
  const accent = chatFileTypeAccent(fileName, mimeType);
  return { fileName, mimeType, typeLabel, accent };
}

/** Gộp metadata file khi merge API + socket / optimistic + server. */
export function mergeChatFileMessageFields(
  primary: IMessage,
  fallback?: IMessage | null,
): IMessage {
  if (!fallback) return primary;
  if (primary.type !== "file" && fallback.type !== "file") return primary;

  const mime =
    normalizeChatMediaMime(primary.mediaType, primary.type) ??
    normalizeChatMediaMime(fallback.mediaType, fallback.type);

  const mediaOriginalName = pickMediaOriginalName(
    primary.mediaOriginalName,
    fallback.mediaOriginalName,
  );

  return {
    ...primary,
    mediaType: mime ?? primary.mediaType ?? fallback.mediaType,
    mediaOriginalName,
    mediaSize:
      typeof primary.mediaSize === "number" && primary.mediaSize > 0
        ? primary.mediaSize
        : fallback.mediaSize,
    thumbnailUrl: primary.thumbnailUrl ?? fallback.thumbnailUrl,
  };
}

/** URL ổn định để tải (refresh CDN qua API). */
export function chatMediaDownloadUrl(msg: IMessage): string {
  const raw = (msg.mediaUrl ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("file:") || raw.startsWith("content:")) return raw;
  return resolveChatMediaDownloadUrl(raw);
}

/** Trạng thái lightbox từ tin ảnh/video (dùng sau khi chọn «Xem» trong MessageActionSheet). */
export function getChatMediaLightboxStateFromMessage(msg: IMessage): ChatMediaLightboxState {
  if (msg.type === "image" || msg.type === "sticker") {
    const uri = chatImageDisplayUrl(msg);
    if (!uri) return null;
    return {
      kind: "image",
      uri,
      filename: chatMediaDownloadFilename(msg, msg.type === "sticker" ? "sticker" : "image"),
    };
  }
  if (msg.type === "video") {
    const uri = chatVideoPlayUrl(msg);
    if (!uri) return null;
    return {
      kind: "video",
      uri,
      filename: chatMediaDownloadFilename(msg, "video"),
    };
  }
  return null;
}

export function chatMediaDownloadFilename(msg: IMessage, fallback: string): string {
  const { fileName } = resolveChatFileBubbleMeta(msg);
  if (fileName && fileName !== "Tệp đính kèm") return fileName;
  const ext =
    msg.type === "video"
      ? "mp4"
      : msg.type === "image" || msg.type === "sticker"
        ? "jpg"
        : msg.mediaType?.includes("/")
          ? (msg.mediaType.split("/").pop() ?? "bin")
          : "bin";
  return `${fallback}.${ext}`;
}
