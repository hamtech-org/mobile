import { Image, Pressable, Text, View } from "react-native";
import type { IPost } from "@/types/newsfeed.types";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";

interface Props {
  post: IPost;
  onPress: () => void;
}

export const FeedPostCard = ({ post, onPress }: Props) => {
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
};
