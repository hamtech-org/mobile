import { useEffect, type ReactElement } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import ImageViewing from "react-native-image-viewing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Download, X } from "lucide-react-native";

import { toast } from "@/utils/appToast";
import { resolveChatMediaDownloadUrl, saveChatMediaToLibrary } from "@/utils/chatMediaDownload";

export type ChatMediaLightboxState =
  | { kind: "image"; uri: string; filename: string }
  | { kind: "video"; uri: string; filename: string }
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

  useEffect(() => {
    if (!state) return;
    return () => {
      /* cleanup when closed */
    };
  }, [state]);

  if (!state) return null;

  const handleSave = async () => {
    const ok = await saveChatMediaToLibrary(
      resolveChatMediaDownloadUrl(state.uri),
      state.filename,
      state.kind,
    );
    if (ok) {
      toast.success(state.kind === "image" ? "Đã lưu ảnh" : "Đã lưu video");
      onSaved?.();
    } else {
      toast.error("Không lưu được. Thử lại sau.");
    }
  };

  if (state.kind === "image") {
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
