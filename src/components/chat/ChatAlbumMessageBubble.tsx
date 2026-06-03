import { Image } from "expo-image";
import { Play } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { IMessage } from "@/types/chat.types";
import { ChatJumpHighlightWrap } from "@/components/chat/ChatJumpHighlight";
import { chatMediaShellStyle, CHAT_MEDIA_SHELL_RADIUS } from "@/components/chat/chatMediaShell";

interface ChatAlbumMessageBubbleProps {
  msg: IMessage;
  isMe: boolean;
  isDark?: boolean;
  isJumpHighlighted?: boolean;
  onOpenLightbox: (items: { url: string; type: "image" | "video" }[], startIndex: number) => void;
  onLongPress?: () => void;
}

export function ChatAlbumMessageBubble({
  msg,
  isMe,
  isDark = false,
  isJumpHighlighted = false,
  onOpenLightbox,
  onLongPress,
}: ChatAlbumMessageBubbleProps) {
  const items = msg.medias || [];
  if (items.length === 0) return null;

  const visibleItems = items.slice(0, 4);
  const remainingCount = items.length - 4;

  const getGridStyle = () => {
    if (items.length === 2) {
      return { flexDirection: "row" as const, height: 180 };
    }
    if (items.length === 3) {
      return { flexDirection: "row" as const, height: 130 };
    }
    // 4 or more
    return { flexDirection: "row" as const, flexWrap: "wrap" as const, height: 260 };
  };

  const handleItemPress = (index: number) => {
    const lightboxItems = items.map((item) => ({
      url: item.url,
      type: item.type as "image" | "video",
    }));
    onOpenLightbox(lightboxItems, index);
  };

  const getCellSize = (index: number): ViewStyle => {
    const total = items.length;
    if (total === 2) {
      return { width: "49%", height: "100%" };
    }
    if (total === 3) {
      return { width: "32.3%", height: "100%" };
    }
    // 4 or more: grid 2x2
    return { width: "49%", height: "49%" };
  };

  return (
    <ChatJumpHighlightWrap
      active={isJumpHighlighted}
      borderRadius={CHAT_MEDIA_SHELL_RADIUS}
      style={[chatMediaShellStyle(isDark), { width: 280 }]}
    >
      <Pressable onLongPress={onLongPress}>
        <View style={[getGridStyle(), styles.gridGap]}>
          {visibleItems.map((item, index) => {
            const isLastVisible = index === 3;
            const showOverlay = isLastVisible && remainingCount > 0;
            const isVideo = item.type === "video";

            const displayUrl = isVideo ? item.thumbnailUrl || item.url : item.url;

            return (
              <Pressable
                key={item.mediaId}
                onPress={() => handleItemPress(index)}
                onLongPress={onLongPress}
                style={[getCellSize(index), styles.cell]}
              >
                <Image
                  source={{ uri: displayUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={150}
                />

                {isVideo && (
                  <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                      <Play size={18} color="#fff" fill="#fff" style={styles.playIcon} />
                    </View>
                  </View>
                )}

                {showOverlay && (
                  <View style={styles.countOverlay}>
                    <Text style={styles.countText}>+{remainingCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </ChatJumpHighlightWrap>
  );
}

const styles = StyleSheet.create({
  gridGap: {
    justifyContent: "space-between",
    alignContent: "space-between",
    padding: 3,
  },
  cell: {
    position: "relative",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  playIcon: {
    marginLeft: 2,
  },
  countOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
});
