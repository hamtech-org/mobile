import type { ReactElement, ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ChatJumpHighlightWrap } from "@/components/chat/ChatJumpHighlight";
import {
  ChatFileAttachmentCard,
  ChatFilePreviewPlaceholder,
} from "@/components/chat/ChatFileAttachmentCard";
import {
  chatFileMessageShellStyle,
  CHAT_FILE_CARD_WIDTH,
  CHAT_FILE_PREVIEW_BG,
  CHAT_FILE_PREVIEW_BG_DARK,
  CHAT_MEDIA_SHELL_BG,
  CHAT_MEDIA_SHELL_BG_DARK,
  CHAT_MEDIA_SHELL_RADIUS,
  type ChatMediaLayout,
} from "@/components/chat/chatMediaShell";

export interface ChatFileMessageBubbleProps {
  layout: ChatMediaLayout;
  fileName: string;
  fileSizeLabel: string | null;
  mimeType?: string | null;
  previewUri?: string | null;
  caption: string | null;
  mediaSavedOnDevice?: boolean;
  isOwn?: boolean;
  isDark?: boolean;
  isJumpHighlighted?: boolean;
  header?: ReactNode;
  /** Chạm thẻ → MessageActionSheet. */
  onShowActions: () => void;
  onDownload: () => void;
  onFolderHint: () => void;
  renderCaption?: (text: string) => ReactElement;
}

/**
 * Thẻ file trong chat — 1:1 web `ChatFileMessageCard` (268px, preview + footer xanh).
 * Chỉ dùng StyleSheet (không className) để NativeWind không ghi đè trên Expo Go.
 */
export function ChatFileMessageBubble({
  layout,
  fileName,
  fileSizeLabel,
  mimeType,
  previewUri,
  caption,
  mediaSavedOnDevice = false,
  isOwn = false,
  isDark = false,
  isJumpHighlighted = false,
  header,
  onShowActions,
  onDownload,
  onFolderHint,
  renderCaption,
}: ChatFileMessageBubbleProps) {
  const hasCaption = Boolean(caption?.trim());
  const hasPreview = Boolean(previewUri?.trim());
  const shellBg = isDark ? CHAT_MEDIA_SHELL_BG_DARK : CHAT_MEDIA_SHELL_BG;

  return (
    <ChatJumpHighlightWrap
      active={isJumpHighlighted}
      borderRadius={CHAT_MEDIA_SHELL_RADIUS}
      style={chatFileMessageShellStyle(isDark, isOwn)}
    >
      <Pressable
        onLongPress={onShowActions}
        delayLongPress={300}
        style={styles.pressableFill}
        accessibilityLabel="Tùy chọn tin nhắn file"
      >
        {header ? (
          <View style={[styles.header, { backgroundColor: shellBg }]}>{header}</View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onShowActions}
          accessibilityLabel="Tùy chọn tin nhắn file"
        >
          {hasPreview ? (
            <Image
              source={{ uri: previewUri! }}
              style={[
                styles.previewImage,
                {
                  height: layout.filePreviewHeight,
                  backgroundColor: isDark ? CHAT_FILE_PREVIEW_BG_DARK : CHAT_FILE_PREVIEW_BG,
                },
              ]}
              resizeMode="cover"
            />
          ) : (
            <ChatFilePreviewPlaceholder isDark={isDark} height={layout.filePlaceholderHeight} />
          )}
        </TouchableOpacity>

        <ChatFileAttachmentCard
          fileName={fileName}
          fileSizeLabel={fileSizeLabel}
          mimeType={mimeType}
          mediaSavedOnDevice={mediaSavedOnDevice}
          isDark={isDark}
          onOpen={onShowActions}
          onDownload={onDownload}
          onFolderHint={onFolderHint}
        />

        {hasCaption ? (
          <View
            style={[
              styles.captionBlock,
              {
                backgroundColor: shellBg,
                borderTopColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <View style={styles.captionInner}>
              {renderCaption ? (
                renderCaption(caption!.trim())
              ) : (
                <Text style={[styles.captionText, { color: isDark ? "#E4E6EB" : "#1C1E21" }]}>
                  {caption!.trim()}
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </Pressable>
    </ChatJumpHighlightWrap>
  );
}

const styles = StyleSheet.create({
  pressableFill: {
    width: CHAT_FILE_CARD_WIDTH,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    width: CHAT_FILE_CARD_WIDTH,
  },
  previewImage: {
    width: CHAT_FILE_CARD_WIDTH,
  },
  captionBlock: {
    width: CHAT_FILE_CARD_WIDTH,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captionInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  captionText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
