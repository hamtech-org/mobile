import likeLottie from "../assets/icons/emoji/like-thumb.json";
import loveLottie from "../assets/icons/emoji/love.json";
import hahaLottie from "../assets/icons/emoji/haha.json";
import wowLottie from "../assets/icons/emoji/wow.json";
import sadLottie from "../assets/icons/emoji/crying.json";
import angryLottie from "../assets/icons/emoji/angry.json";

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export interface IReaction {
  userId: string;
  type: ReactionType;
  createdAt: string;
}

export interface IReactionSummary {
  counts: Partial<Record<ReactionType, number>>;
  total: number;
  userReaction: ReactionType | null;
  topReactions: ReactionType[];
}

export const REACTION_META: Record<
  ReactionType,
  {
    emoji: string;
    label: string;
    color: string;
    lottie: any;
    gif: any;
  }
> = {
  like: { emoji: "👍", label: "Thích", color: "#1877F2", lottie: likeLottie, gif: likeLottie },
  love: {
    emoji: "❤️",
    label: "Yêu thích",
    color: "#F33E58",
    lottie: loveLottie,
    gif: loveLottie,
  },
  haha: { emoji: "😂", label: "Haha", color: "#F7B125", lottie: hahaLottie, gif: hahaLottie },
  wow: { emoji: "😮", label: "Wow", color: "#F7B125", lottie: wowLottie, gif: wowLottie },
  sad: { emoji: "😢", label: "Buồn", color: "#F7B125", lottie: sadLottie, gif: sadLottie },
  angry: {
    emoji: "😡",
    label: "Phẫn nộ",
    color: "#E9710F",
    lottie: angryLottie,
    gif: angryLottie,
  },
};
