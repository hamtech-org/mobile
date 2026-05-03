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

const gifUrl = (codepoint: string) =>
  `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/512.gif`;

export const REACTION_META: Record<
  ReactionType,
  {
    emoji: string;
    label: string;
    color: string;
    lottie: any;
    gif: string;
  }
> = {
  like: { emoji: "👍", label: "Thích", color: "#1877F2", lottie: likeLottie, gif: gifUrl("1f44d") },
  love: {
    emoji: "❤️",
    label: "Yêu thích",
    color: "#F33E58",
    lottie: loveLottie,
    gif: gifUrl("2764"),
  },
  haha: { emoji: "😂", label: "Haha", color: "#F7B125", lottie: hahaLottie, gif: gifUrl("1f602") },
  wow: { emoji: "😮", label: "Wow", color: "#F7B125", lottie: wowLottie, gif: gifUrl("1f62e") },
  sad: { emoji: "😢", label: "Buồn", color: "#F7B125", lottie: sadLottie, gif: gifUrl("1f622") },
  angry: {
    emoji: "😡",
    label: "Phẫn nộ",
    color: "#E9710F",
    lottie: angryLottie,
    gif: gifUrl("1f621"),
  },
};
