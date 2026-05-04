import React, { useState } from "react";
import ImageViewing from "react-native-image-viewing";
import { Pressable, View, Image, Text, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";

interface Props {
  mediaUrls: string[];
  onOpen?: (index: number) => void;
}

const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);

const VideoLightboxPlayer = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      style={{ width: "100%", height: "100%" }}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};

const VideoThumbnail = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.pause();
  });

  return (
    <VideoView
      style={{ width: "100%", height: "100%" }}
      player={player}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

interface MediaItemProps {
  url: string;
  onPress: () => void;
  overlay?: React.ReactNode;
}

const MediaItem = ({ url, onPress, overlay }: MediaItemProps) => {
  const isVideo = isVideoUrl(url);
  return (
    <Pressable onPress={onPress} className="h-full w-full">
      {isVideo ? (
        <VideoThumbnail url={url} />
      ) : (
        <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      )}
      {isVideo && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="items-center justify-center rounded-full bg-black/60 p-2 pb-2 pl-3 pr-2 pt-2">
            <Ionicons name="play" size={24} color="white" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}
      {overlay}
    </Pressable>
  );
};

export const MediaGallery: React.FC<Props> = ({ mediaUrls }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [videoLightboxUrl, setVideoLightboxUrl] = useState<string | null>(null);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  // Only pass image URLs to ImageViewing (it doesn't support video)
  const imageUrls = mediaUrls.filter((url) => !isVideoUrl(url)).map((url) => ({ uri: url }));

  const openLightbox = (index: number) => {
    if (isVideoUrl(mediaUrls[index])) {
      setVideoLightboxUrl(mediaUrls[index]);
    } else {
      // map to image-only index
      const imgIndex = mediaUrls.slice(0, index + 1).filter((u) => !isVideoUrl(u)).length - 1;
      setLightboxIndex(imgIndex >= 0 ? imgIndex : 0);
    }
  };

  const count = mediaUrls.length;
  const remaining = count > 4 ? count - 4 : 0;

  return (
    <>
      {count === 1 && (
        <View className="mt-3 w-full overflow-hidden rounded-2xl" style={{ aspectRatio: 4 / 3 }}>
          <MediaItem url={mediaUrls[0]} onPress={() => openLightbox(0)} />
        </View>
      )}

      {count === 2 && (
        <View
          className="mt-3 w-full flex-row gap-1 overflow-hidden rounded-2xl"
          style={{ aspectRatio: 4 / 3 }}
        >
          <View className="h-full flex-1 overflow-hidden">
            <MediaItem url={mediaUrls[0]} onPress={() => openLightbox(0)} />
          </View>
          <View className="h-full flex-1 overflow-hidden">
            <MediaItem url={mediaUrls[1]} onPress={() => openLightbox(1)} />
          </View>
        </View>
      )}

      {count === 3 && (
        <View
          className="mt-3 w-full flex-row gap-1 overflow-hidden rounded-2xl"
          style={{ aspectRatio: 4 / 3 }}
        >
          <View className="h-full flex-1 overflow-hidden">
            <MediaItem url={mediaUrls[0]} onPress={() => openLightbox(0)} />
          </View>
          <View className="h-full flex-1 flex-col gap-1">
            <View className="w-full flex-1 overflow-hidden">
              <MediaItem url={mediaUrls[1]} onPress={() => openLightbox(1)} />
            </View>
            <View className="w-full flex-1 overflow-hidden">
              <MediaItem url={mediaUrls[2]} onPress={() => openLightbox(2)} />
            </View>
          </View>
        </View>
      )}

      {count >= 4 && (
        <View
          className="mt-3 w-full flex-row gap-1 overflow-hidden rounded-2xl"
          style={{ aspectRatio: 4 / 3 }}
        >
          <View className="h-full flex-1 overflow-hidden">
            <MediaItem url={mediaUrls[0]} onPress={() => openLightbox(0)} />
          </View>
          <View className="h-full flex-1 flex-col gap-1">
            <View className="w-full flex-1 flex-row gap-1">
              <View className="h-full flex-1 overflow-hidden">
                <MediaItem url={mediaUrls[1]} onPress={() => openLightbox(1)} />
              </View>
              <View className="h-full flex-1 overflow-hidden">
                <MediaItem url={mediaUrls[2]} onPress={() => openLightbox(2)} />
              </View>
            </View>
            <View className="w-full flex-1 overflow-hidden">
              <MediaItem
                url={mediaUrls[3]}
                onPress={() => openLightbox(3)}
                overlay={
                  remaining > 0 ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/50">
                      <Text className="text-2xl font-bold text-white">+{remaining}</Text>
                    </View>
                  ) : undefined
                }
              />
            </View>
          </View>
        </View>
      )}

      {imageUrls.length > 0 && lightboxIndex !== null && (
        <ImageViewing
          images={imageUrls}
          imageIndex={lightboxIndex}
          visible={lightboxIndex !== null}
          onRequestClose={() => setLightboxIndex(null)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
      )}

      {/* Video Lightbox */}
      <Modal
        visible={videoLightboxUrl !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setVideoLightboxUrl(null)}
      >
        <View className="flex-1 items-center justify-center bg-black">
          <Pressable
            className="absolute right-4 top-12 z-10 rounded-full bg-black/40 p-2"
            onPress={() => setVideoLightboxUrl(null)}
          >
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          {videoLightboxUrl && <VideoLightboxPlayer url={videoLightboxUrl} />}
        </View>
      </Modal>
    </>
  );
};
