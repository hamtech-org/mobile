import React from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "@/components/common/SearchBar";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { REELS_MOCK } from "@/features/newsfeed/constants/newsfeed.constants";
import { useNewsfeedPagination } from "@/features/newsfeed/hooks/useNewsfeedPagination";
import { useNewsfeedSearch } from "@/features/newsfeed/hooks/useNewsfeedSearch";
import { useCreatePostHeader } from "@/features/newsfeed/hooks/useCreatePostHeader";
import { CreatePostHeader } from "@/features/newsfeed/components/CreatePostHeader";
import { ReelsStrip } from "@/features/newsfeed/components/ReelsStrip";
import { PaginatedFeedList } from "@/features/newsfeed/components/PaginatedFeedList";

export default function NewsfeedScreen() {
  const router = useRouter();
  const { posts, hasMore, isLoadingInitial, isFetchingNext, loadMore } = useNewsfeedPagination();
  const { query, setQuery, filteredPosts } = useNewsfeedSearch(posts);
  const { createPostName, createPostAvatar, createPostInitial } = useCreatePostHeader();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader
        title="Bảng tin"
        rightActions={[
          {
            icon: "add-circle-outline",
            accessibilityLabel: "Tạo bài viết",
            onPress: () => router.push("/(main)/(newsfeed)/editor/new"),
          },
        ]}
      />

      <View className="px-4 pb-2 pt-3">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Tìm bài viết, hashtag..." />
      </View>

      <PaginatedFeedList
        posts={filteredPosts}
        hasMore={hasMore}
        isFetchingNext={isFetchingNext}
        isLoadingInitial={isLoadingInitial}
        headerComponent={
          <View>
            <CreatePostHeader
              name={createPostName}
              avatar={createPostAvatar}
              initial={createPostInitial}
              onPressCreate={() => router.push("/(main)/(newsfeed)/editor/new")}
            />
            <ReelsStrip reels={REELS_MOCK} />
          </View>
        }
        onEndReached={loadMore}
        onPressPost={(postId) => router.push(`/(main)/(newsfeed)/${postId}`)}
      />
    </SafeAreaView>
  );
}
