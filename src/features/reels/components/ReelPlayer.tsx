import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useRecordReelViewMutation } from "@/store/api/newsfeedApi";
import type { IReel } from "@/types/newsfeed.types";

interface Props {
  reel: IReel;
  isVisible: boolean;
  height: number;
}

export const ReelPlayer = ({ reel, isVisible, height }: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const [isPaused, setIsPaused] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const viewRecordedRef = useRef(false);
  const watchStartRef = useRef<number | null>(null);

  const [recordView] = useRecordReelViewMutation();

  const player = useVideoPlayer(reel.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (isVisible) {
      player.play();
      setIsPaused(false);
      watchStartRef.current = Date.now();
    } else {
      player.pause();
      setIsPaused(false);
      watchStartRef.current = null;
      setCaptionExpanded(false);
    }
  }, [isVisible, player]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") {
        player.pause();
      } else if (isVisible && !isPaused) {
        player.play();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [isVisible, isPaused, player]);

  useEffect(() => {
    if (!isVisible || viewRecordedRef.current) return;

    const timer = setTimeout(() => {
      if (watchStartRef.current) {
        const watchedMs = Date.now() - watchStartRef.current;
        if (watchedMs >= 2000) {
          recordView({ reelId: reel.reelId, watchedMs, completed: false });
          viewRecordedRef.current = true;
        }
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [isVisible, reel.reelId, recordView]);

  const handleTap = useCallback(() => {
    if (isPaused) {
      player.play();
      setIsPaused(false);
    } else {
      player.pause();
      setIsPaused(true);
    }
  }, [isPaused, player]);

  const hasLongCaption = (reel.caption?.length ?? 0) > 60;

  return (
    <Pressable
      onPress={handleTap}
      className="flex-1 bg-black"
      style={{ width: screenWidth, height }}
    >
      <VideoView
        player={player}
        style={{ width: screenWidth, height }}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Gradient overlay bottom */}
      <View
        className="absolute inset-x-0 bottom-0"
        style={{ height: height * 0.35 }}
        pointerEvents="none"
      >
        <View className="flex-1 bg-black/60" style={{ opacity: 0.7 }} />
      </View>

      {/* Pause icon overlay */}
      {isPaused && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <View className="size-20 items-center justify-center rounded-full bg-black/40">
            <Ionicons name="play" size={36} color="#fff" />
          </View>
        </View>
      )}

      {/* Author + caption overlay (bottom-left) */}
      <View className="absolute bottom-5 left-4 right-16 z-10">
        {/* Author row */}
        <View className="mb-2 flex-row items-center">
          <Text className="text-[15px] font-bold text-white">
            {reel.author?.displayName ?? "Người dùng"}
          </Text>
        </View>

        {/* Caption */}
        {reel.caption ? (
          <Pressable onPress={() => hasLongCaption && setCaptionExpanded((e) => !e)}>
            <Text
              className="text-[13px] leading-snug text-white"
              numberOfLines={captionExpanded ? undefined : 1}
            >
              {reel.caption}
            </Text>
            {hasLongCaption && !captionExpanded && (
              <Text className="mt-0.5 text-[13px] font-semibold text-white/80">... Xem thêm</Text>
            )}
          </Pressable>
        ) : null}

        {/* Hashtags */}
        {reel.hashtags.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap gap-1.5">
            {reel.hashtags.map((tag) => (
              <Text key={tag} className="text-[13px] font-semibold text-blue-300">
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};
