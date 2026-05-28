import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StatusBar, Text, View } from "react-native";
import type { LayoutChangeEvent, ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  newsfeedApi,
  useGetReelsFeedQuery,
  useLazyGetReelsFeedQuery,
} from "@/store/api/newsfeedApi";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { ReelActionBar } from "@/features/reels/components/ReelActionBar";
import { ReelCommentsSheet } from "@/features/reels/components/ReelCommentsSheet";
import { ReelCommentInputBar } from "@/features/reels/components/ReelCommentInputBar";
import { useAppDispatch } from "@/hooks/useAppStore";
import { useSocket } from "@/hooks/useSocket";
import type { IReel } from "@/types/newsfeed.types";

function getReelEventId(payload: unknown): string | null {
  const p = payload as { reelId?: unknown; targetId?: unknown } | null;
  const reelId = typeof p?.reelId === "string" ? p.reelId : p?.targetId;
  return typeof reelId === "string" ? reelId : null;
}

export default function ReelsFeedScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const isFocused = useIsFocused();
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
          setAllReels((prev) => {
            const existing = new Set(prev.map((r) => r.reelId));
            return [...prev, ...res.items.filter((r) => !existing.has(r.reelId))];
          });
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
  }, [visibleIndex, allReels, commentsReelId]);

  const visibleReelId = allReels[visibleIndex]?.reelId ?? null;

  useEffect(() => {
    if (!socket || !visibleReelId) return undefined;
    socket.emit("newsfeed:reel_join", { reelId: visibleReelId });
    return () => {
      socket.emit("newsfeed:reel_leave", { reelId: visibleReelId });
    };
  }, [socket, visibleReelId]);

  useEffect(() => {
    if (!socket) return undefined;

    const invalidateReel = (payload: unknown) => {
      const reelId = getReelEventId(payload);
      dispatch(
        newsfeedApi.util.invalidateTags([
          "ReelsFeed",
          ...(reelId ? [{ type: "ReelDetail" as const, id: reelId }] : []),
        ]),
      );
    };

    const handleReelDeleted = (payload: unknown) => {
      const reelId = getReelEventId(payload);
      if (!reelId) return;
      setAllReels((prev) => prev.filter((r) => r.reelId !== reelId));
      setCommentsReelId((current) => (current === reelId ? null : current));
      invalidateReel(payload);
    };

    const handleReelCommented = (payload: unknown) => {
      const reelId = getReelEventId(payload);
      dispatch(
        newsfeedApi.util.invalidateTags([
          "ReelsFeed",
          ...(reelId
            ? [
                { type: "ReelDetail" as const, id: reelId },
                { type: "ReelComments" as const, id: reelId },
              ]
            : []),
        ]),
      );
    };

    socket.on("newsfeed:reel_deleted", handleReelDeleted);
    socket.on("newsfeed:reel_reacted", invalidateReel);
    socket.on("newsfeed:reel_commented", handleReelCommented);

    return () => {
      socket.off("newsfeed:reel_deleted", handleReelDeleted);
      socket.off("newsfeed:reel_reacted", invalidateReel);
      socket.off("newsfeed:reel_commented", handleReelCommented);
    };
  }, [socket, dispatch]);

  const renderItem = useCallback(
    ({ item, index }: { item: IReel; index: number }) => (
      <View style={{ height: itemHeight }}>
        <ReelPlayer
          reel={item}
          isVisible={isFocused && visibleIndex === index}
          height={itemHeight}
        />
        <ReelActionBar reel={item} onOpenComments={() => setCommentsReelId(item.reelId)} />
      </View>
    ),
    [visibleIndex, itemHeight, isFocused],
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
          disableIntervalMomentum={true}
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          removeClippedSubviews
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
