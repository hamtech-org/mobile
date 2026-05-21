import { Image, Pressable, Text, TextInput, View, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { IPost, IComment } from "@/types/newsfeed.types";
import type { RootState } from "@/store/store";
import type { ReactionType } from "@/types/reaction.types";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import { HashtagText } from "./HashtagText";
import { MediaGallery } from "./MediaGallery";
import {
  useLazyGetCommentsQuery,
  useReactToPostMutation,
  useDeletePostMutation,
  useToggleSavePostMutation,
} from "@/store/api/newsfeedApi";
import {
  usePinCommunityPostMutation,
  useUnpinCommunityPostMutation,
} from "@/store/api/communityApi";
import { CommentItem } from "./CommentItem";
import { CommentInput } from "./CommentInput";
import { SharedPostPreview } from "./SharedPostPreview";
import { SharePostModal } from "./SharePostModal";
import { formatRelativeTime } from "@/utils/time";
import { ReactionButton } from "@/components/common/ReactionButton";
import { ReactionSummary } from "@/components/common/ReactionButton/ReactionSummary";

interface Props {
  post: IPost;
  communityRole?: "owner" | "admin" | "moderator" | "member" | null;
}

export const FeedPostCard = ({ post, communityRole }: Props) => {
  const extractedText = extractTextFromTiptapJson(post.content);
  const displayName = post.author?.displayName ?? post.authorId;
  const avatar = post.author?.avatar ?? "";
  const initial = displayName.trim().charAt(0).toUpperCase();

  const [localReaction, setLocalReaction] = useState<ReactionType | null>(
    post.currentUserReaction ?? null,
  );
  const [localCounts, setLocalCounts] = useState(post.reactionsCount ?? {});

  useEffect(() => {
    setLocalReaction(post.currentUserReaction ?? null);
    setLocalCounts(post.reactionsCount ?? {});
  }, [post.currentUserReaction, post.reactionsCount]);

  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [comments, setComments] = useState<IComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [displayCommentsCount, setDisplayCommentsCount] = useState(post.commentsCount ?? 0);

  const [replyTo, setReplyTo] = useState<{ commentId: string; authorName: string } | null>(null);
  const [latestReplies, setLatestReplies] = useState<Record<string, IComment>>({});

  const commentInputRef = useRef<TextInput>(null);

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isOwner = currentUser?.userId === post.authorId;
  const commentAuthorName = currentUser?.displayName?.trim() || "Bạn";
  const commentAuthorAvatar = currentUser?.avatar || "";
  const commentAuthorInitial = commentAuthorName.charAt(0).toUpperCase() || "U";

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(post.isSaved ?? false);

  const [getCommentsPage] = useLazyGetCommentsQuery();
  const [reactToPost] = useReactToPostMutation();
  const [deletePost, { isLoading: isDeleting }] = useDeletePostMutation();
  const [toggleSavePost] = useToggleSavePostMutation();
  const [pinPost] = usePinCommunityPostMutation();
  const [unpinPost] = useUnpinCommunityPostMutation();

  const isModeratorOrAbove =
    communityRole === "owner" || communityRole === "admin" || communityRole === "moderator";

  const handlePinToggle = async () => {
    setIsMenuOpen(false);
    if (!post.groupId) return;
    try {
      if (post.isPinned) {
        await unpinPost({ groupId: post.groupId, postId: post.postId }).unwrap();
        Alert.alert("Thành công", "Đã bỏ ghim bài viết");
      } else {
        await pinPost({ groupId: post.groupId, postId: post.postId }).unwrap();
        Alert.alert("Thành công", "Đã ghim bài viết");
      }
    } catch (err: any) {
      Alert.alert("Thất bại", err?.data?.message || "Có lỗi xảy ra");
    }
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handlePostReact = (type: ReactionType | null) => {
    const serverType = type ?? localReaction;
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

  const loadCommentPage = async (cursor?: string | null, append = false) => {
    if (append) setIsLoadingMoreComments(true);
    else setIsLoadingComments(true);
    try {
      const page = await getCommentsPage({
        postId: post.postId,
        limit: 5,
        cursor: cursor ?? null,
      }).unwrap();
      if (append) setComments((prev) => [...prev, ...page.items]);
      else setComments(page.items);
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
        setReplyTo(null);
        setLatestReplies({});
      }
      return next;
    });
  };

  const handleStartReply = (commentId: string, authorName: string) => {
    setReplyTo({ commentId, authorName });
    commentInputRef.current?.focus();
  };

  const handleCommentSubmitted = (comment: IComment) => {
    setComments((prev) => [...prev, comment]);
    setDisplayCommentsCount((prev) => prev + 1);
  };

  const handleReplySubmitted = (parentId: string, reply: IComment) => {
    setLatestReplies((prev) => ({ ...prev, [parentId]: reply }));
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
      {post.isPinned && (
        <View className="mb-2 flex-row items-center gap-1.5 px-1">
          <Ionicons name="pin" size={14} color="#3b82f6" />
          <Text allowFontScaling={false} className="text-xs font-semibold text-blue-500">
            Được ghim bởi Quản trị viên
          </Text>
        </View>
      )}
      {/* Header */}
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

      {/* Content */}
      <View className="mt-3">
        <HashtagText text={extractedText.slice(0, 180) + (extractedText.length > 180 ? "…" : "")} />
        {post.sharedFrom && <SharedPostPreview sharedFrom={post.sharedFrom} />}
      </View>

      {!post.sharedFrom && <MediaGallery mediaUrls={post.mediaUrls} />}

      {/* Stats line */}
      {(Object.keys(localCounts).some((k) => (localCounts as Record<string, number>)[k] > 0) ||
        displayCommentsCount > 0 ||
        (post.sharesCount ?? 0) > 0) && (
        <View className="mt-2 flex-row items-center justify-between px-2">
          {Object.keys(localCounts).some((k) => (localCounts as Record<string, number>)[k] > 0) ? (
            <ReactionSummary summary={localCounts as any} size="sm" />
          ) : (
            <View />
          )}
          <View className="flex-row items-center gap-3">
            {(post.sharesCount ?? 0) > 0 && (
              <Text className="text-xs text-muted-foreground">{post.sharesCount} chia sẻ</Text>
            )}
            {displayCommentsCount > 0 && (
              <Pressable onPress={toggleCommentPanel}>
                <Text className="text-xs text-muted-foreground">
                  {displayCommentsCount} bình luận
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Action bar */}
      <View className="mt-2 h-11 flex-row items-center border-t border-slate-100">
        <ReactionButton size="md" currentUserReaction={localReaction} onReact={handlePostReact} />
        <View className="h-6 w-[1px] bg-slate-100" />
        <Pressable
          className="h-full flex-1 flex-row items-center justify-center gap-1.5 active:opacity-60"
          onPress={toggleCommentPanel}
        >
          <Ionicons name="chatbubble-outline" size={19} color="#64748b" />
          <Text allowFontScaling={false} className="text-[14px] font-semibold text-[#64748b]">
            Bình luận
          </Text>
        </Pressable>
        <View className="h-6 w-[1px] bg-slate-100" />
        <Pressable
          className="h-full flex-1 flex-row items-center justify-center active:opacity-60"
          onPress={() => setShareModalOpen(true)}
        >
          <Ionicons name="arrow-redo-outline" size={19} color="#64748b" />
          <Text
            allowFontScaling={false}
            className="ml-1.5 text-[14px] font-semibold text-[#64748b]"
          >
            Chia sẻ
          </Text>
        </Pressable>
      </View>

      {/* Comment panel */}
      {isCommentOpen && (
        <View className="mt-3 gap-3 border-t border-border/60 pt-3">
          {/* Comment list */}
          <View className="gap-2">
            {isLoadingComments && comments.length === 0 ? (
              <>
                {[0, 1].map((i) => (
                  <View key={i} className="flex-row items-start gap-2">
                    <View className="size-7 rounded-full bg-muted/60" />
                    <View className="flex-1 rounded-xl bg-muted/50 px-3 py-2">
                      <View className="h-2.5 w-20 rounded bg-muted/70" />
                      <View className="mt-2 h-3 w-4/5 rounded bg-muted/60" />
                    </View>
                  </View>
                ))}
              </>
            ) : comments.length === 0 ? (
              <Text className="py-2 text-center text-xs text-muted-foreground">
                Chưa có bình luận nào.
              </Text>
            ) : (
              <>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.commentId}
                    comment={comment}
                    postId={post.postId}
                    onReply={handleStartReply}
                    newReply={latestReplies[comment.commentId]}
                  />
                ))}
                {isLoadingMoreComments && (
                  <View className="gap-2 py-1">
                    {[0, 1].map((i) => (
                      <View key={i} className="flex-row items-start gap-2">
                        <View className="size-7 rounded-full bg-muted/60" />
                        <View className="flex-1 gap-1.5">
                          <View className="h-2.5 w-16 rounded bg-muted/60" />
                          <View className="h-8 rounded-xl bg-muted/50" style={{ width: "75%" }} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {hasMoreComments && !isLoadingMoreComments && (
                  <Pressable
                    onPress={() => void loadCommentPage(nextCursor, true)}
                    className="self-start px-1 py-1"
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">
                      Xem thêm bình luận
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Comment input */}
          <CommentInput
            ref={commentInputRef}
            postId={post.postId}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onCommentSubmitted={handleCommentSubmitted}
            onReplySubmitted={handleReplySubmitted}
            authorName={commentAuthorName}
            authorAvatar={commentAuthorAvatar}
            authorInitial={commentAuthorInitial}
          />
        </View>
      )}

      {/* Share modal */}
      <SharePostModal
        visible={shareModalOpen}
        post={post}
        onClose={() => setShareModalOpen(false)}
      />

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
                    const next = !isSaved;
                    setIsSaved(next);
                    void toggleSavePost(post.postId)
                      .unwrap()
                      .catch(() => setIsSaved(!next));
                  }}
                >
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={isSaved ? "#3b82f6" : "hsl(var(--foreground))"}
                  />
                  <Text
                    className={`text-base font-medium ${isSaved ? "text-blue-500" : "text-foreground"}`}
                  >
                    {isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                  </Text>
                </Pressable>
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
                  onPress={() => {
                    setIsMenuOpen(false);
                    const next = !isSaved;
                    setIsSaved(next);
                    void toggleSavePost(post.postId)
                      .unwrap()
                      .catch(() => setIsSaved(!next));
                  }}
                >
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={isSaved ? "#3b82f6" : "hsl(var(--muted-foreground))"}
                  />
                  <Text
                    className={`text-base font-medium ${isSaved ? "text-blue-500" : "text-muted-foreground"}`}
                  >
                    {isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                  </Text>
                </Pressable>
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
            {isModeratorOrAbove && post.groupId && (
              <Pressable
                className="flex-row items-center gap-3 border-t border-border/40 px-5 py-4 active:bg-muted"
                onPress={handlePinToggle}
              >
                <Ionicons name="pin" size={20} color="#3b82f6" />
                <Text className="text-base font-medium text-blue-500">
                  {post.isPinned ? "Bỏ ghim bài viết" : "Ghim bài viết"}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
