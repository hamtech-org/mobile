import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useGetFeedQuery } from "@/store/api/newsfeedApi";
import type { IPost } from "@/types/newsfeed.types";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "@/components/common/SearchBar";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import type { RootState } from "@/store/store";

const reels = [
  {
    id: "1",
    thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=500&fit=crop",
    views: "1.2M",
    name: "The New Mentor",
  },
  {
    id: "2",
    thumbnail: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&h=500&fit=crop",
    views: "840k",
    name: "TechCraft",
  },
  {
    id: "3",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&h=500&fit=crop",
    views: "2.4M",
    name: "Thành Duy",
  },
  {
    id: "4",
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=500&fit=crop",
    views: "560k",
    name: "JR Duy Trần",
  },
];

function PostCard({ post, onPress }: { post: IPost; onPress: () => void }) {
  const postImage = post.mediaUrls?.[0] ?? null;
  const likes = Object.values(post.reactionsCount ?? {}).reduce((a, b) => a + b, 0);
  const displayName = post.author?.displayName ?? post.authorId;
  const avatar = post.author?.avatar ?? "";
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <Pressable onPress={onPress} className="mb-4 rounded-3xl border border-border/40 bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="size-11 items-center justify-center overflow-hidden rounded-full bg-muted/40">
            {avatar ? (
              <Image source={{ uri: avatar }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Text className="text-sm font-bold text-muted-foreground">{initial || "U"}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold">{displayName}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Text className="rounded-full bg-muted/30 px-2 py-1 text-xs">♥ {likes}</Text>
      </View>

      <Text className="mt-3 text-sm text-foreground/90">
        {extractTextFromTiptapJson(post.content).slice(0, 180)}
        {extractTextFromTiptapJson(post.content).length > 180 ? "…" : ""}
      </Text>

      {postImage ? (
        <View className="mt-3 overflow-hidden rounded-2xl">
          <Image source={{ uri: postImage }} className="h-52 w-full" resizeMode="cover" />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function NewsfeedScreen() {
  const router = useRouter();
  const { data: posts = [], isLoading } = useGetFeedQuery();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((p) => {
      const text = extractTextFromTiptapJson(p.content).toLowerCase();
      return (
        text.includes(query) ||
        p.tags?.some((t) => t.toLowerCase().includes(query)) ||
        p.categories?.some((c) => c.toLowerCase().includes(query))
      );
    });
  }, [posts, q]);

  const createPostName = currentUser?.displayName?.trim() || "Bạn";
  const createPostAvatar = currentUser?.avatar ?? "";
  const createPostInitial = createPostName.charAt(0).toUpperCase() || "U";

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
        <SearchBar value={q} onChangeText={setQ} placeholder="Tìm bài viết, hashtag..." />
      </View>

      <View className="px-4 pb-2">
        <View className="rounded-3xl border border-border/40 bg-card px-3 py-3">
          <View className="flex-row items-center gap-3">
            <View className="size-10 items-center justify-center overflow-hidden rounded-full bg-muted/40">
              {createPostAvatar ? (
                <Image
                  source={{ uri: createPostAvatar }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-sm font-bold text-muted-foreground">{createPostInitial}</Text>
              )}
            </View>
            <Pressable
              onPress={() => router.push("/(main)/(newsfeed)/editor/new")}
              className="flex-1 rounded-full bg-muted/50 px-4 py-2.5"
            >
              <Text className="text-sm text-muted-foreground">
                {createPostName} ơi, bạn đang nghĩ gì thế?
              </Text>
            </Pressable>
            <Ionicons name="videocam" size={20} color="#e11d48" />
            <Ionicons name="image" size={20} color="#16a34a" />
            <Ionicons name="happy" size={20} color="#f59e0b" />
          </View>
        </View>
      </View>

      <View className="pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        >
          <Pressable className="w-[126px] overflow-hidden rounded-2xl bg-card">
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
              key={reel.id}
              className="relative h-[200px] w-[126px] overflow-hidden rounded-2xl"
            >
              <Image
                source={{ uri: reel.thumbnail }}
                className="h-full w-full"
                resizeMode="cover"
              />
              <View className="absolute inset-0 bg-black/35" />
              <View className="absolute left-2 top-2 size-8 rounded-full border-2 border-blue-500 bg-card/40" />
              <View className="absolute bottom-2 left-2 right-2">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="play" size={12} color="#fff" />
                  <Text className="text-[11px] font-bold text-white">{reel.views}</Text>
                </View>
                <Text className="mt-1 text-sm font-bold text-white" numberOfLines={2}>
                  {reel.name}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="px-4">
          <Text className="text-sm text-muted-foreground">Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.postId}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => router.push(`/(main)/(newsfeed)/${item.postId}`)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
        />
      )}
    </SafeAreaView>
  );
}
