import type { MediaUploadType } from "@/store/api/mediaApi";

/** Suy ra MIME / tên file từ asset ImagePicker (tránh video bị gán `image/jpeg`). */
export function pendingAttachmentFromImagePickerAsset(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  type?: "image" | "video" | "livePhoto" | "pairedVideo" | null;
}): {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
} {
  const isVideo = asset.type === "video" || asset.type === "pairedVideo";
  const mime = asset.mimeType?.trim() || (isVideo ? "video/mp4" : "image/jpeg");
  const extFromMime = mime.includes("/") ? (mime.split("/").pop() ?? "") : "";
  const defaultName = isVideo
    ? `video_${Date.now()}.${extFromMime === "quicktime" ? "mov" : "mp4"}`
    : `photo_${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    name: asset.fileName?.trim() || defaultName,
    mimeType: mime,
    size: asset.fileSize,
  };
}

export function chatMessageTypeFromMime(mimeType: string): "image" | "video" | "file" {
  const t = mimeType.toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  return "file";
}

export function mediaUploadTypeFromMime(mimeType: string): MediaUploadType {
  const t = mimeType.toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  return "file";
}
