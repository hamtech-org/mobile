import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link2 } from "lucide-react-native";

import { chatListCardStyles } from "@/components/chat/chatListCardStyles";
import { CONVERSATION_GALLERY_THEME } from "@/components/chat/conversationGallery/conversationGalleryTheme";

type ConversationGalleryLinkRowProps = {
  url: string;
  previewLine: string;
  onPress: () => void;
  onLongPress?: () => void;
};

export function ConversationGalleryLinkRow({
  url,
  previewLine,
  onPress,
  onLongPress,
}: ConversationGalleryLinkRowProps): ReactElement {
  const theme = CONVERSATION_GALLERY_THEME.link;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        chatListCardStyles.pressable,
        pressed ? chatListCardStyles.pressablePressed : null,
      ]}
    >
      <View style={[chatListCardStyles.card, styles.row]}>
        <View style={[styles.iconBox, { backgroundColor: theme.softBg }]}>
          <Link2 size={20} color={theme.tint} strokeWidth={2} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.url} numberOfLines={2}>
            {url}
          </Text>
          <Text style={chatListCardStyles.meta} numberOfLines={2}>
            {previewLine}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  url: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0D9488",
    lineHeight: 20,
  },
});
