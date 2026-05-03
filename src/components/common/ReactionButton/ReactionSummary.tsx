import React from "react";
import { View, Text, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import { IReactionSummary, REACTION_META } from "@/types/reaction.types";

interface ReactionSummaryProps {
  summary?: IReactionSummary | Partial<Record<string, number>>;
  size?: "sm" | "md" | "lg";
}

export const ReactionSummary: React.FC<ReactionSummaryProps> = ({ summary, size = "md" }) => {
  if (!summary) return null;

  let total = 0;
  let topLotties: object[];

  if ("counts" in summary && "total" in summary && "topReactions" in summary) {
    total = summary.total as number;
    topLotties = (summary.topReactions as string[])
      .map((t) => REACTION_META[t as keyof typeof REACTION_META]?.lottie)
      .filter(Boolean);
  } else {
    const counts = summary as Record<string, number>;
    total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    topLotties = Object.entries(counts)
      .filter(([, v]) => (v || 0) > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k]) => REACTION_META[k as keyof typeof REACTION_META]?.lottie)
      .filter(Boolean);
  }

  if (total === 0) return null;

  const bgSize = size === "sm" ? 18 : size === "lg" ? 28 : 24;
  const lottieSize = size === "sm" ? 18 : size === "lg" ? 28 : 24;
  const spacing = size === "sm" ? -4 : -8;

  return (
    <View style={styles.container}>
      <View style={styles.emojis}>
        {topLotties.map((lottie, idx) => (
          <View
            key={idx}
            style={[
              styles.emojiBg,
              {
                zIndex: 10 - idx,
                width: bgSize,
                height: bgSize,
                marginLeft: idx === 0 ? 0 : spacing,
              },
            ]}
          >
            <LottieView
              source={lottie}
              autoPlay={true}
              loop={false}
              style={{ width: lottieSize, height: lottieSize }}
            />
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
  },
  emojis: {
    flexDirection: "row",
    alignItems: "center",
  },
  emojiBg: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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
