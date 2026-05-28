import { cacheDirectory, copyAsync, getInfoAsync } from "expo-file-system/legacy";

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

async function uniqueCachePath(baseDir: string, fileName: string): Promise<string> {
  const safe = safeFileBaseName(fileName);
  let candidate = `${baseDir}${safe}`;
  const info = await getInfoAsync(candidate);
  if (!info.exists) return candidate;
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  candidate = `${baseDir}${stem}_${Date.now()}${ext}`;
  return candidate;
}

/**
 * Chuẩn bị file local trước khi upload.
 * Giữ **tên file gốc** trong cache để multipart / uploadAsync gửi đúng `originalname` lên server
 * (khớp web `File.name`).
 */
export async function prepareLocalFileForUpload(
  input: LocalUploadFileInput,
): Promise<LocalUploadFileOutput> {
  const name = safeFileBaseName(input.name);
  const type = input.mimeType?.trim() || "application/octet-stream";
  const uri = input.uri.trim();

  const baseDir = cacheDirectory;
  if (!baseDir) {
    return { uri, name, type };
  }

  if (uri.startsWith("file://") && uri.startsWith(baseDir)) {
    const base = uri.slice(uri.lastIndexOf("/") + 1);
    if (base === name) {
      return { uri, name, type };
    }
  }

  const dest = await uniqueCachePath(baseDir, name);
  await copyAsync({ from: uri, to: dest });
  return { uri: dest, name, type };
}
