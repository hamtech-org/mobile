import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChatFileTypeBadge } from "@/components/chat/ChatFileTypeBadge";
import { chatListCardStyles } from "@/components/chat/chatListCardStyles";

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
      style={({ pressed }) => [
        chatListCardStyles.pressable,
        pressed ? chatListCardStyles.pressablePressed : null,
      ]}
    >
      <View style={[chatListCardStyles.card, styles.row]}>
        <ChatFileTypeBadge fileName={fileName} mimeType={mimeType} size="list" />
        <View style={styles.textCol}>
          <Text style={chatListCardStyles.title} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={chatListCardStyles.meta} numberOfLines={1}>
            {metaLine}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    marginLeft: 12,
  },
});
