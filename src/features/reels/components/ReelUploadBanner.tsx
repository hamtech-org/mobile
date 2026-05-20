import { useEffect } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

import type { RootState } from "@/store/store";
import { resetUpload } from "@/store/slices/reelUploadSlice";
import { store } from "@/store/store";

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
  const barColor = status === "uploading" ? "#3b82f6" : status === "done" ? "#22c55e" : "#ef4444";
  const bg = isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)";
  const textColor = isDark ? "#e2e8f0" : "#0f172a";
  const trackBg = isDark ? "#334155" : "#e2e8f0";

  const label =
    status === "uploading"
      ? pct < 100
        ? `Đang tải reel lên... ${pct}%`
        : "Đang xử lý reel..."
      : status === "done"
        ? "Reel đã được đăng!"
        : `Đăng thất bại: ${error ?? "lỗi không xác định"}`;

  return (
    // Outer wrapper: full width anchor, no background, passes touches through
    <View
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        // Leave right-4 + size-10 = 56px clear for create-reel button on reels screen
        right: 64,
        zIndex: 50,
      }}
      pointerEvents="box-none"
    >
      {/* Pill */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: bg,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 7,
          gap: 7,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
          overflow: "hidden",
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: barColor }} />
        <Text style={{ fontSize: 12, fontWeight: "500", color: textColor }}>{label}</Text>
        {status !== "uploading" && (
          <Pressable onPress={() => store.dispatch(resetUpload())} hitSlop={10}>
            <Text style={{ fontSize: 11, color: barColor, fontWeight: "700" }}>✕</Text>
          </Pressable>
        )}
        {/* Thin progress bar at bottom of pill */}
        {status === "uploading" && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: trackBg,
            }}
          >
            <View style={{ height: 2, width: `${pct}%`, backgroundColor: barColor }} />
          </View>
        )}
      </View>
    </View>
  );
}
