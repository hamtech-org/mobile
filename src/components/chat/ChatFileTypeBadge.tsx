import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { chatFileTypeAccent, chatFileTypeLabel } from "@/utils/chatMediaDisplay";

type ChatFileTypeBadgeProps = {
  fileName: string;
  mimeType?: string | null;
  /** `md` khớp thẻ file chat; `sm` cho hàng ghim; `list` cho danh sách file quản lý nhóm; `lg` giữ tương thích cũ. */
  size?: "sm" | "md" | "list" | "lg";
};

/** Badge PDF / XLSX / DOC… — dùng `EXT_TYPE_LABEL` trong `chatMediaDisplay`. */
export function ChatFileTypeBadge({
  fileName,
  mimeType,
  size = "md",
}: ChatFileTypeBadgeProps): ReactElement {
  const label = chatFileTypeLabel(fileName, mimeType);
  const accent = chatFileTypeAccent(fileName, mimeType);
  const box =
    size === "sm"
      ? styles.boxSm
      : size === "list"
        ? styles.boxList
        : size === "lg"
          ? styles.boxLg
          : styles.boxMd;

  const textStyle = size === "list" || size === "lg" ? styles.textList : styles.textMd;

  return (
    <View style={[box, { backgroundColor: accent }]}>
      <Text style={textStyle}>{label.slice(0, 4)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boxMd: {
    width: 36,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxSm: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxList: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxLg: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textMd: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  textList: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
