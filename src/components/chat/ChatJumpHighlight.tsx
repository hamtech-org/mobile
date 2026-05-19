import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const HIGHLIGHT_BLUE = "rgba(59, 130, 246, 1)";
const HIGHLIGHT_GLOW = "rgba(59, 130, 246, 0.35)";

/** Animation nhảy tới tin — khớp web `.chat-msg-jump-flash` (~2.1s). */
export function useChatJumpHighlightPulse(active: boolean): {
  borderColor: Animated.AnimatedInterpolation<string>;
  shadowOpacity: Animated.AnimatedInterpolation<number>;
} {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 2100,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const borderColor = progress.interpolate({
    inputRange: [0, 0.2, 0.55, 1],
    outputRange: [
      "rgba(59,130,246,0)",
      HIGHLIGHT_BLUE,
      "rgba(59,130,246,0.55)",
      "rgba(59,130,246,0)",
    ],
  });

  const shadowOpacity = progress.interpolate({
    inputRange: [0, 0.2, 0.55, 1],
    outputRange: [0, 0.45, 0.18, 0],
  });

  return { borderColor, shadowOpacity };
}

type ChatJumpHighlightWrapProps = {
  active: boolean;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Bọc khối bubble/media — viền + glow pulse, không padding ngoài. */
export function ChatJumpHighlightWrap({
  active,
  borderRadius = 12,
  style,
  children,
}: ChatJumpHighlightWrapProps): ReactElement {
  const { borderColor, shadowOpacity } = useChatJumpHighlightPulse(active);

  if (!active) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={style}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth: 2,
            borderColor,
            shadowColor: HIGHLIGHT_GLOW,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 14,
            shadowOpacity,
            elevation: 4,
          },
        ]}
      />
    </View>
  );
}
