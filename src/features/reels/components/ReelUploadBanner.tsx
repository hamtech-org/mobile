import { useEffect } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import type { RootState } from "@/store/store";
import { resetUpload } from "@/store/slices/reelUploadSlice";
import { store } from "@/store/store";

const TAB_BAR_HEIGHT = 60;

export function ReelUploadBanner() {
  const { status, progress, error } = useSelector((s: RootState) => s.reelUpload);
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    if (status !== "done") return;
    const timer = setTimeout(() => store.dispatch(resetUpload()), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === "idle") return null;

  const pct = Math.round(progress * 100);
  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT;

  const bg = isDark ? "#1e2433" : "#ffffff";
  const border = isDark ? "#2d3348" : "#e2e8f0";
  const textPrimary = isDark ? "#f1f5f9" : "#0f172a";
  const textMuted = isDark ? "#64748b" : "#94a3b8";
  const trackBg = isDark ? "#334155" : "#e2e8f0";

  const barColor = status === "uploading" ? "#3b82f6" : status === "done" ? "#22c55e" : "#ef4444";

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        backgroundColor: bg,
        borderTopWidth: 1,
        borderTopColor: border,
      }}
    >
      {/* Progress track */}
      <View style={{ height: 3, backgroundColor: trackBg }}>
        <View
          style={{
            height: 3,
            width: `${status === "uploading" ? pct : 100}%`,
            backgroundColor: barColor,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 10,
        }}
      >
        {/* Status dot */}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: barColor }} />

        {/* Message */}
        <Text style={{ flex: 1, fontSize: 13, fontWeight: "500", color: textPrimary }}>
          {status === "uploading"
            ? pct < 100
              ? `Đang tải reel lên... ${pct}%`
              : "Đang xử lý reel..."
            : status === "done"
              ? "Reel đã được đăng!"
              : `Đăng thất bại: ${error ?? "lỗi không xác định"}`}
        </Text>

        {status !== "uploading" && (
          <Pressable
            onPress={() => store.dispatch(resetUpload())}
            hitSlop={8}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: textMuted }}>Đóng</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
