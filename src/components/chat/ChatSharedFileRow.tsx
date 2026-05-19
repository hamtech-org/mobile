import type { ReactElement } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ChatFileTypeBadge } from "@/components/chat/ChatFileTypeBadge";

export type ChatSharedFileRowProps = {
  fileName: string;
  mimeType?: string | null;
  metaLine: string;
  onPress: () => void;
};

/** Hàng file trong danh sách chia sẻ — card ngang, khớp mẫu «File» quản lý nhóm. */
export function ChatSharedFileRow({
  fileName,
  mimeType,
  metaLine,
  onPress,
}: ChatSharedFileRowProps): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressablePressed : null]}
    >
      <View style={styles.card}>
        <ChatFileTypeBadge fileName={fileName} mimeType={mimeType} size="list" />
        <View style={styles.textCol}>
          <Text style={styles.name} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
  },
  pressablePressed: {
    opacity: 0.92,
  },
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        // Không dùng elevation — dễ che mất border trên Android.
      },
    }),
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#202124",
    lineHeight: 22,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "400",
    color: "#70757A",
    lineHeight: 18,
  },
});
