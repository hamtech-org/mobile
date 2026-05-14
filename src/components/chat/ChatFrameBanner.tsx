import { useEffect, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { BarChart2, CheckCircle2, ClipboardList, X } from "lucide-react-native";

import { useAppDispatch } from "@/hooks/useAppStore";
import {
  clearChatFrameBanner,
  type ChatFrameBanner as ChatFrameBannerData,
} from "@/store/slices/chatSlice";
import { formatTimestamp } from "@/utils/time";

interface ChatFrameBannerProps {
  banner: ChatFrameBannerData;
}

/**
 * Thông báo trong khung chat nhóm — khớp web `ChatGroupFrameNoticeBar.tsx`
 * (variant mặc định `task_assigned`, chỉ giờ HH:mm ở dòng phụ, border-t + nền /90).
 */
export function ChatFrameBanner({ banner }: ChatFrameBannerProps): ReactElement {
  const dispatch = useAppDispatch();
  const v = banner.variant ?? "task_assigned";
  const at = banner.atIso?.trim();
  const timeLabel = at && !Number.isNaN(new Date(at).getTime()) ? formatTimestamp(at) : "";

  useEffect(() => {
    const t = setTimeout(() => dispatch(clearChatFrameBanner()), 7000);
    return () => clearTimeout(t);
  }, [banner.atIso, banner.message, banner.variant, dispatch]);

  const theme =
    v === "task_joined"
      ? {
          wrap: "border-emerald-200/70 bg-emerald-50/90 dark:border-emerald-800/60 dark:bg-emerald-900/20",
          main: "text-emerald-900 dark:text-emerald-50",
          sub: "text-emerald-900/60 dark:text-emerald-50/70",
          icon: <CheckCircle2 size={16} color="#047857" strokeWidth={2} />,
          closeIcon: "#047857",
        }
      : v === "poll"
        ? {
            wrap: "border-orange-200/70 bg-orange-50/90 dark:border-orange-800/60 dark:bg-orange-900/20",
            main: "text-orange-950 dark:text-orange-50",
            sub: "text-orange-950/60 dark:text-orange-50/70",
            icon: <BarChart2 size={16} color="#431407" strokeWidth={2} />,
            closeIcon: "#9a3412",
          }
        : {
            wrap: "border-blue-200/70 bg-blue-50/90 dark:border-blue-800/60 dark:bg-blue-900/20",
            main: "text-blue-950 dark:text-blue-50",
            sub: "text-blue-950/60 dark:text-blue-50/70",
            icon: <ClipboardList size={16} color="#1e40af" strokeWidth={2} />,
            closeIcon: "#1d4ed8",
          };

  return (
    <View
      className={`relative w-full shrink-0 border-t px-3 py-2 ${theme.wrap}`}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
    >
      <View className="flex-row items-start gap-2">
        <View className="mt-[1px]">{theme.icon}</View>
        <Text
          className={`min-w-0 flex-1 text-left text-[12px] font-semibold leading-[18px] ${theme.main}`}
          numberOfLines={5}
        >
          {banner.message}
        </Text>
        <Pressable
          onPress={() => dispatch(clearChatFrameBanner())}
          hitSlop={10}
          className="shrink-0 rounded-md p-1 active:bg-black/5 dark:active:bg-white/10"
          accessibilityLabel="Đóng thông báo"
        >
          <X size={16} color={theme.closeIcon} strokeWidth={2} />
        </Pressable>
      </View>
      {timeLabel ? (
        <Text className={`mt-0.5 pl-6 text-[11px] font-semibold ${theme.sub}`}>{timeLabel}</Text>
      ) : null}
    </View>
  );
}
