import { Dimensions, type ViewStyle } from "react-native";

/** Padding ngang FlatList chat (`contentContainerStyle.paddingHorizontal`). */
export const CHAT_LIST_HORIZONTAL_PADDING = 16;

// ── Màu / viền — khớp web Tailwind ─────────────────────────────────────
export const CHAT_MEDIA_SHELL_BORDER = "#B8C9E8";
export const CHAT_MEDIA_SHELL_BORDER_DARK = "rgba(255,255,255,0.15)";
export const CHAT_MEDIA_SHELL_BG = "#FFFFFF";
export const CHAT_MEDIA_SHELL_BG_DARK = "#18181B";
export const CHAT_FILE_FOOTER_BORDER = "#D8E6F8";
export const CHAT_FILE_FOOTER_BG = "#E8F1FC";
export const CHAT_FILE_FOOTER_BG_DARK = "#2A3140";
export const CHAT_FILE_PREVIEW_BG = "#F5F6F8";
export const CHAT_FILE_PREVIEW_BG_DARK = "#09090B";
export const CHAT_IMAGE_PREVIEW_BG = "rgba(0,0,0,0.04)";
export const CHAT_IMAGE_PREVIEW_BG_DARK = "rgba(0,0,0,0.4)";
export const CHAT_VIDEO_PLAYER_BG = "#09090B";
export const CHAT_VIDEO_FOOTER_BG = "rgba(255,255,255,0.92)";
export const CHAT_VIDEO_FOOTER_BG_DARK = "rgba(9,9,11,0.82)";
export const CHAT_VIDEO_FOOTER_BORDER = "rgba(0,0,0,0.05)";
export const CHAT_VIDEO_FOOTER_BORDER_DARK = "rgba(255,255,255,0.10)";

/** Chiều rộng thẻ file — khớp web `min-w-[268px] max-w-[20rem]`. */
export const CHAT_FILE_CARD_WIDTH = 268;

export const CHAT_MEDIA_SHELL_RADIUS = 12;
export const CHAT_MEDIA_ACTION_RADIUS_FILE = 8;
export const CHAT_MEDIA_ACTION_RADIUS_VIDEO = 12;
export const CHAT_MEDIA_CAPTION_RADIUS = 8;

export interface ChatMediaLayout {
  contentWidth: number;
  visualMaxWidth: number;
  fileMaxWidth: number;
  fileMinWidth: number;
  maxMediaHeight: number;
  filePreviewHeight: number;
  filePlaceholderHeight: number;
  videoMinHeight: number;
}

/**
 * Kích thước media mobile — khớp web:
 * ảnh/video `min(96vw,44rem)`, file `min(100%,20rem)` min-w 268px.
 */
export function getChatMediaLayout(windowWidth: number): ChatMediaLayout {
  const contentWidth = Math.max(240, windowWidth - CHAT_LIST_HORIZONTAL_PADDING * 2);
  const scale = Math.min(1, contentWidth / 390);

  const visualMaxWidth = Math.min(Math.round(contentWidth * 0.96), Math.round(704 * scale));

  /** Cố định 268px — khớp web, tránh kéo gần full màn hình trên Expo Go. */
  const fileMaxWidth = CHAT_FILE_CARD_WIDTH;
  const fileMinWidth = CHAT_FILE_CARD_WIDTH;

  const windowHeight = Dimensions.get("window").height;
  const maxMediaHeight = Math.min(Math.round(windowHeight * 0.78), Math.round(640 * scale));

  /** Web: preview ảnh `h-[148px]`, placeholder `h-[132px]`. */
  const filePreviewHeight = 148;
  const filePlaceholderHeight = 132;
  const videoMinHeight = Math.max(168, Math.round(200 * scale));

  return {
    contentWidth,
    visualMaxWidth,
    fileMaxWidth,
    fileMinWidth,
    maxMediaHeight,
    filePreviewHeight,
    filePlaceholderHeight,
    videoMinHeight,
  };
}

export function chatMediaMaxHeight(layout?: ChatMediaLayout): number {
  if (layout) return layout.maxMediaHeight;
  return Math.min(Dimensions.get("window").height * 0.78, 640);
}

/**
 * Kích thước hiển thị theo từng ảnh: giữ tỷ lệ gốc, chỉ thu nhỏ khi vượt max.
 * Không phóng to (không ép full `visualMaxWidth` cho mọi tin).
 */
export function fitMediaInBox(
  maxW: number,
  maxH: number,
  srcW: number,
  srcH: number,
): { width: number; height: number } {
  if (srcW <= 0 || srcH <= 0) {
    return { width: Math.min(96, maxW), height: Math.min(72, maxH) };
  }
  const scale = Math.min(maxW / srcW, maxH / srcH, 1);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

/** Bọc bubble media trong cột chat. */
export function chatMediaBubbleContainStyle(
  layout: ChatMediaLayout,
  kind: "visual" | "file",
): ViewStyle {
  return {
    width: "100%",
    maxWidth: kind === "visual" ? layout.visualMaxWidth : layout.fileMaxWidth,
    minWidth: kind === "file" ? layout.fileMinWidth : 0,
    overflow: "hidden",
  };
}

export function chatMediaShellStyle(isDark: boolean): ViewStyle {
  return {
    width: "100%",
    overflow: "hidden",
    borderRadius: CHAT_MEDIA_SHELL_RADIUS,
    borderWidth: 1,
    borderColor: isDark ? CHAT_MEDIA_SHELL_BORDER_DARK : CHAT_MEDIA_SHELL_BORDER,
    backgroundColor: isDark ? CHAT_MEDIA_SHELL_BG_DARK : CHAT_MEDIA_SHELL_BG,
    shadowColor: "#3B5B8C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  };
}

/** Shell ảnh — bọc đúng kích thước pixel (không kéo full `visualMaxWidth`). */
export function chatImageMessageShellStyle(width: number, isDark: boolean): ViewStyle {
  return {
    width,
    maxWidth: width,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: CHAT_MEDIA_SHELL_RADIUS,
    borderWidth: 1,
    borderColor: isDark ? CHAT_MEDIA_SHELL_BORDER_DARK : CHAT_MEDIA_SHELL_BORDER,
    backgroundColor: isDark ? CHAT_MEDIA_SHELL_BG_DARK : CHAT_MEDIA_SHELL_BG,
    shadowColor: "#3B5B8C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  };
}

/** Shell thẻ file — cố định 268–320px, không `width:100%` (tránh kéo full màn hình). */
export function chatFileMessageShellStyle(isDark: boolean, isOwn: boolean): ViewStyle {
  return {
    width: CHAT_FILE_CARD_WIDTH,
    maxWidth: CHAT_FILE_CARD_WIDTH,
    minWidth: CHAT_FILE_CARD_WIDTH,
    flexShrink: 0,
    alignSelf: isOwn ? "flex-end" : "flex-start",
    overflow: "hidden",
    borderRadius: CHAT_MEDIA_SHELL_RADIUS,
    borderWidth: 1,
    borderColor: isDark ? CHAT_MEDIA_SHELL_BORDER_DARK : CHAT_MEDIA_SHELL_BORDER,
    backgroundColor: isDark ? CHAT_MEDIA_SHELL_BG_DARK : CHAT_MEDIA_SHELL_BG,
    shadowColor: "#3B5B8C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  };
}

/** Caption ảnh/video — khớp web `mt-0.5 px-2.5 py-1.5 rounded-lg`. */
export function chatMediaCaptionStyle(
  isOwn: boolean,
  isDark: boolean,
  maxWidth: number,
): ViewStyle {
  return {
    marginTop: 2,
    width: "100%",
    maxWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CHAT_MEDIA_CAPTION_RADIUS,
    backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)",
  };
}

/** Nút tải / thư mục file — khớp web `rounded-lg border p-2` (32×32, icon 16). */
export function chatMediaFileActionBtnStyle(isDark: boolean): ViewStyle {
  return {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CHAT_MEDIA_ACTION_RADIUS_FILE,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.15)" : "#C5D0E0",
    backgroundColor: isDark ? "#18181B" : "#FFFFFF",
    overflow: "hidden",
  };
}

/** Nút video footer — khớp web `rounded-xl border p-2.5` (36×36). */
export function chatMediaVideoActionBtnStyle(isDark: boolean): ViewStyle {
  return {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CHAT_MEDIA_ACTION_RADIUS_VIDEO,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.10)",
    backgroundColor: isDark ? "#18181B" : "#FFFFFF",
  };
}

/** @deprecated dùng `getChatMediaLayout` */
export function chatMediaCardMaxWidth(windowWidth: number, kind: "file" | "visual"): number {
  const layout = getChatMediaLayout(windowWidth);
  return kind === "visual" ? layout.visualMaxWidth : layout.fileMaxWidth;
}
