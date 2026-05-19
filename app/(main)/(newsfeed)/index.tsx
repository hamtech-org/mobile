import React, { useState } from "react";
import { Text, View, Modal, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "@/components/common/SearchBar";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useNewsfeedPagination } from "@/features/newsfeed/hooks/useNewsfeedPagination";
import { useNewsfeedSearch } from "@/features/newsfeed/hooks/useNewsfeedSearch";
import { useCreatePostHeader } from "@/features/newsfeed/hooks/useCreatePostHeader";
import { CreatePostHeader } from "@/features/newsfeed/components/CreatePostHeader";
import { ReelsStrip } from "@/features/newsfeed/components/ReelsStrip";
import { PaginatedFeedList } from "@/features/newsfeed/components/PaginatedFeedList";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";

export default function NewsfeedScreen() {
  const router = useRouter();
  const { posts, hasMore, isLoadingInitial, isFetchingNext, loadMore } = useNewsfeedPagination();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { query, setQuery, filteredPosts } = useNewsfeedSearch(posts);
  const { createPostName, createPostAvatar, createPostInitial } = useCreatePostHeader();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader
        title="Bảng tin"
        rightSlot={
          <View className="flex-row items-center">
            <Pressable
              onPress={() => setIsSearchOpen(true)}
              className="p-2 active:opacity-70"
              accessibilityLabel="Tìm kiếm"
            >
              <Ionicons name="search-outline" size={22} color="hsl(var(--foreground) / 1)" />
            </Pressable>
            <NotificationBellButton />
            <Pressable
              onPress={() => router.push("/(main)/(newsfeed)/editor/new")}
              className="p-2 active:opacity-70"
              accessibilityLabel="Tạo bài viết"
            >
              <Ionicons name="add-circle-outline" size={24} color="hsl(var(--foreground) / 1)" />
            </Pressable>
          </View>
        }
      />

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
            <ReelsStrip />
          </View>
        }
        onEndReached={loadMore}
      />

      <Modal visible={isSearchOpen} animationType="fade" transparent>
        <View className="flex-1 bg-black/20">
          <SafeAreaView className="bg-background" edges={["top"]}>
            <View className="flex-row items-center gap-3 border-b border-border/40 px-4 py-3 shadow-sm">
              <View className="flex-1">
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Tìm bài viết, hashtag..."
                  autoFocus
                />
              </View>
              <Pressable
                onPress={() => {
                  setIsSearchOpen(false);
                  setQuery("");
                }}
                className="py-2"
              >
                <Text className="text-base font-medium text-blue-600">Hủy</Text>
              </Pressable>
            </View>
          </SafeAreaView>
          <Pressable className="flex-1" onPress={() => setIsSearchOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
