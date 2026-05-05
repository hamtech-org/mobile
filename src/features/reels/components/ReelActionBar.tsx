import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useReactToReelMutation, useToggleSaveReelMutation } from "@/store/api/newsfeedApi";
import type { ReactionType } from "@/types/reaction.types";
import type { IReel } from "@/types/newsfeed.types";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  reel: IReel;
  onOpenComments: () => void;
}

/** Tổng reactions từ reactionsCount map */
function totalReactions(counts: Partial<Record<ReactionType, number>>): number {
  return Object.values(counts).reduce((acc, v) => acc + (v ?? 0), 0);
}

/** Format số lớn: 1200 → 1.2K */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface ActionItem {
  icon: IoniconsName;
  label: string;
  count: string;
  color: string;
  onPress: (() => void) | undefined;
}

/**
 * Cột action bên phải reel (TikTok-style) cho mobile.
 * ❤️ Like, 💬 Comment, 🔖 Save, 👁 Views
 */
export const ReelActionBar = ({ reel, onOpenComments }: Props) => {
  const [reactToReel] = useReactToReelMutation();
  const [toggleSave] = useToggleSaveReelMutation();

  const [liked, setLiked] = useState<ReactionType | null>(reel.currentUserReaction ?? null);
  const [likeCount, setLikeCount] = useState(totalReactions(reel.reactionsCount));
  const [saved, setSaved] = useState(reel.isSaved ?? false);
  const [saveCount, setSaveCount] = useState(reel.savesCount);

  const handleLike = useCallback(async () => {
    const prevLiked = liked;
    const prevCount = likeCount;

    if (liked) {
      setLiked(null);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      setLiked("like");
      setLikeCount((c) => c + 1);
    }

    try {
      await reactToReel({ reelId: reel.reelId, type: "like" }).unwrap();
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  }, [liked, likeCount, reel.reelId, reactToReel]);

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

  const actions: ActionItem[] = [
    {
      icon: liked ? "heart" : "heart-outline",
      label: "Thích",
      count: formatCount(likeCount),
      color: liked ? "#EF4444" : "#fff",
      onPress: handleLike,
    },
    {
      icon: "chatbubble-ellipses-outline",
      label: "Bình luận",
      count: formatCount(reel.commentsCount),
      color: "#fff",
      onPress: onOpenComments,
    },
    {
      icon: saved ? "bookmark" : "bookmark-outline",
      label: "Lưu",
      count: formatCount(saveCount),
      color: saved ? "#FACC15" : "#fff",
      onPress: handleSave,
    },
    {
      icon: "eye-outline",
      label: "Lượt xem",
      count: formatCount(reel.viewsCount),
      color: "rgba(255,255,255,0.6)",
      onPress: undefined,
    },
  ];

  return (
    <View className="absolute bottom-28 right-3 z-20 items-center gap-5">
      {/* Author avatar */}
      <Pressable className="mb-2">
        <View className="size-12 items-center justify-center rounded-full border-2 border-white bg-blue-600">
          <Text className="text-base font-bold text-white">
            {reel.author?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
      </Pressable>

      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          className="items-center gap-1"
          hitSlop={8}
          disabled={!action.onPress}
        >
          <View className="size-11 items-center justify-center rounded-full bg-black/30">
            <Ionicons name={action.icon} size={24} color={action.color} />
          </View>
          <Text className="text-xs font-semibold text-white">{action.count}</Text>
        </Pressable>
      ))}
    </View>
  );
};
