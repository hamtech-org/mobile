import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useGetReelsFeedQuery } from "@/store/api/newsfeedApi";
import type { IReel } from "@/types/newsfeed.types";

/** Format số lớn: 1200 → 1.2K */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Horizontal reel strip trên NewsfeedScreen.
 * Self-contained: fetch 6 reels từ API.
 */
export const ReelsStrip = () => {
  const router = useRouter();
  const { data, isLoading } = useGetReelsFeedQuery({ feed: "foryou", limit: 6 });
  const reels = data?.items ?? [];

  // Loading skeleton
  if (isLoading) {
    return (
      <View className="flex-row gap-2.5 pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <View
            key={`reel-skel-${i}`}
            className="h-[200px] w-[126px] animate-pulse rounded-2xl bg-muted/50"
          />
        ))}
      </View>
    );
  }

  if (reels.length === 0) return null;

  return (
    <View className="pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      >
        {/* Create reel card */}
        <Pressable
          className="w-[126px] overflow-hidden rounded-2xl bg-card"
          onPress={() => router.push("/(main)/(reels)")}
        >
          <View className="h-[160px] items-center justify-center bg-muted/70">
            <View className="size-14 rounded-full bg-primary/20" />
          </View>
          <View className="absolute bottom-10 left-1/2 size-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background bg-blue-600">
            <Ionicons name="add" size={18} color="#fff" />
          </View>
          <Text className="bg-background/70 py-2 text-center text-xs font-bold text-foreground">
            Tạo tin
          </Text>
        </Pressable>

        {reels.map((reel) => (
          <Pressable
            key={reel.reelId}
            className="relative h-[200px] w-[126px] overflow-hidden rounded-2xl"
            onPress={() => router.push("/(main)/(reels)")}
          >
            <Image
              source={{ uri: reel.thumbnailUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-black/35" />

            {/* Author avatar placeholder */}
            <View className="absolute left-2 top-2 size-8 items-center justify-center rounded-full border-2 border-blue-500 bg-card/40">
              <Text className="text-[10px] font-bold text-white">
                {reel.author?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>

            <View className="absolute bottom-2 left-2 right-2">
              <View className="flex-row items-center gap-1">
                <Ionicons name="play" size={12} color="#fff" />
                <Text className="text-[11px] font-bold text-white">
                  {formatCount(reel.viewsCount)}
                </Text>
              </View>
              <Text className="mt-1 text-sm font-bold text-white" numberOfLines={2}>
                {reel.author?.displayName ?? "Người dùng"}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};
