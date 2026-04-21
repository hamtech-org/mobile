import { useEffect } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type Edge = `${number}%` | number;

function DriftOrb({
  size,
  color,
  top,
  bottom,
  left,
  right,
  durationMs,
  rangeX,
  rangeY,
  delayMs = 0,
}: {
  size: number;
  color: string;
  top?: Edge;
  bottom?: Edge;
  left?: Edge;
  right?: Edge;
  durationMs: number;
  rangeX: number;
  rangeY: number;
  delayMs?: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: durationMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delayMs, durationMs, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-rangeX, rangeX]) },
      { translateY: interpolate(t.value, [0, 1], [rangeY, -rangeY]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top,
          bottom,
          left,
          right,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export const AuthAmbientBackground = () => {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const base = isDark ? "hsl(224 32% 11%)" : "hsl(210 35% 97%)";
  const orb = isDark ? "rgba(96, 165, 250, 0.055)" : "rgba(37, 99, 235, 0.065)";
  const orbSoft = isDark ? "rgba(125, 211, 252, 0.04)" : "rgba(59, 130, 246, 0.045)";

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: base }]} pointerEvents="none">
      <DriftOrb
        size={280}
        color={orb}
        top="-8%"
        left="-18%"
        durationMs={26000}
        rangeX={18}
        rangeY={14}
      />
      <DriftOrb
        size={220}
        color={orbSoft}
        top="38%"
        right="-22%"
        durationMs={30000}
        rangeX={14}
        rangeY={20}
        delayMs={800}
      />
      <DriftOrb
        size={200}
        color={orb}
        bottom="6%"
        left="-12%"
        durationMs={23000}
        rangeX={16}
        rangeY={12}
        delayMs={400}
      />
    </View>
  );
};
