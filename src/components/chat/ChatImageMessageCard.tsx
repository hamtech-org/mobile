import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import {
  chatMediaMaxHeight,
  chatMediaShellStyle,
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

/** Ảnh — khớp web: `rounded-xl border #B8C9E8 shadow-sm object-contain`. */
export function ChatImageMessageCard({
  uri,
  layout,
  isDark = false,
  hasCaptionBelow = false,
  onPress,
}: ChatImageMessageCardProps) {
  const maxH = chatMediaMaxHeight(layout);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const previewBg = isDark ? CHAT_IMAGE_PREVIEW_BG_DARK : CHAT_IMAGE_PREVIEW_BG;

  useEffect(() => {
    let cancelled = false;
    setAspectRatio(null);
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const imageStyle = aspectRatio
    ? {
        width: "100%" as const,
        aspectRatio,
        maxHeight: maxH,
        backgroundColor: previewBg,
      }
    : {
        width: "100%" as const,
        minHeight: Math.min(120, maxH),
        maxHeight: maxH,
        backgroundColor: previewBg,
      };

  return (
    <View style={[chatMediaShellStyle(isDark), hasCaptionBelow ? styles.withCaptionBelow : null]}>
      <Pressable onPress={onPress} accessibilityLabel="Tùy chọn tin nhắn ảnh" style={styles.press}>
        <Image
          source={{ uri }}
          style={imageStyle}
          resizeMode="contain"
          onLoad={(e) => {
            const { width, height } = e.nativeEvent.source;
            if (width > 0 && height > 0) setAspectRatio(width / height);
          }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  press: {
    width: "100%",
  },
  withCaptionBelow: {
    marginBottom: 6,
  },
});
