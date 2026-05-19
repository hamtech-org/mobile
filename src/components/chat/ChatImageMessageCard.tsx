import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  chatImageMessageShellStyle,
  chatMediaMaxHeight,
  fitMediaInBox,
  CHAT_IMAGE_PREVIEW_BG,
  CHAT_IMAGE_PREVIEW_BG_DARK,
  type ChatMediaLayout,
} from "@/components/chat/chatMediaShell";

export interface ChatImageMessageCardProps {
  uri: string;
  layout: ChatMediaLayout;
  isDark?: boolean;
  hasCaptionBelow?: boolean;
  /** Chạm → MessageActionSheet (cảm xúc, thu hồi, …). */
  onPress: () => void;
}

/** Ảnh — khớp web: `object-contain`, tôn EXIF (expo-image), không dùng `Image.getSize`. */
export function ChatImageMessageCard({
  uri,
  layout,
  isDark = false,
  hasCaptionBelow = false,
  onPress,
}: ChatImageMessageCardProps) {
  const maxH = chatMediaMaxHeight(layout);
  const maxW = layout.visualMaxWidth;
  const previewBg = isDark ? CHAT_IMAGE_PREVIEW_BG_DARK : CHAT_IMAGE_PREVIEW_BG;
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setSourceSize(null);
  }, [uri]);

  const displayBox = useMemo(() => {
    if (!sourceSize) return null;
    return fitMediaInBox(maxW, maxH, sourceSize.w, sourceSize.h);
  }, [sourceSize, maxW, maxH]);

  const shellWidth = displayBox?.width ?? Math.min(96, maxW);
  const shellHeight = displayBox?.height ?? Math.min(72, maxH);

  return (
    <View
      style={[
        chatImageMessageShellStyle(shellWidth, isDark),
        hasCaptionBelow ? styles.withCaptionBelow : null,
      ]}
    >
      <Pressable onPress={onPress} accessibilityLabel="Tùy chọn tin nhắn ảnh">
        <Image
          source={{ uri }}
          style={{
            width: shellWidth,
            height: shellHeight,
            backgroundColor: previewBg,
          }}
          contentFit="contain"
          transition={150}
          onLoad={(event) => {
            const { width, height } = event.source;
            if (width > 0 && height > 0) {
              setSourceSize({ w: width, h: height });
            }
          }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  withCaptionBelow: {
    marginBottom: 6,
  },
});
