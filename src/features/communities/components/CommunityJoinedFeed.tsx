import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useLazyGetJoinedCommunitiesFeedQuery } from "@/store/api/communityApi";
import type { IPost } from "@/types/newsfeed.types";
import { FeedPostCard } from "@/features/newsfeed/components/FeedPostCard";
import { useIconColors } from "@/hooks/useIconColors";

export function CommunityJoinedFeed() {
  const { primary, muted } = useIconColors();
  const [triggerGetFeed] = useLazyGetJoinedCommunitiesFeedQuery();
  const [posts, setPosts] = useState<IPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const didBootstrapFeedRef = useRef(false);

  const fetchFeedPage = useCallback(
    async (cursor: string | null, replace: boolean): Promise<void> => {
      if (!replace && (!hasMore || isFetchingNext)) return;
      if (replace && !isRefreshing) setIsLoadingInitial(true);
      else if (!replace) setIsFetchingNext(true);

      try {
        const response = await triggerGetFeed(
          {
            limit: 15,
            cursor,
          },
          true,
        ).unwrap();

        const items = Array.isArray(response?.items) ? response.items : [];
        const resNextCursor = response?.nextCursor ?? null;
        const resHasMore = Boolean(response?.hasMore);

        setPosts((prev) => {
          if (replace) return items;
          const merged = new Map(prev.map((post) => [post.postId, post]));
          for (const post of items) {
            merged.set(post.postId, post);
          }
          return Array.from(merged.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
        setNextCursor(resNextCursor);
        setHasMore(resHasMore);
      } catch (err) {
        console.error("Fetch joined communities feed error:", err);
        if (replace) {
          setPosts([]);
          setNextCursor(null);
          setHasMore(false);
        }
      } finally {
        setIsLoadingInitial(false);
        setIsFetchingNext(false);
        setIsRefreshing(false);
      }
    },
    [hasMore, isFetchingNext, isRefreshing, triggerGetFeed],
  );

  useEffect(() => {
    if (didBootstrapFeedRef.current) return;
    didBootstrapFeedRef.current = true;
    void fetchFeedPage(null, true);
  }, [fetchFeedPage]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchFeedPage(null, true);
  };

  const handleEndReached = () => {
    if (hasMore && !isFetchingNext && !isLoadingInitial) {
      void fetchFeedPage(nextCursor, false);
    }
  };

  const renderSkeleton = () => (
    <View className="gap-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <View
          key={`community-skeleton-${index}`}
          className="rounded-2xl border border-border/40 bg-card p-4"
        >
          <View className="mb-3 flex-row items-center gap-3">
            <View className="size-10 rounded-full bg-muted/70" />
            <View className="gap-2">
              <View className="h-3.5 w-28 rounded bg-muted/70" />
              <View className="h-2.5 w-16 rounded bg-muted/60" />
            </View>
          </View>
          <View className="gap-2">
            <View className="h-3 w-full rounded bg-muted/70" />
            <View className="h-3 w-5/6 rounded bg-muted/60" />
          </View>
          <View className="mt-3 h-40 w-full rounded-xl bg-muted/60" />
        </View>
      ))}
    </View>
  );

  if (isLoadingInitial) {
    return <View className="flex-1 bg-background px-4 pt-3">{renderSkeleton()}</View>;
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={posts}
        keyExtractor={(item) => item.postId}
        renderItem={({ item }) => <FeedPostCard post={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[primary]}
            tintColor={primary}
          />
        }
        ListEmptyComponent={
          <View className="mt-4 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card p-8">
            <Text className="mb-1 text-center text-base font-semibold text-foreground">
              Chưa có bài viết nào
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              Tham gia cộng đồng và đăng bài viết đầu tiên để cùng thảo luận.
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNext ? (
            <View className="items-center py-4">
              <ActivityIndicator color={primary} />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <View className="items-center py-4">
              <Text className="text-xs text-muted-foreground">Bạn đã xem hết bài viết</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
