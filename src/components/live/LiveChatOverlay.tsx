import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { LiveChatLine } from "@/components/live/LiveChatPanel";

type Props = {
  messages: LiveChatLine[];
  keyboardOffset: number;
  visible?: boolean;
};

const COLLAPSED_COUNT = 5;
const COLLAPSED_H = 220;
const EXPANDED_H = 420;

function initials(name: string): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

const ChatRow = ({ item, faded }: { item: LiveChatLine; faded: boolean }) => {
  const avatarUrl = item.avatar ?? null;
  return (
    <View style={[s.row, faded ? s.rowFaded : null]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
      ) : (
        <View style={s.avatarFallback}>
          <Text style={s.avatarText}>{initials(item.displayName)}</Text>
        </View>
      )}
      <View style={s.rowText}>
        <Text style={s.meta} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={s.msg} numberOfLines={2}>
          {item.text}
        </Text>
      </View>
    </View>
  );
};

export const LiveChatOverlay = ({ messages, keyboardOffset, visible = true }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const height = useSharedValue(COLLAPSED_H);

  const data = useMemo(() => {
    if (expanded) return messages;
    return messages.slice(-COLLAPSED_COUNT);
  }, [expanded, messages]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onEnd((e) => {
          if (e.translationY < -24) {
            setExpanded(true);
          } else if (e.translationY > 24) {
            setExpanded(false);
          }
        })
        .enabled(visible),
    [visible],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const target = expanded ? EXPANDED_H : COLLAPSED_H;
    // keep animation in sync with JS state changes
    if (height.value !== target) {
      height.value = withTiming(target, { duration: 220 });
    }
    return {
      height: height.value,
      transform: [{ translateY: -keyboardOffset }],
      opacity: visible ? 1 : 0,
    };
  }, [expanded, keyboardOffset, visible]);

  if (!visible) return null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.container, animatedStyle]}>
        {expanded ? (
          <View style={s.header}>
            <Text style={s.headerTitle}>Chat</Text>
            <Pressable onPress={() => setExpanded(false)} hitSlop={8}>
              <Text style={s.headerAction}>Thu gọn</Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          data={data}
          keyExtractor={(item, i) => `${item.sentAt}-${item.userId}-${i}`}
          contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const faded = !expanded && index < Math.max(0, data.length - 2);
            return <ChatRow item={item} faded={faded} />;
          }}
        />
      </Animated.View>
    </GestureDetector>
  );
};

const s = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 88,
    bottom: 74,
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  header: {
    paddingTop: 10,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
  },
  headerAction: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 2,
  },
  rowFaded: {
    opacity: 0.55,
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.86)",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.78)",
  },
  msg: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255,255,255,0.92)",
  },
});
