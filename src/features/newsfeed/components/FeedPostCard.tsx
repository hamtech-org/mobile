import { Image, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useSelector } from "react-redux";
import type { IPost } from "@/types/newsfeed.types";
import type { RootState } from "@/store/store";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import {
  useAddCommentMutation,
  useLazyGetCommentsQuery,
  useReactToPostMutation,
} from "@/store/api/newsfeedApi";
import type { IComment } from "@/types/newsfeed.types";

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
  const [comments, setComments] = useState<IComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const commentAuthorName = currentUser?.displayName?.trim() || "Bạn";
  const commentAuthorAvatar = currentUser?.avatar || "";
  const commentAuthorInitial = commentAuthorName.charAt(0).toUpperCase() || "U";
  const [getCommentsPage] = useLazyGetCommentsQuery();
  const [addComment, { isLoading: isAddingComment }] = useAddCommentMutation();
  const [reactToPost] = useReactToPostMutation();

  const loadCommentPage = async (cursor?: string | null, append: boolean = false) => {
    if (append) {
      setIsLoadingMoreComments(true);
    } else {
      setIsLoadingComments(true);
    }
    try {
      const page = await getCommentsPage({
        postId: post.postId,
        limit: 5,
        cursor: cursor ?? null,
      }).unwrap();
      if (append) {
        setComments((prev) =>
          [...prev, ...page.items].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          ),
        );
      } else {
        setComments(
          [...page.items].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          ),
        );
      }
      setNextCursor(page.nextCursor);
      setHasMoreComments(page.hasMore);
    } finally {
      setIsLoadingComments(false);
      setIsLoadingMoreComments(false);
    }
  };

  const toggleCommentPanel = () => {
    setIsCommentOpen((prev) => {
      const next = !prev;
      if (next) {
        void loadCommentPage(null, false);
      } else {
        setComments([]);
        setNextCursor(null);
        setHasMoreComments(false);
      }
      return next;
    });
  };

  const submitComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    try {
      const created = await addComment({ postId: post.postId, content }).unwrap();
      setComments((prev) =>
        [...prev, created].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      );
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
        <View />
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
          <Pressable className="flex-row items-center gap-1" onPress={toggleCommentPanel}>
            <Ionicons name="chatbubble-outline" size={16} color="#2563eb" />
            <Text className="text-sm font-bold text-foreground">
              {comments.length > 0 ? comments.length : post.commentsCount}
            </Text>
          </Pressable>
          <Pressable className="flex-row items-center gap-1">
            <Ionicons name="share-social-outline" size={16} color="#16a34a" />
            <Text className="text-sm font-bold text-foreground">{post.sharesCount ?? 0}</Text>
          </Pressable>
        </View>
      </View>

      {isCommentOpen ? (
        <View className="mt-3 gap-2 border-t border-border/60 pt-3">
          {isLoadingComments && comments.length === 0 ? (
            <View className="gap-2">
              <View className="rounded-xl bg-muted/50 px-3 py-2">
                <View className="h-2.5 w-20 rounded bg-muted/70" />
                <View className="mt-2 h-3 w-4/5 rounded bg-muted/60" />
              </View>
              <View className="rounded-xl bg-muted/50 px-3 py-2">
                <View className="h-2.5 w-16 rounded bg-muted/70" />
                <View className="mt-2 h-3 w-2/3 rounded bg-muted/60" />
              </View>
            </View>
          ) : comments.length === 0 ? (
            <Text className="text-xs text-muted-foreground">Chưa có bình luận nào.</Text>
          ) : (
            <View className="gap-2">
              {comments.map((comment) => (
                <View key={comment.commentId} className="flex-row items-start gap-2">
                  <View className="size-7 items-center justify-center overflow-hidden rounded-full bg-muted/60">
                    {comment.author?.avatar ? (
                      <Image
                        source={{ uri: comment.author.avatar }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-[10px] font-bold text-muted-foreground">
                        {(comment.author?.displayName ?? comment.authorId)
                          .charAt(0)
                          .toUpperCase() || "U"}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="rounded-xl bg-muted/50 px-3 py-2">
                      <Text className="text-xs font-semibold text-foreground/80">
                        {comment.author?.displayName ?? comment.authorId}
                      </Text>
                      <Text className="text-sm text-foreground">{comment.content}</Text>
                    </View>
                    <View className="mt-1 flex-row items-center gap-3 px-1">
                      <Text className="text-[11px] text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </Text>
                      <Pressable>
                        <Text className="text-[11px] font-semibold text-muted-foreground">
                          Thích
                        </Text>
                      </Pressable>
                      <Pressable>
                        <Text className="text-[11px] font-semibold text-muted-foreground">
                          Trả lời
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
              {hasMoreComments ? (
                <Pressable
                  onPress={() => void loadCommentPage(nextCursor, true)}
                  disabled={isLoadingMoreComments}
                  className="self-start px-1 py-1 disabled:opacity-60"
                >
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {isLoadingMoreComments ? "Đang tải..." : "Xem thêm bình luận"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View className="flex-row items-start gap-2">
            <View className="size-8 items-center justify-center overflow-hidden rounded-full bg-muted/40">
              {commentAuthorAvatar ? (
                <Image
                  source={{ uri: commentAuthorAvatar }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-xs font-bold text-muted-foreground">
                  {commentAuthorInitial}
                </Text>
              )}
            </View>
            <View className="flex-1 gap-2 rounded-2xl border border-border/60 bg-background p-2.5">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Viết bình luận..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => {
                  void submitComment();
                }}
                className="min-h-[72px] rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground"
              />
              <View className="flex-row items-center justify-between border-t border-border/50 pt-2">
                <View className="flex-row items-center gap-1">
                  <Pressable className="rounded-lg p-1.5">
                    <Ionicons name="happy-outline" size={16} color="#f59e0b" />
                  </Pressable>
                  <Pressable className="rounded-lg p-1.5">
                    <Ionicons name="image-outline" size={16} color="#16a34a" />
                  </Pressable>
                </View>
                <Pressable
                  disabled={isAddingComment || commentText.trim().length === 0}
                  onPress={submitComment}
                  className="flex-row items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 disabled:opacity-60"
                >
                  <Ionicons name="send" size={13} color="#fff" />
                  <Text className="text-xs font-bold text-white">Gửi</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};
