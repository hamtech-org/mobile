import { useCallback, useRef, useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThumbsUp } from "lucide-react-native";
import LottieView from "lottie-react-native";
import { EmojiPicker } from "@/components/common/ReactionButton/EmojiPicker";
import { useReactToReelMutation, useToggleSaveReelMutation } from "@/store/api/newsfeedApi";
import { REACTION_META } from "@/types/reaction.types";
import type { ReactionType } from "@/types/reaction.types";
import type { IReel } from "@/types/newsfeed.types";

interface Props {
  reel: IReel;
  onOpenComments: () => void;
  onOpenReport: () => void;
}

function totalReactions(counts: Partial<Record<ReactionType, number>>): number {
  return Object.values(counts).reduce((acc, v) => acc + (v ?? 0), 0);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const ReelActionBar = ({ reel, onOpenComments, onOpenReport }: Props) => {
  const [reactToReel] = useReactToReelMutation();
  const [toggleSave] = useToggleSaveReelMutation();

  const [liked, setLiked] = useState<ReactionType | null>(reel.currentUserReaction ?? null);
  const [likeCount, setLikeCount] = useState(totalReactions(reel.reactionsCount));
  const [saved, setSaved] = useState(reel.isSaved ?? false);
  const [saveCount, setSaveCount] = useState(reel.savesCount);
  const [moreVisible, setMoreVisible] = useState(false);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [anchorY, setAnchorY] = useState<number | undefined>(undefined);
  const [anchorX, setAnchorX] = useState<number | undefined>(undefined);
  const likeButtonRef = useRef<View>(null);

  const handleReact = useCallback(
    async (type: ReactionType) => {
      const prevLiked = liked;
      const prevCount = likeCount;
      setReactionPickerVisible(false);

      const toggling = type === liked;
      if (toggling) {
        setLiked(null);
        setLikeCount((c) => Math.max(0, c - 1));
      } else if (!liked) {
        setLiked(type);
        setLikeCount((c) => c + 1);
      } else {
        setLiked(type);
      }

      try {
        await reactToReel({ reelId: reel.reelId, type }).unwrap();
      } catch {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    },
    [liked, likeCount, reel.reelId, reactToReel],
  );

  const handleDefaultPress = useCallback(() => {
    void handleReact(liked ?? "like");
  }, [liked, handleReact]);

  const handleLongPress = useCallback(() => {
    likeButtonRef.current?.measureInWindow((x, y) => {
      setAnchorX(x);
      setAnchorY(y);
      setReactionPickerVisible(true);
    });
  }, []);

  const handleSave = useCallback(async () => {
    const prevSaved = saved;
    const prevCount = saveCount;

    setSaved((s) => !s);
    setSaveCount((c) => (saved ? Math.max(0, c - 1) : c + 1));

    try {
      await toggleSave(reel.reelId).unwrap();
    } catch {
      setSaved(prevSaved);
      setSaveCount(prevCount);
    }
  }, [saved, saveCount, reel.reelId, toggleSave]);

  const currentMeta = liked ? REACTION_META[liked] : null;

  return (
    <>
      <View className="absolute bottom-28 right-3 z-20 items-center gap-5">
        {/* Avatar */}
        <View className="relative mb-1 items-center">
          {reel.author?.avatar ? (
            <Image
              source={{ uri: reel.author.avatar }}
              className="size-12 rounded-full border-2 border-white/80"
            />
          ) : (
            <View className="size-12 items-center justify-center rounded-full border-2 border-white/80 bg-blue-600/80">
              <Text className="text-sm font-bold text-white">
                {reel.author?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View className="absolute -bottom-2 size-5 items-center justify-center rounded-full bg-blue-600">
            <Text className="text-xs font-bold text-white">+</Text>
          </View>
        </View>

        {/* Like — long press to open emoji picker */}
        <View ref={likeButtonRef} className="items-center">
          <Pressable
            onPress={handleDefaultPress}
            onLongPress={handleLongPress}
            delayLongPress={350}
            hitSlop={8}
            className="items-center gap-1"
          >
            {currentMeta ? (
              <LottieView
                source={currentMeta.lottie}
                autoPlay
                loop={false}
                style={{ width: 28, height: 28 }}
              />
            ) : (
              <ThumbsUp size={28} color="#fff" />
            )}
            <Text
              className="text-xs font-semibold"
              style={{ color: currentMeta ? currentMeta.color : "#fff" }}
            >
              {formatCount(likeCount)}
            </Text>
          </Pressable>
        </View>

        {/* Comment */}
        <Pressable onPress={onOpenComments} className="items-center gap-1" hitSlop={8}>
          <Ionicons name="chatbubble-ellipses-outline" size={28} color="#fff" />
          <Text className="text-xs font-semibold text-white">
            {formatCount(reel.commentsCount)}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable className="items-center gap-1" hitSlop={8}>
          <Ionicons name="arrow-redo-outline" size={28} color="#fff" />
          <Text className="text-xs font-semibold text-white">{formatCount(reel.sharesCount)}</Text>
        </Pressable>

        {/* More */}
        <Pressable onPress={() => setMoreVisible(true)} className="items-center" hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Emoji reaction picker */}
      <EmojiPicker
        isVisible={reactionPickerVisible}
        onReact={(type) => void handleReact(type)}
        onClose={() => setReactionPickerVisible(false)}
        anchorY={anchorY}
        anchorX={anchorX}
      />

      {/* More menu modal */}
      <Modal
        visible={moreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreVisible(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setMoreVisible(false)}>
          <Pressable
            className="rounded-t-2xl bg-neutral-900 px-4 pb-10 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/30" />

            <Pressable
              onPress={() => {
                void handleSave();
                setMoreVisible(false);
              }}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3.5 active:bg-white/10"
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={22}
                color={saved ? "#FACC15" : "#fff"}
              />
              <Text className="flex-1 text-[15px] font-medium text-white">
                {saved ? "Bỏ lưu" : "Lưu reel"}
              </Text>
              {saveCount > 0 && (
                <Text className="text-sm text-white/50">{formatCount(saveCount)}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setMoreVisible(false);
                onOpenReport();
              }}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3.5 active:bg-white/10"
            >
              <Ionicons name="flag-outline" size={22} color="#EF4444" />
              <Text className="text-[15px] font-medium text-red-400">Báo cáo</Text>
            </Pressable>

            <View className="flex-row items-center gap-3 px-3 py-3.5">
              <Ionicons name="eye-outline" size={22} color="rgba(255,255,255,0.5)" />
              <Text className="text-[15px] text-white/50">
                {formatCount(reel.viewsCount)} lượt xem
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
