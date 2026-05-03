import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { IReactionSummary, REACTION_META } from "@/types/reaction.types";

interface ReactionSummaryProps {
  summary?: IReactionSummary | Partial<Record<string, number>>;
  size?: "sm" | "md" | "lg";
}

export const ReactionSummary: React.FC<ReactionSummaryProps> = ({ summary, size = "md" }) => {
  if (!summary) return null;

  let topEmojis: string[] = [];
  let total = 0;

  if ("counts" in summary && "total" in summary && "topReactions" in summary) {
    total = summary.total as number;
    topEmojis = (summary.topReactions as string[])
      .map((t) => REACTION_META[t as keyof typeof REACTION_META]?.emoji)
      .filter(Boolean);
  } else {
    const counts = summary as Record<string, number>;
    total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    topEmojis = Object.entries(counts)
      .filter(([, v]) => (v || 0) > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k]) => REACTION_META[k as keyof typeof REACTION_META]?.emoji)
      .filter(Boolean);
  }

  if (total === 0) return null;

  return (
    <View style={[styles.container, size === "sm" && styles.containerSm]}>
      <View style={styles.emojis}>
        {topEmojis.map((emoji, idx) => (
          <View
            key={idx}
            style={[styles.emojiBg, { zIndex: 10 - idx }, size === "sm" && styles.emojiBgSm]}
          >
            <Text style={[styles.emojiText, size === "sm" && styles.emojiTextSm]}>{emoji}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.totalText, size === "sm" && styles.totalTextSm]}>{total}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "transparent", // Đảm bảo luôn trong suốt
  },
  containerSm: {
    backgroundColor: "transparent",
  },
  emojis: {
    flexDirection: "row",
    backgroundColor: "transparent",
  },
  emojiBg: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    backgroundColor: "transparent",
    borderWidth: 0, // Xóa bỏ hoàn toàn border
    elevation: 0, // Xóa bóng trên Android
    shadowOpacity: 0, // Xóa bóng trên iOS
  },
  emojiBgSm: {
    width: 18,
    height: 18,
    marginLeft: -4,
  },
  emojiText: {
    fontSize: 12,
  },
  emojiTextSm: {
    fontSize: 10,
  },
  totalText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
    marginLeft: 2,
  },
  totalTextSm: {
    fontSize: 11,
    fontWeight: "600",
  },
});
