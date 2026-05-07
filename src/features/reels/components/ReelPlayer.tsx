import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Image } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useRecordReelViewMutation } from "@/store/api/newsfeedApi";
import type { IReel } from "@/types/newsfeed.types";

interface Props {
  reel: IReel;
  isVisible: boolean;
  height: number;
}

/**
 * Full-screen video player cho 1 reel trên mobile.
 * Dùng expo-video (useVideoPlayer) cho native performance.
 * - Autoplay khi visible, pause khi không
 * - Tap to toggle play/pause
 * - Auto view recording sau 2s xem
 */
export const ReelPlayer = ({ reel, isVisible, height }: Props) => {
  const { width: screenWidth } = useWindowDimensions();
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const viewRecordedRef = useRef(false);
  const watchStartRef = useRef<number | null>(null);

  const [recordView] = useRecordReelViewMutation();

  const player = useVideoPlayer(reel.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  // Autoplay / pause based on visibility
  useEffect(() => {
    if (isVisible) {
      player.play();
      setIsPaused(false);
      watchStartRef.current = Date.now();
    } else {
      player.pause();
      setIsPaused(true);
      watchStartRef.current = null;
    }
  }, [isVisible, player]);

  // Mute control
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // Record view after 2s
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

  return (
    <Pressable
      onPress={handleTap}
      className="flex-1 bg-black"
      style={{ width: screenWidth, height: height }}
    >
      {/* Video */}
      <VideoView
        player={player}
        style={{ width: screenWidth, height: height }}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Gradient overlay bottom */}
      <View
        className="absolute inset-x-0 bottom-0"
        style={{
          height: height * 0.35,
          backgroundColor: "transparent",
        }}
        pointerEvents="none"
      />

      {/* Pause icon overlay */}
      {isPaused && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <View className="size-20 items-center justify-center rounded-full bg-black/40">
            <Ionicons name="play" size={36} color="#fff" />
          </View>
        </View>
      )}

      {/* Mute toggle */}
      <Pressable
        onPress={() => setIsMuted((m) => !m)}
        className="absolute bottom-5 right-20 z-20 size-9 items-center justify-center rounded-full bg-black/40"
        hitSlop={10}
      >
        <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} color="#fff" />
      </Pressable>

      {/* Reel info overlay (bottom-left) */}
      <View className="absolute bottom-5 left-4 right-20 z-10" pointerEvents="none">
        {/* Author */}
        <View className="mb-2 flex-row items-center gap-2">
          {reel.author?.avatar ? (
            <Image
              source={{ uri: reel.author.avatar }}
              className="size-10 rounded-full border-2 border-white/80"
            />
          ) : (
            <View className="size-10 items-center justify-center rounded-full border-2 border-white/80 bg-blue-600/80">
              <Text className="text-sm font-bold text-white">
                {reel.author?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <Text className="text-sm font-bold text-white">
            {reel.author?.displayName ?? "Người dùng"}
          </Text>
        </View>

        {/* Caption */}
        {reel.caption ? (
          <Text className="text-sm leading-snug text-white" numberOfLines={3}>
            {reel.caption}
          </Text>
        ) : null}

        {/* Hashtags */}
        {reel.hashtags.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {reel.hashtags.map((tag) => (
              <Text key={tag} className="text-xs font-semibold text-blue-300">
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};
