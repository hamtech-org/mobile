import { FlatList, Text, View } from "react-native";
import type { IPost } from "@/types/newsfeed.types";
import { FeedPostCard } from "@/features/newsfeed/components/FeedPostCard";

interface Props {
  posts: IPost[];
  hasMore: boolean;
  isFetchingNext: boolean;
  isLoadingInitial?: boolean;
  headerComponent?: React.ReactElement;
  onEndReached: () => void;
}

export const PaginatedFeedList = ({
  posts,
  hasMore,
  isFetchingNext,
  isLoadingInitial = false,
  headerComponent,
  onEndReached,
}: Props) => (
  <FlatList
    data={posts}
    keyExtractor={(item) => item.postId}
    renderItem={({ item }) => <FeedPostCard post={item} />}
    ListHeaderComponent={headerComponent ?? null}
    ListEmptyComponent={
      isLoadingInitial ? (
        <View className="gap-3 py-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <View
              key={`post-skeleton-${index}`}
              className="rounded-2xl border border-border/40 bg-card p-4"
            >
              <View className="mb-3 flex-row items-center gap-3">
                <View className="size-10 rounded-full bg-muted/70" />
                <View className="gap-2">
                  <View className="h-3 w-28 rounded bg-muted/70" />
                  <View className="h-2.5 w-16 rounded bg-muted/60" />
                </View>
              </View>
              <View className="gap-2">
                <View className="h-3 w-full rounded bg-muted/70" />
                <View className="h-3 w-5/6 rounded bg-muted/60" />
              </View>
              <View className="mt-3 h-44 w-full rounded-xl bg-muted/60" />
            </View>
          ))}
        </View>
      ) : null
    }
    onEndReachedThreshold={0.45}
    onEndReached={onEndReached}
    ListFooterComponent={
      isFetchingNext ? (
        <View className="py-3">
          <View className="rounded-2xl border border-border/40 bg-card p-4">
            <View className="mb-3 flex-row items-center gap-3">
              <View className="size-9 rounded-full bg-muted/70" />
              <View className="h-3 w-24 rounded bg-muted/70" />
            </View>
            <View className="gap-2">
              <View className="h-3 w-full rounded bg-muted/70" />
              <View className="h-3 w-4/5 rounded bg-muted/60" />
            </View>
          </View>
        </View>
      ) : !hasMore && posts.length > 0 ? (
        <View className="py-3">
          <Text className="text-center text-xs text-muted-foreground">Bạn đã xem hết bài viết</Text>
        </View>
      ) : null
    }
    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
  />
);
