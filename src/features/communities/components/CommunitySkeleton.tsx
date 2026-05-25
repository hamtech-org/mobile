import { useEffect, useMemo } from "react";
import { Animated, View } from "react-native";

export function CommunitySkeleton() {
  const opacity = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="flex-row items-center rounded-2xl border border-border bg-card p-3"
    >
      <View className="size-12 rounded-full bg-muted" />
      <View className="ml-3 min-w-0 flex-1 gap-2">
        <View className="h-4 w-1/2 rounded bg-muted" />
        <View className="h-3.5 w-3/4 rounded bg-muted" />
        <View className="h-3 w-1/3 rounded bg-muted" />
      </View>
      <View className="ml-2 h-5 w-12 rounded-full bg-muted" />
    </Animated.View>
  );
}
