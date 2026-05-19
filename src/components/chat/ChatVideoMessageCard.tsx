import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CircleCheck, Download, FolderOpen, Maximize2, Video } from "lucide-react-native";

import { ChatJumpHighlightWrap } from "@/components/chat/ChatJumpHighlight";
import { ChatMediaLongPressLayer } from "@/components/chat/ChatMediaLongPressLayer";
import {
  chatMediaShellStyle,
  chatMediaVideoActionBtnStyle,
  CHAT_MEDIA_SHELL_RADIUS,
  CHAT_VIDEO_FOOTER_BG,
  CHAT_VIDEO_FOOTER_BG_DARK,
  CHAT_VIDEO_FOOTER_BORDER,
  CHAT_VIDEO_FOOTER_BORDER_DARK,
  CHAT_VIDEO_PLAYER_BG,
  type ChatMediaLayout,
} from "@/components/chat/chatMediaShell";

export interface ChatVideoMessageCardProps {
  layout: ChatMediaLayout;
  isDark?: boolean;
  hasCaptionBelow?: boolean;
  isJumpHighlighted?: boolean;
  title: string;
  metaLine?: string | null;
  mediaSavedOnDevice?: boolean;
  videoPlayer: ReactNode;
  /** Chạm vùng video → MessageActionSheet. */
  onPress: () => void;
  onFullscreen: () => void;
  onFolderHint: () => void;
  onDownload: () => void;
}

/** Video — khớp web: player 16:9 + footer trắng/violet + nút rounded-xl. */
export function ChatVideoMessageCard({
  layout,
  isDark = false,
  hasCaptionBelow = false,
  isJumpHighlighted = false,
  title,
  metaLine,
  mediaSavedOnDevice = false,
  videoPlayer,
  onPress,
  onFullscreen,
  onFolderHint,
  onDownload,
}: ChatVideoMessageCardProps) {
  const footer = isDark ? FOOTER.dark : FOOTER.light;
  const videoActionBtn = chatMediaVideoActionBtnStyle(isDark);

  return (
    <ChatJumpHighlightWrap
      active={isJumpHighlighted}
      borderRadius={CHAT_MEDIA_SHELL_RADIUS}
      style={[chatMediaShellStyle(isDark), hasCaptionBelow && styles.withCaptionBelow]}
    >
      <View
        style={[
          styles.playerWrap,
          { minHeight: layout.videoMinHeight, maxHeight: layout.maxMediaHeight },
        ]}
      >
        {videoPlayer}
        <ChatMediaLongPressLayer
          fill
          onPress={onPress}
          onLongPress={onPress}
          accessibilityLabel="Tùy chọn tin nhắn video"
        />
        <Pressable
          onPress={onFullscreen}
          style={styles.fullscreenBtn}
          accessibilityLabel="Xem video toàn màn hình"
        >
          <Maximize2 size={14} color="#fff" strokeWidth={2} />
          <Text style={styles.fullscreenLabel}>Toàn màn hình</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: isDark ? CHAT_VIDEO_FOOTER_BG_DARK : CHAT_VIDEO_FOOTER_BG,
            borderTopColor: isDark ? CHAT_VIDEO_FOOTER_BORDER_DARK : CHAT_VIDEO_FOOTER_BORDER,
          },
        ]}
      >
        <ChatMediaLongPressLayer
          onPress={onPress}
          onLongPress={onPress}
          style={styles.footerMain}
          accessibilityLabel="Tùy chọn tin nhắn video"
        >
          <View style={[styles.iconBox, { backgroundColor: footer.iconBg }]}>
            <Video size={20} color={footer.iconColor} strokeWidth={2} />
          </View>
          <View style={styles.metaCol}>
            <Text style={[styles.title, { color: footer.title }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.metaRow}>
              {metaLine ? (
                <Text style={[styles.meta, { color: footer.meta }]}>{metaLine}</Text>
              ) : null}
              {mediaSavedOnDevice ? (
                <View style={styles.savedRow}>
                  <CircleCheck size={14} color="#059669" strokeWidth={2} />
                  <Text style={styles.savedText}>Đã có trên máy</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ChatMediaLongPressLayer>
        <View style={styles.actionRail}>
          {mediaSavedOnDevice ? (
            <Pressable
              onPress={onFolderHint}
              style={({ pressed }) => [videoActionBtn, pressed && styles.btnPressed]}
              accessibilityLabel="Gợi ý thư mục tải xuống"
            >
              <FolderOpen size={16} color={footer.actionIcon} strokeWidth={2} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onDownload}
            style={({ pressed }) => [videoActionBtn, pressed && styles.btnPressed]}
            accessibilityLabel="Tải video xuống"
          >
            <Download size={16} color={footer.actionIcon} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </ChatJumpHighlightWrap>
  );
}

const FOOTER = {
  light: {
    iconBg: "#EDE9FE",
    iconColor: "#7C3AED",
    title: "#1C1E21",
    meta: "#65676B",
    actionIcon: "#1C1E21",
  },
  dark: {
    iconBg: "rgba(76,29,149,0.4)",
    iconColor: "#A78BFA",
    title: "#E4E6EB",
    meta: "#B0B3B8",
    actionIcon: "#E4E6EB",
  },
} as const;

const styles = StyleSheet.create({
  withCaptionBelow: {
    marginBottom: 6,
  },
  playerWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: CHAT_VIDEO_PLAYER_BG,
    overflow: "hidden",
  },
  fullscreenBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fullscreenLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    marginRight: 8,
  },
  iconBox: {
    borderRadius: 8,
    padding: 8,
  },
  metaCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  savedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#059669",
  },
  actionRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 0,
    alignSelf: "center",
  },
  btnPressed: {
    opacity: 0.85,
  },
});
