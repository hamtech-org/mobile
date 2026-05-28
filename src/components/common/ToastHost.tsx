import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import {
  removeToast,
  type AppToastItem,
  type AppToastVariant,
} from "@/store/slices/notificationSlice";

const VARIANT: Record<AppToastVariant, { bg: string; border: string; text: string }> = {
  success: { bg: "#064E3B", border: "#34D399", text: "#ECFDF5" },
  error: { bg: "#7F1D1D", border: "#F87171", text: "#FEF2F2" },
  info: { bg: "#0C4A6E", border: "#38BDF8", text: "#F0F9FF" },
  warning: { bg: "#713F12", border: "#FBBF24", text: "#FFFBEB" },
};

function ToastRow({ item, onDismiss }: { item: AppToastItem; onDismiss: () => void }) {
  const c = VARIANT[item.variant];
  return (
    <Pressable
      onPress={onDismiss}
      style={[styles.row, { backgroundColor: c.bg, borderColor: c.border }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: c.text }]} numberOfLines={4}>
        {item.message}
      </Text>
    </Pressable>
  );
}

/**
 * Host toast toàn app — đặt trong root layout, phía trên Stack.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((s) => s.notification.toasts);

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
      {toasts.map((t) => (
        <ToastRow key={t.id} item={t} onDismiss={() => dispatch(removeToast(t.id))} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 99999,
    gap: 8,
  },
  row: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
