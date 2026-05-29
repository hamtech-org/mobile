import { useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";

import { useSocketContext } from "@/contexts/SocketContext";
import { REACTION_META } from "@/types/reaction.types";
import type { LiveReactionPayload, LiveReactionType } from "@/components/live/LiveChatPanel";

type ReactionItem = {
  id: string;
  type: LiveReactionType;
  x: number;
};

const ANIM_MS = 3500;

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const FloatingReaction = ({
  item,
  onDone,
}: {
  item: ReactionItem;
  onDone: (id: string) => void;
}) => {
  const { height } = Dimensions.get("window");
  const rise = useSharedValue(0);
  const opacity = useSharedValue(1);
  const drift = useSharedValue(0);

  useEffect(() => {
    const targetRise = -Math.max(180, height * 0.55);
    drift.value = randomBetween(-26, 26);
    rise.value = withTiming(targetRise, {
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(
      0,
      {
        duration: ANIM_MS,
        easing: Easing.in(Easing.quad),
      },
      (finished) => {
        if (finished) runOnJS(onDone)(item.id);
      },
    );
  }, [drift, height, item.id, onDone, opacity, rise]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value }, { translateY: rise.value }, { scale: 1 }],
    opacity: opacity.value,
  }));

  const src = REACTION_META[item.type]?.lottie;
  if (!src) return null;

  return (
    <Animated.View style={[s.floating, { left: item.x }, style]}>
      <LottieView source={src} autoPlay loop={false} style={s.lottie} />
    </Animated.View>
  );
};

export const LiveFloatingReactions = ({ sessionId }: { sessionId: string }) => {
  const socket = useSocketContext();
  const [items, setItems] = useState<ReactionItem[]>([]);

  const usableSessionId = useMemo(() => sessionId.trim(), [sessionId]);

  useEffect(() => {
    if (!socket || !usableSessionId) return;

    const handler = (raw: unknown) => {
      const p = raw as LiveReactionPayload;
      if (!p?.sessionId || p.sessionId !== usableSessionId) return;
      const type = p.reactionType as LiveReactionType;
      if (!REACTION_META[type]) return;

      const w = Dimensions.get("window").width;
      const x = Math.max(16, Math.min(w - 56, randomBetween(16, w - 56)));
      setItems((prev) => [...prev.slice(-40), { id: randomId(), type, x }]);
    };

    socket.on("live:reaction", handler);
    return () => {
      socket.off("live:reaction", handler);
    };
  }, [socket, usableSessionId]);

  if (!usableSessionId) return null;

  return (
    <View pointerEvents="none" style={s.root}>
      {items.map((it) => (
        <FloatingReaction
          key={it.id}
          item={it}
          onDone={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
        />
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  floating: {
    position: "absolute",
    bottom: 84,
    width: 44,
    height: 44,
  },
  lottie: {
    width: 44,
    height: 44,
  },
});
