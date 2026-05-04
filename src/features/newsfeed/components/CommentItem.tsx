import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useState, useEffect, useRef } from "react";
import type { IComment } from "@/types/newsfeed.types";
import type { ReactionType } from "@/types/reaction.types";
import { useReactToCommentMutation, useLazyGetCommentRepliesQuery } from "@/store/api/newsfeedApi";
import { ReactionButton } from "@/components/common/ReactionButton";
import { ReactionSummary } from "@/components/common/ReactionButton/ReactionSummary";
import { HashtagText } from "./HashtagText";
import { formatRelativeTime } from "@/utils/time";

interface Props {
  comment: IComment;
  postId: string;
  isNested?: boolean;
  onReply?: (commentId: string, authorName: string) => void;
  newReply?: IComment;
}

export const CommentItem = ({ comment, postId, isNested = false, onReply, newReply }: Props) => {
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(
    comment.currentUserReaction ?? null,
  );
  const [localReactionsCount, setLocalReactionsCount] = useState(comment.reactionsCount || {});
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<IComment[]>([]);
  const [replyNextCursor, setReplyNextCursor] = useState<string | null>(null);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState(comment.repliesCount ?? 0);
  const addedReplyIds = useRef<Set<string>>(new Set());

  const [reactToComment] = useReactToCommentMutation();
  const [fetchReplies, { isLoading: isLoadingReplies }] = useLazyGetCommentRepliesQuery();

  // Thêm reply mới từ parent vào danh sách replies
  useEffect(() => {
    if (!newReply || addedReplyIds.current.has(newReply.commentId)) return;
    addedReplyIds.current.add(newReply.commentId);
    setReplies((prev) => [...prev, newReply]);
    setLocalRepliesCount((prev) => prev + 1);
    setShowReplies(true);
  }, [newReply]);

  const loadReplies = async (cursor?: string | null, append = false) => {
    try {
      const page = await fetchReplies({
        postId,
        commentId: comment.commentId,
        cursor: cursor ?? null,
      }).unwrap();
      setReplies((prev) => (append ? [...prev, ...page.items] : page.items));
      setReplyNextCursor(page.nextCursor);
      setHasMoreReplies(page.hasMore);
    } catch {
      // no-op
    }
  };

  const handleToggleReplies = async () => {
    if (!showReplies && replies.length === 0) {
      await loadReplies(null, false);
    }
    setShowReplies((prev) => !prev);
  };

  const authorName = comment.author?.displayName ?? comment.authorId;
  const authorAvatar = comment.author?.avatar ?? "";
  const totalReactions = Object.values(localReactionsCount).reduce((a, b) => a + (b || 0), 0);

  return (
    <View style={isNested ? { marginLeft: 36 } : undefined}>
      <View className="flex-row items-start gap-2">
        <View
          className={`items-center justify-center overflow-hidden rounded-full bg-muted/60 ${isNested ? "size-6" : "size-7"}`}
        >
          {authorAvatar ? (
            <Image source={{ uri: authorAvatar }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text
              className={`font-bold text-muted-foreground ${isNested ? "text-[9px]" : "text-[10px]"}`}
            >
              {authorName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View className="flex-1">
          <View className="rounded-xl bg-muted/50 px-3 py-2">
            <Text
              className={`font-semibold text-foreground/80 ${isNested ? "text-[11px]" : "text-xs"}`}
            >
              {authorName}
            </Text>
            <HashtagText text={comment.content} />
          </View>

          {/* Media attachments */}
          {comment.mediaUrls && comment.mediaUrls.length > 0 && (
            <View className="mt-1.5 flex-row flex-wrap gap-1.5">
              {comment.mediaUrls.map((url, idx) => (
                <Image
                  key={idx}
                  source={{ uri: url }}
                  className="size-20 rounded-lg"
                  resizeMode="cover"
                />
              ))}
            </View>
          )}

          <View className="mt-0.5 flex-row items-center gap-3 px-1">
            <Text className="text-[11px] text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </Text>

            <View className="flex-row items-center gap-1">
              {!localReaction && totalReactions > 0 && (
                <ReactionSummary
                  summary={localReactionsCount as Record<string, number>}
                  size="sm"
                />
              )}
              <View style={localReaction ? undefined : { width: 28, height: 24 }}>
                <ReactionButton
                  size="sm"
                  showLabel={false}
                  currentUserReaction={localReaction}
                  summary={
                    localReaction ? (localReactionsCount as Record<string, number>) : undefined
                  }
                  onReact={(type) => {
                    const prevReaction = localReaction;
                    const serverType = type ?? prevReaction;
                    if (!serverType) return;
                    const newCounts = { ...localReactionsCount };
                    if (prevReaction) {
                      newCounts[prevReaction] = Math.max(0, (newCounts[prevReaction] || 0) - 1);
                    }
                    if (type) {
                      newCounts[type] = (newCounts[type] || 0) + 1;
                    }
                    setLocalReaction(type);
                    setLocalReactionsCount(newCounts);
                    void reactToComment({
                      postId,
                      commentId: comment.commentId,
                      type: serverType,
                    });
                  }}
                />
              </View>
            </View>

            {!isNested && (
              <Pressable
                onPress={() => onReply?.(comment.commentId, authorName)}
                className="active:opacity-60"
              >
                <Text className="text-[11px] font-semibold text-muted-foreground">Trả lời</Text>
              </Pressable>
            )}
          </View>

          {!isNested && localRepliesCount > 0 && (
            <Pressable
              onPress={() => void handleToggleReplies()}
              className="mt-1 flex-row items-center gap-1.5 px-1"
            >
              {isLoadingReplies && <ActivityIndicator size={10} color="#3b82f6" />}
              <Text className="text-xs font-semibold text-blue-500">
                {showReplies ? "Ẩn trả lời" : `Xem ${localRepliesCount} trả lời`}
              </Text>
            </Pressable>
          )}

          {!isNested && showReplies && replies.length > 0 && (
            <View className="mt-2 gap-2">
              {replies.map((reply) => (
                <CommentItem key={reply.commentId} comment={reply} postId={postId} isNested />
              ))}
              {hasMoreReplies && (
                <Pressable
                  onPress={() => void loadReplies(replyNextCursor, true)}
                  style={{ marginLeft: 36 }}
                  className="px-1 py-0.5"
                >
                  <Text className="text-xs font-semibold text-muted-foreground">
                    Xem thêm trả lời
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
