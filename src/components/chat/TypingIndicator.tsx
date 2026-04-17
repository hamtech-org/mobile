import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

import type { TypingUserEntry } from "@/types/chat.types";

interface TypingIndicatorProps {
  typingUsers: TypingUserEntry[];
  currentUserId: string;
}

/**
 * TypingIndicator — hiện "Tên đang gõ..." với animated dots.
 * Render phía trên input bar khi có người đang gõ.
 */
export const TypingIndicator = ({
  typingUsers,
  currentUserId,
}: TypingIndicatorProps) => {
  // Lọc bỏ chính mình
  const others = typingUsers.filter((u) => u.userId !== currentUserId);

  if (others.length === 0) return null;

  const label =
    others.length === 1
      ? `${others[0].displayName || "Ai đó"} đang gõ`
      : others.length === 2
        ? `${others[0].displayName || "Ai đó"} và ${others[1].displayName || "ai đó"} đang gõ`
        : `${others.length} người đang gõ`;

  return (
    <View className="flex-row items-center gap-2 px-4 py-1.5">
      <AnimatedDots />
      <Text className="text-muted-foreground text-[12px] italic">
        {label}
      </Text>
    </View>
  );
};

// ── Animated Dots ───────────────────────────────────────────────────────

function AnimatedDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );

    const anim1 = createDotAnimation(dot1, 0);
    const anim2 = createDotAnimation(dot2, 200);
    const anim3 = createDotAnimation(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (animValue: Animated.Value) => ({
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#a1a1aa",
    opacity: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3],
        }),
      },
    ],
  });

  return (
    <View className="flex-row items-center gap-[3px]">
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}
