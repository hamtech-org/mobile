import { Pressable, StyleSheet, Text, View } from "react-native";

interface ChatMessageReactionsOverlayProps {
  reactions: Record<string, string[]>;
  isOwn: boolean;
  viewerUserId?: string | null;
  onReact?: (emoji: string) => void;
}

/** Chip cảm xúc nổi cạnh bubble media — khớp web. */
export function ChatMessageReactionsOverlay({
  reactions,
  isOwn,
  viewerUserId,
  onReact,
}: ChatMessageReactionsOverlayProps) {
  const entries = Object.entries(reactions);
  if (entries.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, isOwn ? styles.wrapOwn : styles.wrapOther]}>
      {entries.map(([emoji, userIds]) => {
        const mine = viewerUserId ? userIds.includes(viewerUserId) : false;
        const chip = (
          <View style={[styles.chip, mine ? styles.chipMine : styles.chipDefault]}>
            <Text style={styles.emoji}>{emoji}</Text>
            {userIds.length > 1 ? (
              <Text style={[styles.count, mine && styles.countMine]}>{userIds.length}</Text>
            ) : null}
          </View>
        );
        return onReact ? (
          <Pressable key={emoji} onPress={() => onReact(emoji)} hitSlop={4}>
            {chip}
          </Pressable>
        ) : (
          <View key={emoji}>{chip}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: -12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    zIndex: 10,
    maxWidth: "100%",
  },
  wrapOwn: {
    left: -4,
  },
  wrapOther: {
    right: -4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  chipDefault: {
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "#FFFFFF",
  },
  chipMine: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  emoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  count: {
    fontSize: 10,
    fontWeight: "600",
    color: "#65676B",
    marginLeft: 2,
  },
  countMine: {
    color: "#2563EB",
  },
});
