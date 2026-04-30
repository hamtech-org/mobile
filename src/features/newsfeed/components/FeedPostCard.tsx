import { Image, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import type { IPost } from "@/types/newsfeed.types";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import {
  useAddCommentMutation,
  useGetCommentsQuery,
  useReactToPostMutation,
} from "@/store/api/newsfeedApi";

interface Props {
  post: IPost;
}

export const FeedPostCard = ({ post }: Props) => {
  const postImage = post.mediaUrls?.[0] ?? null;
  const likes = Object.values(post.reactionsCount ?? {}).reduce((a, b) => a + b, 0);
  const displayName = post.author?.displayName ?? post.authorId;
  const avatar = post.author?.avatar ?? "";
  const initial = displayName.trim().charAt(0).toUpperCase();
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { data: commentsData = [], isFetching: isCommentsFetching } = useGetCommentsQuery(
    post.postId,
    {
      skip: !isCommentOpen,
    },
  );
  const [addComment, { isLoading: isAddingComment }] = useAddCommentMutation();
  const [reactToPost] = useReactToPostMutation();

  const submitComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    try {
      await addComment({ postId: post.postId, content }).unwrap();
      setCommentText("");
    } catch {
      // no-op
    }
  };

  return (
    <View className="mb-4 rounded-3xl border border-border/40 bg-card p-4">
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

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <Pressable
            className="flex-row items-center gap-1"
            onPress={() => {
              void reactToPost({ postId: post.postId, type: "like" });
            }}
          >
            <Ionicons name="heart-outline" size={16} color="#ef4444" />
            <Text className="text-sm font-bold text-foreground">{likes}</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-1"
            onPress={() => setIsCommentOpen((prev) => !prev)}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#2563eb" />
            <Text className="text-sm font-bold text-foreground">
              {commentsData.length > 0 ? commentsData.length : post.commentsCount}
            </Text>
          </Pressable>
          <Pressable className="flex-row items-center gap-1">
            <Ionicons name="share-social-outline" size={16} color="#16a34a" />
            <Text className="text-sm font-bold text-foreground">{post.sharesCount ?? 0}</Text>
          </Pressable>
        </View>
      </View>

      {isCommentOpen ? (
        <View className="mt-3 gap-2">
          {isCommentsFetching ? (
            <Text className="text-xs text-muted-foreground">Đang tải bình luận...</Text>
          ) : commentsData.length === 0 ? (
            <Text className="text-xs text-muted-foreground">Chưa có bình luận nào.</Text>
          ) : (
            <View className="gap-2">
              {commentsData.map((comment) => (
                <View key={comment.commentId} className="rounded-xl bg-muted/50 px-3 py-2">
                  <Text className="text-xs font-semibold text-foreground/80">
                    {comment.authorId}
                  </Text>
                  <Text className="text-sm text-foreground">{comment.content}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="flex-row items-center gap-2">
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Viết bình luận..."
              placeholderTextColor="#94a3b8"
              className="flex-1 rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground"
            />
            <Pressable
              disabled={isAddingComment || commentText.trim().length === 0}
              onPress={submitComment}
              className="rounded-xl bg-blue-600 px-3 py-2 disabled:opacity-60"
            >
              <Text className="text-xs font-bold text-white">Gửi</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};
