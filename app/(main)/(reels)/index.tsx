import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StatusBar, Text, View } from "react-native";
import type { LayoutChangeEvent, ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGetReelsFeedQuery, useLazyGetReelsFeedQuery } from "@/store/api/newsfeedApi";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { ReelActionBar } from "@/features/reels/components/ReelActionBar";
import { ReelCommentsSheet } from "@/features/reels/components/ReelCommentsSheet";
import { ReelCommentInputBar } from "@/features/reels/components/ReelCommentInputBar";
import type { IReel } from "@/types/newsfeed.types";

export default function ReelsFeedScreen() {
  const router = useRouter();
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [commentsReelId, setCommentsReelId] = useState<string | null>(null);
  const [itemHeight, setItemHeight] = useState(0);
  const [replyTo, setReplyTo] = useState<{ commentId: string; authorName: string } | null>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setItemHeight(e.nativeEvent.layout.height);
  }, []);

  const handleCloseComments = useCallback(() => {
    setCommentsReelId(null);
    setReplyTo(null);
  }, []);

  const handleReply = useCallback((commentId: string, authorName: string) => {
    setReplyTo({ commentId, authorName });
  }, []);

  const { data, isLoading, isFetching } = useGetReelsFeedQuery({
    feed: "foryou",
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
    fetchMore({ feed: "foryou", limit: 10, cursor: nextCursor })
      .unwrap()
      .then((res) => {
        if (res) {
          setAllReels((prev) => [...prev, ...res.items]);
          setNextCursor(res.nextCursor);
          setHasMore(res.hasMore);
        }
      })
      .catch(() => {});
  }, [hasMore, nextCursor, isFetching, fetchMore]);

  // Auto-update commentsReelId khi user scroll sang reel khác (nếu panel đang mở)
  useEffect(() => {
    if (commentsReelId !== null && allReels[visibleIndex]) {
      setCommentsReelId(allReels[visibleIndex].reelId);
      setReplyTo(null); // reset reply khi đổi reel
    }
  }, [visibleIndex, allReels]);

  const renderItem = useCallback(
    ({ item, index }: { item: IReel; index: number }) => (
      <View style={{ height: itemHeight }}>
        <ReelPlayer reel={item} isVisible={visibleIndex === index} height={itemHeight} />
        <ReelActionBar
          reel={item}
          onOpenComments={() => setCommentsReelId(item.reelId)}
          onOpenReport={() =>
            Alert.alert("Báo cáo", "Bạn muốn báo cáo reel này?", [
              { text: "Hủy", style: "cancel" },
              { text: "Báo cáo", style: "destructive" },
            ])
          }
        />
      </View>
    ),
    [visibleIndex, itemHeight],
  );

  const keyExtractor = useCallback((item: IReel) => item.reelId, []);

  return (
    <View className="flex-1 bg-black" onLayout={handleLayout}>
      <StatusBar barStyle="light-content" />

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
          snapToInterval={itemHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          getItemLayout={(_data, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
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

      <ReelCommentsSheet
        reelId={commentsReelId ?? ""}
        visible={!!commentsReelId}
        onClose={handleCloseComments}
        onReply={handleReply}
      />
      {commentsReelId && (
        <ReelCommentInputBar
          reelId={commentsReelId}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      )}
    </View>
  );
}
