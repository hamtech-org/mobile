import { cacheDirectory, copyAsync } from "expo-file-system/legacy";

export interface LocalUploadFileInput {
  uri: string;
  name: string;
  mimeType: string;
}

export interface LocalUploadFileOutput {
  uri: string;
  name: string;
  type: string;
}

function safeFileBaseName(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim();
  const n = base || "upload.bin";
  return n.length > 180 ? n.slice(0, 180) : n;
}

function isMediaUriSkippableCopy(uri: string, mimeType: string): boolean {
  if (!uri.startsWith("file://")) return false;
  const t = mimeType.toLowerCase();
  return (
    t.startsWith("image/") || t.startsWith("video/") || t.startsWith("audio/")
  );
}

/**
 * Chuẩn bị file local trước khi upload.
 * - `content://` hoặc file tài liệu: copy sang `file://` trong cache (ổn định cho native upload).
 * - Ảnh/video/audio đã `file://` (máy ảnh, thư viện): giữ nguyên, tránh copy file lớn hai lần.
 */
export async function prepareLocalFileForUpload(
  input: LocalUploadFileInput,
): Promise<LocalUploadFileOutput> {
  const name = safeFileBaseName(input.name);
  const type = input.mimeType?.trim() || "application/octet-stream";
  const uri = input.uri.trim();

  if (isMediaUriSkippableCopy(uri, type)) {
    return { uri, name, type };
  }

  const baseDir = cacheDirectory;
  if (!baseDir) {
    return { uri, name, type };
  }

  const extFromName = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  const cleaned = extFromName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  const ext =
    cleaned ||
    (type.startsWith("image/")
      ? "jpg"
      : type.startsWith("video/")
        ? "mp4"
        : "bin");

  const dest = `${baseDir}upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  await copyAsync({ from: uri, to: dest });
  return { uri: dest, name, type };
}
