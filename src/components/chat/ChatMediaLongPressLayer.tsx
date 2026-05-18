import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

interface ChatMediaLongPressLayerProps {
  children: ReactNode;
  onLongPress?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Vùng phủ toàn bộ (video player). */
  fill?: boolean;
  accessibilityLabel?: string;
}

/**
 * Lớp bắt giữ tin — dùng trên video (che native player) và vùng file.
 * Chạm nhanh → `onPress`; giữ ~350ms → `onLongPress` (mở MessageActionSheet).
 */
export function ChatMediaLongPressLayer({
  children,
  onLongPress,
  onPress,
  style,
  fill = false,
  accessibilityLabel,
}: ChatMediaLongPressLayerProps) {
  if (!onLongPress && !onPress) {
    return <>{children}</>;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[fill && styles.fill, style]}
      accessibilityLabel={accessibilityLabel}
    >
      {fill ? null : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
});
