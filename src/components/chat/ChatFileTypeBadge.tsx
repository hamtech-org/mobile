import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { chatFileTypeAccent, chatFileTypeLabel } from "@/utils/chatMediaDisplay";

type ChatFileTypeBadgeProps = {
  fileName: string;
  mimeType?: string | null;
  /** `md` khớp thẻ file chat; `sm` cho hàng ghim. */
  size?: "sm" | "md";
};

/** Badge PDF / XLSX / DOC… — dùng `EXT_TYPE_LABEL` trong `chatMediaDisplay`. */
export function ChatFileTypeBadge({
  fileName,
  mimeType,
  size = "md",
}: ChatFileTypeBadgeProps): ReactElement {
  const label = chatFileTypeLabel(fileName, mimeType);
  const accent = chatFileTypeAccent(fileName, mimeType);
  const box = size === "sm" ? styles.boxSm : styles.boxMd;

  return (
    <View style={[box, { backgroundColor: accent }]}>
      <Text style={styles.text}>{label.slice(0, 4)}</Text>
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
  text: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
