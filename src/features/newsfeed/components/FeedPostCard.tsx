import { Image, Pressable, Text, TextInput, View, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { IPost } from "@/types/newsfeed.types";
import type { RootState } from "@/store/store";
import type { ReactionType } from "@/types/reaction.types";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import { HashtagText } from "./HashtagText";
import { MediaGallery } from "./MediaGallery";
import {
  useAddCommentMutation,
  useLazyGetCommentsQuery,
  useReactToPostMutation,
  useReactToCommentMutation,
  useDeletePostMutation,
} from "@/store/api/newsfeedApi";
import type { IComment } from "@/types/newsfeed.types";
import { formatRelativeTime } from "@/utils/time";
import { ReactionButton } from "@/components/common/ReactionButton";
import { ReactionSummary } from "@/components/common/ReactionButton/ReactionSummary";

interface Props {
  post: IPost;
}

export const FeedPostCard = ({ post }: Props) => {
  const extractedText = extractTextFromTiptapJson(post.content);
  const displayName = post.author?.displayName ?? post.authorId;
  const avatar = post.author?.avatar ?? "";
  const initial = displayName.trim().charAt(0).toUpperCase();

  // ── Reaction local state (for immediate UI updates) ──
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(
    post.currentUserReaction ?? null,
  );
  const [localCounts, setLocalCounts] = useState(post.reactionsCount ?? {});

  // Sync when prop changes (e.g. after refetch)
  useEffect(() => {
    setLocalReaction(post.currentUserReaction ?? null);
    setLocalCounts(post.reactionsCount ?? {});
  }, [post.currentUserReaction, post.reactionsCount]);

  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<IComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [displayCommentsCount, setDisplayCommentsCount] = useState(post.commentsCount ?? 0);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isOwner = currentUser?.userId === post.authorId;
  const commentAuthorName = currentUser?.displayName?.trim() || "Bạn";
  const commentAuthorAvatar = currentUser?.avatar || "";
  const commentAuthorInitial = commentAuthorName.charAt(0).toUpperCase() || "U";
  const [getCommentsPage] = useLazyGetCommentsQuery();
  const [addComment, { isLoading: isAddingComment }] = useAddCommentMutation();
  const [reactToPost] = useReactToPostMutation();
  const [reactToComment] = useReactToCommentMutation();
  const [deletePost, { isLoading: isDeleting }] = useDeletePostMutation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  // Post reaction handler: update local state immediately, then send to server
  const handlePostReact = (type: ReactionType | null) => {
    const serverType = type ?? localReaction; // unlike: send oldType to toggle off
    if (!serverType) return;
    const isToggleOff = localReaction === serverType;
    const newReaction = isToggleOff ? null : serverType;
    setLocalReaction(newReaction);
    setLocalCounts((prev) => {
      const next = { ...prev };
      if (localReaction) next[localReaction] = Math.max(0, (next[localReaction] ?? 1) - 1);
      if (!isToggleOff) next[serverType] = (next[serverType] ?? 0) + 1;
      return next;
    });
    void reactToPost({ postId: post.postId, type: serverType });
  };

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
        setComments((prev) => [...prev, ...page.items]);
      } else {
        setComments(page.items);
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
      if (created) {
        setComments((prev) => [...prev, created]);
        setDisplayCommentsCount((prev) => prev + 1);
      }
      setCommentText("");
    } catch {
      // no-op
    }
  };

  const handleDeletePost = () => {
    setIsMenuOpen(false);
    Alert.alert("Xóa bài viết?", "Bài viết này sẽ bị xóa vĩnh viễn. Bạn không thể hoàn tác.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(post.postId).unwrap();
          } catch {
            // Error handled by middleware
          }
        },
      },
    ]);
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
              {formatRelativeTime(post.createdAt)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setIsMenuOpen(true)}
          className="-mr-2 rounded-full p-2 active:bg-muted/40"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#64748b" />
        </Pressable>
      </View>
      <View className="mt-3">
        <HashtagText text={extractedText.slice(0, 180) + (extractedText.length > 180 ? "…" : "")} />
      </View>

      <MediaGallery mediaUrls={post.mediaUrls} />

      {/* ── Reaction count bar (shows above action bar when reactions exist) ── */}
      {Object.keys(localCounts).some((k) => (localCounts as Record<string, number>)[k] > 0) && (
        <View className="mt-2 px-2">
          <ReactionSummary summary={localCounts as any} size="sm" />
        </View>
      )}

      {/* ── Action bar: Thích | Bình luận | Chia sẻ ── */}
      <View className="mt-2 h-11 flex-row items-center border-t border-slate-100">
        {/* Thích */}
        <ReactionButton size="md" currentUserReaction={localReaction} onReact={handlePostReact} />

        {/* Divider */}
        <View className="h-6 w-[1px] bg-slate-100" />

        {/* Bình luận */}
        <Pressable
          className="h-full flex-1 flex-row items-center justify-center active:opacity-60"
          onPress={toggleCommentPanel}
        >
          <Ionicons name="chatbubble-outline" size={19} color="#64748b" />
          <Text
            allowFontScaling={false}
            className="ml-1.5 text-[14px] font-semibold text-[#64748b]"
          >
            Bình luận
          </Text>
        </Pressable>

        {/* Divider */}
        <View className="h-6 w-[1px] bg-slate-100" />

        {/* Chia sẻ */}
        <Pressable className="h-full flex-1 flex-row items-center justify-center active:opacity-60">
          <Ionicons name="arrow-redo-outline" size={19} color="#64748b" />
          <Text
            allowFontScaling={false}
            className="ml-1.5 text-[14px] font-semibold text-[#64748b]"
          >
            Chia sẻ
          </Text>
        </Pressable>
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
            <Text className="py-2 text-center text-xs text-muted-foreground">
              Chưa có bình luận nào.
            </Text>
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
                      <HashtagText text={comment.content} />
                    </View>
                    <View className="mt-1 flex-row items-center gap-3 px-1">
                      <Text className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(comment.createdAt)}
                      </Text>
                      <View className="z-10 flex-row items-center gap-1">
                        <ReactionButton
                          size="sm"
                          showLabel={false}
                          currentUserReaction={comment.currentUserReaction}
                          onReact={(type) => {
                            const serverType = type ?? comment.currentUserReaction;
                            if (!serverType) return;
                            void reactToComment({
                              postId: post.postId,
                              commentId: comment.commentId,
                              type: serverType,
                            });
                          }}
                        />
                        {Object.keys(comment.reactionsCount || {}).length > 0 && (
                          <ReactionSummary summary={comment.reactionsCount as any} size="sm" />
                        )}
                      </View>
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

      {/* Menu Modal */}
      <Modal visible={isMenuOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 items-center justify-center bg-black/20"
          onPress={() => setIsMenuOpen(false)}
        >
          <Pressable
            className="w-4/5 overflow-hidden rounded-2xl border border-border/40 bg-background shadow-lg"
            onPress={(e) => e.stopPropagation()}
          >
            {isOwner ? (
              <>
                <Pressable
                  className="flex-row items-center gap-3 border-b border-border/40 px-5 py-4 active:bg-muted"
                  onPress={() => {
                    setIsMenuOpen(false);
                    router.push(`/(main)/(newsfeed)/editor/${post.postId}`);
                  }}
                >
                  <Ionicons name="pencil" size={20} color="hsl(var(--foreground))" />
                  <Text className="text-base font-medium text-foreground">Chỉnh sửa bài viết</Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center gap-3 px-5 py-4 active:bg-muted"
                  onPress={handleDeletePost}
                  disabled={isDeleting}
                >
                  <Ionicons name="trash" size={20} color="#ef4444" />
                  <Text className="text-base font-medium text-red-500">
                    {isDeleting ? "Đang xóa..." : "Xóa bài viết"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  className="flex-row items-center gap-3 border-b border-border/40 px-5 py-4 active:bg-muted"
                  onPress={() => setIsMenuOpen(false)}
                >
                  <Ionicons name="flag" size={20} color="hsl(var(--muted-foreground))" />
                  <Text className="text-base font-medium text-muted-foreground">Báo cáo</Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center gap-3 px-5 py-4 active:bg-muted"
                  onPress={() => setIsMenuOpen(false)}
                >
                  <Ionicons name="eye-off" size={20} color="hsl(var(--muted-foreground))" />
                  <Text className="text-base font-medium text-muted-foreground">Ẩn bài viết</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
