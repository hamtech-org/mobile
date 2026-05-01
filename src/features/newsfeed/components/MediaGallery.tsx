import React, { useState } from "react";
import ImageViewing from "react-native-image-viewing";
import { Pressable, View, Image, Text } from "react-native";

interface Props {
  mediaUrls: string[];
  onOpen?: (index: number) => void;
}

const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);

interface MediaItemProps {
  url: string;
  onPress: () => void;
  overlay?: React.ReactNode;
}

const MediaItem = ({ url, onPress, overlay }: MediaItemProps) => (
  <Pressable onPress={onPress} className="h-full w-full">
    <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    {overlay}
  </Pressable>
);

export const MediaGallery: React.FC<Props> = ({ mediaUrls }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  // Only pass image URLs to ImageViewing (it doesn't support video)
  const imageUrls = mediaUrls.filter((url) => !isVideoUrl(url)).map((url) => ({ uri: url }));

  const openLightbox = (index: number) => {
    // Only open for images
    if (!isVideoUrl(mediaUrls[index])) {
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
    </>
  );
};
