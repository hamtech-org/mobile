import { useEffect, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { BarChart2, CheckCircle2, ClipboardList, X } from "lucide-react-native";

import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useAppDispatch } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import {
  clearChatFrameBanner,
  type ChatFrameBanner as ChatFrameBannerData,
} from "@/store/slices/chatSlice";
import { formatConversationListActivityTime, formatTimestamp } from "@/utils/time";

interface ChatFrameBannerProps {
  banner: ChatFrameBannerData;
}

/**
 * Thông báo trong khung chat — đồng bộ web `ChatGroupFrameNoticeBar`
 * (poll cam, task xanh ClipboardList, tham gia xanh CheckCircle; không variant → primary).
 */
export function ChatFrameBanner({ banner }: ChatFrameBannerProps): ReactElement {
  const dispatch = useAppDispatch();
  const { muted } = useIconColors();
  const calendarNow = useCalendarNow();

  const v = banner.variant;
  const timeLabel =
    formatConversationListActivityTime(banner.atIso, calendarNow) ||
    formatTimestamp(banner.atIso) ||
    "";

  useEffect(() => {
    const t = setTimeout(() => dispatch(clearChatFrameBanner()), 8000);
    return () => clearTimeout(t);
  }, [banner.atIso, banner.message, banner.variant, dispatch]);

  if (!v) {
    return (
      <View className="mx-3 mb-1.5 flex-row items-start gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {timeLabel ? `Cập nhật · ${timeLabel}` : "Cập nhật"}
          </Text>
          <Text
            className="mt-1 text-[13px] font-semibold leading-snug text-foreground"
            numberOfLines={4}
          >
            {banner.message}
          </Text>
        </View>
        <Pressable
          onPress={() => dispatch(clearChatFrameBanner())}
          hitSlop={10}
          className="rounded-full p-0.5 active:bg-primary/15"
          accessibilityLabel="Đóng thông báo"
        >
          <X size={18} color={muted} strokeWidth={2} />
        </Pressable>
      </View>
    );
  }

  const theme =
    v === "task_joined"
      ? {
          wrap: "border-emerald-200/70 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20",
          main: "text-emerald-900 dark:text-emerald-50",
          sub: "text-emerald-900/60 dark:text-emerald-50/70",
          iconColor: "#047857",
          icon: <CheckCircle2 size={16} color="#047857" strokeWidth={2} />,
        }
      : v === "poll"
        ? {
            wrap: "border-orange-200/70 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-900/20",
            main: "text-orange-950 dark:text-orange-50",
            sub: "text-orange-950/60 dark:text-orange-50/70",
            iconColor: "#c2410c",
            icon: <BarChart2 size={16} color="#c2410c" strokeWidth={2} />,
          }
        : {
            wrap: "border-blue-200/70 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20",
            main: "text-blue-950 dark:text-blue-50",
            sub: "text-blue-950/60 dark:text-blue-50/70",
            iconColor: "#1d4ed8",
            icon: <ClipboardList size={16} color="#1d4ed8" strokeWidth={2} />,
          };

  return (
    <View className={`mx-3 mb-1.5 rounded-xl border px-3 py-2.5 ${theme.wrap}`}>
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
          className="rounded-md p-1 active:bg-black/5 dark:active:bg-white/10"
          accessibilityLabel="Đóng thông báo"
        >
          <X size={16} color={theme.iconColor} strokeWidth={2} />
        </Pressable>
      </View>
      {timeLabel ? (
        <Text className={`mt-0.5 pl-6 text-[11px] font-semibold ${theme.sub}`}>{timeLabel}</Text>
      ) : null}
    </View>
  );
}
