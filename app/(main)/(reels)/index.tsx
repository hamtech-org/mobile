import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import type { ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGetReelsFeedQuery, useLazyGetReelsFeedQuery } from "@/store/api/newsfeedApi";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { ReelActionBar } from "@/features/reels/components/ReelActionBar";
import { ReelCommentsSheet } from "@/features/reels/components/ReelCommentsSheet";
import type { IReel, ReelFeedKind } from "@/types/newsfeed.types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const TABS: { key: ReelFeedKind; label: string }[] = [
  { key: "foryou", label: "Dành cho bạn" },
  { key: "following", label: "Đang theo dõi" },
];

/**
 * Reels feed screen — FlatList full-screen snap-scroll (TikTok-style).
 * Tab route: (reels)/index
 */
export default function ReelsFeedScreen() {
  const router = useRouter();
  const [feedKind, setFeedKind] = useState<ReelFeedKind>("foryou");
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [commentsReelId, setCommentsReelId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useGetReelsFeedQuery({
    feed: feedKind,
    limit: 10,
  });
  const [fetchMore] = useLazyGetReelsFeedQuery();

  const [allReels, setAllReels] = useState<IReel[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Reset khi data thay đổi
  useEffect(() => {
    if (data) {
      setAllReels(data.items);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    }
  }, [data]);

  // Viewability tracking
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0]?.index;
      if (typeof idx === "number") {
        setVisibleIndex(idx);
      }
    }
  }).current;

  // Load more
  const handleEndReached = useCallback(() => {
    if (!hasMore || !nextCursor || isFetching) return;
    fetchMore({ feed: feedKind, limit: 10, cursor: nextCursor })
      .unwrap()
      .then((res) => {
        if (res) {
          setAllReels((prev) => [...prev, ...res.items]);
          setNextCursor(res.nextCursor);
          setHasMore(res.hasMore);
        }
      })
      .catch(() => {});
  }, [hasMore, nextCursor, isFetching, feedKind, fetchMore]);

  // Switch tab
  const handleSwitchTab = useCallback((kind: ReelFeedKind) => {
    setFeedKind(kind);
    setAllReels([]);
    setNextCursor(null);
    setHasMore(true);
    setVisibleIndex(0);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: IReel; index: number }) => (
      <View style={{ height: SCREEN_HEIGHT }}>
        <ReelPlayer reel={item} isVisible={visibleIndex === index} />
        <ReelActionBar reel={item} onOpenComments={() => setCommentsReelId(item.reelId)} />
      </View>
    ),
    [visibleIndex],
  );

  const keyExtractor = useCallback((item: IReel) => item.reelId, []);

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />

      {/* Top tabs */}
      <View className="absolute inset-x-0 top-0 z-30 flex-row items-center justify-center gap-6 pb-2 pt-14">
        {TABS.map((tab) => (
          <Pressable key={tab.key} onPress={() => handleSwitchTab(tab.key)}>
            <Text
              className={`border-b-2 pb-1 text-sm font-bold ${
                feedKind === tab.key
                  ? "border-white text-white"
                  : "border-transparent text-white/50"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Create button */}
      <Pressable
        onPress={() => router.push("/(main)/(reels)/create")}
        className="absolute right-4 top-14 z-30 size-10 items-center justify-center rounded-full bg-white/20"
        hitSlop={8}
      >
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>

      {/* Loading state */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : allReels.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg font-semibold text-white/60">Chưa có reel nào</Text>
          <Text className="mt-1 text-sm text-white/40">Hãy quay lại sau hoặc thử tab khác!</Text>
        </View>
      ) : (
        <FlatList
          data={allReels}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          getItemLayout={(_data, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
          ListFooterComponent={
            isFetching ? (
              <View className="h-20 items-center justify-center">
                <ActivityIndicator color="rgba(255,255,255,0.5)" />
              </View>
            ) : null
          }
        />
      )}

      {/* Comments Sheet */}
      <ReelCommentsSheet
        reelId={commentsReelId ?? ""}
        visible={!!commentsReelId}
        onClose={() => setCommentsReelId(null)}
      />
    </View>
  );
}
