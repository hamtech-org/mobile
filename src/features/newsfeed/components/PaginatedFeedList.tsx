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
  onPressPost: (postId: string) => void;
}

export const PaginatedFeedList = ({
  posts,
  hasMore,
  isFetchingNext,
  isLoadingInitial = false,
  headerComponent,
  onEndReached,
  onPressPost,
}: Props) => (
  <FlatList
    data={posts}
    keyExtractor={(item) => item.postId}
    renderItem={({ item }) => <FeedPostCard post={item} onPress={() => onPressPost(item.postId)} />}
    ListHeaderComponent={headerComponent ?? null}
    ListEmptyComponent={
      isLoadingInitial ? (
        <View className="px-4 py-3">
          <Text className="text-sm text-muted-foreground">Đang tải...</Text>
        </View>
      ) : null
    }
    onEndReachedThreshold={0.45}
    onEndReached={onEndReached}
    ListFooterComponent={
      isFetchingNext ? (
        <View className="py-3">
          <Text className="text-center text-xs text-muted-foreground">
            Đang tải thêm bài viết...
          </Text>
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
