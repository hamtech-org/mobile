import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import ImageViewing from "react-native-image-viewing";
import { Ionicons } from "@expo/vector-icons";
import type { IComment } from "@/types/newsfeed.types";
import type { ReactionType } from "@/types/reaction.types";
import {
  useReactToReelCommentMutation,
  useGetReelCommentRepliesQuery,
  useLazyGetReelCommentRepliesQuery,
} from "@/store/api/newsfeedApi";
import { ReactionButton } from "@/components/common/ReactionButton";
import { ReactionSummary } from "@/components/common/ReactionButton/ReactionSummary";
import { formatRelativeTime } from "@/utils/time";

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
  reelId: string;
  isNested?: boolean;
  onReply?: (commentId: string, authorName: string) => void;
}

export const ReelCommentItem = ({ comment, reelId, isNested = false, onReply }: Props) => {
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(
    comment.currentUserReaction ?? null,
  );
  const [localReactionsCount, setLocalReactionsCount] = useState(comment.reactionsCount || {});
  const [showReplies, setShowReplies] = useState(false);
  const [extraReplies, setExtraReplies] = useState<IComment[]>([]);
  const [replyNextCursor, setReplyNextCursor] = useState<string | null>(null);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [reactToReelComment] = useReactToReelCommentMutation();
  const { data: firstPageData, isLoading: isLoadingReplies } = useGetReelCommentRepliesQuery(
    { reelId, commentId: comment.commentId, cursor: null },
    { skip: !showReplies },
  );
  const [loadMoreReplies] = useLazyGetReelCommentRepliesQuery();

  // Reset extra pages when first page refetches (cache invalidated by new reply)
  useEffect(() => {
    setExtraReplies([]);
    setReplyNextCursor(firstPageData?.nextCursor ?? null);
    setHasMoreReplies(firstPageData?.hasMore ?? false);
  }, [firstPageData]);

  const replies = [...(firstPageData?.items ?? []), ...extraReplies];

  const authorName = comment.author?.displayName ?? comment.authorId;
  const authorAvatar = comment.author?.avatar ?? "";
  const totalReactions = Object.values(localReactionsCount).reduce((a, b) => a + (b || 0), 0);
  const mediaUrl = comment.mediaUrls?.[0];
  const isVideoMedia = !!mediaUrl && IS_VIDEO.test(mediaUrl);

  const handleLoadMoreReplies = async () => {
    if (!replyNextCursor) return;
    try {
      const page = await loadMoreReplies({
        reelId,
        commentId: comment.commentId,
        cursor: replyNextCursor,
      }).unwrap();
      setExtraReplies((prev) => [...prev, ...page.items]);
      setReplyNextCursor(page.nextCursor);
      setHasMoreReplies(page.hasMore);
    } catch {
      // no-op
    }
  };

  const handleToggleReplies = () => setShowReplies((prev) => !prev);

  const handleReact = (type: ReactionType | null) => {
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
    void reactToReelComment({ reelId, commentId: comment.commentId, type: serverType });
  };

  return (
    <View>
      <View style={s.row}>
        {/* Avatar */}
        <View
          className={`shrink-0 items-center justify-center overflow-hidden bg-muted ${isNested ? "h-6 w-6 rounded-full" : "h-8 w-8 rounded-full"}`}
        >
          {authorAvatar ? (
            <Image
              source={{ uri: authorAvatar }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <Text
              className={`font-bold text-muted-foreground ${isNested ? "text-[9px]" : "text-[12px]"}`}
            >
              {authorName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {/* Tên tác giả ngoài bubble */}
          <Text
            className={`mb-0.5 px-1 font-semibold text-foreground/90 ${isNested ? "text-[11px]" : "text-[13px]"}`}
          >
            {authorName}
          </Text>

          {/* Bubble */}
          {!!comment.content && (
            <View className="max-w-full self-start rounded-xl bg-muted px-3 py-2">
              <Text className="text-sm leading-5 text-foreground">{comment.content}</Text>
            </View>
          )}

          {/* Media */}
          {mediaUrl && (
            <Pressable onPress={() => setPreviewOpen(true)} style={s.mediaThumbnail}>
              {isVideoMedia ? (
                <>
                  <CommentVideoThumb uri={mediaUrl} />
                  <View style={s.playOverlay}>
                    <View style={s.playBtn}>
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
            <View style={s.videoModal}>
              <Pressable style={s.closeBtn} onPress={() => setPreviewOpen(false)}>
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
              {previewOpen && mediaUrl && <CommentVideoPlayer uri={mediaUrl} />}
            </View>
          </Modal>

          {/* Metadata row */}
          <View className="mt-1 flex-row items-center gap-3 px-1">
            <Text className="text-[11px] text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </Text>

            <View style={s.reactionRow}>
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
                  onReact={handleReact}
                />
              </View>
            </View>

            {!isNested && (
              <Pressable onPress={() => onReply?.(comment.commentId, authorName)}>
                <Ionicons
                  name="chatbubble-outline"
                  size={14}
                  color="hsl(var(--muted-foreground))"
                />
              </Pressable>
            )}
          </View>

          {/* "Xem N trả lời" toggle */}
          {!isNested && (comment.repliesCount ?? 0) > 0 && (
            <Pressable
              onPress={handleToggleReplies}
              className="mt-1 flex-row items-center gap-1.5 px-1"
            >
              {isLoadingReplies && <ActivityIndicator size={10} color="#60a5fa" />}
              <Text className="text-xs font-semibold text-blue-400">
                {showReplies ? "Ẩn trả lời" : `Xem ${comment.repliesCount} trả lời`}
              </Text>
            </Pressable>
          )}

          {/* Nested replies */}
          {!isNested && showReplies && replies.length > 0 && (
            <View style={{ marginTop: 8, gap: 8 }}>
              {replies.map((reply) => (
                <ReelCommentItem key={reply.commentId} comment={reply} reelId={reelId} isNested />
              ))}
              {hasMoreReplies && (
                <Pressable onPress={() => void handleLoadMoreReplies()} className="ml-9 py-1">
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

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  mediaThumbnail: { marginTop: 6, width: 200, height: 150, borderRadius: 12, overflow: "hidden" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBtn: { borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", padding: 10 },
  videoModal: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  closeBtn: {
    position: "absolute",
    right: 16,
    top: 48,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 999,
    padding: 8,
  },
  reactionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
});
