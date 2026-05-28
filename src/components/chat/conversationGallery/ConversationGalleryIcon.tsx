import type { ReactElement } from "react";
import { FileText, Image as ImageIcon, Link2 } from "lucide-react-native";

import type { ConversationGalleryKind } from "@/components/chat/conversationGallery/conversationGalleryTheme";

type ConversationGalleryIconProps = {
  kind: ConversationGalleryKind;
  color: string;
  size?: number;
};

export function ConversationGalleryIcon({
  kind,
  color,
  size = 18,
}: ConversationGalleryIconProps): ReactElement {
  if (kind === "media") return <ImageIcon size={size} color={color} strokeWidth={2} />;
  if (kind === "file") return <FileText size={size} color={color} strokeWidth={2} />;
  return <Link2 size={size} color={color} strokeWidth={2} />;
}
