import { ActivityIndicator, Image, Modal, Pressable, Text, View } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { useVideoPlayer, VideoView } from "expo-video";
import ImageViewing from "react-native-image-viewing";
import { Ionicons } from "@expo/vector-icons";
import type { IComment } from "@/types/newsfeed.types";
import type { ReactionType } from "@/types/reaction.types";
import { useReactToCommentMutation, useLazyGetCommentRepliesQuery } from "@/store/api/newsfeedApi";
import { ReactionButton } from "@/components/common/ReactionButton";
import { ReactionSummary } from "@/components/common/ReactionButton/ReactionSummary";
import { HashtagText } from "./HashtagText";
import { formatRelativeTime } from "@/utils/time";
import { CommunityReportSheet } from "@/features/communities/components/CommunityReportSheet";

const IS_VIDEO = /\.(mp4|webm|ogg|mov)(\?|$)/i;

const CommentVideoThumb = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.pause();
  });
  return (
    <VideoView
      style={{ width: "100%", height: "100%" }}
      player={player}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

const CommentVideoPlayer = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      style={{ width: "100%", height: "100%" }}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};

interface Props {
  comment: IComment;
  postId: string;
  isNested?: boolean;
  onReply?: (commentId: string, authorName: string) => void;
  newReply?: IComment;
  groupId?: string;
}

export const CommentItem = ({
  comment,
  postId,
  isNested = false,
  onReply,
  newReply,
  groupId,
}: Props) => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(
    comment.currentUserReaction ?? null,
  );
  const [localReactionsCount, setLocalReactionsCount] = useState(comment.reactionsCount || {});
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<IComment[]>([]);
  const [replyNextCursor, setReplyNextCursor] = useState<string | null>(null);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState(comment.repliesCount ?? 0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
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
  const mediaUrl = comment.mediaUrls?.[0];
  const isVideoMedia = !!mediaUrl && IS_VIDEO.test(mediaUrl);

  return (
    <View>
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
          {/* Author name — ngoài bubble */}
          <Text
            className={`mb-0.5 px-1 font-semibold text-foreground/80 ${isNested ? "text-[11px]" : "text-xs"}`}
          >
            {authorName}
          </Text>

          {/* Bubble — chỉ render khi có text */}
          {!!comment.content && (
            <View className="self-start rounded-xl bg-muted/50 px-3 py-2">
              <HashtagText text={comment.content} />
            </View>
          )}

          {/* Media — thumbnail tappable + lightbox */}
          {mediaUrl && (
            <Pressable
              onPress={() => setPreviewOpen(true)}
              className="mt-1 overflow-hidden rounded-xl"
              style={{ width: 200, height: 150 }}
            >
              {isVideoMedia ? (
                <>
                  <CommentVideoThumb uri={mediaUrl} />
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="rounded-full bg-black/60 p-2.5">
                      <Ionicons name="play" size={20} color="white" style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                </>
              ) : (
                <Image
                  source={{ uri: mediaUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              )}
            </Pressable>
          )}

          {/* Image lightbox */}
          {mediaUrl && !isVideoMedia && (
            <ImageViewing
              images={[{ uri: mediaUrl }]}
              imageIndex={0}
              visible={previewOpen}
              onRequestClose={() => setPreviewOpen(false)}
              swipeToCloseEnabled
              doubleTapToZoomEnabled
            />
          )}

          {/* Video modal */}
          <Modal
            visible={previewOpen && isVideoMedia}
            animationType="fade"
            transparent
            onRequestClose={() => setPreviewOpen(false)}
          >
            <View className="flex-1 items-center justify-center bg-black">
              <Pressable
                className="absolute right-4 top-12 z-10 rounded-full bg-black/40 p-2"
                onPress={() => setPreviewOpen(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
              {previewOpen && mediaUrl && <CommentVideoPlayer uri={mediaUrl} />}
            </View>
          </Modal>

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
                <Ionicons
                  name="chatbubble-outline"
                  size={14}
                  color="hsl(var(--muted-foreground))"
                />
              </Pressable>
            )}

            {groupId && currentUser?.userId !== comment.authorId && (
              <Pressable onPress={() => setShowReportSheet(true)} className="active:opacity-60">
                <Ionicons name="flag-outline" size={14} color="hsl(var(--muted-foreground))" />
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
                <CommentItem
                  key={reply.commentId}
                  comment={reply}
                  postId={postId}
                  isNested
                  groupId={groupId}
                />
              ))}
              {hasMoreReplies && (
                <Pressable
                  onPress={() => void loadReplies(replyNextCursor, true)}
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
      {/* Community Report Sheet */}
      {groupId && (
        <CommunityReportSheet
          groupId={groupId}
          entityType="CMT"
          entityId={comment.commentId}
          postId={postId}
          createdAt={comment.createdAt}
          visible={showReportSheet}
          onClose={() => setShowReportSheet(false)}
        />
      )}
    </View>
  );
};
