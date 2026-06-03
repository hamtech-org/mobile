import { useEffect, useState, useRef, type ReactElement } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
  FlatList,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import ImageViewing from "react-native-image-viewing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Download, X } from "lucide-react-native";
import { Image } from "expo-image";

import { toast } from "@/utils/appToast";
import { resolveChatMediaDownloadUrl, saveChatMediaToLibrary } from "@/utils/chatMediaDownload";

export type ChatMediaLightboxItem = {
  url: string;
  type: "image" | "video";
};

export type ChatMediaLightboxState =
  | { kind: "image"; uri: string; filename: string }
  | { kind: "video"; uri: string; filename: string }
  | { items: ChatMediaLightboxItem[]; startIndex: number }
  | null;

interface ChatMediaLightboxProps {
  state: ChatMediaLightboxState;
  onClose: () => void;
  onSaved?: () => void;
}

function VideoLightboxPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls
      allowsFullscreen
    />
  );
}

export function ChatMediaLightbox({
  state,
  onClose,
  onSaved,
}: ChatMediaLightboxProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!state) return;
    if ("items" in state && state.items) {
      setActiveIndex(state.startIndex || 0);
      // Wait for layout and scroll to index
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: state.startIndex || 0,
          animated: false,
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (!state) return null;

  const handleSave = async () => {
    let url = "";
    let kind: "image" | "video" = "image";
    let filename = "";

    if ("items" in state && state.items) {
      const activeItem = state.items[activeIndex];
      if (!activeItem) return;
      url = activeItem.url;
      kind = activeItem.type;
      filename = url.split("/").pop() || (kind === "video" ? "video.mp4" : "image.jpg");
    } else if ("uri" in state) {
      url = state.uri;
      kind = state.kind;
      filename = state.filename;
    }

    const ok = await saveChatMediaToLibrary(resolveChatMediaDownloadUrl(url), filename, kind);
    if (ok) {
      toast.success(kind === "image" ? "Đã lưu ảnh" : "Đã lưu video");
      onSaved?.();
    } else {
      toast.error("Không lưu được. Thử lại sau.");
    }
  };

  // If viewing an album/playlist of items
  if ("items" in state && state.items) {
    const totalItems = state.items.length;
    return (
      <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <View className="flex-1 bg-black">
          {/* Header toolbar */}
          <View
            className="absolute left-0 right-0 z-10 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="rounded-full bg-black/50 p-2.5 active:opacity-80"
              accessibilityLabel="Đóng"
            >
              <X size={24} color="#fff" strokeWidth={2} />
            </Pressable>

            {/* Pagination indicator */}
            <Text className="text-[14px] font-semibold text-white">
              {activeIndex + 1} / {totalItems}
            </Text>

            <Pressable
              onPress={() => void handleSave()}
              className="flex-row items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 active:opacity-80"
              accessibilityLabel="Lưu media"
            >
              <Download size={20} color="#fff" strokeWidth={2} />
              <Text className="text-[14px] font-semibold text-white">Lưu</Text>
            </Pressable>
          </View>

          {/* Media Swiper */}
          <FlatList
            ref={flatListRef}
            data={state.items}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({
                offset: index * width,
                animated: false,
              });
            }}
            onMomentumScrollEnd={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / width);
              if (index >= 0 && index < totalItems) {
                setActiveIndex(index);
              }
            }}
            renderItem={({ item, index }) => {
              const isActive = index === activeIndex;
              return (
                <View style={{ width, height }} className="items-center justify-center">
                  {item.type === "video" ? (
                    isActive ? (
                      <VideoLightboxPlayer uri={item.url} />
                    ) : (
                      <ActivityIndicator color="#fff" size="large" />
                    )
                  ) : (
                    <Image
                      source={{ uri: item.url }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="contain"
                    />
                  )}
                </View>
              );
            }}
          />
        </View>
      </Modal>
    );
  }

  // Single item fallback
  if ("kind" in state && state.kind === "image") {
    return (
      <ImageViewing
        images={[{ uri: state.uri }]}
        imageIndex={0}
        visible
        onRequestClose={onClose}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        FooterComponent={() => (
          <View
            style={{
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: 16,
              flexDirection: "row",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => void handleSave()}
              className="flex-row items-center gap-2 rounded-full bg-white/20 px-5 py-3 active:opacity-80"
              accessibilityLabel="Lưu ảnh"
            >
              <Download size={20} color="#fff" strokeWidth={2} />
              <Text className="text-[15px] font-semibold text-white">Lưu ảnh</Text>
            </Pressable>
          </View>
        )}
      />
    );
  }

  if ("kind" in state && state.kind === "video") {
    return (
      <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <View className="flex-1 bg-black">
          <View
            className="absolute left-0 right-0 z-10 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="rounded-full bg-black/50 p-2.5 active:opacity-80"
              accessibilityLabel="Đóng"
            >
              <X size={24} color="#fff" strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              className="flex-row items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 active:opacity-80"
              accessibilityLabel="Lưu video"
            >
              <Download size={20} color="#fff" strokeWidth={2} />
              <Text className="text-[14px] font-semibold text-white">Lưu</Text>
            </Pressable>
          </View>
          <View className="flex-1 items-center justify-center">
            {state.uri ? (
              <VideoLightboxPlayer uri={state.uri} />
            ) : (
              <ActivityIndicator color="#fff" size="large" />
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return null;
}
