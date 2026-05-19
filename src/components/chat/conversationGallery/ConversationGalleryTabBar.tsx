import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConversationGalleryIcon } from "@/components/chat/conversationGallery/ConversationGalleryIcon";
import {
  CONVERSATION_GALLERY_KINDS,
  CONVERSATION_GALLERY_THEME,
  type ConversationGalleryKind,
} from "@/components/chat/conversationGallery/conversationGalleryTheme";

type ConversationGalleryTabBarProps = {
  active: ConversationGalleryKind;
  onChange: (kind: ConversationGalleryKind) => void;
};

export function ConversationGalleryTabBar({
  active,
  onChange,
}: ConversationGalleryTabBarProps): ReactElement {
  return (
    <View style={styles.wrap}>
      {CONVERSATION_GALLERY_KINDS.map((kind) => {
        const theme = CONVERSATION_GALLERY_THEME[kind];
        const isActive = active === kind;
        return (
          <Pressable
            key={kind}
            onPress={() => onChange(kind)}
            style={[
              styles.tab,
              isActive ? { backgroundColor: theme.tint, borderColor: theme.tint } : null,
            ]}
          >
            <ConversationGalleryIcon
              kind={kind}
              color={isActive ? "#FFFFFF" : theme.tint}
              size={14}
            />
            <Text
              style={[styles.tabText, isActive ? styles.tabTextActive : { color: theme.tint }]}
              numberOfLines={1}
            >
              {theme.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
});
