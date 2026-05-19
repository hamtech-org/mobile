/** Đồng bộ web `conversationGalleryTheme.ts`. */
export type ConversationGalleryKind = "media" | "file" | "link";

export const CONVERSATION_GALLERY_KINDS: ConversationGalleryKind[] = ["media", "file", "link"];

export const CONVERSATION_GALLERY_THEME: Record<
  ConversationGalleryKind,
  {
    label: string;
    navLabel: string;
    tint: string;
    softBg: string;
  }
> = {
  media: {
    label: "Ảnh / Video",
    navLabel: "Ảnh/Video",
    tint: "#0068FF",
    softBg: "rgba(0, 104, 255, 0.1)",
  },
  file: {
    label: "File",
    navLabel: "File",
    tint: "#5C6BC0",
    softBg: "rgba(92, 107, 192, 0.12)",
  },
  link: {
    label: "Link",
    navLabel: "Link",
    tint: "#0068FF",
    softBg: "rgba(0, 104, 255, 0.08)",
  },
};
